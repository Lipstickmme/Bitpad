"use client";
import { useCallback, useEffect, useState } from "react";
import { useTonAddress, useTonConnectUI } from "@tonconnect/ui-react";
import { Coins } from "lucide-react";
import type { MarketToken } from "@/lib/types";
import type { TcMessage } from "@/lib/ton/client";
import { num } from "@/lib/format";
import { Hint } from "../ui";
import { toast } from "../Toast";
import { haptic } from "../TelegramBridge";
import { jettonWallet, refreshSoon } from "./usePool";

interface VaultRes {
  vault: { address: string; totalStaked: string; stakers: number; rewardsTotal: string; carry: string } | null;
  me: { amount: string; pending: string } | null;
  error?: string;
}

const toUnits = (v: string) => {
  const [i, f = ""] = v.split(".");
  return BigInt(i || "0") * 10n ** 9n + BigInt((f + "000000000").slice(0, 9) || "0");
};
const human = (raw: string | bigint) => Number(BigInt(raw)) / 1e9;

/** Stake the jetton, earn TON from a share of the pool's fees. Withdraw any time. */
export function StakePanel({ token }: { token: MarketToken }) {
  const wallet = useTonAddress();
  const [tc] = useTonConnectUI();
  const [data, setData] = useState<VaultRes | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [mode, setMode] = useState<"stake" | "unstake">("stake");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const pool = token.bitpad?.pool;
  const tonPair = !token.bitpad?.pairMaster;

  const load = useCallback(() => {
    if (!pool) return;
    fetch(`/api/bitpad/vault?pool=${pool}${wallet ? `&me=${wallet}` : ""}`).then((r) => r.json()).then(setData).catch(() => {});
    if (wallet)
      fetch(`/api/portfolio?address=${wallet}`)
        .then((r) => r.json())
        .then((d) => setBalance(d.holdings?.find((h: { address: string }) => h.address === token.address)?.amount ?? 0))
        .catch(() => {});
  }, [pool, wallet, token.address]);
  useEffect(() => {
    load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [load]);

  if (!pool || !data?.vault) return null; // launches from before vaults existed
  const v = data.vault;
  const staked = data.me ? human(data.me.amount) : 0;
  const pending = data.me ? human(data.me.pending) : 0;
  const share = token.totalSupply ? (100 * human(v.totalStaked)) / token.totalSupply : null;
  const myShare = Number(v.totalStaked) > 0 && data.me ? (100 * Number(data.me.amount)) / Number(v.totalStaked) : 0;

  async function send(build: () => Promise<TcMessage[]>, done: string) {
    haptic("medium");
    if (!wallet) return tc.openModal();
    setBusy(true);
    try {
      await tc.sendTransaction({ validUntil: Math.floor(Date.now() / 1000) + 300, messages: await build() });
      haptic("success");
      toast.success(done, "Updates in a few seconds.");
      setAmount("");
      refreshSoon(load);
    } catch (e) {
      haptic("error");
      toast.error("Transaction not sent", (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const tx = () => import("@/lib/ton/launch");
  const submit = () => {
    const units = toUnits(amount || "0");
    if (units <= 0n) return;
    if (mode === "stake")
      return send(async () => [(await tx()).buildStakeTx({ vault: v.address, userJettonWallet: await jettonWallet(token.address, wallet), user: wallet, amount: units })], `Staking ${amount} $${token.symbol}`);
    return send(async () => [(await tx()).buildUnstakeTx(v.address, units)], `Withdrawing ${amount} $${token.symbol}`);
  };
  const max = mode === "stake" ? balance ?? 0 : staked;

  return (
    <div className="card p-4">
      <div className="flex items-center gap-1.5 text-sm font-semibold">
        <Coins className="size-4 text-brand" /> Stake &amp; earn TON
        <Hint align="right">
          Stake ${token.symbol} here to earn TON. Every time the pool&apos;s fees are collected, 30% of the platform fee and 30% of the creator&apos;s fee go to stakers, split by how much each person has staked. You can withdraw any time.{" "}
          {tonPair
            ? "This pool is paired with TON, so the rewards are paid straight from the pool contract."
            : `This pool is paired with ${token.pair.symbol}, so the stakers' share is sent to the Bitpad fee wallet, swapped to TON and then added to the vault. That step is run by Bitpad, not the contract.`}
        </Hint>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <Stat k="Staked" v={`${num(human(v.totalStaked), 0)}`} sub={share != null ? `${share.toFixed(1)}% of supply` : undefined} />
        <Stat k="Stakers" v={String(v.stakers)} />
        <Stat k="Paid out" v={`${num(human(v.rewardsTotal), 3)} TON`} />
      </div>

      {wallet && (
        <div className="mt-3 flex items-center justify-between rounded-lg bg-surface-2 p-3 text-xs">
          <div>
            <div className="text-muted">You</div>
            <div className="num font-semibold">{num(staked, 2)} staked{myShare ? <span className="font-normal text-muted"> · {myShare.toFixed(2)}%</span> : null}</div>
          </div>
          <div className="text-right">
            <div className="text-muted">Claimable</div>
            <div className="num font-semibold text-ink">{num(pending, 4)} TON</div>
          </div>
          <button disabled={busy || pending <= 0} onClick={() => send(async () => [(await tx()).buildClaimRewardsTx(v.address)], "Claiming rewards")} className="btn btn-ghost h-8 px-3 text-xs">Claim</button>
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-1 rounded-lg bg-surface-2 p-1">
        {(["stake", "unstake"] as const).map((m) => (
          <button key={m} onClick={() => { setMode(m); setAmount(""); }} className={`rounded-md py-1.5 text-xs font-semibold capitalize ${mode === m ? "bg-line-strong text-ink" : "text-muted"}`}>{m === "stake" ? "Stake" : "Withdraw"}</button>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2 rounded-lg border border-line px-3">
        <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0.0" className="num h-10 min-w-0 flex-1 bg-transparent font-semibold outline-none" />
        <button onClick={() => setAmount(String(Math.floor(max * 1e4) / 1e4))} disabled={!max} className="text-xs text-muted hover:text-ink disabled:opacity-40">Max {num(max, 2)}</button>
      </div>
      <button onClick={submit} disabled={busy || (!!wallet && !(Number(amount) > 0 && Number(amount) <= max + 1e-9))} className="btn btn-primary mt-2 w-full">
        {busy ? "Confirm in wallet…" : !wallet ? "Connect TON wallet" : mode === "stake" ? `Stake $${token.symbol}` : `Withdraw $${token.symbol}`}
      </button>

      <button
        onClick={() => send(async () => [(await tx()).buildClaimFeesTx(pool, !tonPair)], "Collecting pool fees")}
        disabled={busy}
        className="mt-2 w-full text-center text-[11px] text-muted hover:text-ink"
        title="Anyone can trigger this. It pays the platform, the creator and the stakers' share."
      >
        Distribute accrued fees now →
      </button>
    </div>
  );
}

function Stat({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-surface-2 p-2.5">
      <div className="text-muted">{k}</div>
      <div className="num truncate font-semibold">{v}</div>
      {sub && <div className="num text-[10px] text-muted">{sub}</div>}
    </div>
  );
}
