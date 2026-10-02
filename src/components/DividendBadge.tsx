import type { PairAsset } from "@/lib/types";
import { dividendInfo } from "@/lib/dividend";

/** Dividend score: 3 bars filled by yield tier, plus a short label. Hover for the explanation. */
export function DividendBadge({ asset, compact = false, className = "" }: { asset: Pick<PairAsset, "kind" | "symbol" | "dividendYield">; compact?: boolean; className?: string }) {
  const d = dividendInfo(asset);
  const tone = d.score == null ? "text-muted" : d.score === 0 ? "text-muted" : d.score === 3 ? "text-up" : d.score === 2 ? "text-[#8cd1b4]" : "text-ink-2";
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap ${tone} ${className}`} title={d.tip}>
      {d.score != null && (
        <span className="inline-flex items-end gap-[2px]" aria-hidden>
          {[1, 2, 3].map((i) => (
            <span key={i} className={`w-[3px] rounded-[1px] ${i <= d.score! ? "bg-current" : "bg-line-strong"}`} style={{ height: 3 + i * 3 }} />
          ))}
        </span>
      )}
      <span className="text-[11px] font-medium">{compact && d.score && asset.dividendYield ? `${asset.dividendYield.toFixed(2)}%` : d.label}</span>
      <span className="sr-only">{d.tip}</span>
    </span>
  );
}
