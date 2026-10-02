"use client";
import { DividendBadge } from "./DividendBadge";
import type { PairAsset } from "@/lib/types";
import { pct, price } from "@/lib/format";
import { priceGap } from "@/lib/market-hours";
import { AssetDot, Change, Hint } from "./ui";
import { CandleChart } from "./CandleChart";
import { QuickBuyAmount, QuickBuyButton } from "./QuickBuy";
import { XBuyButton } from "./XBuy";

export function StockDetail({ asset: a }: { asset: PairAsset }) {
  const gap = priceGap(a.tonPriceUsd, a.oraclePriceUsd);
  const day = (ms: number) => new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0 space-y-4">
        <div className="card flex flex-wrap items-center gap-4 p-5">
          <AssetDot asset={a} size={48} />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{a.symbol}</h1>
            <div className="text-sm text-ink-2">{a.name}{a.sector ? ` · ${a.sector}` : ""}</div>
          </div>
          <div className="num ml-auto text-right">
            <div className="text-2xl font-semibold">{a.oraclePriceUsd != null ? price(a.oraclePriceUsd) : a.priceUsd != null ? price(a.priceUsd) : "—"}</div>
            <Change value={a.change24h} className="text-sm" />
          </div>
        </div>
        <CandleChart
          url={`/api/stocks/${encodeURIComponent(a.symbol)}/candles`}
          symbol={a.symbol}
          timeframes={["15m", "1h", "1D", "1W"]}
          initial="1D"
          title="Price"
          sources={[{ id: "market", label: "Real market" }, ...(a.tonAddress ? [{ id: "ton", label: "On TON" }] : [])]}
        />
      </div>
      <aside className="space-y-4">
        <div className="card space-y-3 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Buy {a.symbol}</span>
            <QuickBuyAmount />
          </div>
          {a.tonAddress ? (
            <div className="flex items-center justify-between text-sm"><span className="text-ink-2">On TON via STON.fi</span><QuickBuyButton token={{ address: a.tonAddress, symbol: a.symbol }} className="h-9 px-3 text-sm" /></div>
          ) : a.solanaMint ? (
            <div className="flex items-center justify-between text-sm"><span className="text-ink-2">On Solana via LI.FI</span><XBuyButton chain="solana" token={a.solanaMint} symbol={a.symbol} className="h-9 px-3 text-sm" /></div>
          ) : (
            <p className="text-sm text-muted">Not tradable on-chain yet, price only.</p>
          )}
        </div>
        <div className="card space-y-2 p-4 text-sm">
          <Row k="Real price" v={a.oraclePriceUsd != null ? price(a.oraclePriceUsd) : "—"} hint="Pyth oracle, or Yahoo Finance as a fallback. It follows the real stock or gold market." />
          <Row k="On TON" v={a.tonPriceUsd != null ? price(a.tonPriceUsd) : "not listed"} />
          <Row k="Gap" v={gap != null ? pct(gap) : "—"} hint="How far the TON price is from the real market. Positive means TON buyers pay a premium. It's usually wider when the US market is closed." />
          {a.kind === "stock" && (
            <>
              <Row k="Dividend score" v={<DividendBadge asset={a} />} />
              <Row k="Last dividend" v={a.lastDividend ? `$${a.lastDividend.amount.toFixed(3)} · ${day(a.lastDividend.date * 1000)}` : "—"} />
              <Row k="Next (est.)" v={a.nextDividendEst ? `~${day(a.nextDividendEst)}` : "—"} hint="Last payment plus the usual interval. An estimate, not an announced date. xStocks reinvest dividends into the token instead of paying cash." />
            </>
          )}
          {a.tonAddress && <Row k="TON jetton" v={<a className="font-mono text-xs hover:text-ink" href={`https://tonviewer.com/${a.tonAddress}`} target="_blank" rel="noreferrer">{a.tonAddress.slice(0, 6)}…{a.tonAddress.slice(-4)}</a>} />}
        </div>
      </aside>
    </div>
  );
}

function Row({ k, v, hint }: { k: string; v: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-1 text-muted">{k}{hint && <Hint align="right">{hint}</Hint>}</span>
      <span className="num text-right font-medium">{v}</span>
    </div>
  );
}
