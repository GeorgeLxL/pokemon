import type { Deck } from "@/lib/types";

const DAYS = ["日", "月", "火", "水", "木", "金", "土"];

function formatJST(dateStr: string): string {
  const d = new Date(new Date(dateStr).getTime() + 9 * 3600000);
  return `${d.getUTCFullYear()}年${String(d.getUTCMonth() + 1).padStart(2, "0")}月${String(d.getUTCDate()).padStart(2, "0")}日(${DAYS[d.getUTCDay()]})`;
}

export default function DeckCard({ deck, rankLabel }: { deck: Deck; rankLabel: string }) {
  const deckUrl = `https://www.pokemon-card.com/deck/confirm.html/deckID/${deck.deck_ID_var}`;
  const imgBase = `https://www.pokemon-card.com/deck/deckView.php/deckID/${deck.deck_ID_var}`;

  return (
    <a
      href={deckUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow bg-white"
    >
      <div className="p-4 flex items-center justify-between">
        <span className="font-semibold text-blue-700">{rankLabel}</span>
        <p className="text-gray-600">ユーザー名: {deck.player_name}</p>
        <p className="text-gray-600">ユーザーID: {deck.player_id}</p>
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path d="M18 13v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      </div>
      <picture>
        <source srcSet={`${imgBase}.webp`} type="image/webp" />
        <img src={`${imgBase}.png`} alt={deck.deck_ID_var} loading="lazy" className="w-full" />
      </picture>
      <div className="p-4 text-sm text-gray-500 mt-1">
        <p className="mb-3">{deck.deck_date_date ? formatJST(deck.deck_date_date instanceof Date ? deck.deck_date_date.toISOString() : deck.deck_date_date) : ""} {deck.deck_place_var}</p>
        <p>{deck.place_var}({deck.event_prefecture})</p>
      </div>
    </a>
  );
}
