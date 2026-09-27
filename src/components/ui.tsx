import type { MarketToken, PairAsset } from "@/lib/types";
import { pct } from "@/lib/format";

export function TokenAvatar({ token, size = 48 }: { token: Pick<MarketToken, "symbol" | "image">; size?: number }) {
  return (
    <div className="grid shrink-0 place-items-center overflow-hidden rounded-full border border-line bg-surface-2" style={{ width: size, height: size }}>
      {token.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={token.image} alt="" className="size-full object-cover" loading="lazy" />
      ) : (
        <span className="font-bold text-ink-2" style={{ fontSize: size * 0.3 }}>{token.symbol.slice(0, 3)}</span>
      )}
    </div>
  );
}

export function AssetDot({ asset, size = 18 }: { asset: Pick<PairAsset, "symbol" | "color" | "image">; size?: number }) {
  if (asset.image)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={asset.image} alt="" width={size} height={size} className="inline-block shrink-0 rounded-full" style={{ width: size, height: size }} loading="lazy" />;
  return (
    <span className="inline-grid shrink-0 place-items-center rounded-full font-black text-white" style={{ width: size, height: size, background: asset.color, fontSize: size * 0.42 }} aria-hidden>
      {asset.symbol.replace(/x$/, "").slice(0, 2)}
    </span>
  );
}

export function PairBadge({ asset }: { asset: PairAsset }) {
  const tone =
    asset.kind === "stock" ? "bg-[#eef3fb] text-[#35557f] border-[#d5e0ef]"
    : asset.kind === "commodity" ? "bg-warn-soft text-warn border-warn/25"
    : asset.kind === "jetton" ? "bg-[#eef6fb] text-[#2d6b8f] border-[#d3e6f1]"
    : "bg-surface-2 text-ink-2 border-line";
  return <span className={`chip ${tone}`}>{asset.badge}</span>;
}

export function Change({ value, className = "" }: { value: number | null | undefined; className?: string }) {
  if (value == null || !Number.isFinite(value)) return <span className={`num text-muted ${className}`}>—</span>;
  return <span className={`num font-semibold ${value >= 0 ? "text-up" : "text-down"} ${className}`}>{pct(value)}</span>;
}

/** Price path reconstructed from real % changes: price 24h, 6h, 1h and 5m ago → now. */
export function changePath(price: number, c: { m5: number; h1: number; h6: number; h24: number }) {
  const at = (pctChange: number) => price / (1 + pctChange / 100);
  return [at(c.h24), at(c.h6), at(c.h1), at(c.m5), price];
}

export function Sparkline({ data, width = 96, height = 32, up }: { data: number[]; width?: number; height?: number; up?: boolean }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * width, height - 2 - ((v - min) / span) * (height - 4)]);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");
  const isUp = up ?? data[data.length - 1] >= data[0];
  const color = isUp ? "var(--color-up)" : "var(--color-down)";
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <path d={`${d}L${width},${height}L0,${height}Z`} fill={color} opacity={0.08} />
      <path d={d} fill="none" stroke={color} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function Stat({ label, value, sub, className = "" }: { label: string; value: React.ReactNode; sub?: React.ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 px-4 py-3 ${className}`}>
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className="num mt-1 truncate text-base font-semibold tracking-tight sm:text-xl">{value}</div>
      {sub && <div className="mt-0.5 text-xs">{sub}</div>}
    </div>
  );
}

export function SourceTag({ source }: { source: "live" | "partial" | "unavailable" }) {
  if (source === "live") return <span className="chip border-up/25 bg-up-soft text-up"><span className="size-1.5 rounded-full bg-up" />Live</span>;
  if (source === "partial") return <span className="chip" title="Protocol volume only — no pools sampled right now">Volume only</span>;
  return <span className="chip text-muted" title="No public source answered">No data</span>;
}

/** Formats a nullable number, rendering an em dash when missing. */
export function orDash<T>(v: T | null | undefined, f: (x: T) => string) {
  return v == null || (typeof v === "number" && !Number.isFinite(v)) ? "—" : f(v);
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-3">
      <h2 className="text-base font-semibold tracking-tight">{children}</h2>
      {right && <div className="ml-auto flex items-center gap-2">{right}</div>}
    </div>
  );
}
