"use client";
import { useState, useCallback, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
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

type SearchParamsShape = {
  get(name: string): string | null;
  getAll(name: string): string[];
  toString(): string;
};

function getFilterFromParams(params: SearchParamsShape): DeckFilter {
  const defaultFilter = getDefaultFilter();
  const ranks = params.getAll("ranks").map((value: string) => Number(value)).filter((value) => !Number.isNaN(value));
  const prefectures = params.getAll("prefectures");

  return {
    startDate: params.get("startDate") ?? defaultFilter.startDate,
    endDate: params.get("endDate") ?? defaultFilter.endDate,
    category: params.get("category") ?? defaultFilter.category,
    league: Number(params.get("league") ?? defaultFilter.league),
    ranks: ranks.length > 0 ? ranks : defaultFilter.ranks,
    prefectures: prefectures.length > 0 ? prefectures : defaultFilter.prefectures,
    cardName: params.get("cardName") ?? undefined,
    cardNumMin: params.get("cardNumMin") ?? undefined,
    cardNumMax: params.get("cardNumMax") ?? undefined,
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
  const searchParams = useSearchParams();
  const router = useRouter();
  const hasCleanedUrlRef = useRef(false);
  const [filter, setFilter] = useState<DeckFilter>(getDefaultFilter);
  const [pendingFilter, setPendingFilter] = useState<DeckFilter>(getDefaultFilter);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    // If there are URL parameters, set them in the modal and apply them automatically
    if (searchParams.toString() && !hasCleanedUrlRef.current) {
      const urlFilter = getFilterFromParams(searchParams);
      setPendingFilter(urlFilter);
      setFilter(urlFilter);
      setPage(1);
      hasCleanedUrlRef.current = true;
      router.replace("/decks");
    }
  }, [searchParams.toString(), router]);

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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <header className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">デッキ検索</h1>
              <p className="text-gray-600">強力なデッキを探しましょう</p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setModalOpen(true)}
                className="flex items-center gap-3 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                </svg>
                条件検索
              </button>
              <a
                href="/card-adoption-rate"
                className="flex items-center gap-2 px-6 py-3 border-2 border-gray-300 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 text-gray-700 font-medium"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                カード採用率へ
              </a>
              
            </div>
          </div>
        </header>

        {/* Results */}
        {isFetching ? (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-500 text-lg">読み込み中...</p>
            </div>
          </div>
        ) : error ? (
          <div className="bg-white rounded-2xl shadow-lg border border-red-200 p-8">
            <div className="text-center">
              <div className="text-red-500 mb-4">
                <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-red-600 text-lg font-medium">エラー: {(error as Error).message}</p>
            </div>
          </div>
        ) : !data?.decks?.length ? (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-12">
            <div className="text-center">
              <div className="text-gray-400 mb-4">
                <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.29-.966-5.5-2.5" />
                </svg>
              </div>
              <p className="text-gray-500 text-lg">該当するデッキがありません。</p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
            
              {data?.stats && (
                <div className="bg-gray-50 rounded-lg px-4 py-2 mb-6 text-sm text-gray-600 border border-gray-200">
                  <div className="flex justify-end items-center gap-4">
                    <span className="font-medium">{data.stats.eventCount} イベント</span>
                    <span className="text-gray-400">|</span>
                    <span className="font-medium">{data.stats.totalDeckCount} デッキ中</span>
                    <span className="text-gray-400">|</span>
                    <span className="font-medium text-blue-600">{data.stats.filteredDeckCount} デッキ対象</span>
                  </div>
                </div>
              )}
            <div className="space-y-4">
              {data.decks.map((deck, idx) => (
                <DeckCard key={deck.deck_ID_var + idx.toString()} deck={deck} rankLabel={rankLabel(Number(deck.rank_int))} />
              ))}
            </div>
          </div>
        )}

        {/* Pagination */}
        {data && data.total > 0 && (
          <div className="mt-8">
            <Pagination
              total={data.total}
              page={page}
              pageSize={pageSize}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              onPageChange={setPage}
              onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
            />
          </div>
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
    </div>
  );
}
