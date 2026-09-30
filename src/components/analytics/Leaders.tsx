"use client";
import Link from "next/link";
import type { ChainStat, LaunchpadStat, TrendingPool } from "@/lib/types";
import { CHAINS } from "@/lib/chains";
import { num, pct, usd } from "@/lib/format";
import { Hint } from "../ui";

const winRate = (l: LaunchpadStat) => (l.wins + l.losses ? (100 * l.wins) / (l.wins + l.losses) : 0);
const MEDAL = ["1", "2", "3"];

interface Board {
  title: string;
  hint: string;
  rows: { label: string; sub?: string; value: string; href?: string; tone?: "up" | "down" }[];
}

/** Top 3 in every metric, from the same live data as the rest of the page. */
export function Leaders({ venues, chains, trending, kind }: { venues: LaunchpadStat[]; chains: ChainStat[]; trending: TrendingPool[]; kind: "launchpads" | "dexes" }) {
  const live = venues.filter((v) => v.source !== "unavailable");
  const sampled = live.filter((v) => v.wins + v.losses >= 5);
  const top = <T,>(list: T[], by: (x: T) => number, n = 3) => [...list].filter((x) => Number.isFinite(by(x))).sort((a, b) => by(b) - by(a)).slice(0, n);
  const vRow = (v: LaunchpadStat, value: string, tone?: "up" | "down") => ({ label: v.name, sub: CHAINS[v.chain].short, value, tone });
  const pRow = (p: TrendingPool, value: string, tone?: "up" | "down") => ({ label: `${p.base}/${p.quote}`, sub: `${CHAINS[p.chain].short} · ${p.dex}`, value, tone, href: p.poolAddress ? `/pool/${p.chain}/${p.poolAddress}` : undefined });
  const noun = kind === "launchpads" ? "launchpad" : "DEX";

  const boards: Board[] = [
    { title: `Top ${noun}s by volume`, hint: "Highest 24h traded volume (DefiLlama protocol volume, or sampled pools where DefiLlama doesn't list the venue).", rows: top(live, (v) => v.volume24h).map((v) => vRow(v, usd(v.volume24h, { compact: true }))) },
    { title: "Fastest growing", hint: "Biggest change in 24h volume versus the day before (DefiLlama). Shows where activity is accelerating.", rows: top(live.filter((v) => v.volumeChange), (v) => v.volumeChange).map((v) => vRow(v, pct(v.volumeChange), v.volumeChange >= 0 ? "up" : "down")) },
    { title: "Most fees earned", hint: "Protocol fees collected in the last 24h (DefiLlama fees dashboard).", rows: top(live.filter((v) => v.fees24h), (v) => v.fees24h ?? 0).map((v) => vRow(v, usd(v.fees24h ?? 0, { compact: true }))) },
    { title: "Best win rate", hint: "Share of sampled new/trending tokens trading higher than 24h ago. Only venues with at least 5 sampled tokens.", rows: top(sampled, winRate).map((v) => vRow(v, `${winRate(v).toFixed(0)}% · ${v.wins}/${v.wins + v.losses}`, "up")) },
    { title: "Best median return", hint: "Median 24h price change of sampled tokens: what a typical fresh token did on that venue.", rows: top(sampled, (v) => v.medianReturn24h).map((v) => vRow(v, pct(v.medianReturn24h), v.medianReturn24h >= 0 ? "up" : "down")) },
    { title: "Most buy pressure", hint: "Buys per sell across sampled pools in the last 24h. Above 1 means more buyers than sellers.", rows: top(sampled, (v) => v.buySellRatio).map((v) => vRow(v, `${v.buySellRatio.toFixed(2)} buys/sell`)) },
    ...(kind === "launchpads" ? [{ title: "Most launches (24h)", hint: "New pools younger than 24h in the sample (Bitpad: launches from the factory in the last 24h).", rows: top(live, (v) => v.launches24h).map((v) => vRow(v, num(v.launches24h, 0))) }] : []),
    { title: "Top chains by volume", hint: "24h DEX volume per chain (DefiLlama).", rows: top(chains, (c) => c.volume24h).map((c) => ({ label: CHAINS[c.chain].name, value: usd(c.volume24h, { compact: true }) })) },
    { title: "Highest FOMO", hint: "FOMO index per chain: buy/sell pressure, 1h momentum and volume acceleration combined (0–100).", rows: top(chains, (c) => c.fomo).map((c) => ({ label: CHAINS[c.chain].name, value: `${c.fomo}/100` })) },
    { title: "Most new pools (24h)", hint: "Pools GeckoTerminal saw created in the last 24h per chain (from its new-pools feed).", rows: top(chains, (c) => c.newPools24h).map((c) => ({ label: CHAINS[c.chain].name, value: num(c.newPools24h, 0) })) },
    { title: "Top gainers 24h", hint: "Trending pools with the biggest 24h price increase.", rows: top(trending, (p) => p.change24h).map((p) => pRow(p, pct(p.change24h), "up")) },
    { title: "Hottest last hour", hint: "Trending pools with the biggest 1h price move up.", rows: top(trending, (p) => p.change1h).map((p) => pRow(p, pct(p.change1h), p.change1h >= 0 ? "up" : "down")) },
    { title: "Most traded pools", hint: "Trending pools with the highest 24h volume.", rows: top(trending, (p) => p.volume24h).map((p) => pRow(p, usd(p.volume24h, { compact: true }))) },
    { title: "Most transactions", hint: "Trending pools with the most buys + sells in 24h.", rows: top(trending, (p) => p.txns24h).map((p) => pRow(p, num(p.txns24h, 0))) },
    { title: "Deepest liquidity", hint: "Trending pools with the most liquidity (USD), i.e. the least slippage.", rows: top(trending, (p) => p.liquidityUsd).map((p) => pRow(p, usd(p.liquidityUsd, { compact: true }))) },
  ];

  return (
    <section>
      <div className="mb-3 flex items-center gap-1.5">
        <h2 className="text-base font-semibold tracking-tight">Top 3 right now</h2>
        <Hint>Leaders in every metric on this page, for the chain and venue filter above. Hover each board for how it&apos;s measured. Pools link to their chart.</Hint>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {boards.map((b) => (
          <div key={b.title} className="card p-4">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted">{b.title}<Hint>{b.hint}</Hint></div>
            {b.rows.length ? (
              <ol className="space-y-1.5">
                {b.rows.map((r, i) => {
                  const inner = (
                    <>
                      <span className={`grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${i === 0 ? "bg-ink text-bg" : "bg-surface-2 text-ink-2"}`}>{MEDAL[i]}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{r.label}</span>
                        {r.sub && <span className="block truncate text-[10px] text-muted">{r.sub}</span>}
                      </span>
                      <span className={`num shrink-0 text-xs font-semibold ${r.tone === "up" ? "text-up" : r.tone === "down" ? "text-down" : "text-ink"}`}>{r.value}</span>
                    </>
                  );
                  return (
                    <li key={r.label + i}>
                      {r.href ? <Link href={r.href} className="flex items-center gap-2 rounded-md hover:bg-surface-2">{inner}</Link> : <div className="flex items-center gap-2">{inner}</div>}
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="py-3 text-xs text-muted">No data from the sources right now.</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
