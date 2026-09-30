"use client";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { num } from "@/lib/format";
import { AXIS, GRID, TipBox } from "./analytics/ChartCard";
import { Hint } from "./ui";

const SOURCES = ["Bitpad pools", "Launch fees", "STON.fi", "DeDust", "Other"] as const;
const COLOR: Record<string, string> = { "Bitpad pools": "#8cbfd1", "Launch fees": "#c9d6da", "STON.fi": "#5f8794", DeDust: "#8a9ca2", Other: "#3f5a63" };

type Day = { date: string } & Record<string, number | string>;

/** Fee-wallet income per day (30d, stacked by source) and each source's share. */
export function RevenueCharts({ daily, bySource }: { daily: Day[]; bySource: { source: string; amount: number }[] }) {
  const total = bySource.reduce((s, x) => s + x.amount, 0);
  const shares = bySource.filter((x) => x.amount > 0);
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <section className="card p-5 lg:col-span-2">
        <h2 className="mb-4 flex items-center gap-1.5 text-sm font-semibold">
          TON received per day · 30d
          <Hint>Every TON transfer into the fee wallet over the last 30 days (read on-chain via TonAPI), grouped by where it came from. The source comes from the transfer&apos;s own comment: &quot;Bitpad protocol fees&quot; from pool claims, &quot;Bitpad launch fee&quot; from the factory, and bitpad:fee:stonfi or :dedust from routed buys. STON.fi referral fees that sit in STON.fi vaults show up here only once they&apos;re withdrawn.</Hint>
        </h2>
        {total > 0 ? (
          <div className="h-[260px]">
            <ResponsiveContainer>
              <BarChart data={daily} margin={{ left: 0, right: 8 }} barCategoryGap="18%">
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis dataKey="date" {...AXIS} interval={4} />
                <YAxis {...AXIS} width={44} tickFormatter={(v) => num(v, 2)} />
                <Tooltip cursor={{ fill: "rgba(255,255,255,0.03)" }} content={({ payload, label }) => payload?.length ? <TipBox title={String(label)} rows={payload.filter((p) => Number(p.value) > 0).map((p) => ({ label: String(p.dataKey), value: `${num(Number(p.value), 4)} TON`, color: COLOR[String(p.dataKey)] }))} /> : null} />
                {SOURCES.map((k, i) => <Bar key={k} dataKey={k} stackId="a" fill={COLOR[k]} radius={i === SOURCES.length - 1 ? [3, 3, 0, 0] : 0} />)}
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="grid h-[260px] place-items-center text-sm text-muted">No income in the last 30 days yet.</p>
        )}
      </section>
      <section className="card p-5">
        <h2 className="mb-4 flex items-center gap-1.5 text-sm font-semibold">
          Where it comes from
          <Hint>Share of the last 30 days&apos; fee-wallet income by source.</Hint>
        </h2>
        {total > 0 ? (
          <>
            <div className="h-[180px]">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={shares} dataKey="amount" nameKey="source" innerRadius="58%" outerRadius="90%" stroke="#0f191d" strokeWidth={2}>
                    {shares.map((s) => <Cell key={s.source} fill={COLOR[s.source]} />)}
                  </Pie>
                  <Tooltip content={({ payload }) => payload?.[0] ? <TipBox title={String(payload[0].name)} rows={[{ label: "TON", value: num(Number(payload[0].value), 4) }, { label: "Share", value: `${((100 * Number(payload[0].value)) / total).toFixed(1)}%` }]} /> : null} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-3 space-y-1.5 text-xs">
              {bySource.map((s) => (
                <li key={s.source} className="flex items-center gap-2">
                  <span className="size-2.5 rounded-sm" style={{ background: COLOR[s.source] }} />
                  <span className="text-ink-2">{s.source}</span>
                  <span className="num ml-auto">{num(s.amount, 3)} TON · {total ? ((100 * s.amount) / total).toFixed(0) : 0}%</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="grid h-[180px] place-items-center text-sm text-muted">Nothing yet.</p>
        )}
      </section>
    </div>
  );
}
