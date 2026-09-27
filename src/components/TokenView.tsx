"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ExternalLink, Globe } from "lucide-react";
import type { BitpadToken } from "@/lib/types";
import { price, usd, num, shortAddr } from "@/lib/format";
import { AssetDot, Change, PairBadge, SourceTag, Stat, TokenAvatar } from "./ui";
import { CopyButton } from "./CopyButton";
import { PriceChart } from "./PriceChart";
import { TradePanel } from "./TradePanel";
import { PairValuation } from "./PairValuation";
import { ActivityTabs } from "./ActivityTabs";
import { TelegramIcon, XIcon } from "./Brand";

const STATUS: Record<BitpadToken["status"], { label: string; cls: string }> = {
  new: { label: "New", cls: "bg-brand-soft text-brand-ink border-brand/20" },
  live: { label: "Live pool", cls: "bg-up-soft text-up border-up/25" },
  trending: { label: "Trending", cls: "bg-warn-soft text-warn border-warn/25" },
  graduated: { label: "Blue chip", cls: "bg-surface-2 text-ink-2" },
};

export function TokenView({ token }: { token: BitpadToken }) {
  const [live, setLive] = useState(token.priceUsd);
  const mcap = live * token.totalSupply;
  const st = STATUS[token.status];

  return (
    <div className="space-y-4">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink"><ArrowLeft className="size-4" /> Markets</Link>

      <div className="card">
        <div className="flex flex-wrap items-center gap-4 p-5">
          <TokenAvatar token={token} size={64} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-extrabold tracking-tight">{token.symbol}</h1>
              <span className={`chip ${st.cls}`}>{st.label}</span>
              <SourceTag source={token.source} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-2">
              <span>${token.symbol}</span> · <span>Paired with</span> <AssetDot asset={token.pair} /> <span className="font-semibold text-ink">{token.pair.symbol}</span>
              <PairBadge asset={token.pair} />
              <CopyButton value={token.address} label={`CA ${shortAddr(token.address, 6, 6)}`} />
            </div>
          </div>
          <div className="flex gap-2 sm:ml-auto">
            <a className="btn btn-ghost" href={`https://app.ston.fi/swap?ft=TON&tt=${token.address}`} target="_blank" rel="noreferrer">STON.fi <ExternalLink className="size-3.5" /></a>
            <a className="btn btn-ghost" href={`https://tonviewer.com/${token.address}`} target="_blank" rel="noreferrer">Tonviewer <ExternalLink className="size-3.5" /></a>
          </div>
        </div>
        <div className="grid grid-cols-2 divide-line border-t border-line md:grid-cols-5 md:divide-x [&>*:nth-child(-n+2)]:border-b [&>*:nth-child(-n+2)]:border-line md:[&>*]:border-b-0">
          <Stat label="Market cap" value={usd(mcap)} />
          <Stat label="Token price" value={price(live)} sub={<Change value={token.change24h} />} />
          <Stat label="24h volume" value={usd(token.volume24h)} />
          <Stat label="Liquidity" value={usd(token.liquidityUsd)} />
          <Stat label="FDV" value={usd(mcap)} className="col-span-2 md:col-span-1" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:grid-rows-[auto_1fr]">
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <PriceChart token={token} onPrice={setLive} />
        </div>
        <div className="min-w-0 lg:col-start-1 lg:row-start-2">
          <ActivityTabs token={token} />
        </div>
        <aside className="space-y-4 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <TradePanel token={token} livePrice={live} />
          <PairValuation token={token} />
          <div className="card p-4">
            <h3 className="font-bold">About</h3>
            <p className="mt-2 text-sm text-ink-2">{token.description}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-surface-2 p-2.5"><div className="text-muted">Holders</div><div className="num font-bold">{num(token.holders, 0)}</div></div>
              <div className="rounded-lg bg-surface-2 p-2.5"><div className="text-muted">Supply</div><div className="num font-bold">{num(token.totalSupply, 0)}</div></div>
              <div className="rounded-lg bg-surface-2 p-2.5"><div className="text-muted">Creator</div><div className="font-mono font-bold">{shortAddr(token.creator)}</div></div>
              <div className="rounded-lg bg-surface-2 p-2.5"><div className="text-muted">Launched</div><div className="font-bold">{new Date(token.createdAt).toLocaleDateString()}</div></div>
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
