"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ExternalLink } from "lucide-react";
import type { AnalyticsSnapshot, ChainId, LaunchpadStat } from "@/lib/types";
import { CHAINS } from "@/lib/chains";
import { num, pct, price, usd } from "@/lib/format";
import { AXIS, C, ChartCard, GRID, TipBox } from "./ChartCard";
import { Hint, SourceTag } from "../ui";
import { QuickBuyAmount, QuickBuyButton } from "../QuickBuy";
import { Pager } from "../Pager";
import { Leaders } from "./Leaders";
import { XBuyButton, xBuyable } from "../XBuy";
import { volumeSpike } from "@/lib/spike";
import { coin } from "@/lib/coin";

const CHAIN_FILTERS: ("all" | ChainId)[] = ["all", "ton", "solana", "ethereum", "base", "bsc", "arbitrum", "polygon", "avalanche", "sui", "tron"];
const winRate = (l: LaunchpadStat) => (l.wins + l.losses ? (100 * l.wins) / (l.wins + l.losses) : 0);
const VOL_SOURCE = { defillama: "DefiLlama protocol volume", sampled: "sum of sampled pools (understates)", onchain: "Bitpad pools, read on-chain" } as const;

export function AnalyticsView({ data }: { data: AnalyticsSnapshot }) {
  const router = useRouter();
  const [tPage, setTPage] = useState(0);
  const [chain, setChain] = useState<"all" | ChainId>("all");
  const [venueKind, setVenueKind] = useState<"launchpads" | "dexes">("launchpads");
  const [quote, setQuote] = useState<"all" | "ton" | "eth" | "sol" | "stable" | "stock">("all");

  const allVenues = (venueKind === "launchpads" ? data.launchpads : data.dexes).filter((v) => chain === "all" || v.chain === chain);
  const venues = allVenues.filter((v) => v.source !== "unavailable" && v.volume24h > 0).sort((a, b) => b.volume24h - a.volume24h);
  const sampledVenues = allVenues.filter((v) => v.wins + v.losses > 0);
  const chains = data.chains.filter((c) => c.source === "live");
  const totalVol = chains.reduce((s, c) => s + c.volume24h, 0);
  const tonVol = chains.find((c) => c.chain === "ton")?.volume24h ?? 0;
  const hottest = [...chains].sort((a, b) => b.fomo - a.fomo)[0];
  const bestLp = [...data.launchpads].filter((l) => l.wins + l.losses >= 5).sort((a, b) => winRate(b) - winRate(a))[0];

  const trending = useMemo(
    () => data.trending.filter((p) => (chain === "all" || p.chain === chain) && (quote === "all" || p.quoteKind === quote)),
    [data.trending, chain, quote],
  );
  const histKeys = Object.keys(data.history[0] ?? {}).filter((k) => k !== "date");
  const [focus, setFocus] = useState(histKeys.includes("STON.fi") ? "STON.fi" : histKeys[0]);
  const upd = new Date(data.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Market analytics</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-2">Launchpads and DEXes across TON, Solana, Ethereum, Base and BNB — where the volume is, whether new tokens are winning, and where the FOMO is. Every number is pulled live; hover ⓘ for how it&apos;s measured.</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2 text-xs text-muted">
          {data.sources.map((s) => (
            <span key={s.name} className="chip" title={s.ok ? "Answered" : "Didn't answer — dependent panels show no data"}><span className={`size-1.5 rounded-full ${s.ok ? "bg-up" : "bg-muted"}`} />{s.name}</span>
          ))}
          <span>Updated {upd}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-y border-line py-3">
        {CHAIN_FILTERS.map((c) => (
          <button key={c} onClick={() => { setChain(c); setTPage(0); }} className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${chain === c ? "border-line-strong bg-line-strong text-ink" : "border-line text-ink-2 hover:text-ink"}`}>
            {c === "all" ? "All chains" : CHAINS[c].name}
          </button>
        ))}
        <div className="seg ml-auto">
          <button data-on={venueKind === "launchpads"} onClick={() => setVenueKind("launchpads")}>Launchpads</button>
          <button data-on={venueKind === "dexes"} onClick={() => setVenueKind("dexes")}>DEXes</button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="DEX volume · 24h"
          value={totalVol ? usd(totalVol, { compact: true }) : "—"}
          sub={`${chains.length} of ${data.chains.length} chains reporting`}
          hint="Total 24h DEX volume across the tracked chains, from DefiLlama's per-chain DEX totals. If DefiLlama is down, it falls back to summing the pools GeckoTerminal sampled."
        />
        <Kpi
          label="TON share"
          value={totalVol ? `${((100 * tonVol) / totalVol).toFixed(2)}%` : "—"}
          sub={tonVol ? `${usd(tonVol, { compact: true })} on TON` : undefined}
          hint="TON's 24h DEX volume divided by the total above. It shows how much of the on-chain trading on these chains happens on TON."
        />
        <Kpi
          label="Highest FOMO"
          value={hottest ? CHAINS[hottest.chain].name : "—"}
          sub={hottest ? `${hottest.fomo}/100 · ${hottest.buySellRatio.toFixed(2)} buys per sell` : undefined}
          hint="The chain with the highest FOMO index (see the chart below): more buyers than sellers, prices rising over the last hour, and volume growing day-on-day."
        />
        <Kpi
          label="Best launchpad win rate"
          value={bestLp ? bestLp.name : "—"}
          sub={bestLp ? `${winRate(bestLp).toFixed(0)}% up · ${bestLp.wins}/${bestLp.wins + bestLp.losses} tokens` : "needs ≥5 sampled tokens"}
          hint="Among launchpads with at least 5 sampled tokens: the share of their new and trending tokens trading higher than 24h ago. It's a live sample from GeckoTerminal, not every token."
          align="right"
        />
      </div>

      <Leaders venues={allVenues} chains={chain === "all" ? chains : chains.filter((c) => c.chain === chain)} trending={trending} kind={venueKind} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard
          title="FOMO index"
          sub="0–100 per chain"
          hint={<>FOMO = 40% buy/sell pressure + 30% 1h momentum + 30% volume acceleration.<br /><br />Pressure: buys ÷ sells across sampled pools (0.6 → 0, 1.6 → max). Momentum: average 1h price change (−10% → 0, +20% → max). Acceleration: DefiLlama day-on-day volume change (−30% → 0, +50% → max).</>}
        >
          {!chains.length ? <Empty>No chain data — GeckoTerminal and DefiLlama didn&apos;t answer.</Empty> : <div className="h-[240px]">
            <ResponsiveContainer>
              <BarChart data={[...chains].sort((a, b) => b.fomo - a.fomo).map((c) => ({ name: CHAINS[c.chain].short, chain: c.chain, fomo: c.fomo, ratio: c.buySellRatio, parts: c.fomoParts, n: c.sampled }))} layout="vertical" margin={{ left: 0, right: 28 }} barCategoryGap={8}>
                <CartesianGrid horizontal={false} stroke={GRID} />
                <XAxis type="number" domain={[0, 100]} {...AXIS} />
                <YAxis type="category" dataKey="name" width={44} {...AXIS} />
                <Tooltip cursor={{ fill: C.cursor }} content={({ payload }) => {
                  const p = payload?.[0]?.payload;
                  if (!p) return null;
                  const rows = [{ label: "FOMO", value: `${p.fomo}/100` }, { label: "Buys per sell", value: Number(p.ratio).toFixed(2) }];
                  if (p.parts) rows.push({ label: "Pressure", value: `${Math.round(p.parts.pressure * 100)}%` }, { label: "Momentum", value: `${Math.round(p.parts.momentum * 100)}%` }, { label: "Acceleration", value: `${Math.round(p.parts.volume * 100)}%` });
                  if (p.n) rows.push({ label: "Pools sampled", value: String(p.n) });
                  return <TipBox title={String(p.name)} rows={rows} />;
                }} />
                <Bar dataKey="fomo" radius={[0, 4, 4, 0]} label={{ position: "right", fontSize: 11, fill: C.label }}>
                  {[...chains].sort((a, b) => b.fomo - a.fomo).map((c) => <Cell key={c.chain} fill={c.chain === "ton" ? C.accent : C.bar} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>}
        </ChartCard>

        <ChartCard
          className="lg:col-span-2"
          title={`24h volume · ${venueKind === "launchpads" ? "launchpads" : "DEXes"}`}
          sub="TON venues highlighted"
          hint={<>Traded volume over the last 24h for each venue. It comes from DefiLlama&apos;s protocol volume where DefiLlama lists the venue. Otherwise it&apos;s the sum of the pools GeckoTerminal sampled, which understates the real total; the tooltip shows which. Bitpad&apos;s volume is read from its own pools on-chain.</>}
        >
          {!venues.length ? <Empty>No volume data for these venues right now.</Empty> : <div className="h-[240px]">
            <ResponsiveContainer>
              <BarChart data={venues} margin={{ left: 8, right: 8 }} barCategoryGap="22%">
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis dataKey="name" {...AXIS} interval={0} tick={{ fontSize: 10 }} />
                <YAxis {...AXIS} tickFormatter={(v) => usd(v, { compact: true })} width={56} />
                <Tooltip cursor={{ fill: C.cursor }} content={({ payload }) => {
                  const p = payload?.[0]?.payload as LaunchpadStat | undefined;
                  return p ? <TipBox title={p.name} rows={[
                    { label: "Volume", value: usd(p.volume24h, { compact: true }) },
                    ...(p.volumeChange ? [{ label: "vs yesterday", value: pct(p.volumeChange) }] : []),
                    ...(p.fees24h ? [{ label: "Fees 24h", value: usd(p.fees24h, { compact: true }) }] : []),
                    { label: "Chain", value: CHAINS[p.chain].name },
                    { label: "Source", value: p.volumeSource ? VOL_SOURCE[p.volumeSource] : "—" },
                  ]} /> : null;
                }} />
                <Bar dataKey="volume24h" radius={[4, 4, 0, 0]}>
                  {venues.map((v) => <Cell key={v.id} fill={v.chain === "ton" ? C.accent : C.bar} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard
          title="Are new tokens winning?"
          sub="Share of sampled tokens up vs down over 24h"
          hint={<>For each venue we take the new and trending pools GeckoTerminal lists right now and count how many trade higher (win) or lower (loss) than 24h ago. The dashed line is 50/50, so anything right of it means most fresh tokens there are green. n is the sample size, and small samples swing a lot.</>}
        >
          {!sampledVenues.length ? <Empty>No sampled pools right now (GeckoTerminal / DexScreener).</Empty> : <div className="h-[280px]">
            <ResponsiveContainer>
              <BarChart data={sampledVenues.map((v) => ({ name: `${v.name} · ${v.wins + v.losses}`, venue: v.name, wins: v.wins, losses: v.losses, rate: winRate(v) }))} layout="vertical" stackOffset="expand" margin={{ left: 0, right: 16 }} barCategoryGap={6}>
                <CartesianGrid horizontal={false} stroke={GRID} />
                <XAxis type="number" {...AXIS} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
                <YAxis type="category" dataKey="name" width={118} {...AXIS} tick={{ fontSize: 11 }} />
                <Tooltip cursor={{ fill: C.cursor }} content={({ payload }) => {
                  const p = payload?.[0]?.payload;
                  return p ? <TipBox title={p.venue} rows={[{ label: "Up 24h", value: String(p.wins), color: C.up }, { label: "Down 24h", value: String(p.losses), color: C.down }, { label: "Win rate", value: `${p.rate.toFixed(0)}%` }]} /> : null;
                }} />
                <Bar dataKey="wins" stackId="a" fill={C.up} fillOpacity={0.85} stroke={C.bg} strokeWidth={2} />
                <Bar dataKey="losses" stackId="a" fill={C.down} fillOpacity={0.85} stroke={C.bg} strokeWidth={2} radius={[0, 4, 4, 0]} />
                <ReferenceLine x={0.5} stroke={C.label} strokeDasharray="3 3" />
              </BarChart>
            </ResponsiveContainer>
          </div>}
          {!!sampledVenues.length && <Legend items={[{ label: "Up 24h", color: C.up }, { label: "Down 24h", color: C.down }]} />}
        </ChartCard>

        <ChartCard
          title="Typical 24h return"
          sub="Median of sampled tokens · mean in tooltip"
          hint={<>The median 24h price change of the same sample, meaning what a typical fresh token on that venue did. The mean (in the tooltip) gets dragged up by a few moonshots, so a high mean with a negative median means most tokens lost and a handful ran.</>}
        >
          {!sampledVenues.length ? <Empty>No sampled pools right now.</Empty> : <div className="h-[280px]">
            <ResponsiveContainer>
              <BarChart data={sampledVenues.map((v) => ({ name: v.name, avg: v.avgReturn24h, med: v.medianReturn24h, n: v.wins + v.losses }))} margin={{ left: 0, right: 8 }} barCategoryGap="25%">
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis dataKey="name" {...AXIS} interval={0} tick={{ fontSize: 10 }} />
                <YAxis {...AXIS} tickFormatter={(v) => `${Math.round(v)}%`} width={48} />
                <ReferenceLine y={0} stroke={C.ref} />
                <Tooltip cursor={{ fill: C.cursor }} content={({ payload }) => {
                  const p = payload?.[0]?.payload;
                  return p ? <TipBox title={p.name} rows={[{ label: "Median", value: pct(p.med) }, { label: "Mean", value: pct(p.avg) }, { label: "Tokens", value: String(p.n) }]} /> : null;
                }} />
                <Bar dataKey="med" radius={4}>
                  {sampledVenues.map((v) => <Cell key={v.id} fill={v.medianReturn24h >= 0 ? C.up : C.down} fillOpacity={0.85} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard
          className="lg:col-span-2"
          title="DEX volume · 14 days"
          sub="Pick a venue to highlight it"
          hint={<>Daily traded volume from DefiLlama&apos;s protocol history. The highlighted venue is drawn in color and the rest stay grey for context. The scale is logarithmic so TON&apos;s DEXes stay readable next to Uniswap and Raydium.</>}
          right={histKeys.length ? <div className="seg">{histKeys.map((k) => <button key={k} data-on={focus === k} onClick={() => setFocus(k)}>{k}</button>)}</div> : undefined}
        >
          {!data.history.length ? <Empty>DefiLlama history unavailable right now.</Empty> : <div className="h-[280px]">
            <ResponsiveContainer>
              <LineChart data={data.history} margin={{ left: 0, right: 12 }}>
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis dataKey="date" {...AXIS} />
                <YAxis {...AXIS} tickFormatter={(v) => usd(v, { compact: true })} width={56} scale="log" domain={["auto", "auto"]} allowDataOverflow />
                <Tooltip content={({ payload, label }) => payload?.length ? <TipBox title={String(label)} rows={[...payload].sort((a, b) => Number(b.value) - Number(a.value)).map((p) => ({ label: String(p.dataKey), value: usd(Number(p.value), { compact: true }), color: p.dataKey === focus ? C.accent : C.bar }))} /> : null} />
                {histKeys.filter((k) => k !== focus).map((k) => <Line key={k} dataKey={k} stroke={C.bar} strokeWidth={1.5} dot={false} activeDot={false} isAnimationActive={false} />)}
                {focus && <Line key={focus} dataKey={focus} stroke={C.accent} strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: C.bg }} />}
              </LineChart>
            </ResponsiveContainer>
          </div>}
        </ChartCard>

        <ChartCard
          title="What's the winning pair?"
          sub="Sampled pools by quote asset"
          hint={<>Sampled pools (plus Bitpad launches) grouped by the asset they&apos;re paired against: TON, ETH, SOL, stables or tokenized stocks. For each group you get 24h volume, average 24h return, and the share of pools that are up. It shows which kind of pair is attracting money today.</>}
        >
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted">
              <tr><th className="py-1.5 font-medium">Pairs</th><th className="text-right font-medium">Vol</th><th className="text-right font-medium">Avg</th><th className="text-right font-medium">Up</th></tr>
            </thead>
            <tbody className="num">
              {data.pairTypes.map((p) => (
                <tr key={p.kind} className="border-t border-line">
                  <td className="py-2.5 font-medium">{p.label}<div className="text-[11px] font-normal text-muted">{p.pools} pools</div></td>
                  <td className="text-right">{p.pools ? usd(p.volume24h, { compact: true }) : "—"}</td>
                  <td className={`text-right font-medium ${!p.pools ? "text-muted" : p.avgReturn24h >= 0 ? "text-up" : "text-down"}`}>{p.pools ? pct(p.avgReturn24h) : "—"}</td>
                  <td className="text-right">
                    {p.pools ? (
                      <div className="ml-auto flex w-20 items-center justify-end gap-1.5">
                        <div className="h-1.5 w-10 overflow-hidden rounded-full bg-line"><div className="h-full bg-ink-2" style={{ width: `${p.winRate}%` }} /></div>
                        <span className="text-xs">{p.winRate.toFixed(0)}%</span>
                      </div>
                    ) : <span className="text-muted">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ChartCard>
      </div>

      <ChartCard
        title={`${venueKind === "launchpads" ? "Launchpad" : "DEX"} comparison`}
        sub="Click a column to sort"
        hint={<>Every metric above side by side. <b>Live</b> means pools were sampled just now. <b>Volume only</b> means DefiLlama reports volume but no pools were sampled, so win rate and returns are blank. <b>No data</b> means no public source answered. Launches counts sampled pools younger than 24h, or Bitpad factory launches in the last 24h.</>}
      >
        <CompareTable rows={allVenues} />
      </ChartCard>

      <ChartCard
        title="Trending pools"
        sub="Top 24h volume across chains · ⚡ buys on any chain"
        hint={<>GeckoTerminal&apos;s trending pools for each chain, ranked by 24h volume. Filter by what the token is paired against. ⚡ spends your quick-buy amount. TON pools go through the best STON.fi or DeDust route from your TON wallet. Solana, Ethereum, Base and BNB tokens are paid in that chain&apos;s coin (the same USD value) from Phantom or MetaMask, on LI.FI&apos;s best route (Jupiter, Uniswap, PancakeSwap…).</>}
        right={
          <div className="flex flex-wrap items-center gap-2">
            <QuickBuyAmount />
            <div className="seg">
              {(["all", "ton", "eth", "sol", "stable", "stock"] as const).map((q) => (
                <button key={q} data-on={quote === q} onClick={() => { setQuote(q); setTPage(0); }}>{q === "all" ? "All" : q.toUpperCase()}</button>
              ))}
            </div>
          </div>
        }
      >
        <div className="scroll-x">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="text-left text-xs text-muted">
              <tr className="border-b border-line">
                <th className="py-2 font-medium">Pool</th><th className="font-medium">Chain · DEX</th>
                <th className="text-right font-medium">Price</th><th className="text-right font-medium">Mcap</th><th className="text-right font-medium">1h</th><th className="text-right font-medium">24h</th>
                <th className="text-right font-medium">Volume</th><th className="text-right font-medium">Liquidity</th><th className="text-right font-medium">Txns</th><th className="text-right font-medium">Age</th><th className="pl-3 text-right font-medium">Buy</th>
              </tr>
            </thead>
            <tbody className="num">
              {trending.slice(tPage * 15, (tPage + 1) * 15).map((p) => (
                <tr key={p.id} onClick={() => p.poolAddress && router.push(`/pool/${p.chain}/${p.poolAddress}`)} title={volumeSpike(p) ? "Unusual volume right now" : undefined} className={`border-b border-line/60 last:border-0 hover:bg-surface-2/60 ${p.poolAddress ? "cursor-pointer" : ""} ${volumeSpike(p) ? "spike" : ""}`}>
                  <td className="py-2.5 font-medium">{p.poolAddress ? <Link href={`/pool/${p.chain}/${p.poolAddress}`} className="hover:underline">{p.base}<span className="font-normal text-muted"> / {coin(p.quote)}</span></Link> : <>{p.base}<span className="font-normal text-muted"> / {coin(p.quote)}</span></>}</td>
                  <td className="text-xs text-ink-2">{CHAINS[p.chain].short} · {p.dex}</td>
                  <td className="text-right">{price(p.priceUsd)}</td>
                  <td className="text-right" title={!p.marketCap && p.fdv ? "Fully diluted value (market cap not reported)" : undefined}>{p.marketCap || p.fdv ? usd((p.marketCap || p.fdv)!, { compact: true }) : "—"}</td>
                  <td className={`text-right ${p.change1h >= 0 ? "text-up" : "text-down"}`}>{pct(p.change1h)}</td>
                  <td className={`text-right font-medium ${p.change24h >= 0 ? "text-up" : "text-down"}`}>{pct(p.change24h)}</td>
                  <td className="text-right">{usd(p.volume24h, { compact: true })}</td>
                  <td className="text-right">{usd(p.liquidityUsd, { compact: true })}</td>
                  <td className="text-right">{num(p.txns24h, 0)}</td>
                  <td className="text-right text-muted">{p.ageHours < 48 ? `${Math.round(p.ageHours)}h` : `${Math.round(p.ageHours / 24)}d`}</td>
                  <td className="pl-3 text-right">
                    {p.chain === "ton" && p.baseAddress ? (
                      <QuickBuyButton token={{ address: p.baseAddress, symbol: p.base }} />
                    ) : p.baseAddress && xBuyable(p.chain) ? (
                      <XBuyButton chain={p.chain} token={p.baseAddress} symbol={p.base} />
                    ) : p.url ? (
                      <a href={p.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex text-muted hover:text-ink" aria-label="Open pool"><ExternalLink className="size-3.5" /></a>
                    ) : null}
                  </td>
                </tr>
              ))}
              {!trending.length && <tr><td colSpan={11} className="py-6 text-center text-muted">No pools for this filter</td></tr>}
            </tbody>
          </table>
        </div>
        <Pager page={tPage} pageSize={15} total={trending.length} onPage={setTPage} />
      </ChartCard>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="grid h-[240px] place-items-center rounded-lg bg-surface-2/60 px-4 text-center text-sm text-muted">{children}</div>;
}

function Kpi({ label, value, sub, hint, align }: { label: string; value: string; sub?: string; hint: React.ReactNode; align?: "left" | "right" }) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted">{label}<Hint align={align}>{hint}</Hint></div>
      <div className="num mt-2 truncate text-2xl font-semibold tracking-tight">{value}</div>
      {sub && <div className="mt-1 truncate text-xs text-ink-2">{sub}</div>}
    </div>
  );
}

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: i.color }} />{i.label}</span>
      ))}
    </div>
  );
}

type SortKey = "volume24h" | "volumeChange" | "fees24h" | "launches24h" | "winRate" | "medianReturn24h" | "buySellRatio";
function CompareTable({ rows }: { rows: LaunchpadStat[] }) {
  const [key, setKey] = useState<SortKey>("volume24h");
  const val = (r: LaunchpadStat) => (key === "winRate" ? winRate(r) : r[key] ?? -Infinity);
  const sorted = [...rows].sort((a, b) => val(b) - val(a));
  const H = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <th className="text-right font-medium">
      <button onClick={() => setKey(k)} className={key === k ? "text-ink" : "hover:text-ink"}>{children}{key === k ? " ↓" : ""}</button>
    </th>
  );
  const sampled = (r: LaunchpadStat) => r.wins + r.losses > 0;
  return (
    <div className="scroll-x">
      <table className="w-full min-w-[920px] text-sm">
        <thead className="text-left text-xs text-muted">
          <tr className="border-b border-line">
            <th className="py-2 font-medium">Venue</th><th className="font-medium">Chain</th><th className="font-medium">Mechanism</th>
            <H k="volume24h">Volume 24h</H><H k="volumeChange">vs 1d</H><H k="fees24h">Fees 24h</H><H k="launches24h">Launches</H><H k="winRate">Win rate</H><H k="medianReturn24h">Median 24h</H><H k="buySellRatio">Buys/sell</H>
            <th className="text-right font-medium">Top gainer</th><th className="pl-3 font-medium">Data</th>
          </tr>
        </thead>
        <tbody className="num">
          {sorted.map((r) => (
            <tr key={r.id} className={`border-b border-line/60 last:border-0 ${r.id === "bitpad" ? "bg-surface-2/70" : ""}`}>
              <td className="py-2.5 font-medium">{r.name}</td>
              <td className="text-ink-2">{CHAINS[r.chain].short}</td>
              <td className="text-xs text-ink-2">{r.mechanism}</td>
              <td className="text-right" title={r.volumeSource ? VOL_SOURCE[r.volumeSource] : undefined}>{r.source === "unavailable" ? "—" : usd(r.volume24h, { compact: true })}{r.volumeSource === "sampled" && <span className="text-muted">*</span>}</td>
              <td className={`text-right ${!r.volumeChange ? "text-muted" : r.volumeChange >= 0 ? "text-up" : "text-down"}`}>{r.source === "unavailable" || !r.volumeChange ? "—" : pct(r.volumeChange)}</td>
              <td className="text-right">{r.fees24h ? usd(r.fees24h, { compact: true }) : "—"}</td>
              <td className="text-right">{r.kind === "launchpad" && r.source !== "unavailable" ? num(r.launches24h, 0) : "—"}</td>
              <td className="text-right">{sampled(r) ? <>{winRate(r).toFixed(0)}% <span className="text-xs text-muted">({r.wins}/{r.wins + r.losses})</span></> : "—"}</td>
              <td className={`text-right font-medium ${!sampled(r) ? "text-muted" : r.medianReturn24h >= 0 ? "text-up" : "text-down"}`}>{sampled(r) ? pct(r.medianReturn24h) : "—"}</td>
              <td className="text-right">{sampled(r) ? r.buySellRatio.toFixed(2) : "—"}</td>
              <td className="text-right text-xs">{r.topGainer ? <>{r.topGainer.symbol} <span className="text-up">{pct(r.topGainer.change, 0)}</span></> : "—"}</td>
              <td className="pl-3"><SourceTag source={r.source} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-[11px] text-muted">* volume summed from sampled pools, so the real total is higher.</p>
    </div>
  );
}
