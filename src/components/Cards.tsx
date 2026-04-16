"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { CardRow, DeckFilter } from "@/lib/types";

interface Props {
  cards: CardRow[];
  filter: DeckFilter;
}

export default function Cards({ cards, filter }: Props) {
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [collapsedCategories, setCollapsedCategories] = useState<Set<number>>(new Set());

  const router = useRouter();
  const { data: categories = [] } = useQuery<{ id: Number, name_var: string }[]>({
    queryKey: ["category"],
    queryFn: () => fetch("/api/category").then((r) => r.json()),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const buildDeckQuery = (filter: DeckFilter, cardName: string, count: number) => {
    const params = new URLSearchParams();
    params.set("startDate", filter.startDate);
    params.set("endDate", filter.endDate);
    params.set("league", String(filter.league));
    if (filter.category) params.set("category", filter.category);
    filter.ranks.forEach((rank) => params.append("ranks", String(rank)));
    filter.prefectures?.forEach((pref) => params.append("prefectures", pref));
    params.set("cardName", cardName);
    params.set("cardNumMin", String(count));
    params.set("cardNumMax", String(count));
    return params.toString();
  };

  const navigateToDecks = (card: CardRow, count: number) => {
    const query = buildDeckQuery(filter, card.name_var, count);
    router.push(`/decks?${query}`);
  };

  const toggleCategory = (catId: number) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  };

  const handleImageError = (imageUrl: string) => {
    setImageErrors(prev => new Set(prev).add(imageUrl));
  };

  const cardCounts = (card: CardRow) => {
    const newArr = card.counts.sort((a, b) => a.count - b.count).filter((c): c is typeof c => c.count < 5)

    const total = newArr.reduce((sum, count) => sum + count.appearances, 0);

    const countElements = newArr.map((count, idx) => (
      <tr
        key={idx}
        className={`w-full text-md cursor-pointer ${idx % 2 === 0 ? 'bg-gray-200' : ''}`}
        onClick={() => navigateToDecks(card, count.count)}
      >
        <td className="px-3 py-1">{count.count}枚</td>
        <td className="px-3 py-1"><span className="text-blue-900">{count.appearances}回</span></td>
        <td className="px-3 py-1"><span className="text-red-900 text-sm">{Math.round(count.appearances / total * 1000) / 10 || 0}%</span></td>
      </tr>
    ));

    return countElements;

  }

  return (
    <div className="space-y-6">
      {categories.map(({ id, name_var }) => {
        const categoryCards = cards.filter(card => card.category_int === Number(id));
        if (categoryCards.length === 0) return null;

        const isCollapsed = collapsedCategories.has(Number(id));
        return (
          <div
            key={name_var}
            className="bg-white rounded-lg border p-4"
            onClick={() => toggleCategory(Number(id))}
          >
            <div
              className="w-full text-left flex items-center justify-between text-lg font-bold mb-4 text-blue-700 hover:text-blue-900"
            >
              <span>{name_var} ({categoryCards.length})</span>
              <span className="text-xl">{isCollapsed ? "＋" : "−"}</span>
            </div>
            {!isCollapsed && (
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4" onClick={e => e.stopPropagation()}>
                {categoryCards.map((card) => (
                  <div key={`${card.category_int}-${card.name_var}`} className="flex flex-col justify-start bg-blue-200 gap-4 p-3 pb-6 border border-gray-500 rounded-xl hover:bg-blue-300">
                    <div className="w-full h-auto flex-shrink-0 rounded-xl overflow-hidden">
                      {imageErrors.has(card.image_var) ? (
                        <div className="w-full h-full bg-gray-200 rounded border flex items-center justify-center text-xs text-gray-500">
                          画像なし
                        </div>
                      ) : (
                        <img
                          src={'https://www.pokemon-card.com/assets/images/card_images/large/' + card.image_var + '.jpg'}
                          alt={card.name_var}
                          className="w-full h-full object-cover rounded border"
                          loading="lazy"
                          onError={() => handleImageError(card.image_var)}
                        />
                      )}
                    </div>
                    <h3 className="my-2 font-bold text-center">{card.name_var}</h3>
                    <table className="bg-white rounded-xl overflow-hidden p-3 mt-auto w-full font-bold">
                      <tbody>
                        {cardCounts(card)}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}