"use client";
import type { PairAsset } from "@/lib/types";
import Link from "next/link";
import { pct, price } from "@/lib/format";
import { priceGap } from "@/lib/market-hours";
import { AssetDot, Change, Hint } from "./ui";
import { QuickBuyButton } from "./QuickBuy";
import { XBuyButton } from "./XBuy";

/**
 * Tokenized stocks & gold, live. xStocks (Backed Finance, 1:1 custodied) trade
 * natively on TON through STON.fi, so ⚡ buys them with TON; if a ticker has no
 * TON listing yet but exists on Solana, ⚡ buys the Solana xStock instead.
 */
export function StockBoard({ assets }: { assets: PairAsset[] }) {
  const rows = assets.filter((a) => (a.kind === "stock" || a.kind === "commodity") && a.priceUsd != null);
  if (!rows.length) return null;
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight"><span className="h-4 w-1 rounded-full bg-gold" aria-hidden />Stocks &amp; gold on TON</h2>
        <Hint>
          Tokenized equities (xStocks by Backed Finance, each backed 1:1 by the real share held by a regulated custodian) and gold, the same assets you can pair a jetton with. Prices come from Pyth&apos;s oracle, with Yahoo and Jupiter as fallbacks. ⚡ buys the TON jetton through STON.fi, or the Solana version through Jupiter when there&apos;s no TON listing. xStocks aren&apos;t available to US persons, and STON.fi may check eligibility.
        </Hint>
        <Link href="/stocks" className="ml-auto text-sm text-muted hover:text-ink">Price gaps &amp; dividends →</Link>
      </div>
      <div className="scroll-x flex gap-3 pb-1">
        {rows.map((a) => (
          <div key={a.symbol} className="card flex w-[180px] shrink-0 flex-col gap-2 p-3 transition-colors hover:border-gold/40">
            <div className="flex items-center gap-2">
              <AssetDot asset={a} size={24} />
              <div className="min-w-0">
                <Link href={`/stocks/${encodeURIComponent(a.symbol)}`} className="text-sm font-semibold hover:underline">{a.symbol}</Link>
                <div className="truncate text-[11px] text-muted">{a.name}</div>
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="num text-sm">{price(a.priceUsd!)}</span>
              <Change value={a.change24h} className="text-xs" />
            </div>
            {(() => {
              const gap = priceGap(a.tonPriceUsd, a.oraclePriceUsd);
              return (
                <div className="num flex justify-between text-[11px] text-muted">
                  <span>{a.dividendYield ? `${a.dividendYield.toFixed(2)}% div.` : a.kind === "stock" ? "no dividend" : a.sector}</span>
                  {gap != null && <span title="On-TON price vs real-market price">{pct(gap)} gap</span>}
                </div>
              );
            })()}
            <div className="flex items-center justify-between text-[11px] text-muted">
              {a.tonAddress ? (
                <>
                  <span>on TON</span>
                  <QuickBuyButton token={{ address: a.tonAddress, symbol: a.symbol }} />
                </>
              ) : a.solanaMint ? (
                <>
                  <span>on Solana</span>
                  <XBuyButton chain="solana" token={a.solanaMint} symbol={a.symbol} />
                </>
              ) : (
                <span>price only</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
