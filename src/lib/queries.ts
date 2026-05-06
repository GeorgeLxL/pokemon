import { db } from "./db";
import type { DeckFilter, DeckRow, CardFlatRow, CardRow, DeckStats, Deck } from "./types";

// ─── helpers ─────────────────────────────────────────────────────────────────

type Cond = { cardName: string; cardNumber: number; cardCondition: string };

function condToOperator(c: string): string {
  return c === "eql" ? "=" : c === "gte" ? ">=" : c === "lte" ? "<=" : "!=";
}

async function fetchConds(category: string): Promise<Cond[]> {
  if (!category.trim()) return [];

  const like = category.includes("【") ? category : `${category}%`;
  const [rows] = await db.query<any[]>(
    "SELECT conds FROM deck_categories1 WHERE category1_var = ? OR category1_var LIKE ?",
    [category, like]
  );
  return rows.flatMap((r: any) => (r.conds ? (JSON.parse(r.conds) as Cond[]) : []));
}

function buildRequiredPairs(conds: Cond[]): { pairsSQL: string; whereSQL: string } {
  const pairs = conds.map(
    (c) => `SELECT '${c.cardName}' AS name_var, ${c.cardNumber} AS required_count, '${condToOperator(c.cardCondition)}' AS operator`
  );
  const wheres = conds.map((c) => {
    const op = condToOperator(c.cardCondition);
    return `(rp.operator = '${op}' AND ufc.count_int ${op} rp.required_count)`;
  });
  return { pairsSQL: pairs.join(" UNION ALL "), whereSQL: wheres.join(" OR ") };
}

async function buildDeckCardCond(filter: DeckFilter): Promise<string> {
  let deckCardCond = "";

  if (filter.category && filter.category.trim() !== "") {
    const cd_query = filter.category.includes("【")
      ? `SELECT conds FROM deck_categories1 WHERE category1_var = ?`
      : `SELECT conds FROM deck_categories1 WHERE category1_var = ? OR category1_var LIKE '${filter.category}%'`;
    const [conditions] = await db.query<any[]>(cd_query, [filter.category]);

    if (Array.isArray(conditions) && conditions.length > 0) {
      const groups: string[] = [];
      for (const row of conditions) {
        const conds: Cond[] = row?.conds ? JSON.parse(row.conds) : [];
        if (conds.length === 0) continue;
        const parts = conds.map(
          (item) =>
            `EXISTS ( SELECT 1 FROM cards WHERE deck_ID_var = c.deck_ID_var AND name_var = '${item.cardName}' AND count_int ${condToOperator(item.cardCondition)} ${item.cardNumber} )`
        );
        groups.push(`( ${parts.join(" AND ")} )`);
      }
      if (groups.length > 0) deckCardCond = `( ${groups.join(" OR ")} )`;
    }
  }

  if (
    (filter.cardName && filter.cardName.trim() !== "") ||
    (filter.cardNumMin && filter.cardNumMin.trim() !== "") ||
    (filter.cardNumMax && filter.cardNumMax.trim() !== "")
  ) {
    if (deckCardCond) deckCardCond += " AND ";
    let cardCond = `EXISTS ( SELECT 1 FROM cards WHERE deck_ID_var = c.deck_ID_var`;
    if (filter.cardName && filter.cardName.trim() !== "")
      cardCond += ` AND name_var = '${filter.cardName}'`;
    if (filter.cardNumMin && filter.cardNumMin.trim() !== "")
      cardCond += ` AND count_int >= ${Number(filter.cardNumMin)}`;
    if (filter.cardNumMax && filter.cardNumMax.trim() !== "")
      cardCond += ` AND count_int <= ${Number(filter.cardNumMax)}`;
    cardCond += " )";
    deckCardCond += cardCond;
  }

  return deckCardCond;
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
  return [...map.values()]
}

// ─── getDecksAndStats ─────────────────────────────────────────────────────────

export async function getDecksAndStats(
  filter: DeckFilter,
  page: number,
  pageSize: number,
): Promise<{ decks: Deck[]; total: number; stats: DeckStats }> {
  const prefWhere = filter.prefectures?.length
    ? `AND e.event_prefecture IN (${filter.prefectures.map((p) => `'${p}'`).join(",")})`
    : "";
  const rankList = filter.ranks.map(Number).join(",");
  const offset = (page - 1) * pageSize;

  const [[{ eventCount }]] = await db.query<any[]>(`
    SELECT COUNT(*) AS eventCount FROM events e
    WHERE e.event_date_date BETWEEN ? AND ?
    AND e.event_league_int = ? ${prefWhere}
  `, [filter.startDate, filter.endDate, filter.league]);

  const [[{ totalDeckCount }]] = await db.query<any[]>(`
    SELECT COUNT(*) AS totalDeckCount FROM decks d
    LEFT JOIN events e ON e.event_holding_id = d.event_holding_id
    WHERE e.event_date_date BETWEEN ? AND ?
    AND e.event_league_int = ? AND d.rank_int IN (${rankList}) ${prefWhere}
  `, [filter.startDate, filter.endDate, filter.league]);

    // console.log("filter==", filter);

    const startDate = filter.startDate; // Keep as-is since MySQL DATE type doesn't store timezone
    const endDate = filter.endDate;

    const deckCardCond = await buildDeckCardCond(filter);

    let query = `SELECT *, COUNT(*) OVER () AS filtered_deck_count FROM (
                  SELECT d.*, e.event_prefecture FROM decks AS d JOIN 
                  events as e ON d.event_holding_id = e.event_holding_id 
                  JOIN (
                  SELECT DISTINCT c.deck_ID_var
                  FROM cards c
                  ${deckCardCond? "WHERE " + deckCardCond : ""} ) AS c ON d.deck_ID_var = c.deck_ID_var
                  WHERE e.event_date_date BETWEEN ? AND ?
                  AND e.event_league_int = ? AND d.rank_int IN (${rankList}) ${prefWhere}
                  ) AS d ORDER BY rank_int
                  LIMIT ${pageSize} OFFSET ${offset}`;

    
    const [decks_result] = await db.query(query, [
      startDate,
      endDate,
      filter.league,
    ]);

    
  //   console.log("step 5")
  //   console.log("query==>", query);

  const deckRows = decks_result as DeckRow[];

  const stats: DeckStats = {
    eventCount: Number(eventCount),
    totalDeckCount: Number(totalDeckCount),
    filteredDeckCount: Number(deckRows.length > 0 ? deckRows[0].filtered_deck_count : 0),
  };

  const decks: Deck[] = deckRows;
  return { decks, total: Number(deckRows.length > 0 ? deckRows[0].filtered_deck_count : 0), stats };
}

// ─── getCards ─────────────────────────────────────────────────────────────────

export async function getCards(filter: DeckFilter): Promise<CardRow[]> {
  const prefWhere = filter.prefectures?.length
    ? `AND e.event_prefecture IN (${filter.prefectures.map((p) => `'${p}'`).join(",")})`
    : "";
  const rankList = filter.ranks.map(Number).join(",");

  const startDate = filter.startDate; // Keep as-is since MySQL DATE type doesn't store timezone
  const endDate = filter.endDate;

  const deckCardCond = await buildDeckCardCond(filter);

  const query = `SELECT category_int, MIN(image_var) AS image_var, name_var, count_int,
                    COUNT(DISTINCT deck_ID_var) AS appearance_count
                  FROM cards WHERE deck_ID_var IN (
                  SELECT d.deck_ID_var FROM decks AS d JOIN 
                  events as e ON d.event_holding_id = e.event_holding_id 
                  JOIN (
                  SELECT DISTINCT c.deck_ID_var
                  FROM cards c
                  ${deckCardCond? "WHERE " + deckCardCond : ""} ) AS c ON d.deck_ID_var = c.deck_ID_var
                  WHERE e.event_date_date BETWEEN ? AND ?
                  AND e.event_league_int = ? AND d.rank_int IN (${rankList}) ${prefWhere})
                  AND count_int < 5
                  GROUP BY category_int, name_var, count_int
                  ORDER BY category_int`

  const [flat] = await db.query<any[]>(query, [startDate, endDate, filter.league]);

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