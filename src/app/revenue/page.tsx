import type { Metadata } from "next";
import { config } from "@/lib/config";
import { getFeeRevenue } from "@/lib/fees";
import { getPairAssets } from "@/lib/prices";
import { ago, num, shortAddr, usd } from "@/lib/format";
import { SERIES } from "@/lib/venues";

export const metadata: Metadata = { title: "Revenue & fees" };
export const dynamic = "force-dynamic";

export default async function RevenuePage() {
  const [rev, { assets }] = await Promise.all([getFeeRevenue(), getPairAssets()]);
  const tonUsd = assets.find((a) => a.symbol === "TON")?.priceUsd ?? null;
  const inUsd = (t: number | null | undefined) => (t != null && tonUsd ? ` · ${usd(t * tonUsd, { compact: true })}` : "");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Revenue & fees</h1>
        <p className="text-sm text-ink-2">Fees are taken on-chain: STON.fi routes pay Bitpad&apos;s referral share inside the swap, DeDust routes and launches send a separate transfer. Figures below are what the fee wallet actually received.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Swap fee" value={`${(config.swapFeeBps / 100).toFixed(2)}%`} sub="per trade" />
        <Tile label="Launch fee" value={`${config.launchFeeTon} TON`} sub="per token" />
        <Tile label="Received · 24h" value={rev.configured ? `${num(rev.received24h, 2)} TON` : "—"} sub={rev.configured ? `${inUsd(rev.received24h).slice(3) || "fee wallet"}` : "set NEXT_PUBLIC_FEE_WALLET"} />
        <Tile label="Received · 7d" value={rev.configured ? `${num(rev.received7d, 2)} TON` : "—"} sub={rev.configured ? `balance ${rev.balance != null ? num(rev.balance, 2) : "—"} TON${inUsd(rev.balance)}` : "—"} />
      </div>

      <section className="card p-5">
        <h2 className="font-semibold">Fee split</h2>
        <p className="text-xs text-muted">Configured in <code>src/lib/config.ts</code> — distribution is done from the fee wallet.</p>
        <div className="mt-4 flex h-3 overflow-hidden rounded-full">
          {config.feeSplit.map((f, i) => <div key={f.label} style={{ width: `${f.share}%`, background: SERIES[i] }} className="border-r-2 border-surface last:border-0" />)}
        </div>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {config.feeSplit.map((f, i) => (
            <li key={f.label} className="flex items-center gap-3 rounded-lg bg-surface-2 px-3 py-2">
              <span className="size-2.5 rounded-sm" style={{ background: SERIES[i] }} />
              <span className="flex-1 text-sm">{f.label}</span>
              <span className="num text-sm font-semibold">{f.share}%</span>
              {rev.configured && <span className="num w-24 text-right text-xs text-muted">{num((rev.received7d * f.share) / 100, 2)} TON/7d</span>}
            </li>
          ))}
        </ul>
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-line px-4 py-3 text-sm font-semibold">Incoming to fee wallet {rev.configured && <span className="font-mono text-xs font-normal text-muted">{shortAddr(config.feeWallet, 6, 6)}</span>}</div>
        {!rev.configured ? (
          <p className="p-6 text-center text-sm text-muted">Set <code>NEXT_PUBLIC_FEE_WALLET</code> to start collecting fees.</p>
        ) : !rev.recent.length ? (
          <p className="p-6 text-center text-sm text-muted">{rev.live ? "No incoming transfers yet." : "TonAPI didn't respond."}</p>
        ) : (
          <table className="w-full text-sm">
            <tbody className="num">
              {rev.recent.map((r, i) => (
                <tr key={i} className="border-b border-line/60 last:border-0">
                  <td className="px-4 py-2 text-muted">{ago(r.time)}</td>
                  <td className="font-mono text-xs">{shortAddr(r.from, 6, 6)}</td>
                  <td className="text-xs text-ink-2">{r.comment ?? ""}</td>
                  <td className="px-4 text-right font-semibold">+{num(r.amount, 4)} TON</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className="num mt-1 truncate text-xl font-semibold">{value}</div>
      <div className="truncate text-xs text-ink-2">{sub}</div>
    </div>
  );
}
