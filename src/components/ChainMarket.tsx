"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import type { TrendingPool } from "@/lib/types";
import type { ChainMarket as Data, MarketChain } from "@/lib/chain-market";
import { pct, price, usd } from "@/lib/format";
import { Hint, Verified } from "./ui";
import { XBuyButton, xBuyable } from "./XBuy";
import { Pager } from "./Pager";
import { volumeSpike } from "@/lib/spike";
import { coin } from "@/lib/coin";

const PAGE = 15;
const NATIVE: Record<MarketChain, { name: string; coin: string; kind: TrendingPool["quoteKind"] }> = {
  ethereum: { name: "Ethereum", coin: "ETH", kind: "eth" },
  solana: { name: "Solana", coin: "SOL", kind: "sol" },
};
type Tab = "stocks" | "trending" | "top" | "native" | "stable" | "other";

/** ETH / SOL market below the TON market: stock pairs first, then trending, top and pools grouped by what they're paired with. */
export function ChainMarket({ chain }: { chain: MarketChain }) {
  const n = NATIVE[chain];
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<Tab>("stocks");
  const [page, setPage] = useState(0);

  useEffect(() => {
    fetch(`/api/chain-market?chain=${chain}`).then((r) => r.json()).then(setData).catch(() => setFailed(true));
  }, [chain]);

  const all = useMemo(() => (data ? [...data.top, ...data.trending.filter((t) => !data.top.some((x) => x.id === t.id))] : []), [data]);
  const rows = useMemo(() => {
    if (!data) return [];
    switch (tab) {
      case "stocks": return data.stocks;
      case "trending": return data.trending;
      case "top": return data.top;
      case "native": return all.filter((p) => p.quoteKind === n.kind);
      case "stable": return all.filter((p) => p.quoteKind === "stable");
      case "other": return all.filter((p) => p.quoteKind !== n.kind && p.quoteKind !== "stable");
    }
  }, [data, tab, all, n.kind]);
  // Show the stock tab only when there's something in it
  const tabs: [Tab, string][] = [
    ...(data?.stocks.length ? [["stocks", "Stock pairs"] as [Tab, string]] : []),
    ["trending", "Trending"], ["top", "Top"], ["native", `${n.coin} pairs`], ["stable", "Stable pairs"], ["other", "Other pairs"],
  ];
  const active = data && !data.stocks.length && tab === "stocks" ? "trending" : tab;
  const shown = (active === tab ? rows : data?.trending ?? []).slice(page * PAGE, (page + 1) * PAGE);
  const total = (active === tab ? rows : data?.trending ?? []).length;

  return (
    <div id={`${chain}-market`} className="scroll-mt-20">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-1.5 text-base font-semibold tracking-tight">
          {n.name} market
          <Hint>Live from GeckoTerminal and DexScreener. <b>Stock pairs</b> are tokenized stocks and gold on {n.name} (xStocks, Ondo, PAX Gold, Tether Gold) and popular tokens traded against them. The other tabs group {n.name}&apos;s trending and top pools by what they&apos;re paired with. ⚡ pays in {n.coin} from {chain === "solana" ? "Phantom" : "MetaMask"}, on LI.FI&apos;s best route.</Hint>
        </h2>
        <div className="seg ml-auto max-w-full overflow-x-auto">
          {tabs.map(([k, label]) => <button key={k} data-on={active === k} onClick={() => { setTab(k); setPage(0); }}>{label}</button>)}
        </div>
      </div>
      <div className="card overflow-hidden">
        <div className="scroll-x">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="text-left text-xs text-muted">
              <tr className="border-b border-line">
                <th className="px-4 py-2 font-medium">Token</th><th className="font-medium">DEX</th>
                <th className="text-right font-medium">Price</th><th className="text-right font-medium">24h</th>
                <th className="text-right font-medium">Mcap</th><th className="text-right font-medium">Volume</th><th className="text-right font-medium">Liquidity</th>
                <th className="px-4 text-right font-medium">Buy</th>
              </tr>
            </thead>
            <tbody className="num">
              {shown.map((p) => <Row key={p.id} p={p} />)}
              {!data && !failed && Array.from({ length: 5 }, (_, i) => <tr key={i} className="border-b border-line/60"><td colSpan={8} className="px-4 py-3"><div className="h-4 animate-pulse rounded bg-surface-2" /></td></tr>)}
              {data && !shown.length && <tr><td colSpan={8} className="py-8 text-center text-muted">{data.live ? "Nothing in this group right now." : "GeckoTerminal didn't respond. Try again in a minute."}</td></tr>}
              {failed && <tr><td colSpan={8} className="py-8 text-center text-muted">Couldn&apos;t load the {n.name} market. Try again in a minute.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <Pager page={page} pageSize={PAGE} total={total} onPage={setPage} />
    </div>
  );
}

function Row({ p }: { p: TrendingPool }) {
  const mcap = p.marketCap || p.fdv || null;
  const label = <>{p.base}{p.verified && <Verified className="ml-1 size-3.5 align-[-2px]" />}{p.quote && <span className="font-normal text-muted"> / {coin(p.quote)}</span>}</>;
  return (
    <tr title={volumeSpike(p) ? "Unusual volume right now" : undefined} className={`border-b border-line/60 last:border-0 hover:bg-surface-2/60 ${volumeSpike(p) ? "spike" : ""}`}>
      <td className="px-4 py-2.5 font-medium">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {p.baseImage ? <img src={p.baseImage} alt="" className="size-5 rounded-full" loading="lazy" /> : <span className="size-5 rounded-full bg-surface-2" />}
          {p.poolAddress ? <Link href={`/pool/${p.chain}/${p.poolAddress}`} className="hover:underline">{label}</Link> : p.url ? <a href={p.url} target="_blank" rel="noreferrer" className="hover:underline">{label}</a> : label}
        </div>
      </td>
      <td className="text-xs text-ink-2">{p.dex}</td>
      <td className="text-right">{p.priceUsd ? price(p.priceUsd) : "—"}</td>
      <td className={`text-right font-medium ${p.change24h >= 0 ? "text-up" : "text-down"}`}>{pct(p.change24h)}</td>
      <td className="text-right" title={!p.marketCap && p.fdv ? "Fully diluted value (market cap not reported)" : undefined}>{mcap ? usd(mcap, { compact: true }) : "—"}</td>
      <td className="text-right">{usd(p.volume24h, { compact: true })}</td>
      <td className="text-right">{usd(p.liquidityUsd, { compact: true })}</td>
      <td className="px-4 text-right">
        {p.baseAddress && xBuyable(p.chain) ? <XBuyButton chain={p.chain} token={p.baseAddress} symbol={p.base} /> : p.url ? <a href={p.url} target="_blank" rel="noreferrer" className="inline-flex text-muted hover:text-ink" aria-label="Open pool"><ExternalLink className="size-3.5" /></a> : null}
      </td>
    </tr>
  );
}
