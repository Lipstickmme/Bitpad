"use client";
import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useTonAddress, useTonConnectUI } from "@tonconnect/ui-react";
import { Zap } from "lucide-react";
import { toNano } from "@ton/core";
import type { RouteQuote } from "@/lib/types";
import { useApp } from "@/lib/store";
import { generalReferrer, storedReferral } from "@/lib/referral";
import { minOutFor, quoteBuy } from "@/lib/bitpad-math";
import type { TcMessage } from "@/lib/ton/client";
import { toast } from "./Toast";
import { haptic } from "./TelegramBridge";
import { bigState, refreshSoon, type PoolResponse } from "./bitpad/usePool";

/** False during SSR and hydration, true after — the persisted amount only exists in the browser. */
const useHydrated = () => useSyncExternalStore(() => () => {}, () => true, () => false);

/** What a quick buy needs to know about a token. */
export interface QuickBuyTarget {
  address: string;
  symbol: string;
  /** BitpadPool address when the token launched on Bitpad */
  bitpadPool?: string;
}

/**
 * Builds a TON-denominated buy on the route that pays the platform:
 *  - Bitpad pools: BuyTon straight to the pool (protocol fee on-chain; creator fee split with the link).
 *  - Other TON jettons: best of STON.fi (referral fee, accrues in the fee wallet's STON.fi vault)
 *    or DeDust (separate fee transfer), whichever returns more tokens.
 */
async function buildQuickBuy(t: QuickBuyTarget, ton: number, wallet: string, slippagePct: number): Promise<{ messages: TcMessage[]; via: string }> {
  if (t.bitpadPool) {
    const ref = storedReferral(t.address);
    const qs = new URLSearchParams({ address: t.bitpadPool, ...(ref && { ref }) });
    const d = (await fetch(`/api/bitpad/pool?${qs}`).then((r) => r.json())) as PoolResponse & { error?: string };
    if (d.error || !d.pool) throw new Error(d.error ?? "Pool unavailable");
    if (d.pool.pairMaster) throw Object.assign(new Error("pair"), { code: "pair" });
    if (!d.pool.tradingOpen) throw new Error("The pool isn't open for trading yet");
    const inU = toNano(ton.toFixed(9));
    const q = quoteBuy(bigState(d.pool), inU);
    if (q.out <= 0n) throw new Error("Amount too small for this pool");
    const referrer = d.refValid && ref ? ref : d.pool.creator;
    const { buildPoolBuyTx } = await import("@/lib/ton/launch");
    return { messages: [buildPoolBuyTx(d.pool.address, inU, minOutFor(q.out, slippagePct), referrer)], via: "Bitpad pool" };
  }

  const d = await fetch(`/api/quote?token=${t.address}&pay=TON&amount=${ton}`).then((r) => r.json());
  const routes: RouteQuote[] = (d.routes ?? []).filter((r: RouteQuote) => r.kind === "onchain");
  const best = routes.find((r) => r.best) ?? routes[0];
  if (!best) throw new Error(d.errors?.length ? `No live route: ${d.errors.join(" · ")}` : "No live route for this token");
  const slip = slippagePct / 100;
  if (best.id === "dedust") {
    const { buildDedustBuyTx } = await import("@/lib/ton/dedust");
    return { messages: await buildDedustBuyTx({ wallet, token: t.address, tonAmount: ton, slippage: slip, referrer: generalReferrer(wallet) }), via: "DeDust" };
  }
  const { buildBuyTx } = await import("@/lib/ton/swap");
  return { messages: (await buildBuyTx({ wallet, jetton: t.address, amount: ton, payWith: "TON", slippage: slip, referrer: generalReferrer(wallet) })).messages, via: best.venue };
}

export function QuickBuyButton({ token, className = "" }: { token: QuickBuyTarget; className?: string }) {
  const wallet = useTonAddress();
  const [tc] = useTonConnectUI();
  const router = useRouter();
  const { quickBuy, slippage } = useApp();
  const hydrated = useHydrated();
  const [busy, setBusy] = useState(false);

  async function go(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    haptic("medium");
    if (!wallet) return tc.openModal();
    if (!(quickBuy > 0)) return toast.error("Set a quick-buy amount", "Enter how much TON each ⚡ buy spends.");
    setBusy(true);
    try {
      const { messages, via } = await buildQuickBuy(token, quickBuy, wallet, slippage);
      await tc.sendTransaction({ validUntil: Math.floor(Date.now() / 1000) + 300, messages });
      haptic("success");
      toast.success(`Buying $${token.symbol}`, `${quickBuy} TON via ${via}. If the price moves past ${slippage}% slippage the swap refunds.`);
      if (token.bitpadPool) refreshSoon(() => router.refresh());
    } catch (err) {
      if ((err as { code?: string }).code === "pair") {
        router.push(`/token/${token.address}`);
        return;
      }
      haptic("error");
      toast.error("Quick buy not sent", (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={go}
      disabled={busy}
      title={`Buy ${quickBuy} TON of $${token.symbol}`}
      className={`inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-line bg-surface-2 px-2 text-xs font-semibold text-ink transition-colors hover:border-brand/50 hover:text-brand-ink disabled:opacity-50 ${className}`}
    >
      <Zap className="size-3.5 text-brand" />
      <span className="num">{busy ? "…" : hydrated ? quickBuy : ""}</span>
    </button>
  );
}

/** Quick-buy size input (TON), shared by every ⚡ button. */
export function QuickBuyAmount() {
  const { quickBuy, setQuickBuy } = useApp();
  const hydrated = useHydrated();
  const [draft, setV] = useState<string | null>(null);
  const v = draft ?? (hydrated ? String(quickBuy) : "");
  return (
    <label className="flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-xs text-muted focus-within:border-line-strong" title="TON spent by each ⚡ quick buy">
      <Zap className="size-3.5 text-brand" />
      Quick buy
      <input
        inputMode="decimal"
        value={v}
        onChange={(e) => {
          const s = e.target.value.replace(/[^0-9.]/g, "");
          setV(s);
          if (Number(s) > 0) setQuickBuy(Number(s));
        }}
        className="num w-12 bg-transparent text-right text-sm font-semibold text-ink outline-none"
      />
      TON
    </label>
  );
}
