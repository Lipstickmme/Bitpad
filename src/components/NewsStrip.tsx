"use client";
import { useEffect, useState } from "react";
import type { NewsItem } from "@/lib/news";
import { ago } from "@/lib/format";

// Black on yellow for visibility; the tag is a black chip
const TAG_CLS = "rounded-[3px] bg-black px-1 py-px text-[9px] font-bold uppercase tracking-wide text-[#f5c518]";

/**
 * Second, thinner strip under the price ticker: latest markets, crypto,
 * memecoin and TON headlines (refreshed every 5 minutes). Loads after the
 * page so it never slows the first render; keeps its height while loading.
 */
export function NewsStrip() {
  const [items, setItems] = useState<NewsItem[]>([]);
  useEffect(() => {
    const load = () => fetch("/api/news").then((r) => r.json()).then((d) => d.items?.length && setItems(d.items)).catch(() => {});
    load();
    const t = setInterval(load, 300_000);
    return () => clearInterval(t);
  }, []);

  const row = items.map((n, i) => (
    <a key={`${n.url}-${i}`} href={n.url} target="_blank" rel="noreferrer" className="group flex shrink-0 items-center gap-1.5 pr-7 text-[11px] leading-4" title={`${n.title} · ${n.source}`}>
      <span className={TAG_CLS}>{n.tag}</span>
      <span className="max-w-[46ch] truncate font-medium text-black group-hover:underline">{n.title}</span>
      <span className="text-black/60">{n.source}{n.time ? ` · ${ago(n.time)}` : ""}</span>
    </a>
  ));

  return (
    <div className="ticker relative h-6 overflow-hidden rounded-sm bg-[#f5c518] py-1" aria-label="Market and crypto news">
      <span className="absolute inset-y-0 left-0 z-10 flex items-center bg-black px-2 text-[10px] font-extrabold uppercase tracking-widest text-[#f5c518]">News</span>
      {items.length === 0 && <span className="pl-16 text-[11px] font-medium text-black/70">Loading headlines…</span>}
      {items.length > 0 && (
        <div className="absolute inset-y-0 left-14 right-0 flex items-center overflow-hidden">
          <div className="ticker-track" style={{ animationDuration: `${Math.max(60, items.length * 9)}s` }}>
            <div className="flex">{row}</div>
            <div className="flex" aria-hidden>{row}</div>
          </div>
        </div>
      )}
    </div>
  );
}
