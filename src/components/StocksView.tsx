"use client";
import { DividendBadge } from "./DividendBadge";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AssetTheme, PairAsset } from "@/lib/types";
import { pct, price } from "@/lib/format";
import { priceGap, usMarket } from "@/lib/market-hours";
import { AssetDot, Change, Hint, Verified } from "./ui";
import { QuickBuyAmount, QuickBuyButton } from "./QuickBuy";
import { XBuyButton } from "./XBuy";

type Sort = "gap" | "change24h" | "dividendYield" | "symbol";
type Tab = "stock" | "metals" | "crypto";
const THEMES: ("All" | AssetTheme)[] = ["All", "AI", "Meme", "Innovation", "Popular", "Index", "Crypto-linked"];
const THEME_HINT: Record<string, string> = {
  AI: "AI chips, cloud and software",
  Meme: "Retail favourites like GameStop",
  Innovation: "Biotech, pharma and new tech",
  Popular: "Household names",
  Index: "S&P 500 and Nasdaq 100 funds",
  "Crypto-linked": "Companies tied to Bitcoin and crypto",
};
const inTab = (a: PairAsset, t: Tab) =>
  t === "crypto" ? a.kind === "crypto" : t === "metals" ? a.kind === "commodity" || a.theme === "Metals" : a.kind === "stock" && a.theme !== "Metals";
const day = (ms: number) => new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export function StocksView({ assets }: { assets: PairAsset[] }) {
  const router = useRouter();
  const [kind, setKind] = useState<Tab>("stock");
  const [theme, setTheme] = useState<(typeof THEMES)[number]>("All");
  const [sort, setSort] = useState<Sort>("gap");
  const market = usMarket();
  const rows = useMemo(() => {
    // only what can actually be bought: a verified token on TON or Solana
    const list = assets.filter((a) => inTab(a, kind) && (kind !== "stock" || theme === "All" || a.theme === theme) && (a.oraclePriceUsd != null || a.tonPriceUsd != null || a.priceUsd != null) && (a.tonAddress || a.solanaMint));
    const v = (a: PairAsset) =>
      sort === "gap" ? Math.abs(priceGap(a.tonPriceUsd, a.oraclePriceUsd) ?? -1) : sort === "symbol" ? 0 : (a[sort] ?? -Infinity);
    return sort === "symbol" ? list.sort((a, b) => a.symbol.localeCompare(b.symbol)) : list.sort((a, b) => v(b) - v(a));
  }, [assets, kind, sort, theme]);
  const themeCount = (t: (typeof THEMES)[number]) => assets.filter((a) => inTab(a, "stock") && (t === "All" || a.theme === t) && (a.tonAddress || a.solanaMint)).length;

  const calendar = assets
    .filter((a) => a.kind === "stock" && a.nextDividendEst && a.lastDividend)
    .sort((a, b) => a.nextDividendEst! - b.nextDividendEst!);

  const H = ({ k, children, className = "text-right" }: { k: Sort; children: React.ReactNode; className?: string }) => (
    <th className={`font-medium ${className}`}>
      <button onClick={() => setSort(k)} className={sort === k ? "text-ink" : "hover:text-ink"}>{children}{sort === k && k !== "symbol" ? " ↓" : ""}</button>
    </th>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Stocks, metals &amp; Bitcoin</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-2">
            Verified tokenized shares, gold and the crypto majors you can buy with GRAM (on TON) or SOL (on Solana), and pair your jetton with. Only genuine tokens are listed. Compare prices with the real market and see when dividends are due.
          </p>
        </div>
        <span suppressHydrationWarning className="chip ml-auto" title="Regular NYSE/Nasdaq hours, New York time. Holidays not included.">
          <span className={`size-1.5 rounded-full ${market.open ? "bg-up" : "bg-muted"}`} />{market.label}
        </span>
      </div>

      <section className="card p-5">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            Price gap: TON vs real market
            <Hint>
              <b>Real price</b> is the Pyth oracle (Yahoo as a fallback), which follows the actual stock or gold market. <b>On TON</b> is what the jetton trades for on STON.fi right now. <b>Gap</b> is the difference. A positive gap means TON buyers are paying a premium, and a negative one means it&apos;s cheaper on TON than on the stock market. Gaps usually widen when the US market is closed (evenings and weekends) because TON keeps trading 24/7. xStocks fold dividends back into the token, so a small lasting premium can be normal.
            </Hint>
          </h2>
          <div className="seg ml-auto">
            <button data-on={kind === "stock"} onClick={() => setKind("stock")}>Stocks</button>
            <button data-on={kind === "metals"} onClick={() => setKind("metals")}>Metals</button>
            <button data-on={kind === "crypto"} onClick={() => setKind("crypto")}>Bitcoin &amp; majors</button>
          </div>
          <QuickBuyAmount />
        </div>
        {kind === "stock" && (
          <div className="scroll-x -mt-1 mb-3 flex gap-1.5">
            {THEMES.map((t) => {
              const n = themeCount(t);
              if (t !== "All" && !n) return null;
              return (
                <button key={t} title={THEME_HINT[t]} onClick={() => setTheme(t)} className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${theme === t ? "border-line-strong bg-line-strong text-ink" : "border-line text-ink-2 hover:border-line-strong hover:text-ink"}`}>
                  {t} <span className="text-muted">{n}</span>
                </button>
              );
            })}
          </div>
        )}
        <div className="scroll-x">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="text-left text-xs text-muted">
              <tr className="border-b border-line">
                <H k="symbol" className="py-2 text-left">Asset</H>
                <th className="text-right font-medium">Real price</th>
                <th className="text-right font-medium">On TON</th>
                <H k="gap">Gap</H>
                <H k="change24h">24h</H>
                <H k="dividendYield">Dividend</H>
                <th className="text-right font-medium">Next dividend</th>
                <th className="pl-3 text-right font-medium">Buy</th>
              </tr>
            </thead>
            <tbody className="num">
              {rows.map((a) => {
                const gap = priceGap(a.tonPriceUsd, a.oraclePriceUsd);
                return (
                  <tr key={a.symbol} onClick={() => router.push(`/stocks/${encodeURIComponent(a.symbol)}`)} className="cursor-pointer border-b border-line/60 last:border-0 hover:bg-surface-2/60">
                    <td className="py-2.5">
                      <div className="flex items-center gap-2.5">
                        <AssetDot asset={a} size={24} />
                        <div><Link href={`/stocks/${encodeURIComponent(a.symbol)}`} className="inline-flex items-center gap-1 font-medium hover:underline">{a.symbol}{a.verified && <Verified />}</Link><div className="text-[11px] text-muted">{a.name}{a.sector ? ` · ${a.sector}` : ""}</div></div>
                      </div>
                    </td>
                    <td className="text-right" title={a.priceSource ? `via ${a.priceSource}` : undefined}>{(a.oraclePriceUsd ?? a.priceUsd) != null ? price((a.oraclePriceUsd ?? a.priceUsd)!) : "—"}</td>
                    <td className="text-right">{a.tonPriceUsd != null ? price(a.tonPriceUsd) : <span className="text-xs text-muted">{a.solanaMint ? "on Solana" : "not on TON"}</span>}</td>
                    <td className={`text-right font-medium ${gap == null ? "text-muted" : Math.abs(gap) < 0.5 ? "text-ink-2" : gap > 0 ? "text-up" : "text-down"}`}>{gap == null ? "—" : pct(gap)}</td>
                    <td className="text-right text-xs"><Change value={a.change24h} /></td>
                    <td className="text-right"><DividendBadge asset={a} /></td>
                    <td className="text-right text-ink-2">{a.nextDividendEst ? `~${day(a.nextDividendEst)}` : "—"}</td>
                    <td className="pl-3 text-right">
                      {a.tonAddress ? <QuickBuyButton token={{ address: a.tonAddress, symbol: a.symbol }} /> : a.solanaMint ? <XBuyButton chain="solana" token={a.solanaMint} symbol={a.symbol} /> : <span className="text-xs text-muted">—</span>}
                    </td>
                  </tr>
                );
              })}
              {!rows.length && <tr><td colSpan={8} className="py-8 text-center text-muted">Nothing here right now: either no live price answered, or no verified token is available to buy.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="mb-4 flex items-center gap-1.5 text-sm font-semibold">
          Dividend calendar
          <Hint>
            The next payment date is estimated as the last payment plus the stock&apos;s usual interval (quarterly, monthly…), from Yahoo&apos;s dividend history, so treat it as roughly when, not an announced date. The amount is the last dividend per share. xStock holders don&apos;t receive cash: Backed reinvests dividends (after tax) into the token, so each xStock slowly grows relative to one share.
          </Hint>
        </h2>
        {calendar.length ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {calendar.map((a) => (
              <div key={a.symbol} className="flex items-center gap-3 rounded-lg bg-surface-2 p-3">
                <div className="w-12 text-center">
                  <div className="text-[10px] uppercase text-muted">{new Date(a.nextDividendEst!).toLocaleDateString(undefined, { month: "short" })}</div>
                  <div className="num text-lg font-semibold">~{new Date(a.nextDividendEst!).getDate()}</div>
                </div>
                <div className="min-w-0 text-xs">
                  <div className="text-sm font-medium">{a.symbol}</div>
                  <div className="num text-ink-2">${a.lastDividend!.amount.toFixed(3)} last · {a.dividendsPerYear}×/yr</div>
                  <div className="num text-muted">{a.dividendYield?.toFixed(2)}% yield</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-muted">No dividend history available right now (Yahoo didn&apos;t answer).</p>
        )}
      </section>
    </div>
  );
}
