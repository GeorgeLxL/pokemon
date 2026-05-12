import { db } from "./db";
import type { DeckFilter, CardFlatRow, CardRow, DeckStats, Deck } from "./types";

// ─── helpers ─────────────────────────────────────────────────────────────────

type Cond = { cardName: string; cardNumber: number; cardCondition: string };

function condToOperator(c: string): string {
  return c === "eql" ? "=" : c === "gte" ? ">=" : c === "lte" ? "<=" : "!=";
}

interface CardFilterSpec {
  groups: Cond[][]; // groups ORed; conds within a group ANDed
  standalone?: { name?: string; min?: number; max?: number };
}

async function fetchFilterSpec(filter: DeckFilter): Promise<CardFilterSpec | null> {
  const spec: CardFilterSpec = { groups: [] };

  if (filter.category && filter.category.trim() !== "") {
    const isExact = filter.category.includes("【");
    const sql = isExact
      ? `SELECT conds FROM deck_categories1 WHERE category1_var = ?`
      : `SELECT conds FROM deck_categories1 WHERE category1_var = ? OR category1_var LIKE ?`;
    const params = isExact ? [filter.category] : [filter.category, `${filter.category}%`];
    const [rows] = await db.query<any[]>(sql, params);
    for (const row of rows) {
      const conds: Cond[] = row?.conds ? JSON.parse(row.conds) : [];
      if (conds.length > 0) spec.groups.push(conds);
    }
  }

  const name = filter.cardName?.trim();
  const minS = filter.cardNumMin?.trim();
  const maxS = filter.cardNumMax?.trim();
  if (name || minS || maxS) {
    spec.standalone = {
      name: name || undefined,
      min: minS ? Number(minS) : undefined,
      max: maxS ? Number(maxS) : undefined,
    };
  }

  if (spec.groups.length === 0 && !spec.standalone) return null;
  return spec;
}

// Build a single scan over `cards` that returns the deck_ID_var values
// satisfying the (groups ORed, standalone ANDed) filter spec.
function buildQualifyingDecksQuery(spec: CardFilterSpec): { sql: string; params: any[] } {
  const params: any[] = [];
  const allNames = new Set<string>();
  for (const g of spec.groups) for (const c of g) allNames.add(c.cardName);
  if (spec.standalone?.name) allNames.add(spec.standalone.name);

  // If the standalone filter has count constraints but no name, we can't
  // pre-restrict by name in WHERE — we need every card row in the scan.
  const standaloneCountOnly =
    !!spec.standalone &&
    !spec.standalone.name &&
    (spec.standalone.min !== undefined || spec.standalone.max !== undefined);

  let whereSql = "";
  if (!standaloneCountOnly && allNames.size > 0) {
    const ph = [...allNames].map(() => "?").join(",");
    whereSql = `WHERE name_var IN (${ph})`;
    params.push(...allNames);
  }

  const groupExprs: string[] = [];
  for (const group of spec.groups) {
    const parts: string[] = [];
    for (const c of group) {
      const op = condToOperator(c.cardCondition);
      parts.push(`SUM(name_var = ? AND count_int ${op} ?) > 0`);
      params.push(c.cardName, c.cardNumber);
    }
    groupExprs.push(`(${parts.join(" AND ")})`);
  }

  let having = "";
  if (groupExprs.length > 0) having = `(${groupExprs.join(" OR ")})`;

  if (spec.standalone) {
    const sParts: string[] = [];
    if (spec.standalone.name) { sParts.push(`name_var = ?`); params.push(spec.standalone.name); }
    if (spec.standalone.min !== undefined) { sParts.push(`count_int >= ?`); params.push(spec.standalone.min); }
    if (spec.standalone.max !== undefined) { sParts.push(`count_int <= ?`); params.push(spec.standalone.max); }
    const sExpr = sParts.length > 0 ? `SUM(${sParts.join(" AND ")}) > 0` : `COUNT(*) > 0`;
    having = having ? `${having} AND ${sExpr}` : sExpr;
  }

  if (!having) having = "1=1";

  const sql = `SELECT deck_ID_var FROM cards ${whereSql} GROUP BY deck_ID_var HAVING ${having}`;
  return { sql, params };
}

function buildPrefClause(prefectures: string[] | undefined): { sql: string; params: any[] } {
  if (!prefectures?.length) return { sql: "", params: [] };
  return {
    sql: `AND e.event_prefecture IN (${prefectures.map(() => "?").join(",")})`,
    params: prefectures,
  };
}

function buildInClause(field: string, ids: string[] | null): { sql: string; params: any[] } {
  if (!ids || ids.length === 0) return { sql: "", params: [] };
  return {
    sql: `AND ${field} IN (${ids.map(() => "?").join(",")})`,
    params: ids,
  };
}

function groupCardRows(flat: CardFlatRow[]): CardRow[] {
  const map = new Map<string, CardRow>();
  for (const row of flat) {
    const key = `${row.category_int}::${row.name_var}`;
    if (!map.has(key)) {
      map.set(key, {
        category_int: row.category_int,
        image_var: row.image_var,
        name_var: row.name_var,
        counts: [],
      });
    }
    const entry = map.get(key)!;
    entry.counts.push({ count: Number(row.count_int), appearances: Number(row.appearance_count) });
  }
  return [...map.values()];
}

// ─── getDecksAndStats ─────────────────────────────────────────────────────────

export async function getDecksAndStats(
  filter: DeckFilter,
  page: number,
  pageSize: number,
): Promise<{ decks: Deck[]; total: number; stats: DeckStats }> {
  const pref = buildPrefClause(filter.prefectures);
  const rankList = filter.ranks.map(Number);
  const rankPh = rankList.map(() => "?").join(",");
  const offset = (page - 1) * pageSize;

  const spec = await fetchFilterSpec(filter);

  // One pass over `cards` to get the qualifying deck IDs (only when a card filter is set).
  let qualifyingIds: string[] | null = null;
  if (spec) {
    const q = buildQualifyingDecksQuery(spec);
    const [rows] = await db.query<any[]>(q.sql, q.params);
    qualifyingIds = rows.map((r) => r.deck_ID_var);
  }
  const qIdsEmpty = qualifyingIds !== null && qualifyingIds.length === 0;
  const qIn = buildInClause("d.deck_ID_var", qualifyingIds);

  // 3 independent queries in parallel.
  const eventCountP = db.query<any[]>(
    `SELECT COUNT(*) AS c FROM events e
     WHERE e.event_date_date BETWEEN ? AND ?
       AND e.event_league_int = ? ${pref.sql}`,
    [filter.startDate, filter.endDate, filter.league, ...pref.params]
  );

  const totalDeckCountP = db.query<any[]>(
    `SELECT COUNT(*) AS c FROM decks d
     JOIN events e ON e.event_holding_id = d.event_holding_id
     WHERE e.event_date_date BETWEEN ? AND ?
       AND e.event_league_int = ?
       AND d.rank_int IN (${rankPh})
       ${pref.sql}`,
    [filter.startDate, filter.endDate, filter.league, ...rankList, ...pref.params]
  );

  const filteredBaseParams = [
    filter.startDate, filter.endDate, filter.league, ...rankList, ...pref.params, ...qIn.params,
  ];

  // When there's no card filter, the filtered count equals the total — skip the query.
  const filteredCountP: Promise<any> = qIdsEmpty
    ? Promise.resolve([[{ c: 0 }]])
    : spec
    ? db.query<any[]>(
        `SELECT COUNT(*) AS c FROM decks d
         JOIN events e ON e.event_holding_id = d.event_holding_id
         WHERE e.event_date_date BETWEEN ? AND ?
           AND e.event_league_int = ?
           AND d.rank_int IN (${rankPh})
           ${pref.sql}
           ${qIn.sql}`,
        filteredBaseParams
      )
    : Promise.resolve(null);

  const decksP: Promise<any> = qIdsEmpty
    ? Promise.resolve([[]])
    : db.query<any[]>(
        `SELECT d.*, e.event_prefecture
         FROM decks d
         JOIN events e ON e.event_holding_id = d.event_holding_id
         WHERE e.event_date_date BETWEEN ? AND ?
           AND e.event_league_int = ?
           AND d.rank_int IN (${rankPh})
           ${pref.sql}
           ${qIn.sql}
         ORDER BY d.rank_int
         LIMIT ? OFFSET ?`,
        [...filteredBaseParams, pageSize, offset]
      );

  const [evRes, totalRes, decksRes, filteredRes] = await Promise.all([
    eventCountP, totalDeckCountP, decksP, filteredCountP,
  ]);

  const eventCount = Number((evRes as any)[0][0].c);
  const totalDeckCount = Number((totalRes as any)[0][0].c);
  const filteredDeckCount = filteredRes
    ? Number((filteredRes as any)[0][0].c)
    : totalDeckCount;

  const decks: Deck[] = ((decksRes as any)[0] ?? []) as Deck[];

  return {
    decks,
    total: filteredDeckCount,
    stats: { eventCount, totalDeckCount, filteredDeckCount },
  };
}

// ─── getCards ─────────────────────────────────────────────────────────────────

export async function getCards(filter: DeckFilter): Promise<CardRow[]> {
  const pref = buildPrefClause(filter.prefectures);
  const rankList = filter.ranks.map(Number);
  const rankPh = rankList.map(() => "?").join(",");

  const spec = await fetchFilterSpec(filter);

  let qualifyingIds: string[] | null = null;
  if (spec) {
    const q = buildQualifyingDecksQuery(spec);
    const [rows] = await db.query<any[]>(q.sql, q.params);
    qualifyingIds = rows.map((r) => r.deck_ID_var);
    if (qualifyingIds.length === 0) return [];
  }
  const qIn = buildInClause("d.deck_ID_var", qualifyingIds);

  const query = `
    SELECT category_int,
           MIN(image_var) AS image_var,
           name_var,
           count_int,
           COUNT(DISTINCT deck_ID_var) AS appearance_count
    FROM cards
    WHERE count_int < 5
      AND deck_ID_var IN (
        SELECT d.deck_ID_var FROM decks d
        JOIN events e ON e.event_holding_id = d.event_holding_id
        WHERE e.event_date_date BETWEEN ? AND ?
          AND e.event_league_int = ?
          AND d.rank_int IN (${rankPh})
          ${pref.sql}
          ${qIn.sql}
      )
    GROUP BY category_int, name_var, count_int
    ORDER BY category_int`;

  const params = [
    filter.startDate, filter.endDate, filter.league, ...rankList, ...pref.params, ...qIn.params,
  ];

  const [flat] = await db.query<any[]>(query, params);
  return groupCardRows(flat as CardFlatRow[]);
}

// ─── simple queries ───────────────────────────────────────────────────────────

export async function searchCards(keyword: string): Promise<string[]> {
  const [rows] = await db.query<any[]>(
    "SELECT DISTINCT name_var FROM cards WHERE name_var LIKE ? LIMIT 20",
    [`%${keyword}%`]
  );
  return rows.map((r: any) => r.name_var);
}

export async function getCardCategories(): Promise<{ category1_var: string }[]> {
  const [rows] = await db.query<any[]>("SELECT category1_var FROM deck_categories1");
  return rows;
}

export async function getCategories(): Promise<{ id: number; name_var: string }[]> {
  const [rows] = await db.query<any[]>("SELECT id, name_var FROM card_categories");
  return rows;
}
