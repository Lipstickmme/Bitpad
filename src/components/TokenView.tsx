"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { captureReferral } from "@/lib/referral";
import { ArrowLeft, ExternalLink, Globe, Rocket } from "lucide-react";
import type { MarketToken } from "@/lib/types";
import { price, usd, num, shortAddr } from "@/lib/format";
import { AssetDot, Change, PairBadge, Stat, TokenAvatar, orDash } from "./ui";
import { CopyButton } from "./CopyButton";
import { PriceChart } from "./PriceChart";
import { TradePanel } from "./TradePanel";
import { BitpadTradePanel } from "./bitpad/BitpadTradePanel";
import { ReferralPanel } from "./bitpad/ReferralPanel";
import { StakePanel } from "./bitpad/StakePanel";
import { PairValuation } from "./PairValuation";
import { ActivityTabs } from "./ActivityTabs";
import { TelegramIcon, XIcon } from "./Brand";
import { QuickBuyButton } from "./QuickBuy";

export function TokenView({ token }: { token: MarketToken }) {
  const [live, setLive] = useState<number | null>(token.priceUsd);
  // Remember the referral link this visitor arrived through (?ref=…) for this token's trades
  useEffect(() => {
    if (token.bitpad) captureReferral(token.address);
  }, [token.address, token.bitpad]);
  const px = live ?? token.priceUsd;
  const mcap = px != null && token.totalSupply ? px * token.totalSupply : token.marketCap ?? token.fdv;
  const dexUrl = token.dex?.includes("dedust") ? `https://dedust.io/swap/TON/${token.address}` : `https://app.ston.fi/swap?ft=TON&tt=${token.address}`;

  return (
    <div className="space-y-4">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink"><ArrowLeft className="size-4" /> Markets</Link>

      <div className="card">
        <div className="flex flex-wrap items-center gap-4 p-5">
          <TokenAvatar token={token} size={64} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">{token.symbol}</h1>
              <span className="text-ink-2">{token.name}</span>
              {token.bitpad && <span className="chip"><Rocket className="size-3" />Bitpad #{token.bitpad.index + 1}</span>}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-2">
              <span>Paired with</span> <AssetDot asset={token.pair} /> <span className="font-semibold text-ink">{token.pair.symbol}</span>
              <PairBadge asset={token.pair} />
              <CopyButton value={token.address} label={`CA ${shortAddr(token.address, 6, 6)}`} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <QuickBuyButton token={{ address: token.address, symbol: token.symbol, bitpadPool: token.bitpad?.pool }} className="h-9 px-3 text-sm" />
            {token.bitpad?.pool ? (
              <a className="btn btn-ghost" href={`https://tonviewer.com/${token.bitpad.pool}`} target="_blank" rel="noreferrer">Pool contract <ExternalLink className="size-3.5" /></a>
            ) : (
              <>
                <a className="btn btn-ghost" href={dexUrl} target="_blank" rel="noreferrer">{token.dex?.includes("dedust") ? "DeDust" : "STON.fi"} <ExternalLink className="size-3.5" /></a>
                {token.poolAddress && <a className="btn btn-ghost" href={`https://www.geckoterminal.com/ton/pools/${token.poolAddress}`} target="_blank" rel="noreferrer">GeckoTerminal <ExternalLink className="size-3.5" /></a>}
              </>
            )}
            <a className="btn btn-ghost" href={`https://tonviewer.com/${token.address}`} target="_blank" rel="noreferrer">Tonviewer <ExternalLink className="size-3.5" /></a>
          </div>
        </div>
        <div className="grid grid-cols-2 divide-line border-t border-line md:grid-cols-5 md:divide-x [&>*:nth-child(-n+2)]:border-b [&>*:nth-child(-n+2)]:border-line md:[&>*]:border-b-0">
          <Stat label="Market cap" value={orDash(mcap, (v) => usd(v))} />
          <Stat label="Token price" value={orDash(px, price)} sub={<Change value={token.change24h} />} />
          <Stat label="24h volume" value={orDash(token.volume24h, (v) => usd(v))} />
          <Stat label="Liquidity" value={orDash(token.liquidityUsd, (v) => usd(v))} />
          <Stat label="Holders" value={orDash(token.holders, (v) => num(v, 0))} className="col-span-2 md:col-span-1" />
        </div>
        <div className="border-t border-line px-5 py-2 text-[11px] text-muted">Data: {token.sources.join(" · ") || "—"}</div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:grid-rows-[auto_1fr]">
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <PriceChart token={token} onPrice={setLive} />
        </div>
        <div className="min-w-0 lg:col-start-1 lg:row-start-2">
          <ActivityTabs token={token} />
        </div>
        <aside className="space-y-4 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          {token.bitpad?.pool ? <BitpadTradePanel token={token} /> : <TradePanel token={token} livePrice={px} />}
          {token.bitpad?.pool && <StakePanel token={token} />}
          {token.bitpad?.pool && <ReferralPanel token={token} />}
          <PairValuation token={token} />
          <div className="card p-4">
            <h3 className="text-sm font-semibold">About</h3>
            {token.description && <p className="mt-2 text-sm text-ink-2">{token.description}</p>}
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-surface-2 p-2.5"><div className="text-muted">Supply</div><div className="num font-bold">{orDash(token.totalSupply, (v) => num(v, 0))}</div></div>
              <div className="rounded-lg bg-surface-2 p-2.5"><div className="text-muted">FDV</div><div className="num font-bold">{orDash(token.fdv, (v) => usd(v, { compact: true }))}</div></div>
              {token.bitpad?.creator && <div className="rounded-lg bg-surface-2 p-2.5"><div className="text-muted">Creator</div><a href={`https://tonviewer.com/${token.bitpad.creator}`} target="_blank" rel="noreferrer" className="font-mono font-bold hover:text-brand">{shortAddr(token.bitpad.creator)}</a></div>}
              {token.createdAt && <div className="rounded-lg bg-surface-2 p-2.5"><div className="text-muted">Pool created</div><div className="font-bold">{new Date(token.createdAt).toLocaleDateString()}</div></div>}
            </div>
            <div className="mt-3 flex gap-2">
              {token.socials?.telegram && <a href={token.socials.telegram} target="_blank" rel="noreferrer" className="btn btn-ghost h-9 w-9 px-0" aria-label="Telegram"><TelegramIcon /></a>}
              {token.socials?.x && <a href={token.socials.x} target="_blank" rel="noreferrer" className="btn btn-ghost h-9 w-9 px-0" aria-label="X"><XIcon /></a>}
              {token.socials?.website && <a href={token.socials.website} target="_blank" rel="noreferrer" className="btn btn-ghost h-9 w-9 px-0" aria-label="Website"><Globe className="size-4" /></a>}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
