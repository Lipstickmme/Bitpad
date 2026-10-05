"use client";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { usd } from "@/lib/format";
import { SERIES } from "@/lib/venues";
import { AXIS, GRID, TipBox } from "./analytics/ChartCard";
import { Hint } from "./ui";

type Slice = { label: string; value: number };

/** Allocation donut, value by chain and each jetton's 24h profit/loss in USD. */
export function PortfolioCharts({ alloc, chains, pnl }: { alloc: Slice[]; chains: Slice[]; pnl: Slice[] }) {
  const total = alloc.reduce((s, a) => s + a.value, 0);
  const net = pnl.reduce((s, p) => s + p.value, 0);
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <section className="card p-4">
        <h3 className="text-sm font-semibold">Allocation</h3>
        {total > 0 ? (
          <>
            <div className="relative h-[180px]">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={alloc} dataKey="value" nameKey="label" innerRadius="60%" outerRadius="92%" stroke="#0f191d" strokeWidth={2}>
                    {alloc.map((a, i) => <Cell key={a.label} fill={SERIES[i % SERIES.length]} />)}
                  </Pie>
                  <Tooltip content={({ payload }) => payload?.[0] ? <TipBox title={String(payload[0].name)} rows={[{ label: "Value", value: usd(Number(payload[0].value)) }, { label: "Share", value: `${((100 * Number(payload[0].value)) / total).toFixed(1)}%` }]} /> : null} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                <div><div className="text-[10px] text-muted">Total</div><div className="num text-sm font-semibold">{usd(total, { compact: true })}</div></div>
              </div>
            </div>
            <ul className="mt-3 space-y-1.5 text-xs">
              {alloc.map((a, i) => (
                <li key={a.label} className="flex items-center gap-2">
                  <span className="size-2.5 rounded-sm" style={{ background: SERIES[i % SERIES.length] }} />
                  {a.label}<span className="num ml-auto text-ink-2">{usd(a.value, { compact: true })} · {((a.value / total) * 100).toFixed(1)}%</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="grid h-[180px] place-items-center text-sm text-muted">Nothing priced yet.</p>
        )}
      </section>

      <section className="card p-4">
        <h3 className="text-sm font-semibold">Value by chain</h3>
        {chains.some((c) => c.value > 0) ? (
          <div className="mt-3 h-[220px]">
            <ResponsiveContainer>
              <BarChart data={chains} layout="vertical" margin={{ left: 0, right: 12 }}>
                <CartesianGrid horizontal={false} stroke={GRID} />
                <XAxis type="number" {...AXIS} tickFormatter={(v) => usd(v, { compact: true })} />
                <YAxis type="category" dataKey="label" {...AXIS} width={64} />
                <Tooltip cursor={{ fill: "rgba(255,255,255,0.03)" }} content={({ payload }) => payload?.[0] ? <TipBox title={String(payload[0].payload.label)} rows={[{ label: "Value", value: usd(Number(payload[0].value)) }]} /> : null} />
                <Bar dataKey="value" radius={[0, 3, 3, 0]}>{chains.map((c, i) => <Cell key={c.label} fill={SERIES[i % SERIES.length]} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="grid h-[220px] place-items-center text-sm text-muted">No balances yet.</p>
        )}
      </section>

      <section className="card p-4">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          24h P&amp;L · tokens
          <Hint>What each TON jetton you hold gained or lost in dollars over the last 24 hours, from its current value and 24h price change. Coins on other chains aren&apos;t included.</Hint>
          <span className={`num ml-auto text-xs ${net >= 0 ? "text-up" : "text-down"}`}>{pnl.length ? `${net >= 0 ? "+" : ""}${usd(net)}` : ""}</span>
        </h3>
        {pnl.length ? (
          <div className="mt-3 h-[220px]">
            <ResponsiveContainer>
              <BarChart data={pnl} margin={{ left: 0, right: 8 }}>
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis dataKey="label" {...AXIS} interval={0} />
                <YAxis {...AXIS} width={48} tickFormatter={(v) => usd(v, { compact: true })} />
                <Tooltip cursor={{ fill: "rgba(255,255,255,0.03)" }} content={({ payload }) => payload?.[0] ? <TipBox title={String(payload[0].payload.label)} rows={[{ label: "24h", value: `${Number(payload[0].value) >= 0 ? "+" : ""}${usd(Number(payload[0].value))}` }]} /> : null} />
                <Bar dataKey="value" radius={3}>{pnl.map((p) => <Cell key={p.label} fill={p.value >= 0 ? "var(--color-up, #4ade80)" : "var(--color-down, #f87171)"} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="grid h-[220px] place-items-center text-sm text-muted">No priced tokens with 24h data.</p>
        )}
      </section>
    </div>
  );
}
