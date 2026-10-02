import Link from "next/link";
import type { MarketToken } from "@/lib/types";
import { price, usd } from "@/lib/format";
import { AssetDot, Change, PairBadge, Sparkline, TokenAvatar, changePath, orDash, Verified } from "./ui";
import { CopyButton } from "./CopyButton";
import { QuickBuyButton } from "./QuickBuy";
import { hotReason, isHot } from "@/lib/spike";
import { HotFlame } from "./HotFlame";
import { coin } from "@/lib/coin";

export function TokenCard({ token }: { token: MarketToken }) {
  const cap = token.marketCap ?? token.fdv;
  const hot = isHot(token);
  const spark = token.priceUsd && token.changes ? changePath(token.priceUsd, token.changes) : null;
  return (
    <Link href={`/token/${token.address}`} title={hotReason(token)} className={`card group block p-4 transition-colors hover:border-brand/40 ${hot ? "hot-card" : ""}`}>
      <div className="flex items-center gap-3">
        <TokenAvatar token={token} size={36} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold">{token.symbol}</span>{token.verified && <Verified />}{hot && <HotFlame title={hotReason(token)} />}
            {token.bitpad && <span className="chip">Bitpad</span>}
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
        <span className="font-medium text-ink">{coin(token.pair.symbol)}</span>
        <PairBadge asset={token.pair} />
        <span className="num ml-auto text-muted">Vol {orDash(token.volume24h, (v) => usd(v, { compact: true }))}</span>
        <QuickBuyButton token={{ address: token.address, symbol: token.symbol, bitpadPool: token.bitpad?.pool }} className="ml-1" />
      </div>
    </Link>
  );
}
