import type { Metadata } from "next";
import { config } from "@/lib/config";
import { getFeeRevenue } from "@/lib/fees";
import { getFactoryConfig } from "@/lib/launches";
import { getPairAssets } from "@/lib/prices";
import { ago, num, shortAddr, usd } from "@/lib/format";

export const metadata: Metadata = { title: "Revenue & fees" };
export const dynamic = "force-dynamic";

export default async function RevenuePage() {
  const [rev, { assets }, factory] = await Promise.all([getFeeRevenue(), getPairAssets(), getFactoryConfig()]);
  const tonUsd = assets.find((a) => a.symbol === "TON")?.priceUsd ?? null;
  const inUsd = (t: number | null | undefined) => (t != null && tonUsd ? ` · ${usd(t * tonUsd, { compact: true })}` : "");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Revenue & fees</h1>
        <p className="text-sm text-ink-2">Fees are taken on-chain: STON.fi routes pay Bitpad&apos;s referral share inside the swap, DeDust routes and launches send a separate transfer. Figures below are what the fee wallet actually received.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Bitpad pool fee" value={factory ? `${((factory.protocolFeeBps + factory.creatorFeeBps) / 100).toFixed(2)}%` : "—"} sub={factory ? `${factory.protocolFeeBps / 100}% protocol · ${factory.creatorFeeBps / 100}% creator` : "factory not reachable"} />
        <Tile label="Launch fee" value={factory ? `${Number(factory.launchFee) / 1e9} TON` : "—"} sub={`STON.fi / DeDust routes: ${(config.swapFeeBps / 100).toFixed(2)}%`} />
        <Tile label="Received · 24h" value={rev.configured ? `${num(rev.received24h, 2)} TON` : "—"} sub={rev.configured ? `${inUsd(rev.received24h).slice(3) || "fee wallet"}` : "set NEXT_PUBLIC_FEE_WALLET"} />
        <Tile label="Received · 7d" value={rev.configured ? `${num(rev.received7d, 2)} TON` : "—"} sub={rev.configured ? `balance ${rev.balance != null ? num(rev.balance, 2) : "—"} TON${inUsd(rev.balance)}` : "—"} />
      </div>

      <section className="card p-5">
        <h2 className="text-sm font-semibold">How fees are shared — on-chain</h2>
        <p className="mt-1 text-xs text-muted">Enforced by each token&apos;s BitpadPool contract; nothing is distributed off-chain.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Split title="Protocol fee" value={factory ? `${factory.protocolFeeBps / 100}%` : "—"} body="Every trade. Accrues in the pool; ClaimFees sends it to the fee wallet." />
          <Split title="Creator fee" value={factory ? `${factory.creatorFeeBps / 100}%` : "—"} body={`Every trade. Split ${100 - config.referral.referrerShareOfCreatorFee}/${config.referral.referrerShareOfCreatorFee} between the creator and the referral link used.`} />
          <Split title="Referral links" value={`max ${config.referral.maxLinksPerToken}`} body="Per token, assigned by the creator. Every buy must come through a link (or the creator's own). Referrers claim their share any time." />
        </div>
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

function Split({ title, value, body }: { title: string; value: string; body: string }) {
  return (
    <div className="rounded-lg bg-surface-2 p-3">
      <div className="flex items-baseline justify-between"><span className="text-sm font-medium">{title}</span><span className="num text-sm font-semibold">{value}</span></div>
      <p className="mt-1 text-xs text-ink-2">{body}</p>
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
