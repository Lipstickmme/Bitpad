import type { PairAsset } from "@/lib/types";
import { price } from "@/lib/format";
import { AssetDot, Change } from "./ui";

export function AssetTicker({ assets, live }: { assets: PairAsset[]; live: boolean }) {
  const row = assets.filter((a) => a.kind !== "jetton" || a.symbol === "TON" || a.symbol === "GRAM");
  return (
    <div className="card flex items-center overflow-hidden">
      <div className="flex shrink-0 items-center gap-1.5 border-r border-line px-3 py-2 text-xs font-bold text-ink-2">
        <span className={`size-1.5 rounded-full ${live ? "bg-up" : "bg-muted"}`} />
        {live ? "Live" : "Ref"} prices
      </div>
      <div className="scroll-x flex gap-5 px-4 py-2">
        {row.map((a) => (
          <div key={a.symbol} className="flex shrink-0 items-center gap-1.5 text-xs">
            <AssetDot asset={a} size={16} />
            <span className="font-semibold">{a.symbol}</span>
            <span className="num text-ink-2">{price(a.priceUsd)}</span>
            <Change value={a.change24h} />
          </div>
        ))}
      </div>
    </div>
  );
}
