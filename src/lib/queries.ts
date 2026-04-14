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
        max_appearance: 0,
      });
    }
    const entry = map.get(key)!;
    entry.counts.push({ count: Number(row.count_int), appearances: Number(row.appearance_count) });
    if (Number(row.appearance_count) > entry.max_appearance) {
      entry.max_appearance = Number(row.appearance_count);
    }
  }
  for (const entry of map.values()) {
    entry.counts.sort((a, b) => a.count - b.count);
  }
  return [...map.values()].sort((a, b) => b.max_appearance - a.max_appearance);
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

    // Convert dates to JST (UTC+9) by treating input as JST date
    const startDate = filter.startDate; // Keep as-is since MySQL DATE type doesn't store timezone
    const endDate = filter.endDate;

    // If category is empty string, skip category filtering
    let conds = [];
    let deckCardCond = "";

    // console.log("step 1")

    if (filter.category && filter.category.trim() !== "") {
      let cd_query = "";
      if (filter.category.includes("【")) {
        cd_query = `SELECT conds from deck_categories1 WHERE category1_var = ?`;
      } else {
        cd_query = `SELECT conds from deck_categories1 WHERE category1_var = ? OR category1_var LIKE '${filter.category}%'`;
      }
      const [conditions] = await db.query<any[]>(cd_query, [filter.category]);
      if (conditions && Array.isArray(conditions) && conditions.length > 0) {
        deckCardCond = "(";
        for (let i = 0; i < conditions.length; i++) {
          conds =
            conditions[i] &&
            conditions[i].conds &&
            conditions[i].conds.length > 0
              ? JSON.parse(conditions[i].conds)
              : [];
          if (conds.length > 0) {
            conds.forEach((item: Cond, index: number) => {
              let operator: string;
              switch (item.cardCondition) {
                case "eql":
                  operator = "=";
                  break;
                case "gte":
                  operator = ">=";
                  break;
                case "lte":
                  operator = "<=";
                  break;
                case "ueq":
                  operator = "!=";
                  break;
                default:
                  operator = "=";
                  break;
              }
              deckCardCond += `( EXISTS ( SELECT 1 FROM cards WHERE deck_ID_var = c.deck_ID_var AND name_var = '${item.cardName}' AND count_int ${operator} ${item.cardNumber} )`;
              if (index < conds.length - 1) {
                deckCardCond += ` AND `;
              } else {
                deckCardCond += `)`;
              }
            });
          }
          if (i < conditions.length - 1) {
            deckCardCond += ` OR `;
          }
        }
        deckCardCond += `)`;
      }
    }

    if (filter.cardName && filter.cardName.trim() !== "" || filter.cardNumMin !== undefined && filter.cardNumMin !== null && filter.cardNumMin.trim() !== "" || filter.cardNumMax !== undefined && filter.cardNumMax !== null && filter.cardNumMax.trim() !== "") {
      if (deckCardCond) deckCardCond += ` AND `;
      deckCardCond += `EXISTS ( SELECT 1 FROM cards WHERE deck_ID_var = c.deck_ID_var `;
      if (filter.cardName && filter.cardName.trim() !== "") {
        deckCardCond += ` AND name_var = '${filter.cardName}' `;
      }
      console.log(filter.cardNumMin);
      if (filter.cardNumMin !== undefined && filter.cardNumMin !== null && filter.cardNumMin.trim() !== "") {
        deckCardCond += ` AND count_int >= ${Number(filter.cardNumMin)}`;
      }
      if (filter.cardNumMax !== undefined && filter.cardNumMax !== null && filter.cardNumMax.trim() !== "") {
        deckCardCond += ` AND count_int <= ${Number(filter.cardNumMax)}`;
      }
      deckCardCond += `)`;
    }

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

    
  //   console.log("step 4")

    const [decks_result] = await db.query(query, [
      startDate,
      endDate,
      filter.league,
    ]);

    
  //   console.log("step 5")
  //   console.log("query==>", query);

  const deckRows = decks_result as DeckRow[];

  console.log(deckRows[0].filtered_deck_count);

  const stats: DeckStats = {
    eventCount: Number(eventCount),
    totalDeckCount: Number(totalDeckCount),
    filteredDeckCount: Number(deckRows[0].filtered_deck_count),
  };

  const decks: Deck[] = deckRows;
  return { decks, total: Number(deckRows[0].filtered_deck_count), stats };
}

// ─── getCards ─────────────────────────────────────────────────────────────────

export async function getCards(filter: DeckFilter): Promise<CardRow[]> {
  const prefWhere = filter.prefectures?.length
    ? `AND e.event_prefecture IN (${filter.prefectures.map((p) => `'${p}'`).join(",")})`
    : "";
  const rankList = filter.ranks.map(Number).join(",");

  const [flat] = await db.query<any[]>(`
    SELECT c.category_int, MIN(c.image_var) AS image_var, c.name_var, c.count_int,
      COUNT(DISTINCT c.deck_ID_var) AS appearance_count
    FROM cards c
    INNER JOIN decks d ON c.deck_ID_var = d.deck_ID_var
    INNER JOIN events e ON d.event_holding_id = e.event_holding_id
    WHERE e.event_date_date BETWEEN ? AND ?
    AND e.event_league_int = ? AND d.rank_int IN (${rankList}) ${prefWhere}
    GROUP BY c.category_int, c.name_var, c.count_int
    ORDER BY c.category_int, appearance_count DESC

  `, [filter.startDate, filter.endDate, filter.league]);

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