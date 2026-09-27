import type { BitpadToken, PairAsset } from "@/lib/types";
import { DEMO_EMOJI } from "@/lib/demo";
import { pct } from "@/lib/format";

export function TokenAvatar({ token, size = 48 }: { token: Pick<BitpadToken, "symbol" | "image">; size?: number }) {
  const emoji = DEMO_EMOJI[token.symbol];
  return (
    <div className="grid shrink-0 place-items-center overflow-hidden rounded-full border border-line bg-surface-2" style={{ width: size, height: size, fontSize: size * 0.48 }}>
      {token.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={token.image} alt="" className="size-full object-cover" />
      ) : emoji ? (
        <span aria-hidden>{emoji}</span>
      ) : (
        <span className="text-xs font-bold text-ink-2">{token.symbol.slice(0, 3)}</span>
      )}
    </div>
  );
}

export function AssetDot({ asset, size = 18 }: { asset: Pick<PairAsset, "symbol" | "color">; size?: number }) {
  return (
    <span className="inline-grid shrink-0 place-items-center rounded-full font-black text-white" style={{ width: size, height: size, background: asset.color, fontSize: size * 0.42 }} aria-hidden>
      {asset.symbol.replace(/x$/, "").slice(0, 2)}
    </span>
  );
}

export function PairBadge({ asset }: { asset: PairAsset }) {
  const tone =
    asset.kind === "stock" ? "bg-brand-soft text-brand-ink border-brand/20"
    : asset.kind === "commodity" ? "bg-warn-soft text-warn border-warn/25"
    : asset.kind === "jetton" ? "bg-[#e6f5fd] text-[#0077b6] border-[#0098ea]/20"
    : "bg-surface-2 text-ink-2 border-line";
  return <span className={`chip ${tone}`}>{asset.badge}</span>;
}

export function Change({ value, className = "" }: { value: number; className?: string }) {
  return <span className={`num font-semibold ${value >= 0 ? "text-up" : "text-down"} ${className}`}>{pct(value)}</span>;
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
    <div className={`min-w-0 px-4 py-3.5 ${className}`}>
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className="num mt-1 truncate text-lg font-bold tracking-tight sm:text-xl">{value}</div>
      {sub && <div className="mt-0.5 text-xs">{sub}</div>}
    </div>
  );
}

export function SourceTag({ source }: { source: "live" | "demo" }) {
  return source === "live" ? (
    <span className="chip border-up/25 bg-up-soft text-up"><span className="size-1.5 rounded-full bg-up" />Live</span>
  ) : (
    <span className="chip" title="Seeded preview data — replaced by live indexer data once connected">Preview</span>
  );
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-3">
      <h2 className="text-lg font-bold tracking-tight">{children}</h2>
      {right && <div className="ml-auto flex items-center gap-2">{right}</div>}
    </div>
  );
}
