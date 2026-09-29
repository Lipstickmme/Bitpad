"use client";
import { useEffect, useState } from "react";
import type { PairAsset } from "@/lib/types";
import { price } from "@/lib/format";
import { AssetDot, Change } from "./ui";

/** Auto-scrolling strip of live pair-asset prices. Refreshes every 30s; assets without a live quote are left out. */
export function AssetTicker({ assets: initial }: { assets: PairAsset[] }) {
  const [assets, setAssets] = useState(initial);
  const hasLive = initial.some((a) => a.priceUsd != null);
  useEffect(() => {
    const load = () =>
      fetch("/api/assets")
        .then((r) => r.json())
        .then((d) => d.assets?.length && setAssets(d.assets))
        .catch(() => {});
    if (!hasLive) load(); // server render had no quotes — try again right away
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [hasLive]);

  const row = assets.filter((a) => a.priceUsd != null && (a.kind !== "jetton" || a.symbol === "TON" || a.symbol === "GRAM"));
  if (!row.length) return null;
  const items = row.map((a) => (
    <span key={a.symbol} className="flex shrink-0 items-center gap-2 pr-8 text-[13px]" title={a.priceSource ? `${a.name} · via ${a.priceSource}` : a.name}>
      <AssetDot asset={a} size={18} />
      <span className="font-medium text-ink">{a.symbol}</span>
      <span className="num text-ink-2">{price(a.priceUsd!)}</span>
      <Change value={a.change24h} className="text-xs" />
    </span>
  ));

  return (
    <div className="ticker relative overflow-hidden border-y border-line py-2.5 [mask-image:linear-gradient(90deg,transparent,#000_6%,#000_94%,transparent)]" aria-label="Live prices">
      <div className="ticker-track" style={{ animationDuration: `${Math.max(30, row.length * 4)}s` }}>
        <div className="flex">{items}</div>
        <div className="flex" aria-hidden>{items}</div>
      </div>
    </div>
  );
}
