"use client";
import { useEffect, useMemo, useState } from "react";
import { useTonAddress, useTonConnectUI } from "@tonconnect/ui-react";
import { ArrowRightLeft, Route, Settings2, Zap } from "lucide-react";
import type { MarketToken, RouteQuote } from "@/lib/types";
import { useApp } from "@/lib/store";
import { num, usd } from "@/lib/format";
import { config } from "@/lib/config";
import { toast } from "./Toast";
// Platform fee: STON.fi routes take it on-chain via referral; DeDust routes add a separate fee transfer.
import { haptic } from "./TelegramBridge";

const PAY = ["TON", "USDT", "GRAM", "USDC"] as const;
const PRESETS: Record<(typeof PAY)[number], number[]> = { TON: [5, 25, 100, 500], USDT: [10, 50, 250, 1000], GRAM: [5000, 25000, 100000, 500000], USDC: [10, 50, 250, 1000] };

export function TradePanel({ token, livePrice }: { token: MarketToken; livePrice?: number | null }) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [routes, setRoutes] = useState<RouteQuote[]>([]);
  const [payResolved, setPayResolved] = useState<{ address: string; decimals: number } | null>(null);
  const [quoteErr, setQuoteErr] = useState<string[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [routeId, setRouteId] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const { payAsset, setPayAsset, slippage, setSlippage } = useApp();
  const wallet = useTonAddress();
  const [tc] = useTonConnectUI();
  const px = livePrice ?? token.priceUsd;

  // Real jetton balance for sell presets
  useEffect(() => {
    if (!wallet) return setBalance(null);
    fetch(`/api/portfolio?address=${wallet}`)
      .then((r) => r.json())
      .then((d) => setBalance(d.holdings?.find((h: { address: string }) => h.address === token.address)?.amount ?? 0))
      .catch(() => setBalance(null));
  }, [wallet, token.address]);

  // Debounced route quotes
  useEffect(() => {
    const a = Number(amount);
    if (!(a > 0) || side === "sell") {
      setRoutes([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(() => {
      fetch(`/api/quote?token=${token.address}&pay=${payAsset}&amount=${a}`)
        .then((r) => r.json())
        .then((d) => {
          setRoutes(d.routes ?? []);
          setPayResolved(d.pay ? { address: d.pay.address, decimals: d.pay.decimals } : null);
          setQuoteErr(d.errors ?? (d.error ? [d.error] : []));
          setRouteId((d.routes ?? []).find((r: RouteQuote) => r.best)?.id);
        })
        .finally(() => setLoading(false));
    }, 350);
    return () => clearTimeout(t);
  }, [amount, payAsset, token.address, side]);

  const route = useMemo(() => routes.find((r) => r.id === routeId), [routes, routeId]);
  const sellUsd = side === "sell" && px ? Number(amount || 0) * px : 0;

  async function submit() {
    haptic("medium");
    if (!wallet) return tc.openModal();
    setBusy(true);
    try {
      const slip = slippage / 100;
      let messages;
      if (side === "buy") {
        if (!route) throw new Error("No executable route — try a different amount or pay asset");
        if (route.id === "dedust") {
          const { buildDedustBuyTx } = await import("@/lib/ton/dedust");
          messages = await buildDedustBuyTx({ wallet, token: token.address, tonAmount: Number(amount), slippage: slip });
        } else {
          const { buildBuyTx } = await import("@/lib/ton/swap");
          messages = (await buildBuyTx({ wallet, jetton: token.address, amount: Number(amount), payWith: payAsset, payAsset: payResolved ?? undefined, slippage: slip })).messages;
        }
      } else {
        const units = BigInt(Math.floor(Number(amount) * 10 ** token.decimals));
        if (token.dex?.includes("dedust")) {
          const { buildDedustSellTx } = await import("@/lib/ton/dedust");
          messages = await buildDedustSellTx({ wallet, token: token.address, units, slippage: slip });
        } else {
          const { buildSellTx } = await import("@/lib/ton/swap");
          messages = [(await buildSellTx({ wallet, jetton: token.address, units, slippage: slip })).message];
        }
      }
      await tc.sendTransaction({ validUntil: Math.floor(Date.now() / 1000) + 300, messages });
      haptic("success");
      toast.success(`${side === "buy" ? "Buy" : "Sell"} submitted`, "Your wallet broadcast the transaction.");
      setAmount("");
    } catch (e) {
      haptic("error");
      toast.error("Transaction not sent", (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-4">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1">
        {(["buy", "sell"] as const).map((s) => (
          <button key={s} onClick={() => setSide(s)} className={`rounded-lg py-2 text-sm font-bold capitalize ${side === s ? (s === "buy" ? "bg-up-soft text-up" : "bg-down-soft text-down") : "text-muted"}`}>
            {s}
          </button>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span className="label">{side === "buy" ? "You pay" : `Amount (${token.symbol})`}</span>
        <button onClick={() => setShowSettings((v) => !v)} className="flex items-center gap-1 text-xs font-semibold text-muted hover:text-ink">
          <Settings2 className="size-3.5" /> Slippage {slippage}%
        </button>
      </div>
      {showSettings && (
        <div className="mt-2 flex gap-1.5">
          {[0.5, 1, 3, 10].map((s) => (
            <button key={s} onClick={() => setSlippage(s)} className={`flex-1 rounded-lg border py-1.5 text-xs font-semibold ${slippage === s ? "border-brand bg-brand-soft text-brand-ink" : "border-line"}`}>{s}%</button>
          ))}
        </div>
      )}

      <div className="mt-2 flex items-center gap-2 rounded-xl border border-line bg-surface px-3 focus-within:border-brand">
        <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0.0" className="num h-12 min-w-0 flex-1 bg-transparent text-xl font-bold outline-none" />
        {side === "buy" ? (
          <select value={payAsset} onChange={(e) => setPayAsset(e.target.value as (typeof PAY)[number])} className="rounded-lg border border-line bg-surface-2 px-2 py-1.5 text-sm font-bold outline-none">
            {PAY.map((p) => <option key={p}>{p}</option>)}
          </select>
        ) : (
          <span className="text-sm font-bold">{token.symbol}</span>
        )}
      </div>
      <div className="mt-2 grid grid-cols-4 gap-1.5">
        {(side === "buy" ? PRESETS[payAsset] : [25, 50, 75, 100]).map((v) => (
          <button key={v} disabled={side === "sell" && !balance} onClick={() => setAmount(side === "buy" ? String(v) : String((((balance ?? 0) * v) / 100).toFixed(Math.min(4, token.decimals))))} className="rounded-lg border border-line py-1.5 text-xs font-semibold text-ink-2 hover:border-line-strong">
            {side === "buy" ? num(v, 0) : `${v}%`}
          </button>
        ))}
      </div>

      {side === "buy" && (
        <div className="mt-4">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted"><Route className="size-3.5" /> Routes {loading && <span className="font-normal normal-case">· quoting…</span>}</div>
          <div className="space-y-1.5">
            {routes.map((r) => (
              <button key={r.id} onClick={() => setRouteId(r.id)} className={`w-full rounded-xl border p-2.5 text-left transition-colors ${routeId === r.id ? "border-brand bg-brand-soft/60" : "border-line hover:border-line-strong"}`}>
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-semibold">{r.venue}</span>
                  {r.best && <span className="chip border-up/25 bg-up-soft text-up">Best</span>}
                  {r.kind === "crosschain" && <span className="chip">Cross-chain</span>}
                  <span className="num ml-auto font-bold">{num(r.receiveAmount, 0)}</span>
                </div>
                <div className="num mt-0.5 flex gap-3 text-[11px] text-muted">
                  {r.receiveUsd > 0 && <span>≈ {usd(r.receiveUsd)}</span>}
                  <span className={r.priceImpact > 3 ? "font-semibold text-down" : ""}>impact {r.priceImpact.toFixed(2)}%</span>
                  <span>~{r.etaSeconds}s</span>
                </div>
              </button>
            ))}
            {!routes.length && !loading && (
              <p className="rounded-xl border border-dashed border-line p-3 text-center text-xs text-muted">
                {Number(amount) > 0 && quoteErr.length ? `No live route: ${quoteErr.join(" · ")}` : "Enter an amount to compare live STON.fi and DeDust quotes."}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="mt-4 space-y-1.5 rounded-xl bg-surface-2 p-3 text-xs">
        <Row k="Price" v={px ? `${usd(px, { digits: 6 })} / ${token.symbol}` : "—"} />
        {side === "sell" && wallet && <Row k="Your balance" v={balance != null ? `${num(balance, 2)} ${token.symbol}` : "—"} />}
        {side === "buy" && route && <Row k="Min. received" v={`${num(route.receiveAmount * (1 - slippage / 100), 0)} ${token.symbol}`} />}
        {side === "sell" && <Row k="You receive ≈" v={usd(sellUsd * (1 - config.swapFeeBps / 10_000))} />}
        <Row k={`Platform fee (${(config.swapFeeBps / 100).toFixed(2)}%)`} v={usd(route?.platformFeeUsd ?? sellUsd * (config.swapFeeBps / 10_000))} />
        {route && route.networkFeeUsd > 0 && <Row k="Network fee (est.)" v={usd(route.networkFeeUsd)} />}
      </div>

      <button onClick={submit} disabled={busy || (!!wallet && !(Number(amount) > 0))} className={`btn mt-4 h-12 w-full text-base ${side === "buy" ? "btn-up" : "btn-down"}`}>
        {busy ? "Confirm in wallet…" : !wallet ? <><Zap className="size-4" /> Connect TON wallet</> : <><ArrowRightLeft className="size-4" /> {side === "buy" ? `Buy $${token.symbol}` : `Sell $${token.symbol}`}</>}
      </button>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted">{k}</span>
      <span className="num text-right font-semibold">{v}</span>
    </div>
  );
}
