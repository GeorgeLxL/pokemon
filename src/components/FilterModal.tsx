"use client";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { DeckFilter } from "@/lib/types";

const PREFECTURE_GROUPS = [
  { region: "北海道・東北", prefectures: ["北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県"] },
  { region: "北信越", prefectures: ["新潟県","富山県","石川県","福井県","長野県"] },
  { region: "関東", prefectures: ["茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県","山梨県"] },
  { region: "東海", prefectures: ["岐阜県","静岡県","愛知県","三重県"] },
  { region: "近畿", prefectures: ["滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県"] },
  { region: "中国", prefectures: ["鳥取県","島根県","岡山県","広島県","山口県"] },
  { region: "四国", prefectures: ["徳島県","香川県","愛媛県","高知県"] },
  { region: "九州・沖縄", prefectures: ["福岡県","佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県","沖縄県"] },
];

const ALL_PREFECTURES = PREFECTURE_GROUPS.flatMap((g) => g.prefectures);
const RANK_OPTIONS = [
  { value: 1, label: "優勝" }, { value: 2, label: "準優勝" },
  { value: 3, label: "TOP4" }, { value: 5, label: "TOP8" }, { value: 9, label: "TOP16" },
];

interface Props {
  open: boolean;
  filter: DeckFilter;
  onChange: (f: DeckFilter) => void;
  onSearch: () => void;
  onClose: () => void;
  hideCardFields?: boolean;
}

export default function FilterModal({ open, filter, onChange, onSearch, onClose, hideCardFields = false }: Props) {
  const [cat1, setCat1] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [rankOpen, setRankOpen] = useState(false);
  const [prefOpen, setPrefOpen] = useState(false);

  const { data: categories = [] } = useQuery<{ category1_var: string }[]>({
    queryKey: ["card-category"],
    queryFn: () => fetch("/api/card-category").then((r) => r.json()),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  // Build two-level category lists
  const cat1Options = [...new Set(
    categories.map((c) => c.category1_var.includes("【") ? c.category1_var.split("【")[0].trim() : c.category1_var)
  )];
  const cat2Options = cat1 === '' ? [] : categories
    .filter((c) => c.category1_var.startsWith(cat1) && c.category1_var.includes("【"))
    .map((c) => ({ label: c.category1_var.match(/【(.+?)】/)?.[1] ?? "", value: c.category1_var }));

  async function handleCardNameInput(val: string) {
    onChange({ ...filter, cardName: val });
    if (val.length < 2) { setSuggestions([]); return; }
    try {
      const res = await fetch(`/api/card-search?keyword=${encodeURIComponent(val)}`);
      if (res.ok) {
        setSuggestions(await res.json());
      }
    } catch (error) {
      // Ignore fetch errors during component cleanup
      console.warn('Card search fetch cancelled:', error);
    }
  }

  const allPrefSelected = ALL_PREFECTURES.every((p) => filter.prefectures.includes(p));

  const toggleRankSelection = (rank: number) => {
    const next = filter.ranks.includes(rank)
      ? filter.ranks.filter((r) => r !== rank)
      : [...filter.ranks, rank];
    onChange({ ...filter, ranks: next });
  };

  const togglePrefSelection = (pref: string) => {
    const next = filter.prefectures.includes(pref)
      ? filter.prefectures.filter((p) => p !== pref)
      : [...filter.prefectures, pref];
    onChange({ ...filter, prefectures: next });
  };

  const togglePrefGroup = (prefs: string[]) => {
    const allSelected = prefs.every((p) => filter.prefectures.includes(p));
    const next = allSelected
      ? filter.prefectures.filter((p) => !prefs.includes(p))
      : [...new Set([...filter.prefectures, ...prefs])];
    onChange({ ...filter, prefectures: next });
  };

  const toggleAllPrefs = () => {
    onChange({ ...filter, prefectures: allPrefSelected ? [] : [...ALL_PREFECTURES] });
  };

  useEffect(() => {
    if (!open) {
      setSuggestions([]);
      setRankOpen(false);
      setPrefOpen(false);
    }
  }, [open]);

  // Sync cat1 with filter.category when filter changes
  useEffect(() => {
    if (filter.category) {
      const cat1Value = filter.category.includes("【") ? filter.category.split("【")[0].trim() : filter.category;
      setCat1(cat1Value);
    } else {
      setCat1("");
    }
  }, [filter.category]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">検索条件</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-2 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Date range */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">開催期間</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">開始日</label>
                <input type="date" value={filter.startDate}
                  onChange={(e) => onChange({ ...filter, startDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">終了日</label>
                <input type="date" value={filter.endDate}
                  onChange={(e) => onChange({ ...filter, endDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" />
              </div>
            </div>
          </div>

          {/* Category */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">カテゴリ</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">カテゴリ(1)</label>
                <select value={cat1} onChange={(e) => { setCat1(e.target.value); onChange({ ...filter, category: e.target.value }); }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white max-h-96 overflow-y-auto">
                  <option value="">カテゴリを選択</option>
                  {cat1Options.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {cat2Options.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">カテゴリ(2)</label>
                  <select value={filter.category} onChange={(e) => onChange({ ...filter, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white max-h-96 overflow-y-auto">
                    <option value="">選択してください</option>
                    {cat2Options.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Card name autocomplete */}
          {!hideCardFields && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">カード名</h3>
              <div className="relative">
                <input type="text" value={filter.cardName ?? ""}
                  onChange={(e) => handleCardNameInput(e.target.value)}
                  placeholder="カードの名前を入力" autoComplete="off"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" />
                {suggestions.length > 0 && (
                  <ul className="absolute z-10 bg-white border border-gray-300 rounded-lg shadow-lg w-full mt-1 max-h-40 overflow-y-auto">
                    {suggestions.map((s) => (
                      <li key={s} className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm border-b border-gray-100 last:border-b-0"
                        onClick={() => { onChange({ ...filter, cardName: s }); setSuggestions([]); }}>
                        {s}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* Card count */}
          {!hideCardFields && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">カード枚数</h3>
              <div className="flex items-center gap-3">
                <input type="number" min={0} max={60} value={filter.cardNumMin ?? ""}
                  onChange={(e) => onChange({ ...filter, cardNumMin: e.target.value })}
                  placeholder="最小" className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-center" />
                <span className="text-gray-600 font-medium">枚以上</span>
                <input type="number" min={0} max={60} value={filter.cardNumMax ?? ""}
                  onChange={(e) => onChange({ ...filter, cardNumMax: e.target.value })}
                  placeholder="最大" className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-center" />
                <span className="text-gray-600 font-medium">枚以下</span>
              </div>
            </div>
          )}

          {/* Ranks */}
          <div className="space-y-3 relative">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">順位</h3>
            <button
              type="button"
              onClick={() => setRankOpen((prev) => !prev)}
              className="w-full text-left px-4 py-3 border border-gray-300 rounded-lg bg-white flex items-center justify-between gap-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            >
              <span className="text-sm text-gray-700">
                順位を選択
              </span>
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={rankOpen ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"} />
              </svg>
            </button>
            {rankOpen && (
              <div className="absolute left-0 right-0 mt-2 z-20 max-h-96 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg p-3">
                <div className="flex flex-wrap gap-2">
                  {RANK_OPTIONS.map((r) => (
                    <label key={r.value} className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filter.ranks.includes(r.value)}
                        onChange={() => toggleRankSelection(r.value)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                      />
                      {r.label}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Prefectures */}
          <div className="space-y-3 relative">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">都道府県</h3>
            <button
              type="button"
              onClick={() => setPrefOpen((prev) => !prev)}
              className="w-full text-left px-4 py-3 border border-gray-300 rounded-lg bg-white flex items-center justify-between gap-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            >
              <span className="text-sm text-gray-700">
                都道府県を選択
              </span>
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={prefOpen ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"} />
              </svg>
            </button>
            {prefOpen && (
              <div className="absolute left-0 right-0 bottom-12 z-20 max-h-90 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg p-3">
                <div className="flex items-center justify-between gap-3 px-2 py-2 mb-3 border-b border-gray-100">
                  <p className="text-sm text-gray-700">都道府県を選択</p>
                  <button
                    type="button"
                    onClick={toggleAllPrefs}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    {allPrefSelected ? "全解除" : "全選択"}
                  </button>
                </div>
                {PREFECTURE_GROUPS.map((g) => {
                  const groupSelected = g.prefectures.every((p) => filter.prefectures.includes(p));
                  return (
                    <div key={g.region} className="mb-3">
                      <div className="flex items-center justify-between gap-3 mb-2 px-2 text-sm font-semibold text-gray-800">
                        <span>{g.region}</span>
                        <button
                          type="button"
                          onClick={() => togglePrefGroup(g.prefectures)}
                          className="text-sm text-blue-600 hover:text-blue-800"
                        >
                          {groupSelected ? "解除" : "選択"}
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2 px-2">
                        {g.prefectures.map((p) => (
                          <label key={p} className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={filter.prefectures.includes(p)}
                              onChange={() => togglePrefSelection(p)}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                            />
                            <span>{p.replace(/[都道府県]$/, "")}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button onClick={onClose} className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 text-gray-700 font-medium transition-colors">
            キャンセル
          </button>
          <button onClick={onSearch} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors shadow-sm">
            検索
          </button>
        </div>
      </div>
    </div>
  );
}
