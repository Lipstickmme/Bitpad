import Link from "next/link";
import type { MarketToken } from "@/lib/types";
import { price, usd } from "@/lib/format";
import { AssetDot, Change, PairBadge, Sparkline, TokenAvatar, changePath, orDash } from "./ui";
import { CopyButton } from "./CopyButton";

export function TokenCard({ token }: { token: MarketToken }) {
  const cap = token.marketCap ?? token.fdv;
  const spark = token.priceUsd && token.changes ? changePath(token.priceUsd, token.changes) : null;
  return (
    <Link href={`/token/${token.address}`} className="card group block p-4 transition-colors hover:border-line-strong">
      <div className="flex items-center gap-3">
        <TokenAvatar token={token} size={36} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold">{token.symbol}</span>
            {token.bitpad && <span className="chip border-brand/25 bg-brand-soft text-brand-ink">Bitpad</span>}
          </div>
          <div className="truncate text-xs text-muted">{token.name}</div>
        </div>
        <CopyButton value={token.address} label="CA" className="opacity-0 transition-opacity group-hover:opacity-100 max-sm:opacity-100" />
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] text-muted">Market cap</div>
          <div className="num text-lg font-semibold tracking-tight">{orDash(cap, (v) => usd(v, { compact: true }))}</div>
          <div className="num text-xs text-ink-2">{orDash(token.priceUsd, price)} <Change value={token.change24h} className="ml-1" /></div>
        </div>
        {spark && <Sparkline data={spark} width={84} height={32} />}
      </div>

      <div className="mt-3 flex items-center gap-1.5 border-t border-line pt-2.5 text-xs text-ink-2">
        <AssetDot asset={token.pair} size={14} />
        <span className="font-medium text-ink">{token.pair.symbol}</span>
        <PairBadge asset={token.pair} />
        <span className="num ml-auto text-muted">Vol {orDash(token.volume24h, (v) => usd(v, { compact: true }))}</span>
      </div>
    </Link>
  );
}
