"use client";
import { useEffect, useMemo, useState } from "react";
import { useTonAddress, useTonConnectUI } from "@tonconnect/ui-react";
import { ArrowRightLeft, Link2, Settings2, Zap } from "lucide-react";
import type { MarketToken } from "@/lib/types";
import { buyImpact, minOutFor, quoteBuy, quoteSell } from "@/lib/bitpad-math";
import { captureReferral } from "@/lib/referral";
import { useApp } from "@/lib/store";
import { num, shortAddr, usd } from "@/lib/format";
import { toast } from "../Toast";
import { haptic } from "../TelegramBridge";
import { bigState, jettonWallet, refreshSoon, usePool } from "./usePool";

const toUnits = (v: string, dec: number) => {
  const [i, f = ""] = v.split(".");
  return BigInt(i || "0") * 10n ** BigInt(dec) + BigInt((f + "0".repeat(dec)).slice(0, dec) || "0");
};
const fromUnits = (v: bigint, dec: number) => Number(v) / 10 ** dec;

/** Trade panel for tokens launched on Bitpad: buys/sells go straight to the token's BitpadPool. */
export function BitpadTradePanel({ token, onTraded }: { token: MarketToken; onTraded?: () => void }) {
  const wallet = useTonAddress();
  const [tc] = useTonConnectUI();
  const { slippage, setSlippage } = useApp();
  const [ref, setRef] = useState<string | null>(null);
  useEffect(() => setRef(captureReferral(token.address)), [token.address]);
  const { data, error, reload } = usePool(token.bitpad?.pool, wallet, ref);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);

  const pool = data?.pool;
  const pairDec = pool?.pairDecimals ?? 9;
  const pairSym = token.pair.symbol;
  const isTonPair = pool ? !pool.pairMaster : true;
  // Buys must come through a link: the visitor's link if it's valid, else the creator's own
  const linkValid = !!(data?.refValid && ref);
  const referrer = linkValid ? ref! : pool?.creator ?? "";

  useEffect(() => {
    if (!wallet) return setBalance(null);
    fetch(`/api/portfolio?address=${wallet}`)
      .then((r) => r.json())
      .then((d) => setBalance(d.holdings?.find((h: { address: string }) => h.address === token.address)?.amount ?? 0))
      .catch(() => setBalance(null));
  }, [wallet, token.address, busy]);

  const q = useMemo(() => {
    if (!pool || !(Number(amount) > 0)) return null;
    const st = bigState(pool);
    if (side === "buy") {
      const inU = toUnits(amount, pairDec);
      const r = quoteBuy(st, inU);
      return { inU, out: r.out, outHuman: fromUnits(r.out, 9), impact: buyImpact(st, inU) };
    }
    const inU = toUnits(amount, 9);
    const r = quoteSell(st, inU);
    return { inU, out: r.out, outHuman: fromUnits(r.out, pairDec), impact: 0 };
  }, [pool, amount, side, pairDec]);

  async function submit() {
    haptic("medium");
    if (!wallet) return tc.openModal();
    if (!pool || !q) return;
    if (!pool.tradingOpen) return toast.error("Pool not open yet", "The launch is still settling — try again in a few seconds.");
    setBusy(true);
    try {
      const { buildPoolBuyTx, buildPoolSwapTx } = await import("@/lib/ton/launch");
      const minOut = minOutFor(q.out, slippage);
      let message;
      if (side === "buy" && isTonPair) {
        message = buildPoolBuyTx(pool.address, q.inU, minOut, referrer);
      } else if (side === "buy") {
        message = buildPoolSwapTx({ pool: pool.address, userJettonWallet: await jettonWallet(pool.pairMaster!, wallet), user: wallet, amount: q.inU, minOut, referrer });
      } else {
        message = buildPoolSwapTx({ pool: pool.address, userJettonWallet: await jettonWallet(token.address, wallet), user: wallet, amount: q.inU, minOut, referrer: linkValid ? ref! : undefined });
      }
      await tc.sendTransaction({ validUntil: Math.floor(Date.now() / 1000) + 300, messages: [message] });
      haptic("success");
      toast.success(side === "buy" ? `Buying $${token.symbol}` : `Selling $${token.symbol}`, "Sent. If the price moves past your slippage, the pool refunds you in full.");
      setAmount("");
      refreshSoon(() => {
        reload();
        onTraded?.();
      });
    } catch (e) {
      haptic("error");
      toast.error("Transaction not sent", (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const feePct = pool ? (pool.protocolFeeBps + pool.creatorFeeBps) / 100 : null;
  const outUsd = q && side === "buy" && token.priceUsd ? q.outHuman * token.priceUsd : q && side === "sell" && token.pair.priceUsd ? q.outHuman * token.pair.priceUsd : null;

  return (
    <div className="card p-4">
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-surface-2 p-1">
        {(["buy", "sell"] as const).map((s) => (
          <button key={s} onClick={() => { setSide(s); setAmount(""); }} className={`rounded-md py-2 text-sm font-semibold capitalize ${side === s ? (s === "buy" ? "bg-up-soft text-up" : "bg-down-soft text-down") : "text-muted"}`}>{s}</button>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span className="label">{side === "buy" ? `You pay (${pairSym})` : `You sell ($${token.symbol})`}</span>
        <button onClick={() => setShowSettings((v) => !v)} className="flex items-center gap-1 text-xs text-muted hover:text-ink"><Settings2 className="size-3.5" /> Slippage {slippage}%</button>
      </div>
      {showSettings && (
        <div className="mt-2 flex gap-1.5">
          {[0.5, 1, 3, 10].map((s) => <button key={s} onClick={() => setSlippage(s)} className={`flex-1 rounded-md border py-1.5 text-xs ${slippage === s ? "border-line-strong bg-surface-2" : "border-line"}`}>{s}%</button>)}
        </div>
      )}
      <div className="mt-2 flex items-center gap-2 rounded-lg border border-line bg-surface px-3 focus-within:border-ink">
        <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0.0" className="num h-11 min-w-0 flex-1 bg-transparent text-lg font-semibold outline-none" />
        <span className="text-sm font-medium">{side === "buy" ? pairSym : token.symbol}</span>
      </div>
      <div className="mt-2 grid grid-cols-4 gap-1.5">
        {side === "buy"
          ? (isTonPair ? [1, 5, 10, 50] : [10, 50, 100, 500]).map((v) => <button key={v} onClick={() => setAmount(String(v))} className="rounded-md border border-line py-1.5 text-xs text-ink-2 hover:border-line-strong">{v}</button>)
          : [25, 50, 75, 100].map((p) => <button key={p} disabled={!balance} onClick={() => setAmount((((balance ?? 0) * p) / 100).toFixed(4))} className="rounded-md border border-line py-1.5 text-xs text-ink-2 hover:border-line-strong disabled:opacity-40">{p}%</button>)}
      </div>

      <div className="mt-4 space-y-1.5 rounded-lg bg-surface-2 p-3 text-xs">
        <Row k="You receive ≈" v={q ? `${num(q.outHuman, 4)} ${side === "buy" ? token.symbol : pairSym}${outUsd ? ` · ${usd(outUsd)}` : ""}` : "—"} />
        {q && <Row k={`Min. received (${slippage}% slippage)`} v={`${num(fromUnits(minOutFor(q.out, slippage), side === "buy" ? 9 : pairDec), 4)}`} />}
        {q && side === "buy" && <Row k="Price impact" v={`${q.impact.toFixed(2)}%`} warn={q.impact > 5} />}
        <Row k="Pool fee" v={feePct != null ? `${feePct.toFixed(2)}%` : "—"} />
        {side === "sell" && wallet && <Row k="Your balance" v={balance != null ? `${num(balance, 2)} ${token.symbol}` : "—"} />}
      </div>

      {pool && (
        <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted">
          <Link2 className="size-3.5" />
          {side === "sell" && !linkValid
            ? "Selling without a link — the creator keeps the creator fee"
            : referrer === pool.creator
              ? `${side === "buy" ? "Buying" : "Selling"} via the creator's link`
              : <>{side === "buy" ? "Buying" : "Selling"} via link <span className="font-mono">{shortAddr(referrer)}</span></>}
        </div>
      )}
      {ref && data && !data.refValid && <p className="mt-1 text-[11px] text-warn">The referral link you arrived with isn&apos;t active for this token; the creator&apos;s link is used.</p>}
      {error && <p className="mt-2 text-xs text-down">{error}</p>}
      {pool && !pool.tradingOpen && <p className="mt-2 text-xs text-warn">Pool is initialising — trading opens once the launch transaction settles.</p>}

      <button onClick={submit} disabled={busy || (!!wallet && !q)} className={`btn mt-3 h-11 w-full ${side === "buy" ? "btn-up" : "btn-down"}`}>
        {busy ? "Confirm in wallet…" : !wallet ? <><Zap className="size-4" /> Connect TON wallet</> : <><ArrowRightLeft className="size-4" /> {side === "buy" ? `Buy $${token.symbol}` : `Sell $${token.symbol}`}</>}
      </button>
    </div>
  );
}

function Row({ k, v, warn }: { k: string; v: string; warn?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted">{k}</span>
      <span className={`num text-right font-medium ${warn ? "text-down" : ""}`}>{v}</span>
    </div>
  );
}
