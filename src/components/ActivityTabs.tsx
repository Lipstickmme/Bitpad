"use client";
import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import type { MarketToken, Holder, Trade } from "@/lib/types";
import { ago, num, price, shortAddr, usd } from "@/lib/format";

export function ActivityTabs({ token }: { token: MarketToken }) {
  const [tab, setTab] = useState<"trades" | "holders">("trades");
  const [trades, setTrades] = useState<Trade[]>([]);
  const [holders, setHolders] = useState<Holder[]>([]);
  const [, tick] = useState(0);

  const [tradeSrc, setTradeSrc] = useState<string | null>(null);
  const [holderSrc, setHolderSrc] = useState<string | null>(null);
  const [holderTotal, setHolderTotal] = useState<number | null>(token.holders);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const loadTrades = () =>
      fetch(`/api/token/${token.address}/trades`)
        .then((r) => r.json())
        .then((d) => {
          if (!alive) return;
          setTrades(d.trades ?? []);
          setTradeSrc(d.source ?? null);
        })
        .catch(() => {})
        .finally(() => alive && setLoading(false));
    loadTrades();
    fetch(`/api/token/${token.address}/holders`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setHolders(d.holders ?? []);
        setHolderSrc(d.source ?? null);
        if (d.total != null) setHolderTotal(d.total);
      })
      .catch(() => {});
    const poll = setInterval(loadTrades, 15_000);
    const clock = setInterval(() => tick((n) => n + 1), 5000);
    return () => {
      alive = false;
      clearInterval(poll);
      clearInterval(clock);
    };
  }, [token.address]);

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <div className="seg">
          <button data-on={tab === "trades"} onClick={() => setTab("trades")}>Trading history</button>
          <button data-on={tab === "holders"} onClick={() => setTab("holders")}>Holders{holderTotal != null ? ` (${num(holderTotal, 0)})` : ""}</button>
        </div>
        <span className="num ml-auto hidden text-xs text-muted sm:block">
          {token.buys24h != null && <>24h: <span className="text-up">{num(token.buys24h, 0)} buys</span> · <span className="text-down">{num(token.sells24h ?? 0, 0)} sells</span> · </>}
          {tab === "trades" ? (tradeSrc ? `via ${tradeSrc}` : "") : holderSrc ? `via ${holderSrc}` : ""}
        </span>
      </div>
      <div className="scroll-x max-h-[440px] overflow-y-auto">
        {tab === "trades" ? (
          <table className="w-full min-w-[620px] text-sm">
            <thead className="sticky top-0 bg-surface text-left text-xs text-muted">
              <tr className="border-b border-line">
                <th className="px-4 py-2 font-medium">Age</th>
                <th className="px-2 py-2 font-medium">Type</th>
                <th className="px-2 py-2 text-right font-medium">USD</th>
                <th className="px-2 py-2 text-right font-medium">{token.symbol}</th>
                <th className="px-2 py-2 text-right font-medium">Price</th>
                <th className="px-2 py-2 font-medium">Route</th>
                <th className="px-4 py-2 font-medium">Trader</th>
              </tr>
            </thead>
            <tbody className="num">
              {!trades.length && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-muted">{loading ? "Loading trades…" : token.poolAddress ? "No recent trades returned by GeckoTerminal or STON.fi." : "No pool yet — trades appear once liquidity is added."}</td></tr>
              )}
              {trades.map((t) => (
                <tr key={t.id} className="border-b border-line/60 last:border-0 hover:bg-surface-2/60">
                  <td className="px-4 py-2 text-muted">{ago(t.time)}</td>
                  <td className={`px-2 py-2 font-semibold capitalize ${t.side === "buy" ? "text-up" : "text-down"}`}>{t.side}</td>
                  <td className="px-2 py-2 text-right">{t.amountUsd ? usd(t.amountUsd) : "—"}</td>
                  <td className="px-2 py-2 text-right">{num(t.amountToken, 0)}</td>
                  <td className="px-2 py-2 text-right text-ink-2">{t.priceUsd ? price(t.priceUsd) : "—"}</td>
                  <td className="px-2 py-2 text-xs text-ink-2">{t.route}</td>
                  <td className="px-4 py-2">
                    <a href={`https://tonviewer.com/transaction/${t.txHash}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-xs text-ink-2 hover:text-brand">
                      {shortAddr(t.wallet)} <ExternalLink className="size-3" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full min-w-[520px] text-sm">
            <thead className="sticky top-0 bg-surface text-left text-xs text-muted">
              <tr className="border-b border-line">
                <th className="px-4 py-2 font-medium">#</th>
                <th className="px-2 py-2 font-medium">Holder</th>
                <th className="px-2 py-2 text-right font-medium">Amount</th>
                <th className="px-4 py-2 font-medium">Share</th>
              </tr>
            </thead>
            <tbody className="num">
              {!holders.length && <tr><td colSpan={4} className="px-4 py-10 text-center text-muted">Holder list unavailable (TonAPI / toncenter).</td></tr>}
              {holders.map((h, i) => (
                <tr key={h.address} className="border-b border-line/60 last:border-0">
                  <td className="px-4 py-2 text-muted">{i + 1}</td>
                  <td className="px-2 py-2">
                    <a href={`https://tonviewer.com/${h.address}`} target="_blank" rel="noreferrer" className="font-mono text-xs hover:text-brand">{shortAddr(h.address, 6, 4)}</a>
                    {h.label && <span className="chip ml-2">{h.label}</span>}
                  </td>
                  <td className="px-2 py-2 text-right">{num(h.amount, 0)}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-2">
                        <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, (h.share ?? 0) * 4)}%` }} />
                      </div>
                      <span className="text-xs">{h.share != null ? `${h.share.toFixed(2)}%` : "—"}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
