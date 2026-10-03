"use client";
import { useState } from "react";
import Link from "next/link";
import type { StockPaired, XStock } from "@/lib/xchain-stocks";
import { CHAINS } from "@/lib/chains";
import { price, usd } from "@/lib/format";
import { Change, Hint, Verified } from "./ui";
import { XBuyButton, xBuyable } from "./XBuy";
import { Pager } from "./Pager";

const PAGE = 15;

/** Tokenized stocks & gold on Solana / EVM chains, and tokens that trade against them. */
export function XChainStocks({ assets, paired, live }: { assets: XStock[]; paired: StockPaired[]; live: boolean }) {
  const [kind, setKind] = useState<"all" | "stock" | "commodity">("all");
  const [page, setPage] = useState(0);
  const rows = assets.filter((a) => kind === "all" || a.kind === kind);
  const shown = rows.slice(page * PAGE, page * PAGE + PAGE);
  const Img = ({ src }: { src?: string }) =>
    // eslint-disable-next-line @next/next/no-img-element
    src ? <img src={src} alt="" className="size-6 shrink-0 rounded-full" /> : <span className="size-6 shrink-0 rounded-full bg-surface-2" />;

  return (
    <>
      <section className="card p-5">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            On Solana &amp; EVM chains
            <Hint>
              The same kind of tokenized shares and gold, issued on other chains: xStocks and Ondo Global Markets tokens (each backed by the real share), plus PAX Gold and Tether Gold. Found live on DexScreener, then checked: only the genuine contract is listed (Jupiter-verified on Solana, CoinGecko-listed under the same ticker on EVM chains), so look-alike fakes are left out even when they have liquidity. Each asset appears once per chain, as the most liquid verified token, which is the cheapest to buy. ⚡ buys it with that chain&apos;s coin from Phantom or MetaMask, through LI.FI.
            </Hint>
          </h2>
          <div className="seg ml-auto">
            {(["all", "stock", "commodity"] as const).map((k) => (
              <button key={k} data-on={kind === k} onClick={() => { setKind(k); setPage(0); }}>{k === "all" ? "All" : k === "stock" ? "Stocks" : "Gold"}</button>
            ))}
          </div>
        </div>
        <div className="scroll-x">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="text-left text-xs text-muted">
              <tr className="border-b border-line">
                <th className="py-2 font-medium">Asset</th>
                <th className="font-medium">Chain</th>
                <th className="text-right font-medium">Price</th>
                <th className="text-right font-medium">24h</th>
                <th className="text-right font-medium">Liquidity</th>
                <th className="text-right font-medium">Volume 24h</th>
                <th className="pl-3 text-right font-medium">Buy</th>
              </tr>
            </thead>
            <tbody className="num">
              {shown.map((a) => (
                <tr key={`${a.chain}:${a.address}`} className="border-b border-line/60 last:border-0 hover:bg-surface-2/60">
                  <td className="py-2.5">
                    <a href={a.url} target="_blank" rel="noreferrer" className="flex items-center gap-2.5">
                      <Img src={a.image} />
                      <div><div className="flex items-center gap-1 font-medium hover:underline">{a.symbol}{a.verified && <Verified />}</div><div className="text-[11px] text-muted">{a.underlying} · {a.issuer}</div></div>
                    </a>
                  </td>
                  <td className="text-ink-2">{CHAINS[a.chain]?.name ?? a.chain}</td>
                  <td className="text-right">{a.priceUsd != null ? price(a.priceUsd) : "—"}</td>
                  <td className="text-right text-xs"><Change value={a.change24h} /></td>
                  <td className="text-right">{usd(a.liquidityUsd, { compact: true })}</td>
                  <td className="text-right">{usd(a.volume24h, { compact: true })}</td>
                  <td className="pl-3 text-right">{xBuyable(a.chain) ? <XBuyButton chain={a.chain} token={a.address} symbol={a.symbol} /> : <span className="text-xs text-muted">—</span>}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={7} className="py-8 text-center text-muted">{live ? "Nothing found with enough liquidity right now." : "DexScreener didn't answer."}</td></tr>}
            </tbody>
          </table>
        </div>
        <Pager page={page} pageSize={PAGE} total={rows.length} onPage={setPage} />
      </section>

      <section className="card p-5">
        <h2 className="mb-4 flex items-center gap-1.5 text-sm font-semibold">
          Tokens paired with stocks
          <Hint>
            Popular tokens whose pool is quoted in a tokenized stock or gold (for example launches paired with TSLAx or NVDAx on Solana) instead of SOL or ETH. Sorted by 24h volume. Only pools with at least $5k liquidity and $1k daily volume are shown.
          </Hint>
        </h2>
        <div className="scroll-x">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="text-left text-xs text-muted">
              <tr className="border-b border-line">
                <th className="py-2 font-medium">Token</th>
                <th className="font-medium">Chain · DEX</th>
                <th className="text-right font-medium">Price</th>
                <th className="text-right font-medium">24h</th>
                <th className="text-right font-medium">Mcap</th>
                <th className="text-right font-medium">Volume 24h</th>
                <th className="pl-3 text-right font-medium">Buy</th>
              </tr>
            </thead>
            <tbody className="num">
              {paired.map((p) => (
                <tr key={`${p.chain}:${p.pairAddress}`} className="border-b border-line/60 last:border-0 hover:bg-surface-2/60">
                  <td className="py-2.5">
                    <Link href={`/pool/${p.chain}/${p.pairAddress}`} className="flex items-center gap-2.5">
                      <Img src={p.image} />
                      <div><div className="font-medium hover:underline">{p.base}<span className="font-normal text-muted"> / {p.quote}</span></div><div className="max-w-[180px] truncate text-[11px] text-muted">{p.baseName}</div></div>
                    </Link>
                  </td>
                  <td className="text-ink-2">{CHAINS[p.chain]?.name ?? p.chain}<span className="text-muted"> · {p.dex}</span></td>
                  <td className="text-right">{p.priceUsd != null ? price(p.priceUsd) : "—"}</td>
                  <td className="text-right text-xs"><Change value={p.change24h} /></td>
                  <td className="text-right">{p.marketCap ? usd(p.marketCap, { compact: true }) : "—"}</td>
                  <td className="text-right">{usd(p.volume24h, { compact: true })}</td>
                  <td className="pl-3 text-right">{xBuyable(p.chain) ? <XBuyButton chain={p.chain} token={p.baseAddress} symbol={p.base} /> : <span className="text-xs text-muted">—</span>}</td>
                </tr>
              ))}
              {!paired.length && <tr><td colSpan={7} className="py-8 text-center text-muted">{live ? "No stock-paired pools with enough activity right now." : "DexScreener didn't answer."}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
