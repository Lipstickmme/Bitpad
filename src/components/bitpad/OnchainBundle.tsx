"use client";
import { useEffect, useMemo, useState } from "react";
import { useTonAddress, useTonConnectUI } from "@tonconnect/ui-react";
import { Boxes } from "lucide-react";
import type { MarketToken } from "@/lib/types";
import { afterBuy, minOutFor } from "@/lib/bitpad-math";
import { captureReferral } from "@/lib/referral";
import { num, shortAddr } from "@/lib/format";
import { toast } from "../Toast";
import { bigState, usePool } from "./usePool";
import { sendTx } from "@/lib/ton/send";

/**
 * On-chain bundle for Bitpad pools: one TON Connect signature → BitpadBundler
 * buys into every selected wallet in the same transaction. Each leg's minOut is
 * simulated sequentially with the pool's exact math.
 */
export function OnchainBundle({ recipients, splits, slippage }: { recipients: { address: string; label: string }[]; splits: number[]; slippage: number }) {
  const wallet = useTonAddress();
  const [tc] = useTonConnectUI();
  const [tokenAddr, setTokenAddr] = useState("");
  const [token, setToken] = useState<MarketToken | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ref = token ? captureReferral(token.address) : null;
  const { data } = usePool(token?.bitpad?.pool, wallet, ref);

  useEffect(() => {
    setToken(null);
    setErr(null);
    if (!/^(EQ|UQ)[A-Za-z0-9_-]{46}$/.test(tokenAddr.trim())) return;
    fetch(`/api/token/${tokenAddr.trim()}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.token?.bitpad?.pool) return setErr("Not a Bitpad token — use the STON.fi bundle below for other tokens.");
        if (d.token.bitpad.pairMaster) return setErr("On-chain bundles support TON-paired pools.");
        setToken(d.token);
      })
      .catch(() => setErr("Token lookup failed"));
  }, [tokenAddr]);

  const plan = useMemo(() => {
    if (!data?.pool || !recipients.length) return null;
    let st = bigState(data.pool);
    return recipients.map((r, i) => {
      const amount = BigInt(Math.floor((splits[i] ?? 0) * 1e9));
      const sim = afterBuy(st, amount);
      st = sim.state;
      return { recipient: r.address, label: r.label, amount, out: sim.out, minOut: minOutFor(sim.out, slippage) };
    });
  }, [data, recipients, splits, slippage]);

  const referrer = data?.refValid && ref ? ref : data?.pool.creator;

  async function run() {
    if (!wallet) return tc.openModal();
    if (!plan || !data || !referrer) return;
    setBusy(true);
    try {
      const { buildBundleBuyTx } = await import("@/lib/ton/launch");
      const msg = buildBundleBuyTx({ pool: data.pool.address, referrer, legs: plan.filter((l) => l.amount > 0n), feeBps: data.bundlerFeeBps });
      await sendTx(tc, [msg]);
      toast.success("Bundle sent", `${plan.length} wallets buy $${token!.symbol} in one transaction. Legs that would slip are refunded to their wallet.`);
    } catch (e) {
      toast.error("Bundle not sent", (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><Boxes className="size-4" /> On-chain bundle (Bitpad tokens)</h3>
      <p className="mt-1 text-xs text-muted">One signature from your connected wallet; the Bitpad bundler buys into every enabled wallet in the same block.</p>
      <input className="input mt-3 font-mono text-xs" value={tokenAddr} onChange={(e) => setTokenAddr(e.target.value)} placeholder="Bitpad token address (EQ…)" />
      {err && <p className="mt-2 text-xs text-warn">{err}</p>}
      {token && plan && (
        <>
          <div className="mt-3 max-h-40 space-y-1 overflow-y-auto text-xs">
            {plan.map((l) => (
              <div key={l.recipient} className="num flex justify-between">
                <span className="text-muted">{l.label} · {shortAddr(l.recipient)}</span>
                <span>{num(Number(l.amount) / 1e9, 3)} TON → ≥{num(Number(l.minOut) / 1e9, 0)} ${token.symbol}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-muted">
            Via {referrer === data?.pool.creator ? "the creator's link" : `link ${shortAddr(referrer ?? "")}`}
            {data?.bundlerFeeBps ? ` · bundler fee ${(data.bundlerFeeBps / 100).toFixed(2)}%` : ""} · + 0.12 TON gas per wallet (unused gas returns)
          </p>
          <button onClick={run} disabled={busy || !plan.some((l) => l.amount > 0n)} className="btn btn-up mt-3 w-full">
            {busy ? "Confirm in wallet…" : wallet ? `Buy into ${plan.length} wallets` : "Connect TON wallet"}
          </button>
        </>
      )}
    </section>
  );
}
