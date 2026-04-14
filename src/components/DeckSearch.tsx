"use client";
import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import type { DeckFilter, Deck, DeckStats } from "@/lib/types";
import FilterModal from "./FilterModal";
import DeckCard from "./DeckCard";
import Pagination from "./Pagination";

const PAGE_SIZE_OPTIONS = [16, 24, 48];

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

async function fetchDecks(filter: DeckFilter, page: number, pageSize: number, signal?: AbortSignal) {
  const res = await fetch("/api/decks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filter, page, pageSize }),
    signal,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<{ decks: Deck[]; total: number; stats: DeckStats }>;
}

export default function DeckSearch() {
  const [filter, setFilter] = useState<DeckFilter>(getDefaultFilter);
  const [pendingFilter, setPendingFilter] = useState<DeckFilter>(getDefaultFilter);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [modalOpen, setModalOpen] = useState(false);

  const { data, isFetching, error } = useQuery({
    queryKey: ["decks", filter, page, pageSize],
    queryFn: ({ signal }) => fetchDecks(filter, page, pageSize, signal),
    staleTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const handleSearch = useCallback(() => {
    setFilter(pendingFilter);
    setPage(1);
    setModalOpen(false);
  }, [pendingFilter]);

  const rankLabel = (rank: number) =>
    rank === 1 ? "優勝" : rank === 2 ? "準優勝" : rank <= 4 ? "ベスト4" : rank <= 8 ? "ベスト8" : "ベスト16";

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">デッキ検索</h1>
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
            href="/card-adoption-rate"
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            カード採用率へ
          </a>
          {data?.stats && (
            <div className="text-sm text-gray-600 flex gap-2">
              <span>{data.stats.eventCount} イベント</span>
              <span>/</span>
              <span>{data.stats.totalDeckCount} デッキ中</span>
              <span>/</span>
              <span>対象 {data.stats.filteredDeckCount} デッキ</span>
            </div>
          )}
        </div>
      </header>

      {/* Results */}
      {isFetching ? (
        <div className="text-center py-20 text-gray-500">読み込み中...</div>
      ) : error ? (
        <div className="text-center py-20 text-red-500">エラー: {(error as Error).message}</div>
      ) : !data?.decks?.length ? (
        <div className="text-center py-20 text-gray-500">該当するデッキがありません。</div>
      ) : (
        <div className="space-y-4 max-w-5xl mx-auto">
          {data.decks.map((deck, idx) => (
            <DeckCard key={deck.deck_ID_var + idx.toString()} deck={deck} rankLabel={rankLabel(Number(deck.rank_int))} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && data.total > 0 && (
        <Pagination
          total={data.total}
          page={page}
          pageSize={pageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        />
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
