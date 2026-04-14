// Prisma generates types for: cards, decks, events, card_categories, deck_categories1
// Only define types here that Prisma cannot generate

export interface DeckFilter {
  startDate: string;
  endDate: string;
  league: number;
  category: string;
  ranks: number[];
  prefectures: string[];
  cardName?: string;
  cardNumMin?: string;
  cardNumMax?: string;
}

// Shape returned by $queryRaw deck CTE — extends Prisma's decks model
export interface DeckRow {
  deck_ID_var: string;
  rank_int: number | null;
  point_int: number | null;
  event_holding_id: number | null;
  deck_date_date: Date | null;
  deck_place_var: string | null;
  place_var: string | null;
  player_name: string | null;
  player_id: string | null;
  event_prefecture: string | null;
  // stats columns joined via CROSS JOIN Stats
  filtered_deck_count: number | null;
}

// Flat row returned by $queryRaw card adoption rate CTE (one row per card+count)
export interface CardFlatRow {
  category_int: number;
  image_var: string;
  name_var: string;
  count_int: number;
  appearance_count: number;
}

// Grouped shape sent to the frontend
export interface CardRow {
  category_int: number;
  image_var: string;
  name_var: string;
  counts: { count: number; appearances: number }[];
  max_appearance: number;
}

export interface DeckStats {
  eventCount: number;
  totalDeckCount: number;
  filteredDeckCount: number;
}

// Deck shape sent to the frontend (stats columns stripped)
export type Deck = Omit<DeckRow, "event_count" | "total_deck_count" | "filtered_deck_count">;
