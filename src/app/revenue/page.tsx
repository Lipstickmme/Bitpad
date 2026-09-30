import type { Metadata } from "next";
import { config } from "@/lib/config";
import { getFeeRevenue, getReferralFees } from "@/lib/fees";
import { WithdrawVault } from "@/components/WithdrawVault";
import { ReferralProgram } from "@/components/ReferralProgram";
import { Hint } from "@/components/ui";
import { getFactoryConfig } from "@/lib/launches";
import { getPairAssets } from "@/lib/prices";
import { ago, num, shortAddr, usd } from "@/lib/format";

export const metadata: Metadata = { title: "Revenue & fees" };
export const dynamic = "force-dynamic";

export default async function RevenuePage() {
  const [rev, { assets }, factory, ref] = await Promise.all([getFeeRevenue(), getPairAssets(), getFactoryConfig(), getReferralFees().catch(() => null)]);
  const tonUsd = assets.find((a) => a.symbol === "TON")?.priceUsd ?? null;
  const inUsd = (t: number | null | undefined) => (t != null && tonUsd ? ` · ${usd(t * tonUsd, { compact: true })}` : "");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Revenue &amp; fees</h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-2">Every trade Bitpad routes pays the platform on-chain, through the route&apos;s own frontend-fee mechanism: Bitpad pools take a protocol fee inside the contract, STON.fi swaps carry Bitpad as referrer (the cut accrues in STON.fi vaults owned by the fee wallet), and DeDust swaps add a separate fee transfer. Figures below are read live from chain and STON.fi.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Bitpad pool fee" value={factory ? `${((factory.protocolFeeBps + factory.creatorFeeBps) / 100).toFixed(2)}%` : "—"} sub={factory ? `${factory.protocolFeeBps / 100}% protocol · ${factory.creatorFeeBps / 100}% creator` : "factory not reachable"} />
        <Tile label="Launch fee" value={factory ? `${Number(factory.launchFee) / 1e9} TON` : "—"} sub={`STON.fi / DeDust routes: ${(config.swapFeeBps / 100).toFixed(2)}%`} />
        <Tile label="Received · 24h" value={rev.configured ? `${num(rev.received24h, 2)} TON` : "—"} sub={rev.configured ? `${inUsd(rev.received24h).slice(3) || "fee wallet"}` : "factory not reachable"} />
        <Tile label="Received · 7d" value={rev.configured ? `${num(rev.received7d, 2)} TON` : "—"} sub={rev.configured ? `balance ${rev.balance != null ? num(rev.balance, 2) : "—"} TON${inUsd(rev.balance)}` : "—"} />
      </div>

      <ReferralProgram />

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            Frontend fees · STON.fi referral
            <Hint>STON.fi v2 lets the app that routes a swap take a referral fee of up to 1%. Bitpad sets {(config.swapFeeBps / 100).toFixed(2)}% on every STON.fi route, including ⚡ quick buys and the trade panel. The fee stays in a per-token STON.fi Vault owned by the fee wallet until the owner withdraws it (about 0.3 TON gas, unused gas is refunded).</Hint>
          </h2>
          <span className="num ml-auto text-xs text-muted">{ref?.configured && ref.accrued30dUsd != null ? `Accrued 30d ${usd(ref.accrued30dUsd)}` : ""}</span>
        </div>
        {!ref?.configured ? (
          <p className="p-6 text-center text-sm text-muted">Couldn&apos;t read the fee wallet from the factory contract right now.</p>
        ) : !ref.vaults.length ? (
          <p className="p-6 text-center text-sm text-muted">{ref.live ? "No unwithdrawn referral fees in STON.fi vaults." : "STON.fi API didn't respond."}</p>
        ) : (
          <table className="w-full text-sm">
            <tbody className="num">
              {ref.vaults.map((v) => (
                <tr key={v.vault} className="border-b border-line/60 last:border-0">
                  <td className="px-4 py-2.5 font-medium">{v.symbol}</td>
                  <td className="font-mono text-xs text-muted">{shortAddr(v.vault, 6, 6)}</td>
                  <td className="text-right">{num(v.balance, 4)} {v.symbol}{v.usd != null && <span className="text-muted"> · {usd(v.usd)}</span>}</td>
                  <td className="px-4 text-right"><WithdrawVault vault={v.vault} owner={config.feeWallet} label={v.symbol} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

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
          <p className="p-6 text-center text-sm text-muted">Couldn&apos;t read the fee wallet from the factory contract right now.</p>
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
