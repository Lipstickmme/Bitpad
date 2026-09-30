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
    <span className="inline-grid shrink-0 place-items-center rounded-full bg-line-strong font-bold text-ink" style={{ width: size, height: size, fontSize: size * 0.4 }} aria-hidden>
      {asset.symbol.replace(/x$/, "").slice(0, 2)}
    </span>
  );
}

export function PairBadge({ asset }: { asset: PairAsset }) {
  return <span className="chip">{asset.badge}</span>;
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
  if (source === "live") return <span className="chip"><span className="size-1.5 rounded-full bg-up" />Live</span>;
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
      <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight"><span className="h-4 w-1 rounded-full bg-brand" aria-hidden />{children}</h2>
      {right && <div className="ml-auto flex items-center gap-2">{right}</div>}
    </div>
  );
}

/** ⓘ with an explanation on hover, focus or tap. */
export function Hint({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <span className="group relative inline-flex align-middle">
      <button type="button" aria-label="What is this?" className="grid size-4 place-items-center rounded-full text-muted outline-none hover:text-ink focus-visible:text-ink">
        <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
          <circle cx="8" cy="8" r="6.3" />
          <path d="M8 7.2v3.6M8 5.1v.1" strokeLinecap="round" />
        </svg>
      </button>
      <span
        role="tooltip"
        className={`pointer-events-none absolute top-6 z-30 hidden w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-line-strong bg-surface-2 p-3 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-ink-2 shadow-2xl shadow-black/50 group-focus-within:block group-hover:block ${align === "right" ? "right-0" : "left-0"}`}
      >
        {children}
      </span>
    </span>
  );
}
