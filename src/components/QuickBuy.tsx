"use client";
import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useTonAddress, useTonConnectUI } from "@tonconnect/ui-react";
import { Zap } from "lucide-react";
import { toNano } from "@ton/core";
import { useApp } from "@/lib/store";
import { generalReferrer, storedReferral } from "@/lib/referral";
import { minOutFor, quoteBuy } from "@/lib/bitpad-math";
import type { TcMessage } from "@/lib/ton/client";
import { toast } from "./Toast";
import { haptic } from "./TelegramBridge";
import { bigState, refreshSoon, type PoolResponse } from "./bitpad/usePool";
import { sendTx } from "@/lib/ton/send";

/** False during SSR and hydration, true after — the persisted amount only exists in the browser. */
const useHydrated = () => useSyncExternalStore(() => () => {}, () => true, () => false);

/** What a quick buy needs to know about a token. */
export interface QuickBuyTarget {
  address: string;
  symbol: string;
  /** BitpadPool address when the token launched on Bitpad */
  bitpadPool?: string;
}

export type QuickAsset = "GRAM" | "TON";

/** Current quick-buy size and currency (GRAM by default). */
export function useQuickBuy() {
  const { quickBuy, quickBuyGram, quickBuyAsset } = useApp();
  const asset: QuickAsset = quickBuyAsset ?? "GRAM";
  return { asset, amount: asset === "GRAM" ? quickBuyGram ?? 1000 : quickBuy };
}

let priceCache: { at: number; ton: number | null; gram: number | null } | null = null;
/** USD prices of TON and GRAM (for converting a GRAM amount where a route only takes TON). */
export async function tonGramUsd() {
  if (priceCache && Date.now() - priceCache.at < 60_000) return priceCache;
  const d = await fetch("/api/assets").then((r) => r.json());
  const px = (s: string) => (d.assets as { symbol: string; priceUsd: number | null }[]).find((a) => a.symbol === s)?.priceUsd ?? null;
  priceCache = { at: Date.now(), ton: px("TON"), gram: px("GRAM") };
  return priceCache;
}
async function asTon(amount: number, asset: QuickAsset) {
  if (asset === "TON") return amount;
  const p = await tonGramUsd();
  if (!p.ton || !p.gram) throw new Error("GRAM price unavailable, so this TON-only route can't be sized. Switch quick buy to TON.");
  return (amount * p.gram) / p.ton;
}

/**
 * Builds a quick buy on the route that pays the platform:
 *  - Bitpad TON pools: BuyTon straight to the pool (a GRAM amount is converted to the same TON value)
 *  - Other TON jettons, paying GRAM: STON.fi GRAM → jetton (referral fee in the swap)
 *  - Other TON jettons, paying TON: best of STON.fi / DeDust (tagged fee transfer)
 */
async function buildQuickBuy(t: QuickBuyTarget, amount: number, asset: QuickAsset, wallet: string, slippagePct: number): Promise<{ messages: TcMessage[]; via: string; spent: string }> {
  if (t.bitpadPool) {
    const ref = storedReferral(t.address);
    const qs = new URLSearchParams({ address: t.bitpadPool, ...(ref && { ref }) });
    const d = (await fetch(`/api/bitpad/pool?${qs}`).then((r) => r.json())) as PoolResponse & { error?: string };
    if (d.error || !d.pool) throw new Error(d.error ?? "Pool unavailable");
    if (d.pool.pairMaster) throw Object.assign(new Error("pair"), { code: "pair" });
    if (!d.pool.tradingOpen) throw new Error("The pool isn't open for trading yet");
    const ton = await asTon(amount, asset);
    const inU = toNano(ton.toFixed(9));
    const q = quoteBuy(bigState(d.pool), inU);
    if (q.out <= 0n) throw new Error("Amount too small for this pool");
    const referrer = d.refValid && ref ? ref : d.pool.creator;
    const { buildPoolBuyTx } = await import("@/lib/ton/launch");
    return { messages: [buildPoolBuyTx(d.pool.address, inU, minOutFor(q.out, slippagePct), referrer)], via: "Bitpad pool", spent: `${ton.toFixed(3)} TON${asset === "GRAM" ? ` (≈ ${amount} GRAM; this pool is TON-paired)` : ""}` };
  }

  // Quote + transaction built on the server in one round trip (fast, keyed RPC)
  const ref = generalReferrer(wallet);
  const qs = new URLSearchParams({ token: t.address, pay: asset, amount: String(amount), wallet, slippage: String(slippagePct), ...(ref && { ref }) });
  const d = await fetch(`/api/buy-tx?${qs}`).then((r) => r.json());
  if (d.error) throw new Error(d.error);
  return { messages: d.messages, via: d.via, spent: d.spent };
}

export function QuickBuyButton({ token, className = "" }: { token: QuickBuyTarget; className?: string }) {
  const wallet = useTonAddress();
  const [tc] = useTonConnectUI();
  const router = useRouter();
  const { slippage } = useApp();
  const { asset, amount } = useQuickBuy();
  const hydrated = useHydrated();
  const [busy, setBusy] = useState(false);

  async function go(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    haptic("medium");
    if (!wallet) return tc.openModal();
    if (!(amount > 0)) return toast.error("Set a quick-buy amount", `Enter how much ${asset} each ⚡ buy spends.`);
    setBusy(true);
    try {
      const { messages, via, spent } = await buildQuickBuy(token, amount, asset, wallet, slippage);
      await sendTx(tc, messages);
      haptic("success");
      toast.success(`Buying $${token.symbol}`, `${spent} via ${via}. If the price moves past ${slippage}% slippage the swap refunds.`);
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
      title={`Buy ${amount} ${asset} of $${token.symbol}`}
      className={`inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-line bg-surface-2 px-2 text-xs font-semibold text-ink transition-colors hover:border-brand/50 hover:text-brand-ink disabled:opacity-50 ${className}`}
    >
      <Zap className="size-3.5 text-brand" />
      <span className="num">{busy ? "…" : hydrated ? amount : ""}</span>
      {hydrated && <span className="text-[10px] text-muted">{asset}</span>}
    </button>
  );
}

/** Quick-buy size and currency (GRAM or TON), shared by every ⚡ button. */
export function QuickBuyAmount() {
  const { setQuickBuy, setQuickBuyGram, setQuickBuyAsset } = useApp();
  const { asset, amount } = useQuickBuy();
  const hydrated = useHydrated();
  const [draft, setV] = useState<string | null>(null);
  const v = draft ?? (hydrated ? String(amount) : "");
  return (
    <label className="flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-xs text-muted focus-within:border-line-strong" title="Spent by each ⚡ quick buy">
      <Zap className="size-3.5 text-brand" />
      Quick buy
      <input
        inputMode="decimal"
        value={v}
        onChange={(e) => {
          const s = e.target.value.replace(/[^0-9.]/g, "");
          setV(s);
          if (Number(s) > 0) (asset === "GRAM" ? setQuickBuyGram : setQuickBuy)(Number(s));
        }}
        className="num w-14 bg-transparent text-right text-sm font-semibold text-ink outline-none"
      />
      <button
        type="button"
        onClick={() => {
          setV(null);
          setQuickBuyAsset(asset === "GRAM" ? "TON" : "GRAM");
        }}
        className="rounded bg-surface-2 px-1.5 py-0.5 font-semibold text-ink hover:bg-line-strong"
        title="Switch between GRAM and TON"
      >
        {hydrated ? asset : "GRAM"}
      </button>
    </label>
  );
}
