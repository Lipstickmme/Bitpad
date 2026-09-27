"use client";
import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import type { BitpadToken, Holder, Trade } from "@/lib/types";
import { ago, num, price, shortAddr, usd } from "@/lib/format";

export function ActivityTabs({ token }: { token: BitpadToken }) {
  const [tab, setTab] = useState<"trades" | "holders">("trades");
  const [trades, setTrades] = useState<Trade[]>([]);
  const [holders, setHolders] = useState<Holder[]>([]);
  const [, tick] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch(`/api/token/${token.address}`)
        .then((r) => r.json())
        .then((d) => {
          if (!alive) return;
          setTrades(d.trades);
          setHolders(d.holders);
        });
    load();
    const poll = setInterval(load, 20_000);
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
          <button data-on={tab === "holders"} onClick={() => setTab("holders")}>Holders ({num(token.holders, 0)})</button>
        </div>
        <span className="num ml-auto hidden text-xs text-muted sm:block">
          24h: <span className="text-up">{num(token.buys24h, 0)} buys</span> · <span className="text-down">{num(token.sells24h, 0)} sells</span>
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
              {trades.map((t) => (
                <tr key={t.id} className="border-b border-line/60 last:border-0 hover:bg-surface-2/60">
                  <td className="px-4 py-2 text-muted">{ago(t.time)}</td>
                  <td className={`px-2 py-2 font-semibold capitalize ${t.side === "buy" ? "text-up" : "text-down"}`}>{t.side}</td>
                  <td className="px-2 py-2 text-right">{usd(t.amountUsd)}</td>
                  <td className="px-2 py-2 text-right">{num(t.amountToken, 0)}</td>
                  <td className="px-2 py-2 text-right text-ink-2">{price(t.priceUsd)}</td>
                  <td className="px-2 py-2 text-xs text-ink-2">{t.route}</td>
                  <td className="px-4 py-2">
                    <a href={`https://tonviewer.com/${t.wallet}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-xs text-ink-2 hover:text-brand">
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
              {holders.map((h, i) => (
                <tr key={h.address} className="border-b border-line/60 last:border-0">
                  <td className="px-4 py-2 text-muted">{i + 1}</td>
                  <td className="px-2 py-2">
                    <span className="font-mono text-xs">{shortAddr(h.address, 6, 4)}</span>
                    {h.label && <span className="chip ml-2">{h.label}</span>}
                  </td>
                  <td className="px-2 py-2 text-right">{num(h.amount, 0)}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-2">
                        <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, h.share * 4)}%` }} />
                      </div>
                      <span className="text-xs">{h.share.toFixed(2)}%</span>
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
