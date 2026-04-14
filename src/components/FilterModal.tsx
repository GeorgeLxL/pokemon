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
}

export default function FilterModal({ open, filter, onChange, onSearch, onClose }: Props) {
  const [cat1, setCat1] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);

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
  const cat2Options = categories
    .filter((c) => c.category1_var.startsWith(cat1) && c.category1_var.includes("【"))
    .map((c) => ({ label: c.category1_var.match(/【(.+?)】/)?.[1] ?? "", value: c.category1_var }));

  const allPrefSelected = ALL_PREFECTURES.every((p) => filter.prefectures.includes(p));

  function togglePref(pref: string) {
    const next = filter.prefectures.includes(pref)
      ? filter.prefectures.filter((p) => p !== pref)
      : [...filter.prefectures, pref];
    onChange({ ...filter, prefectures: next });
  }

  function toggleRegion(prefs: string[], checked: boolean) {
    const next = checked
      ? [...new Set([...filter.prefectures, ...prefs])]
      : filter.prefectures.filter((p) => !prefs.includes(p));
    onChange({ ...filter, prefectures: next });
  }

  function toggleAllPref(checked: boolean) {
    onChange({ ...filter, prefectures: checked ? [...ALL_PREFECTURES] : [] });
  }

  function toggleRank(val: number, checked: boolean) {
    const next = checked ? [...filter.ranks, val] : filter.ranks.filter((r) => r !== val);
    onChange({ ...filter, ranks: next });
  }

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

  useEffect(() => {
    if (!open) setSuggestions([]);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">検索条件</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        <div className="space-y-4">
          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              開催日
              <input type="date" value={filter.startDate}
                onChange={(e) => onChange({ ...filter, startDate: e.target.value })}
                className="mt-1 w-full border rounded px-2 py-1 text-sm" />
            </label>
            <label className="block text-sm">
              終了日
              <input type="date" value={filter.endDate}
                onChange={(e) => onChange({ ...filter, endDate: e.target.value })}
                className="mt-1 w-full border rounded px-2 py-1 text-sm" />
            </label>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <label className="block text-sm">
              カテゴリ(1)
              <select value={cat1} onChange={(e) => { setCat1(e.target.value); onChange({ ...filter, category: e.target.value }); }}
                className="mt-1 w-full border rounded px-2 py-1 text-sm">
                <option value="">カテゴリを選択</option>
                {cat1Options.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            {cat2Options.length > 0 && (
              <label className="block text-sm">
                カテゴリ(2)
                <select value={filter.category} onChange={(e) => onChange({ ...filter, category: e.target.value })}
                  className="mt-1 w-full border rounded px-2 py-1 text-sm">
                  <option value=""> </option>
                  {cat2Options.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </label>
            )}
          </div>

          {/* Card name autocomplete */}
          <div className="relative">
            <label className="block text-sm">
              カード名
              <input type="text" value={filter.cardName ?? ""}
                onChange={(e) => handleCardNameInput(e.target.value)}
                placeholder="カードの名前" autoComplete="off"
                className="mt-1 w-full border rounded px-2 py-1 text-sm" />
            </label>
            {suggestions.length > 0 && (
              <ul className="absolute z-10 bg-white border rounded shadow w-full mt-1 max-h-40 overflow-y-auto text-sm">
                {suggestions.map((s) => (
                  <li key={s} className="px-3 py-1 hover:bg-gray-100 cursor-pointer"
                    onClick={() => { onChange({ ...filter, cardName: s }); setSuggestions([]); }}>
                    {s}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Card count */}
          <div className="flex items-center gap-2 text-sm">
            <input type="number" min={0} max={60} value={filter.cardNumMin ?? ""}
              onChange={(e) => onChange({ ...filter, cardNumMin: e.target.value })}
              placeholder="最小" className="border rounded px-2 py-1 w-20" />
            <span>枚以上</span>
            <input type="number" min={0} max={60} value={filter.cardNumMax ?? ""}
              onChange={(e) => onChange({ ...filter, cardNumMax: e.target.value })}
              placeholder="最大" className="border rounded px-2 py-1 w-20" />
            <span>枚以下</span>
          </div>

          {/* Ranks */}
          <details className="border rounded">
            <summary className="px-3 py-2 cursor-pointer font-medium text-sm">順位</summary>
            <div className="px-3 pb-3 grid grid-cols-3 gap-2 text-sm">
              {RANK_OPTIONS.map((r) => (
                <label key={r.value} className="flex items-center gap-1">
                  <input type="checkbox" checked={filter.ranks.includes(r.value)}
                    onChange={(e) => toggleRank(r.value, e.target.checked)} />
                  {r.label}
                </label>
              ))}
            </div>
          </details>

          {/* Prefectures */}
          <details className="border rounded">
            <summary className="px-3 py-2 cursor-pointer font-medium text-sm">都道府県</summary>
            <div className="px-3 pb-3 text-sm">
              <label className="flex items-center gap-1 mb-2 font-medium">
                <input type="checkbox" checked={allPrefSelected}
                  onChange={(e) => toggleAllPref(e.target.checked)} />
                全選択
              </label>
              {PREFECTURE_GROUPS.map((g) => {
                const allChecked = g.prefectures.every((p) => filter.prefectures.includes(p));
                return (
                  <div key={g.region} className="mb-2">
                    <label className="flex items-center gap-1 font-medium mb-1">
                      <input type="checkbox" checked={allChecked}
                        onChange={(e) => toggleRegion(g.prefectures, e.target.checked)} />
                      {g.region}
                    </label>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 pl-4">
                      {g.prefectures.map((p) => (
                        <label key={p} className="flex items-center gap-1">
                          <input type="checkbox" checked={filter.prefectures.includes(p)}
                            onChange={() => togglePref(p)} />
                          {p.replace(/[都道府県]$/, "")}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </details>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 border rounded hover:bg-gray-100 text-sm">キャンセル</button>
          <button onClick={onSearch} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">検索</button>
        </div>
      </div>
    </div>
  );
}
