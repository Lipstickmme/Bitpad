import { Landmark } from "lucide-react";
import type { BitpadToken } from "@/lib/types";
import { price, usd } from "@/lib/format";
import { CHAINS } from "@/lib/chains";
import { AssetDot, Change, PairBadge } from "./ui";

/** Valuation of the paired asset and what it means for the token's pool. */
export function PairValuation({ token }: { token: BitpadToken }) {
  const a = token.pair;
  const reserveUnits = token.pairReserveUsd / a.priceUsd;
  const divYear = token.pairReserveUsd * ((a.dividendYield ?? 0) / 100);
  const backingPer1m = (token.pairReserveUsd / token.totalSupply) * 1_000_000;

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2">
        <Landmark className="size-4 text-ink-2" />
        <h3 className="font-bold">Paired asset</h3>
        <span className="ml-auto"><PairBadge asset={a} /></span>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <AssetDot asset={a} size={40} />
        <div className="min-w-0">
          <div className="font-bold">{a.name} <span className="text-muted">· {a.symbol}</span></div>
          <div className="text-xs text-muted">{a.sector ?? a.kind} · native on {CHAINS[a.chain].name}</div>
        </div>
        <div className="ml-auto text-right">
          <div className="num font-bold">{price(a.priceUsd)}</div>
          <Change value={a.change24h} className="text-xs" />
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <Cell k="Pool reserve" v={`${usd(token.pairReserveUsd, { compact: true })}`} sub={`${reserveUnits.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${a.symbol}`} />
        <Cell k="Backing / 1M tokens" v={usd(backingPer1m)} />
        {a.underlyingMarketCap ? <Cell k="Underlying mkt cap" v={usd(a.underlyingMarketCap, { compact: true })} /> : null}
        {a.kind === "stock" && <Cell k="Dividend yield" v={a.dividendYield ? `${a.dividendYield.toFixed(2)}%` : "None"} sub={a.exDividend ? `Ex-div ${a.exDividend}` : undefined} />}
        {a.kind === "stock" && divYear > 0 && <Cell k="Pool dividends / yr (est.)" v={usd(divYear, { compact: true })} sub="Streamed to LP & flywheel" />}
      </dl>
      <p className="mt-3 text-[11px] leading-relaxed text-muted">
        Liquidity sits in a {token.symbol}/{a.symbol} pool from launch — no bonding curve. Price reflects both {token.symbol} demand and the {a.symbol} price, so the
        pool is partly backed by a real-world asset.
      </p>
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
