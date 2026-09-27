import { ExternalLink, Landmark } from "lucide-react";
import type { MarketToken } from "@/lib/types";
import { price, usd } from "@/lib/format";
import { CHAINS } from "@/lib/chains";
import { jupSwapUrl } from "@/lib/data/jupiter";
import { AssetDot, Change, PairBadge } from "./ui";

/** Live valuation of the paired asset (price, 24h, dividends) and what it means for the pool. */
export function PairValuation({ token }: { token: MarketToken }) {
  const a = token.pair;
  // For a 50/50 AMM pool, half the liquidity sits in the paired asset
  const reserveUsd = token.liquidityUsd != null ? token.liquidityUsd / 2 : null;
  const reserveUnits = reserveUsd != null && a.priceUsd ? reserveUsd / a.priceUsd : null;
  const divYear = reserveUsd != null && a.dividendYield ? reserveUsd * (a.dividendYield / 100) : null;
  const backingPer1m = reserveUsd != null && token.totalSupply ? (reserveUsd / token.totalSupply) * 1_000_000 : null;

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2">
        <Landmark className="size-4 text-ink-2" />
        <h3 className="text-sm font-semibold">Paired asset</h3>
        <span className="ml-auto"><PairBadge asset={a} /></span>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <AssetDot asset={a} size={40} />
        <div className="min-w-0">
          <div className="font-bold">{a.name} <span className="text-muted">· {a.symbol}</span></div>
          <div className="text-xs text-muted">{a.sector ?? a.kind} · native on {CHAINS[a.chain].name}</div>
        </div>
        <div className="ml-auto text-right">
          <div className="num font-bold">{a.priceUsd != null ? price(a.priceUsd) : "—"}</div>
          <Change value={a.change24h} className="text-xs" />
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <Cell k="Pool reserve" v={reserveUsd != null ? usd(reserveUsd, { compact: true }) : "—"} sub={reserveUnits != null ? `${reserveUnits.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${a.symbol}` : undefined} />
        <Cell k="Backing / 1M tokens" v={backingPer1m != null ? usd(backingPer1m) : "—"} />
        {a.kind === "stock" && (
          <Cell
            k="Dividend yield (TTM)"
            v={a.dividendYield == null ? "—" : a.dividendYield > 0 ? `${a.dividendYield.toFixed(2)}%` : "None"}
            sub={a.lastDividend ? `Last $${a.lastDividend.amount.toFixed(3)} · ${new Date(a.lastDividend.date * 1000).toLocaleDateString()}` : undefined}
          />
        )}
        {a.kind === "stock" && divYear != null && divYear > 0 && <Cell k="Pool-reserve dividends / yr" v={usd(divYear, { compact: true })} sub="at current yield" />}
      </dl>
      {a.priceSource && <p className="mt-2 text-[11px] text-muted">Price via {a.priceSource}{a.kind === "stock" ? " · dividends via Yahoo Finance" : ""}</p>}
      {a.solanaMint && (
        <a href={jupSwapUrl(a.solanaMint)} target="_blank" rel="noreferrer" className="btn btn-ghost mt-3 w-full text-xs">
          Buy {a.symbol} on Solana (Jupiter) <ExternalLink className="size-3.5" />
        </a>
      )}
      {a.tonAddress && a.symbol !== "TON" && (
        <a href={`https://app.ston.fi/swap?ft=TON&tt=${a.tonAddress}`} target="_blank" rel="noreferrer" className="btn btn-ghost mt-2 w-full text-xs">
          Buy {a.symbol} on TON (STON.fi) <ExternalLink className="size-3.5" />
        </a>
      )}
    </div>
  );
}

function Cell({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-surface-2 p-2.5">
      <dt className="text-muted">{k}</dt>
      <dd className="num mt-0.5 text-sm font-bold">{v}</dd>
      {sub && <dd className="text-muted">{sub}</dd>}
    </div>
  );
}
