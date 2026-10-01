"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useTonAddress, useTonConnectUI } from "@tonconnect/ui-react";
import { Settings, Zap } from "lucide-react";
import { toNano } from "@ton/core";
import { useApp } from "@/lib/store";
import { generalReferrer, storedReferral } from "@/lib/referral";
import { minOutFor, quoteBuy } from "@/lib/bitpad-math";
import type { TcMessage } from "@/lib/ton/client";
import { toast } from "./Toast";
import { haptic } from "./TelegramBridge";
import { bigState, refreshSoon, type PoolResponse } from "./bitpad/usePool";
import { sendTx } from "@/lib/ton/send";
import { stonAppSwapUrl } from "@/lib/ton/links";

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
interface MinimumBuy { amount: number; asset: string; usd: number | null }

async function buildQuickBuy(t: QuickBuyTarget, amount: number, asset: QuickAsset | "USDT", wallet: string, slippagePct: number): Promise<{ messages: TcMessage[]; via: string; spent: string }> {
  if (t.bitpadPool) {
    const ref = storedReferral(t.address);
    const qs = new URLSearchParams({ address: t.bitpadPool, ...(ref && { ref }) });
    const d = (await fetch(`/api/bitpad/pool?${qs}`).then((r) => r.json())) as PoolResponse & { error?: string };
    if (d.error || !d.pool) throw new Error(d.error ?? "Pool unavailable");
    if (d.pool.pairMaster) throw Object.assign(new Error("pair"), { code: "pair" });
    if (!d.pool.tradingOpen) throw new Error("The pool isn't open for trading yet");
    const ton = await asTon(amount, asset as QuickAsset); // USDT only ever comes from the market-maker minimum (not Bitpad pools)
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
  if (d.error) throw Object.assign(new Error(d.error), { minimum: d.minimum as MinimumBuy | undefined });
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

  function go(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    return run();
  }

  /** `override`: a different size the user approved (the market makers' minimum). */
  async function run(override?: MinimumBuy) {
    haptic("medium");
    if (!wallet) return tc.openModal();
    if (!(amount > 0)) return toast.error("Set a quick-buy amount", `Enter how much ${asset} each ⚡ buy spends.`);
    setBusy(true);
    try {
      const { messages, via, spent } = await buildQuickBuy(token, override?.amount ?? amount, (override?.asset as QuickAsset | "USDT") ?? asset, wallet, slippage);
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
      const msg = (err as Error).message;
      const min = (err as { minimum?: MinimumBuy }).minimum;
      if (min) {
        // Too small for the market makers: offer the smallest size they quote; nothing happens unless approved
        const label = `${min.amount} ${min.asset}${min.usd ? ` (~$${min.usd.toFixed(0)})` : ""}`;
        toast.info(`Minimum buy for $${token.symbol}: ${label}`, `Your ${amount} ${asset} is below what market makers quote right now. Buy ${label} instead? You'll still confirm in your wallet.`, { ms: 20_000, action: { label: `Buy ${label}`, onClick: () => void run(min) } });
        return;
      }
      // No pool route (e.g. xStocks trade through STON.fi's market makers): offer the same swap in the STON.fi app
      toast.error("Quick buy not sent", msg,
        /No live route/.test(msg) && !token.bitpadPool ? { ms: 12_000, action: { label: "Buy on STON.fi ↗", onClick: () => window.open(stonAppSwapUrl(token.address), "_blank", "noopener") } } : {});
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
  const { setQuickBuy, setQuickBuyGram, setQuickBuyAsset, slippage, setSlippage } = useApp();
  const { asset, amount } = useQuickBuy();
  const hydrated = useHydrated();
  const [draft, setV] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const v = draft ?? (hydrated ? String(amount) : "");
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const pickAsset = (a: "GRAM" | "TON") => {
    setV(null);
    if (a !== asset) setQuickBuyAsset(a);
  };
  return (
    <div ref={box} className="relative">
      {/* Highlighted so people see they can set how much each ⚡ buy spends */}
      <label className="quickbuy flex h-9 items-center gap-1.5 rounded-lg border border-brand/60 bg-brand-soft/40 px-2.5 text-xs text-brand-ink shadow-[0_0_0_3px_var(--color-brand-soft)] focus-within:border-brand" title="How much each ⚡ quick buy spends">
        <Zap className="size-3.5 fill-current text-brand" />
        <span className="font-semibold">Set quick buy</span>
        <input
          inputMode="decimal"
          value={v}
          aria-label="Quick buy amount"
          onChange={(e) => {
            const s = e.target.value.replace(/[^0-9.]/g, "");
            setV(s);
            if (Number(s) > 0) (asset === "GRAM" ? setQuickBuyGram : setQuickBuy)(Number(s));
          }}
          className="num w-14 rounded bg-black/20 px-1 text-right text-sm font-semibold text-ink outline-none"
        />
        <button type="button" onClick={() => pickAsset(asset === "GRAM" ? "TON" : "GRAM")} className="rounded bg-surface-2 px-1.5 py-0.5 font-semibold text-ink hover:bg-line-strong" title="Switch between GRAM and TON">
          {hydrated ? asset : "GRAM"}
        </button>
        <button type="button" onClick={(e) => { e.preventDefault(); setOpen((o) => !o); }} className="grid size-6 place-items-center rounded text-brand-ink hover:bg-white/10" aria-label="Quick buy settings" aria-expanded={open}>
          <Settings className={`size-4 transition-transform ${open ? "rotate-90" : ""}`} />
        </button>
      </label>
      {open && (
        <div className="card glass absolute right-0 z-30 mt-2 w-64 space-y-3 p-3 text-xs shadow-2xl shadow-black/40">
          <div>
            <div className="mb-1.5 font-semibold text-ink">Pay with</div>
            <div className="seg w-full">
              {(["GRAM", "TON"] as const).map((a) => <button key={a} data-on={hydrated && asset === a} onClick={() => pickAsset(a)} className="flex-1">{a}</button>)}
            </div>
          </div>
          <div>
            <div className="mb-1.5 font-semibold text-ink">Amount per ⚡ buy</div>
            <div className="grid grid-cols-4 gap-1">
              {(asset === "GRAM" ? [100, 500, 1000, 5000] : [0.5, 1, 5, 10]).map((n) => (
                <button key={n} onClick={() => { setV(null); (asset === "GRAM" ? setQuickBuyGram : setQuickBuy)(n); }} className={`rounded-md border py-1.5 font-semibold ${hydrated && amount === n ? "border-brand bg-brand-soft text-brand-ink" : "border-line hover:border-line-strong"}`}>{n}</button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1.5 font-semibold text-ink">Max slippage</div>
            <div className="grid grid-cols-4 gap-1">
              {[0.5, 1, 3, 5].map((n) => (
                <button key={n} onClick={() => setSlippage(n)} className={`rounded-md border py-1.5 font-semibold ${slippage === n ? "border-brand bg-brand-soft text-brand-ink" : "border-line hover:border-line-strong"}`}>{n}%</button>
              ))}
            </div>
            <p className="mt-1.5 text-muted">If the price moves more than this before your swap lands, it refunds instead.</p>
          </div>
        </div>
      )}
    </div>
  );
}
