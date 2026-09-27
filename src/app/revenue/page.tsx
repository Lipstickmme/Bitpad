import type { Metadata } from "next";
import { getTokens } from "@/lib/market";
import { config } from "@/lib/config";
import { usd } from "@/lib/format";
import { shortAddr } from "@/lib/format";
import { SERIES } from "@/lib/venues";

export const metadata: Metadata = { title: "Revenue & fees" };
export const revalidate = 60;

export default async function RevenuePage() {
  const tokens = await getTokens();
  const vol = tokens.reduce((s, t) => s + t.volume24h, 0);
  const swapRev = vol * (config.swapFeeBps / 10_000);
  const launches = tokens.filter((t) => t.status === "new").length;
  const launchRev = launches * config.launchFeeTon * 2.86;
  const total = swapRev + launchRev;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Revenue & fees</h1>
        <p className="text-sm text-ink-2">Every route Bitpad executes carries a platform fee, taken on-chain via STON.fi&apos;s referral mechanism — no custody, no extra contract.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <Tile label="Swap fee" value={`${(config.swapFeeBps / 100).toFixed(2)}%`} sub="per trade, all routes" />
        <Tile label="Launch fee" value={`${config.launchFeeTon} TON`} sub="per token" />
        <Tile label="Est. 24h revenue" value={usd(total, { compact: true })} sub={`${usd(swapRev, { compact: true })} swaps · ${usd(launchRev, { compact: true })} launches`} />
        <Tile label="Fee wallet" value={config.feeWallet ? shortAddr(config.feeWallet, 6, 6) : "Not set"} sub="NEXT_PUBLIC_FEE_WALLET" />
      </div>
      <section className="card p-5">
        <h2 className="font-bold">Where fees go</h2>
        <div className="mt-4 flex h-4 overflow-hidden rounded-full">
          {config.feeSplit.map((f, i) => <div key={f.label} style={{ width: `${f.share}%`, background: SERIES[i] }} className="border-r-2 border-surface last:border-0" />)}
        </div>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {config.feeSplit.map((f, i) => (
            <li key={f.label} className="flex items-center gap-3 rounded-xl bg-surface-2 p-3">
              <span className="size-3 rounded-sm" style={{ background: SERIES[i] }} />
              <span className="flex-1 text-sm font-semibold">{f.label}</span>
              <span className="num text-sm font-bold">{f.share}%</span>
              <span className="num w-20 text-right text-xs text-muted">{usd((total * f.share) / 100, { compact: true })}/d</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="card p-5 text-sm text-ink-2">
        <h2 className="mb-2 font-bold text-ink">How fees are collected</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li><b>On-chain TON swaps</b> — STON.fi v2 routers pay the referral share (up to 1%) straight to the fee wallet inside the swap transaction.</li>
          <li><b>Launches</b> — the BitpadFactory contract forwards the launch fee to the fee wallet when it deploys the jetton.</li>
          <li><b>Bundles</b> — every bundle wallet swap carries the same referral fee.</li>
          <li><b>Cross-chain routes</b> — Omniston / external venues carry the fee as a quote spread.</li>
        </ul>
      </section>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className="num mt-1 truncate text-2xl font-extrabold">{value}</div>
      <div className="truncate text-xs text-ink-2">{sub}</div>
    </div>
  );
}
