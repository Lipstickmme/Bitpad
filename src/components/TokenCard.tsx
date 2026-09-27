import Link from "next/link";
import { Gift, RefreshCw } from "lucide-react";
import type { BitpadToken } from "@/lib/types";
import { usd } from "@/lib/format";
import { AssetDot, Change, PairBadge, Sparkline, TokenAvatar } from "./ui";
import { CopyButton } from "./CopyButton";

export function TokenCard({ token }: { token: BitpadToken }) {
  return (
    <Link href={`/token/${token.address}`} className="card group relative block overflow-hidden p-5 transition-shadow hover:border-line-strong hover:shadow-[0_6px_24px_rgb(12_23_38/0.07)]">
      {/* Big faded paired-asset coin, like the reference design */}
      <div className="pointer-events-none absolute -right-10 top-1/2 hidden -translate-y-1/2 sm:block" aria-hidden>
        <div className="grid size-48 place-items-center rounded-full border border-line/80">
          <div className="grid size-36 place-items-center rounded-full text-4xl font-black text-white opacity-90 transition-transform group-hover:scale-105" style={{ background: token.pair.color }}>
            {token.pair.symbol.replace(/x$/, "").slice(0, 4)}
          </div>
        </div>
      </div>

      <div className="relative flex items-start justify-between">
        <TokenAvatar token={token} size={48} />
        <div className="flex items-center gap-1.5">
          <span className="grid size-7 place-items-center rounded-full border border-line bg-surface text-muted" title="Holder rewards"><Gift className="size-3.5" /></span>
          <span className="grid size-7 place-items-center rounded-full border border-line bg-surface text-muted" title="Fee flywheel"><RefreshCw className="size-3.5" /></span>
          <CopyButton value={token.address} label="CA" />
        </div>
      </div>

      <div className="relative mt-5 max-w-[70%] sm:max-w-[62%]">
        <div className="text-sm font-bold text-brand">${token.symbol}</div>
        <div className="truncate text-sm text-ink-2">{token.name}</div>
        <div className="num mt-1.5 text-3xl font-extrabold tracking-tight">{usd(token.marketCap, { compact: true })}</div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-sm text-ink-2">
          Paired with <AssetDot asset={token.pair} /> <span className="font-semibold text-ink">{token.pair.symbol}</span> <PairBadge asset={token.pair} />
        </div>
      </div>

      <div className="relative mt-4 flex items-center gap-3 border-t border-line pt-3 sm:max-w-[62%]">
        <span className="num text-xs text-muted">Vol {usd(token.volume24h, { compact: true })}</span>
        <Change value={token.change24h} className="text-xs" />
        <div className="ml-auto"><Sparkline data={token.spark} width={90} height={28} /></div>
      </div>
    </Link>
  );
}
