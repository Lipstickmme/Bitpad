"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Page through a list: "1–25 of 112", prev/next and page numbers. */
export function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const from = page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);
  const nums = [...new Set([0, page - 1, page, page + 1, pages - 1])].filter((n) => n >= 0 && n < pages).sort((a, b) => a - b);
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
      <span className="num">{from}–{to} of {total}</span>
      <div className="ml-auto flex items-center gap-1">
        <button onClick={() => onPage(page - 1)} disabled={page === 0} className="btn btn-ghost h-8 w-8 px-0 disabled:opacity-40" aria-label="Previous page"><ChevronLeft className="size-4" /></button>
        {nums.map((n, i) => (
          <span key={n} className="flex items-center gap-1">
            {i > 0 && n - nums[i - 1] > 1 && <span className="px-1">…</span>}
            <button onClick={() => onPage(n)} className={`num h-8 min-w-8 rounded-lg px-2 font-medium ${n === page ? "bg-line-strong text-ink" : "hover:text-ink"}`}>{n + 1}</button>
          </span>
        ))}
        <button onClick={() => onPage(page + 1)} disabled={page >= pages - 1} className="btn btn-ghost h-8 w-8 px-0 disabled:opacity-40" aria-label="Next page"><ChevronRight className="size-4" /></button>
      </div>
    </div>
  );
}
