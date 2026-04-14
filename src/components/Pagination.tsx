"use client";
import { useState } from "react";

interface Props {
  total: number;
  page: number;
  pageSize: number;
  pageSizeOptions: number[];
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: number) => void;
}

export default function Pagination({ total, page, pageSize, pageSizeOptions, onPageChange, onPageSizeChange }: Props) {
  const totalPages = Math.ceil(total / pageSize);
  const [jumpVal, setJumpVal] = useState("");

  const pages: (number | "...")[] = [];
  const delta = 2;
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - delta && i <= page + delta)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== "...") {
      pages.push("...");
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mt-6 text-sm">
      <span className="text-gray-500">
        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} / {total} 件
      </span>

      <div className="flex items-center gap-1">
        <button onClick={() => onPageChange(page - 1)} disabled={page === 1}
          className="px-2 py-1 rounded border disabled:opacity-40 hover:bg-gray-100">‹</button>
        {pages.map((p, i) =>
          p === "..." ? (
            <span key={`ellipsis-${i}`} className="px-2">…</span>
          ) : (
            <button key={`page-${p}`} onClick={() => onPageChange(p as number)}
              className={`px-3 py-1 rounded border ${p === page ? "bg-blue-600 text-white border-blue-600" : "hover:bg-gray-100"}`}>
              {p}
            </button>
          )
        )}
        <button onClick={() => onPageChange(page + 1)} disabled={page === totalPages}
          className="px-2 py-1 rounded border disabled:opacity-40 hover:bg-gray-100">›</button>
      </div>

      <div className="flex items-center gap-2">
        <select value={pageSize} onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="border rounded px-2 py-1">
          {pageSizeOptions.map((s) => <option key={s} value={s}>{s} / ページ</option>)}
        </select>
        <input type="number" min={1} max={totalPages} value={jumpVal}
          onChange={(e) => setJumpVal(e.target.value)}
          className="border rounded px-2 py-1 w-16" placeholder="ページ" />
        <button onClick={() => { const n = Number(jumpVal); if (n >= 1 && n <= totalPages) { onPageChange(n); setJumpVal(""); } }}
          className="px-3 py-1 border rounded hover:bg-gray-100">移動</button>
      </div>
    </div>
  );
}
