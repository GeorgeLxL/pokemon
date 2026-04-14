"use client";
import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import type { DeckFilter, CardRow } from "@/lib/types";
import FilterModal from "./FilterModal";
import Cards from "./Cards";

function getDefaultFilter(): DeckFilter {
  return {
    startDate: new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
    category: "",
    league: 2,
    ranks: [1, 2, 3, 5, 9],
    prefectures: [],
  };
}

async function fetchCards(filter: DeckFilter, signal?: AbortSignal) {
  const res = await fetch("/api/cards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filter }),
    signal,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<CardRow[]>;
}

export default function CardsSearch() {
  const [filter, setFilter] = useState<DeckFilter>(getDefaultFilter);
  const [pendingFilter, setPendingFilter] = useState<DeckFilter>(getDefaultFilter);
  const [modalOpen, setModalOpen] = useState(false);

  const { data: cards, isFetching, error } = useQuery({
    queryKey: ["cards", filter],
    queryFn: ({ signal }) => fetchCards(filter, signal),
    staleTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const handleSearch = useCallback(() => {
    setFilter(pendingFilter);
    setModalOpen(false);
  }, [pendingFilter]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">カード採用率</h1>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            条件検索
          </button>
          <a 
            href="/decks"
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            デッキ検索へ
          </a>
        </div>
      </header>

      {/* Results */}
      {isFetching ? (
        <div className="text-center py-20 text-gray-500">読み込み中...</div>
      ) : error ? (
        <div className="text-center py-20 text-red-500">エラー: {(error as Error).message}</div>
      ) : !cards?.length ? (
        <div className="text-center py-20 text-gray-500">該当するカードがありません。</div>
      ) : (
        <Cards cards={cards} />
      )}

      {/* Filter Modal */}
      <FilterModal
        open={modalOpen}
        filter={pendingFilter}
        onChange={setPendingFilter}
        onSearch={handleSearch}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}