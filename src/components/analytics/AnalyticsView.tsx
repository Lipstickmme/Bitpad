"use client";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Flame, Trophy, Activity, Globe2, ExternalLink } from "lucide-react";
import type { AnalyticsSnapshot, ChainId, LaunchpadStat } from "@/lib/types";
import { CHAINS } from "@/lib/chains";
import { SERIES } from "@/lib/venues";
import { num, pct, price, usd } from "@/lib/format";
import { AXIS, ChartCard, GRID, TipBox } from "./ChartCard";
import { SourceTag } from "../ui";

const CHAIN_FILTERS: ("all" | ChainId)[] = ["all", "ton", "solana", "ethereum", "base", "bsc"];
const UP = "#0f9d58";
const DOWN = "#d93a3a";
const winRate = (l: LaunchpadStat) => (l.wins + l.losses ? (100 * l.wins) / (l.wins + l.losses) : 0);

export function AnalyticsView({ data }: { data: AnalyticsSnapshot }) {
  const [chain, setChain] = useState<"all" | ChainId>("all");
  const [venueKind, setVenueKind] = useState<"launchpads" | "dexes">("launchpads");
  const [quote, setQuote] = useState<"all" | "ton" | "eth" | "sol" | "stable" | "stock">("all");

  const venues = (venueKind === "launchpads" ? data.launchpads : data.dexes).filter((v) => chain === "all" || v.chain === chain);
  const chains = data.chains;
  const totalVol = chains.reduce((s, c) => s + c.volume24h, 0);
  const tonVol = chains.find((c) => c.chain === "ton")?.volume24h ?? 0;
  const hottest = [...chains].sort((a, b) => b.fomo - a.fomo)[0];
  const bestLp = [...data.launchpads].filter((l) => l.wins + l.losses >= 5).sort((a, b) => winRate(b) - winRate(a))[0];

  const trending = useMemo(
    () => data.trending.filter((p) => (chain === "all" || p.chain === chain) && (quote === "all" || p.quoteKind === quote)),
    [data.trending, chain, quote],
  );
  const histKeys = Object.keys(data.history[0] ?? {}).filter((k) => k !== "date");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Traders&apos; heaven</h1>
          <p className="text-sm text-ink-2">Every launchpad and DEX, side by side — where the volume, the wins and the FOMO are right now.</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2 text-xs text-muted">
          {data.sources.map((s) => (
            <span key={s.name} className="chip"><span className={`size-1.5 rounded-full ${s.ok ? "bg-up" : "bg-muted"}`} />{s.name}</span>
          ))}
          <span>Updated {new Date(data.updatedAt).toLocaleTimeString()}</span>
        </div>
      </div>

      <div className="card flex flex-wrap items-center gap-2 p-2">
        <div className="seg">
          {CHAIN_FILTERS.map((c) => (
            <button key={c} data-on={chain === c} onClick={() => setChain(c)}>{c === "all" ? "All chains" : CHAINS[c].short}</button>
          ))}
        </div>
        <div className="seg ml-auto">
          <button data-on={venueKind === "launchpads"} onClick={() => setVenueKind("launchpads")}>Launchpads</button>
          <button data-on={venueKind === "dexes"} onClick={() => setVenueKind("dexes")}>DEXes</button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={<Activity className="size-4" />} label="Tracked DEX volume · 24h" value={usd(totalVol, { compact: true })} sub={`${chains.length} chains`} />
        <Kpi icon={<Globe2 className="size-4" />} label="TON share of volume" value={`${totalVol ? ((100 * tonVol) / totalVol).toFixed(2) : "0"}%`} sub={usd(tonVol, { compact: true })} />
        <Kpi icon={<Flame className="size-4" />} label="Hottest chain (FOMO)" value={hottest ? CHAINS[hottest.chain].name : "—"} sub={hottest ? `score ${hottest.fomo}/100` : ""} />
        <Kpi icon={<Trophy className="size-4" />} label="Best launchpad win rate" value={bestLp ? bestLp.name : "—"} sub={bestLp ? `${winRate(bestLp).toFixed(0)}% of sampled tokens up 24h` : ""} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard title="FOMO index by chain" sub="Buy/sell pressure, 1h momentum & volume acceleration (0–100)">
          <div className="h-[240px]">
            <ResponsiveContainer>
              <BarChart data={chains.map((c) => ({ name: CHAINS[c.chain].short, fomo: c.fomo, ratio: c.buySellRatio }))} layout="vertical" margin={{ left: 0, right: 24 }} barCategoryGap={8}>
                <CartesianGrid horizontal={false} stroke={GRID} />
                <XAxis type="number" domain={[0, 100]} {...AXIS} />
                <YAxis type="category" dataKey="name" width={44} {...AXIS} />
                <Tooltip cursor={{ fill: "#f0f3f7" }} content={({ payload }) => payload?.[0] ? <TipBox title={String(payload[0].payload.name)} rows={[{ label: "FOMO", value: `${payload[0].payload.fomo}/100` }, { label: "Buy/sell", value: Number(payload[0].payload.ratio).toFixed(2) }]} /> : null} />
                <Bar dataKey="fomo" radius={[0, 4, 4, 0]} fill={SERIES[0]} label={{ position: "right", fontSize: 11, fill: "#4a5a6e" }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard className="lg:col-span-2" title={`24h volume · ${venueKind}`} sub="Protocol volume (DefiLlama), sampled pools where unavailable">
          <div className="h-[240px]">
            <ResponsiveContainer>
              <BarChart data={[...venues].sort((a, b) => b.volume24h - a.volume24h)} margin={{ left: 8, right: 8 }} barCategoryGap="22%">
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis dataKey="name" {...AXIS} interval={0} tick={{ fontSize: 10 }} />
                <YAxis {...AXIS} tickFormatter={(v) => usd(v, { compact: true })} width={56} />
                <Tooltip cursor={{ fill: "#f0f3f7" }} content={({ payload }) => {
                  const p = payload?.[0]?.payload as LaunchpadStat | undefined;
                  return p ? <TipBox title={p.name} rows={[{ label: "Volume", value: usd(p.volume24h, { compact: true }), color: p.color }, { label: "Δ 1d", value: pct(p.volumeChange) }, { label: "Chain", value: CHAINS[p.chain].name }]} /> : null;
                }} />
                <Bar dataKey="volume24h" radius={[4, 4, 0, 0]}>
                  {[...venues].sort((a, b) => b.volume24h - a.volume24h).map((v) => <Cell key={v.id} fill={v.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Wins vs losses" sub="Sampled new & trending tokens: up vs down over 24h">
          <div className="h-[280px]">
            <ResponsiveContainer>
              <BarChart data={venues.map((v) => ({ name: v.name, wins: v.wins, losses: v.losses, rate: winRate(v) }))} layout="vertical" stackOffset="expand" margin={{ left: 0, right: 16 }} barCategoryGap={6}>
                <CartesianGrid horizontal={false} stroke={GRID} />
                <XAxis type="number" {...AXIS} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
                <YAxis type="category" dataKey="name" width={96} {...AXIS} tick={{ fontSize: 11 }} />
                <ReferenceLine x={0.5} stroke="#8492a6" strokeDasharray="3 3" />
                <Tooltip cursor={{ fill: "#f0f3f7" }} content={({ payload }) => {
                  const p = payload?.[0]?.payload;
                  return p ? <TipBox title={p.name} rows={[{ label: "Wins", value: String(p.wins), color: UP }, { label: "Losses", value: String(p.losses), color: DOWN }, { label: "Win rate", value: `${p.rate.toFixed(0)}%` }]} /> : null;
                }} />
                <Bar dataKey="wins" stackId="a" fill={UP} stroke="#fff" strokeWidth={2} />
                <Bar dataKey="losses" stackId="a" fill={DOWN} stroke="#fff" strokeWidth={2} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <Legend items={[{ label: "Up 24h", color: UP }, { label: "Down 24h", color: DOWN }]} />
        </ChartCard>

        <ChartCard title="Average 24h return" sub="Mean return of sampled tokens, per venue">
          <div className="h-[280px]">
            <ResponsiveContainer>
              <BarChart data={venues.map((v) => ({ name: v.name, avg: v.avgReturn24h, med: v.medianReturn24h }))} margin={{ left: 0, right: 8 }} barCategoryGap="25%">
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis dataKey="name" {...AXIS} interval={0} tick={{ fontSize: 10 }} />
                <YAxis {...AXIS} tickFormatter={(v) => `${v}%`} width={44} />
                <ReferenceLine y={0} stroke="#8492a6" />
                <Tooltip cursor={{ fill: "#f0f3f7" }} content={({ payload }) => {
                  const p = payload?.[0]?.payload;
                  return p ? <TipBox title={p.name} rows={[{ label: "Average", value: pct(p.avg) }, { label: "Median", value: pct(p.med) }]} /> : null;
                }} />
                <Bar dataKey="avg" radius={4}>
                  {venues.map((v) => <Cell key={v.id} fill={v.avgReturn24h >= 0 ? UP : DOWN} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard className="lg:col-span-2" title="DEX volume · 14 days" sub="Daily volume per protocol">
          <div className="h-[280px]">
            <ResponsiveContainer>
              <LineChart data={data.history} margin={{ left: 0, right: 12 }}>
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis dataKey="date" {...AXIS} />
                <YAxis {...AXIS} tickFormatter={(v) => usd(v, { compact: true })} width={56} scale="log" domain={["auto", "auto"]} allowDataOverflow />
                <Tooltip content={({ payload, label }) => payload?.length ? <TipBox title={String(label)} rows={payload.map((p) => ({ label: String(p.dataKey), value: usd(Number(p.value), { compact: true }), color: String(p.color) }))} /> : null} />
                {histKeys.map((k, i) => <Line key={k} dataKey={k} stroke={SERIES[i % SERIES.length]} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }} />)}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <Legend items={histKeys.map((k, i) => ({ label: k, color: SERIES[i % SERIES.length] }))} />
        </ChartCard>

        <ChartCard title="Pair types" sub="Which quote asset is winning today">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted">
              <tr><th className="py-1.5 font-medium">Pairs</th><th className="text-right font-medium">Vol</th><th className="text-right font-medium">Avg</th><th className="text-right font-medium">Win</th></tr>
            </thead>
            <tbody className="num">
              {data.pairTypes.map((p) => (
                <tr key={p.kind} className="border-t border-line">
                  <td className="py-2 font-semibold">{p.label}<div className="text-[11px] font-normal text-muted">{p.pools} pools</div></td>
                  <td className="text-right">{usd(p.volume24h, { compact: true })}</td>
                  <td className={`text-right font-semibold ${p.avgReturn24h >= 0 ? "text-up" : "text-down"}`}>{pct(p.avgReturn24h)}</td>
                  <td className="text-right">
                    <div className="ml-auto flex w-20 items-center justify-end gap-1.5">
                      <div className="h-1.5 w-10 overflow-hidden rounded-full bg-down-soft"><div className="h-full bg-up" style={{ width: `${p.winRate}%` }} /></div>
                      <span className="text-xs">{p.winRate.toFixed(0)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ChartCard>
      </div>

      <ChartCard title={`${venueKind === "launchpads" ? "Launchpad" : "DEX"} comparison`} sub="Full table — sort by what matters to you">
        <CompareTable rows={venues} />
      </ChartCard>

      <ChartCard
        title="Trending pools across chains"
        sub="TON, ETH, SOL, stable and stock pairs — ranked by 24h volume"
        right={
          <div className="seg">
            {(["all", "ton", "eth", "sol", "stable", "stock"] as const).map((q) => (
              <button key={q} data-on={quote === q} onClick={() => setQuote(q)}>{q === "all" ? "All" : q.toUpperCase()}</button>
            ))}
          </div>
        }
      >
        <div className="scroll-x">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="text-left text-xs text-muted">
              <tr className="border-b border-line">
                <th className="py-2 font-medium">Pool</th><th className="font-medium">Chain · DEX</th>
                <th className="text-right font-medium">Price</th><th className="text-right font-medium">1h</th><th className="text-right font-medium">24h</th>
                <th className="text-right font-medium">Volume</th><th className="text-right font-medium">Liquidity</th><th className="text-right font-medium">Txns</th><th className="text-right font-medium">Age</th><th />
              </tr>
            </thead>
            <tbody className="num">
              {trending.slice(0, 25).map((p) => (
                <tr key={p.id} className="border-b border-line/60 last:border-0 hover:bg-surface-2/60">
                  <td className="py-2 font-semibold">{p.base}<span className="font-normal text-muted"> / {p.quote}</span></td>
                  <td className="text-xs text-ink-2">{CHAINS[p.chain].short} · {p.dex}</td>
                  <td className="text-right">{price(p.priceUsd)}</td>
                  <td className={`text-right ${p.change1h >= 0 ? "text-up" : "text-down"}`}>{pct(p.change1h)}</td>
                  <td className={`text-right font-semibold ${p.change24h >= 0 ? "text-up" : "text-down"}`}>{pct(p.change24h)}</td>
                  <td className="text-right">{usd(p.volume24h, { compact: true })}</td>
                  <td className="text-right">{usd(p.liquidityUsd, { compact: true })}</td>
                  <td className="text-right">{num(p.txns24h, 0)}</td>
                  <td className="text-right text-muted">{p.ageHours < 48 ? `${Math.round(p.ageHours)}h` : `${Math.round(p.ageHours / 24)}d`}</td>
                  <td className="pl-2 text-right">{p.url && <a href={p.url} target="_blank" rel="noreferrer" className="text-muted hover:text-brand" aria-label="Open pool"><ExternalLink className="size-3.5" /></a>}</td>
                </tr>
              ))}
              {!trending.length && <tr><td colSpan={10} className="py-6 text-center text-muted">No pools for this filter</td></tr>}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  );
}

function Kpi({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted">{icon}{label}</div>
      <div className="num mt-1 truncate text-2xl font-extrabold tracking-tight">{value}</div>
      {sub && <div className="mt-0.5 truncate text-xs text-ink-2">{sub}</div>}
    </div>
  );
}

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: i.color }} />{i.label}</span>
      ))}
    </div>
  );
}

type SortKey = "volume24h" | "volumeChange" | "launches24h" | "winRate" | "avgReturn24h" | "buySellRatio";
function CompareTable({ rows }: { rows: LaunchpadStat[] }) {
  const [key, setKey] = useState<SortKey>("volume24h");
  const val = (r: LaunchpadStat) => (key === "winRate" ? winRate(r) : r[key]);
  const sorted = [...rows].sort((a, b) => val(b) - val(a));
  const H = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <th className="text-right font-medium">
      <button onClick={() => setKey(k)} className={key === k ? "font-bold text-ink" : "hover:text-ink"}>{children}{key === k ? " ↓" : ""}</button>
    </th>
  );
  return (
    <div className="scroll-x">
      <table className="w-full min-w-[860px] text-sm">
        <thead className="text-left text-xs text-muted">
          <tr className="border-b border-line">
            <th className="py-2 font-medium">Venue</th><th className="font-medium">Chain</th><th className="font-medium">Mechanism</th>
            <H k="volume24h">Volume 24h</H><H k="volumeChange">Δ 1d</H><H k="launches24h">Launches</H><H k="winRate">Win rate</H><H k="avgReturn24h">Avg return</H><H k="buySellRatio">Buy/Sell</H>
            <th className="text-right font-medium">Top gainer</th><th className="pl-3 font-medium">Data</th>
          </tr>
        </thead>
        <tbody className="num">
          {sorted.map((r) => (
            <tr key={r.id} className={`border-b border-line/60 last:border-0 ${r.id === "bitpad" ? "bg-brand-soft/40" : ""}`}>
              <td className="py-2.5 font-semibold"><span className="mr-2 inline-block size-2.5 rounded-sm align-middle" style={{ background: r.color }} />{r.name}</td>
              <td className="text-ink-2">{CHAINS[r.chain].short}</td>
              <td className="text-xs text-ink-2">{r.mechanism}</td>
              <td className="text-right">{usd(r.volume24h, { compact: true })}</td>
              <td className={`text-right ${r.volumeChange >= 0 ? "text-up" : "text-down"}`}>{pct(r.volumeChange)}</td>
              <td className="text-right">{r.kind === "launchpad" ? num(r.launches24h, 0) : "—"}</td>
              <td className="text-right">{winRate(r).toFixed(0)}% <span className="text-xs text-muted">({r.wins}/{r.wins + r.losses})</span></td>
              <td className={`text-right font-semibold ${r.avgReturn24h >= 0 ? "text-up" : "text-down"}`}>{pct(r.avgReturn24h)}</td>
              <td className="text-right">{r.buySellRatio.toFixed(2)}</td>
              <td className="text-right text-xs">{r.topGainer ? <>{r.topGainer.symbol} <span className="text-up">{pct(r.topGainer.change, 0)}</span></> : "—"}</td>
              <td className="pl-3"><SourceTag source={r.source} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
