"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { MarketToken } from "@/lib/types";
import { ago, pct, price } from "@/lib/format";
import { PriceChart } from "./PriceChart";
import { TokenAvatar, Verified } from "./ui";

export interface LastBuy { priceUsd: number; time: number; ton: number; wallets: number }
const key = (jetton: string) => `bitpad.bundle.lastbuy.${jetton}`;

export function readLastBuy(jetton: string): LastBuy | null {
  try {
    return JSON.parse(localStorage.getItem(key(jetton)) ?? "null");
  } catch {
    return null;
  }
}
export function saveLastBuy(jetton: string, b: LastBuy) {
  try { localStorage.setItem(key(jetton), JSON.stringify(b)); } catch { /* private mode */ }
}

/**
 * The bundle's target token: live chart plus "since your last bundle buy",
 * i.e. how far the price is from where the last buy filled (in profit or not).
 */
export function BundleTokenChart({ jetton, lastBuy, onPrice }: { jetton: string; lastBuy: LastBuy | null; onPrice: (p: number | null) => void }) {
  const [token, setToken] = useState<MarketToken | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [live, setLive] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    setToken(null);
    setErr(null);
    setLive(null);
    const load = () =>
      fetch(`/api/token/${jetton}`)
        .then((r) => r.json())
        .then((d) => {
          if (!alive) return;
          if (d.token) { setToken(d.token); setErr(null); } else setErr(d.error ?? "Token not found");
        })
        .catch(() => alive && setErr("Couldn't load this token"));
    load();
    const t = setInterval(load, 20_000);
    return () => { alive = false; clearInterval(t); };
  }, [jetton]);

  const px = live ?? token?.priceUsd ?? null;
  useEffect(() => onPrice(px), [px, onPrice]);
  const since = lastBuy && px ? ((px - lastBuy.priceUsd) / lastBuy.priceUsd) * 100 : null;

  if (err) return <div className="card p-4 text-sm text-muted">{err}. Check the jetton address.</div>;
  if (!token) return <div className="card h-[120px] animate-pulse" />;
  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
        <TokenAvatar token={token} size={32} />
        <div className="min-w-0">
          <Link href={`/token/${token.address}`} className="flex items-center gap-1 font-semibold hover:underline">${token.symbol}{token.verified && <Verified />}</Link>
          <div className="num text-xs text-ink-2">{px != null ? price(px) : "—"}</div>
        </div>
        <div className="ml-auto text-right">
          {lastBuy ? (
            <>
              <div className={`num text-lg font-bold ${since == null ? "text-muted" : since >= 0 ? "text-up" : "text-down"}`}>{since == null ? "—" : pct(since)}</div>
              <div className="text-[11px] text-muted" title={`Bought at ${price(lastBuy.priceUsd)}`}>since last bundle buy · {lastBuy.ton.toFixed(2)} GRAM in {lastBuy.wallets} wallet{lastBuy.wallets === 1 ? "" : "s"} · {ago(lastBuy.time)} ago</div>
            </>
          ) : (
            <div className="text-[11px] text-muted">No bundle buy yet. After one, its profit or loss shows here.</div>
          )}
        </div>
      </div>
      <PriceChart token={token} onPrice={setLive} />
    </section>
  );
}
