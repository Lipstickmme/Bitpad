"use client";
import { useEffect, useState } from "react";
import type { NewsItem, NewsTag } from "@/lib/news";
import { ago } from "@/lib/format";

const TAG_CLS: Record<NewsTag, string> = {
  Markets: "text-ink-2",
  Crypto: "text-brand",
  Memecoins: "text-warn",
  TON: "text-brand-ink",
};

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
      <span className={`font-semibold uppercase tracking-wide ${TAG_CLS[n.tag]}`}>{n.tag}</span>
      <span className="max-w-[46ch] truncate text-ink-2 group-hover:text-ink group-hover:underline">{n.title}</span>
      <span className="text-muted">{n.source}{n.time ? ` · ${ago(n.time)}` : ""}</span>
    </a>
  ));

  return (
    <div className="ticker relative h-6 overflow-hidden border-b border-line py-1 [mask-image:linear-gradient(90deg,transparent,#000_6%,#000_94%,transparent)]" aria-label="Market and crypto news">
      {items.length > 0 && (
        <div className="ticker-track" style={{ animationDuration: `${Math.max(60, items.length * 9)}s` }}>
          <div className="flex">{row}</div>
          <div className="flex" aria-hidden>{row}</div>
        </div>
      )}
    </div>
  );
}
