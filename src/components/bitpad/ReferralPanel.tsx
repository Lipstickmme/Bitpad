"use client";
import { useEffect, useState } from "react";
import { useTonAddress, useTonConnectUI } from "@tonconnect/ui-react";
import { Crown, Link2, Plus, Trash2, Wallet } from "lucide-react";
import type { MarketToken } from "@/lib/types";
import { config } from "@/lib/config";
import { num, shortAddr } from "@/lib/format";
import { referralLink } from "@/lib/referral";
import { CopyButton } from "../CopyButton";
import { toast } from "../Toast";
import { refreshSoon, usePool } from "./usePool";
import { sendTx } from "@/lib/ton/send";

const MAX_LINKS = config.referral.maxLinksPerToken;

/** Referral links & fees for a Bitpad token: public leaderboard + creator/referrer tools. */
export function ReferralPanel({ token }: { token: MarketToken }) {
  const wallet = useTonAddress();
  const [tc] = useTonConnectUI();
  const { data, reload } = usePool(token.bitpad?.pool, wallet, null);
  const [newRef, setNewRef] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  if (!data) return null;
  const { pool, referrers, me } = data;
  const dec = pool.pairDecimals;
  const sym = token.pair.symbol;
  const fmt = (v: string) => `${num(Number(v) / 10 ** dec, 4)} ${sym}`;
  const active = referrers.filter((r) => r.active).sort((a, b) => Number(BigInt(b.volume) - BigInt(a.volume)));
  const isJettonPair = !!pool.pairMaster;

  async function send(label: string, build: () => Promise<{ address: string; amount: string; payload?: string }>) {
    if (!wallet) return tc.openModal();
    setBusy(label);
    try {
      await sendTx(tc, [await build()]);
      toast.success(`${label} sent`, "Updates here in a few seconds.");
      refreshSoon(reload);
    } catch (e) {
      toast.error(`${label} not sent`, (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const addLink = () => {
    const a = newRef.trim();
    if (!/^(EQ|UQ|0:|kQ|0Q)/.test(a)) return toast.error("Enter a TON wallet address");
    return send("Add link", async () => (await import("@/lib/ton/launch")).buildReferrerTx(pool.address, a)).then(() => setNewRef(""));
  };

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2">
        <Link2 className="size-4 text-ink-2" />
        <h3 className="text-sm font-semibold">Referral links</h3>
        <span className="num ml-auto text-xs text-muted">{pool.activeReferrers}/{MAX_LINKS} used</span>
      </div>
      <p className="mt-1 text-[11px] text-muted">
        Buys go through a link. The creator fee ({pool.creatorFeeBps / 100}%) is split 50/50 between the creator and the link&apos;s owner, on-chain.
      </p>

      {/* Creator tools */}
      {me?.isCreator && (
        <div className="mt-3 rounded-lg border border-line p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold"><Crown className="size-3.5 text-brand" /> You created this token</div>
          <div className="mt-2 flex justify-between text-xs">
            <span className="text-muted">Unclaimed creator fees</span>
            <span className="num font-medium">{fmt(pool.creatorFeesAccrued)}</span>
          </div>
          <button
            disabled={!!busy || BigInt(pool.creatorFeesAccrued) + BigInt(pool.protocolFeesAccrued) === 0n}
            onClick={() => send("Claim fees", async () => (await import("@/lib/ton/launch")).buildClaimFeesTx(pool.address, isJettonPair))}
            className="btn btn-ghost mt-2 h-8 w-full text-xs"
          >
            {busy === "Claim fees" ? "Confirm in wallet…" : "Claim creator fees"}
          </button>
          <div className="mt-3 flex gap-1.5">
            <input value={newRef} onChange={(e) => setNewRef(e.target.value)} placeholder="Promoter wallet address" className="input h-8 flex-1 font-mono text-[11px]" />
            <button onClick={addLink} disabled={!!busy || pool.activeReferrers >= MAX_LINKS} className="btn btn-primary h-8 px-2.5 text-xs"><Plus className="size-3.5" /> Add</button>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
            <span>Your own link</span>
            {origin && <CopyButton value={referralLink(origin, token.address, pool.creator)} label="Copy" />}
          </div>
        </div>
      )}

      {/* Referrer tools */}
      {me?.referrer && (
        <div className="mt-3 rounded-lg border border-line p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold"><Wallet className="size-3.5 text-brand" /> {me.referrer.active ? "You hold a referral link" : "Your link was removed"}</div>
          <div className="mt-2 space-y-1 text-xs">
            <div className="flex justify-between"><span className="text-muted">Unclaimed</span><span className="num font-medium">{fmt(me.referrer.accrued)}</span></div>
            <div className="flex justify-between"><span className="text-muted">Earned (lifetime)</span><span className="num">{fmt(me.referrer.earned)}</span></div>
            <div className="flex justify-between"><span className="text-muted">Volume via your link</span><span className="num">{fmt(me.referrer.volume)}</span></div>
          </div>
          <div className="mt-2 flex gap-1.5">
            {me.referrer.active && origin && <CopyButton value={referralLink(origin, token.address, wallet)} label="Copy my link" className="flex-1 justify-center" />}
            <button
              disabled={!!busy || BigInt(me.referrer.accrued) === 0n}
              onClick={() => send("Claim", async () => (await import("@/lib/ton/launch")).buildClaimReferralTx(pool.address))}
              className="btn btn-ghost h-8 flex-1 text-xs"
            >
              {busy === "Claim" ? "Confirm…" : "Claim"}
            </button>
          </div>
        </div>
      )}

      {/* Leaderboard */}
      <ul className="mt-3 divide-y divide-line text-xs">
        {active.map((r, i) => (
          <li key={r.address} className="flex items-center gap-2 py-2">
            <span className="num w-5 text-muted">{i + 1}</span>
            <a href={`https://tonviewer.com/${r.address}`} target="_blank" rel="noreferrer" className="font-mono hover:text-brand">{shortAddr(r.address)}</a>
            <span className="num ml-auto text-ink-2" title="Volume brought in">{fmt(r.volume)}</span>
            {me?.isCreator && (
              <>
                {origin && <CopyButton value={referralLink(origin, token.address, r.address)} className="px-1.5 py-0.5" />}
                <button onClick={() => send("Remove link", async () => (await import("@/lib/ton/launch")).buildReferrerTx(pool.address, r.address, true))} disabled={!!busy} className="p-1 text-muted hover:text-down" aria-label="Remove link"><Trash2 className="size-3.5" /></button>
              </>
            )}
          </li>
        ))}
        {!active.length && <li className="py-3 text-center text-muted">No referral links yet{me?.isCreator ? " — add your promoters above." : "."}</li>}
      </ul>
    </div>
  );
}
