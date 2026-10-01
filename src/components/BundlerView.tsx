"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTonAddress, useTonConnectUI } from "@tonconnect/ui-react";
import { Eye, KeyRound, Layers, Plus, RefreshCw, Send, ShieldCheck, Trash2, Undo2, Upload, Zap } from "lucide-react";
import type { BundleProgress, BundleWallet, SplitMode } from "@/lib/ton/bundler";
import { shortAddr, num } from "@/lib/format";
import { toast } from "./Toast";
import { CopyButton } from "./CopyButton";
import { OnchainBundle } from "./bitpad/OnchainBundle";
import { sendTx } from "@/lib/ton/send";
import { humanError } from "@/lib/errors";
import { BundleTokenChart, readLastBuy, saveLastBuy, type LastBuy } from "./BundleTokenChart";
import { tonGramUsd } from "./QuickBuy";
import type { MarketToken } from "@/lib/types";

type Lib = typeof import("@/lib/ton/bundler");
const loadLib = () => import("@/lib/ton/bundler");

export function BundlerView() {
  const wallet = useTonAddress();
  const [tc] = useTonConnectUI();
  const [wallets, setWallets] = useState<BundleWallet[]>([]);
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [lib, setLib] = useState<Lib>();
  const [genCount, setGenCount] = useState(5);
  const [importText, setImportText] = useState("");
  // Amounts are in GRAM, TON's native coin (renamed from Toncoin): wallets hold it for buys and gas
  const [fundTotal, setFundTotal] = useState(10);
  const [fundMode, setFundMode] = useState<SplitMode>("random");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [jetton, setJetton] = useState("");
  const [tradeTotal, setTradeTotal] = useState(5);
  const [tradeMode, setTradeMode] = useState<SplitMode>("random");
  const [stagger, setStagger] = useState(1500);
  const [slippage, setSlippage] = useState(2);
  const [progress, setProgress] = useState<Record<string, BundleProgress>>({});
  const [running, setRunning] = useState(false);
  const [seed, setSeed] = useState(0);
  const validJetton = /^[EU]Q[A-Za-z0-9_-]{46}$/.test(jetton);
  const [lastBuy, setLastBuy] = useState<LastBuy | null>(null);
  const livePx = useRef<number | null>(null);
  const onPrice = useCallback((p: number | null) => { livePx.current = p; setPx(p); }, []);
  const [px, setPx] = useState<number | null>(null);
  const [tok, setTok] = useState<MarketToken | null>(null);
  const onToken = useCallback((t: MarketToken | null) => setTok(t), []);
  const [gramUsd, setGramUsd] = useState<number | null>(null);
  useEffect(() => { tonGramUsd().then((p) => setGramUsd(p.ton)).catch(() => {}); }, []);
  // Each wallet's balance of the target token (raw units), for % sells and the portfolio
  const [holdings, setHoldings] = useState<Record<string, bigint>>({});
  const [sellPct, setSellPct] = useState(100);
  const dec = tok?.decimals ?? 9;
  const human = (u: bigint) => Number(u) / 10 ** dec;
  const loadHoldings = useCallback(async () => {
    if (!lib || !validJetton) return setHoldings({});
    try { setHoldings(await lib.fetchJettonBalances(jetton, wallets)); } catch { /* keep last */ }
  }, [lib, validJetton, jetton, wallets]);
  useEffect(() => { loadHoldings(); }, [jetton, validJetton, lib, wallets.length]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => setLastBuy(validJetton ? readLastBuy(jetton) : null), [jetton, validJetton]);

  useEffect(() => {
    loadLib().then((l) => {
      setLib(l);
      setWallets(l.loadWallets());
    });
  }, []);

  const active = wallets.filter((w) => w.enabled);
  // Both splits are in TON (buys) or tokens (sells)
  const fundTon = fundTotal;
  const tradeAmount = tradeTotal;
  const fundSplit = useMemo(() => lib?.splitAmount(fundTon, active.length, fundMode) ?? [], [lib, fundTon, active.length, fundMode, seed]); // eslint-disable-line react-hooks/exhaustive-deps
  const tradeSplit = useMemo(() => lib?.splitAmount(tradeAmount, active.length, tradeMode) ?? [], [lib, tradeAmount, active.length, tradeMode, seed]); // eslint-disable-line react-hooks/exhaustive-deps
  const heldTotal = active.reduce((s, w) => s + (holdings[w.id] ?? 0n), 0n);
  const heldAll = wallets.reduce((s, w) => s + (holdings[w.id] ?? 0n), 0n);
  const totalBal = wallets.reduce((s, w) => s + (Number.isFinite(w.balance) ? w.balance! : 0), 0);

  const persist = (w: BundleWallet[]) => {
    setWallets(w);
    lib?.saveWallets(w);
  };

  async function unlock() {
    if (password.length < 8) return toast.error("Use at least 8 characters");
    if (wallets[0] && lib) {
      try {
        await lib.revealMnemonic(wallets[0], password);
      } catch {
        return toast.error("Wrong password");
      }
    }
    setUnlocked(true);
  }

  async function generate() {
    if (!lib) return;
    const made = await lib.createWallets(genCount, password, wallets.length);
    persist([...wallets, ...made]);
    toast.success(`${made.length} wallets created`, "Encrypted and stored only in this browser.");
  }

  async function doImport() {
    if (!lib) return;
    try {
      const w = await lib.importWallet(importText, password, `Imported ${wallets.length + 1}`);
      persist([...wallets, w]);
      setImportText("");
    } catch (e) {
      toast.error("Import failed", (e as Error).message);
    }
  }

  async function refresh() {
    if (!lib) return;
    const b = await lib.fetchBalances(wallets);
    setWallets((ws) => ws.map((w) => ({ ...w, balance: b[w.id] })));
  }

  /** Bring every selected wallet up to GAS_TARGET GRAM (enough for a swap's attached gas), in one signature. */
  const GAS_TARGET = 0.4;
  const lowGas = active.filter((w) => Number.isFinite(w.balance) && (w.balance ?? 0) < GAS_TARGET);
  async function topUpGas() {
    if (!lib) return;
    if (!wallet) return tc.openModal();
    if (!lowGas.length) return toast.info("Gas is fine", `Every selected wallet already has ${GAS_TARGET} GRAM or more.`);
    const amounts = lowGas.map((w) => Math.max(0.05, GAS_TARGET - (w.balance ?? 0)));
    try {
      const msgs = lib.fundingMessages(lowGas, amounts);
      for (let i = 0; i < msgs.length; i += 4) await sendTx(tc, msgs.slice(i, i + 4));
      toast.success("Gas topped up", `${lowGas.length} wallet${lowGas.length === 1 ? "" : "s"} topped up to ${GAS_TARGET} GRAM.`);
      setTimeout(refresh, 8000);
    } catch (e) {
      toast.error("Top-up cancelled", (e as Error).message);
    }
  }

  async function fund() {
    if (!lib) return;
    if (!wallet) return tc.openModal();
    const msgs = lib.fundingMessages(active, fundSplit);
    try {
      // 4 messages per request keeps older wallet contracts (v4) compatible
      for (let i = 0; i < msgs.length; i += 4) {
        await sendTx(tc, msgs.slice(i, i + 4));
      }
      toast.success("Funding sent", `${active.length} wallets funded from ${shortAddr(wallet)}`);
      setTimeout(refresh, 8000);
    } catch (e) {
      toast.error("Funding cancelled", (e as Error).message);
    }
  }

  /** Re-run only the wallets whose last leg failed, with the same amounts. */
  function retryFailed() {
    const failed = active.filter((w) => progress[w.id]?.status === "error");
    if (!failed.length) return;
    return execute(failed);
  }

  async function execute(only?: BundleWallet[]) {
    if (!lib) return;
    if (!/^[EU]Q[A-Za-z0-9_-]{46}$/.test(jetton)) return toast.error("Enter a valid jetton master address");
    setRunning(true);
    const pxAtStart = livePx.current;
    const sent = new Set<string>();
    let failed = 0;
    const targets = (only ?? active).filter((w) => side === "buy" || (holdings[w.id] ?? 0n) > 0n);
    if (!targets.length) { setRunning(false); return toast.error("Nothing to sell", "None of the selected wallets hold this token."); }
    const amounts = targets.map((w) => tradeSplit[active.indexOf(w)] ?? 0);
    const sellUnits = targets.map((w) => ((holdings[w.id] ?? 0n) * BigInt(sellPct)) / 100n);
    if (!only) setProgress({});
    await lib.runBundle({
      side, wallets: targets, amounts, sellUnits, jetton, password, slippage: slippage / 100, staggerMs: stagger,
      onProgress: (p) => {
        if (p.status === "sent") sent.add(p.walletId);
        if (p.status === "error") failed++;
        setProgress((s) => ({ ...s, [p.walletId]: p }));
      },
    });
    setRunning(false);
    // Remember where this buy filled, for the "since last buy" readout
    if (side === "buy" && sent.size && pxAtStart) {
      const ton = targets.reduce((sum, w, i) => sum + (sent.has(w.id) ? amounts[i] ?? 0 : 0), 0);
      const b = { priceUsd: pxAtStart, time: Date.now(), ton, wallets: sent.size };
      saveLastBuy(jetton, b);
      setLastBuy(b);
    }
    if (failed && !sent.size) toast.error("Bundle didn't go through", "Every wallet failed. The reason is shown next to each wallet.");
    else if (failed) toast.info("Bundle partly sent", `${sent.size} sent, ${failed} failed. The reason is shown next to each wallet.`);
    else toast.success("Bundle sent", `${sent.size} wallet${sent.size === 1 ? "" : "s"} submitted. Balances refresh in a few seconds.`);
    setTimeout(() => { refresh(); loadHoldings(); }, 8000);
  }

  async function sweep() {
    if (!lib) return;
    if (!wallet) return tc.openModal();
    if (!confirm(`Send all TON from ${active.length} wallets to ${shortAddr(wallet)}?`)) return;
    setProgress({});
    await lib.sweepAll(active, wallet, password, (p) => setProgress((s) => ({ ...s, [p.walletId]: p })));
    setTimeout(refresh, 8000);
  }

  async function reveal(w: BundleWallet) {
    if (!lib) return;
    const words = await lib.revealMnemonic(w, password);
    await navigator.clipboard?.writeText(words);
    toast.info(`${w.label} mnemonic copied`, "Store it somewhere safe. Clipboard contents can be read by other apps.");
  }

  if (!unlocked) {
    return (
      <div className="mx-auto max-w-md space-y-4 pt-6">
        <div className="card p-6">
          <div className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand"><KeyRound className="size-5" /></div>
          <h1 className="mt-3 text-xl font-semibold">Multi-wallet bundler</h1>
          <p className="mt-1 text-sm text-ink-2">
            Trade from many TON wallets at once. Burner wallets are generated in your browser and encrypted with this password (PBKDF2 + AES-GCM). Keys never leave this device.
          </p>
          <input type="password" className="input mt-4" placeholder={wallets.length ? "Vault password" : "Create a vault password (8+ chars)"} value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && unlock()} />
          <button onClick={unlock} className="btn btn-primary mt-3 w-full"><ShieldCheck className="size-4" /> {wallets.length ? `Unlock ${wallets.length} wallets` : "Create vault"}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Multi-wallet bundler</h1>
          <p className="text-sm text-ink-2">{wallets.length} wallets · {active.length} active · {num(totalBal, 3)} GRAM</p>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={refresh} className="btn btn-ghost"><RefreshCw className="size-4" /> Balances</button>
          <button onClick={sweep} disabled={!active.length} className="btn btn-ghost"><Undo2 className="size-4" /> Sweep to main</button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-4">
        {validJetton ? <BundleTokenChart jetton={jetton} lastBuy={lastBuy} onPrice={onPrice} onToken={onToken} /> : (
          <div className="card p-4 text-sm text-muted">Paste a jetton address in <b className="text-ink-2">Bundle trade</b> to load its chart and track profit since your last bundle buy.</div>
        )}
        {validJetton && tok && (
          // Minimal bundle portfolio: what all bundle wallets hold of this token, and what it's worth
          <section className="card grid grid-cols-2 gap-3 p-4 text-sm sm:grid-cols-4">
            <div><div className="text-xs text-muted">Bundle holds</div><div className="num font-semibold">{num(human(heldAll), 2)} ${tok.symbol}</div></div>
            <div><div className="text-xs text-muted">Value</div><div className="num font-semibold">{px ? `$${num(human(heldAll) * px, 2)}` : "—"}</div></div>
            <div><div className="text-xs text-muted">In GRAM</div><div className="num font-semibold">{px && gramUsd ? `${num((human(heldAll) * px) / gramUsd, 3)} GRAM` : "—"}</div></div>
            <div><div className="text-xs text-muted">Wallets holding</div><div className="num font-semibold">{wallets.filter((w) => (holdings[w.id] ?? 0n) > 0n).length} / {wallets.length}</div></div>
          </section>
        )}
        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
            <Layers className="size-4 text-ink-2" />
            <h2 className="text-sm font-semibold">Wallets</h2>
            <div className="ml-auto flex items-center gap-2">
              <input type="number" min={1} max={50} value={genCount} onChange={(e) => setGenCount(Math.max(1, Math.min(50, Number(e.target.value))))} className="input h-9 w-16 text-sm" />
              <button onClick={generate} className="btn btn-primary h-9"><Plus className="size-4" /> Generate</button>
            </div>
          </div>
          <div className="scroll-x">
            <table className="w-full min-w-[620px] text-sm">
              <thead className="text-left text-xs text-muted">
                <tr className="border-b border-line">
                  <th className="px-3 py-2 font-medium">On</th><th className="font-medium">Wallet</th><th className="font-medium">Address</th>
                  <th className="text-right font-medium">GRAM</th>{validJetton && <th className="text-right font-medium">{tok ? `$${tok.symbol}` : "Held"}</th>}<th className="text-right font-medium">Next {side}</th><th className="px-3 font-medium">Status</th><th />
                </tr>
              </thead>
              <tbody className="num">
                {wallets.map((w) => {
                  const idx = active.indexOf(w);
                  const p = progress[w.id];
                  return (
                    <tr key={w.id} className="border-b border-line/60 last:border-0">
                      <td className="px-3 py-2"><input type="checkbox" checked={w.enabled} onChange={() => persist(wallets.map((x) => (x.id === w.id ? { ...x, enabled: !x.enabled } : x)))} className="size-4 accent-[var(--color-brand)]" /></td>
                      <td className="font-semibold">{w.label}</td>
                      <td><span className="font-mono text-xs">{shortAddr(w.address, 6, 6)}</span> <CopyButton value={w.address} className="ml-1 px-1.5 py-0.5" /></td>
                      <td className="text-right">{w.balance === undefined ? "—" : Number.isFinite(w.balance) ? num(w.balance, 3) : "err"}</td>
                      {validJetton && <td className="text-right text-ink-2">{holdings[w.id] != null ? num(human(holdings[w.id]), 2) : "—"}</td>}
                      <td className="text-right text-ink-2">{idx >= 0 ? (side === "buy" ? `${num(tradeSplit[idx] ?? 0, 3)} GRAM` : (holdings[w.id] ?? 0n) > 0n ? `${num(human(((holdings[w.id] ?? 0n) * BigInt(sellPct)) / 100n), 2)}` : "none held") : "—"}</td>
                      <td className="px-3">
                        {p && <span className={`chip ${p.status === "sent" ? "border-up/25 bg-up-soft text-up" : p.status === "error" ? "border-down/25 bg-down-soft text-down" : ""}`}>{p.status}</span>}
                        {p?.status === "error" && p.error && (
                          <div className="mt-1 max-w-[280px] whitespace-normal text-[11px] leading-snug text-down">
                            {humanError(p.error)}
                            {humanError(p.error) !== p.error && <details className="mt-0.5 text-muted"><summary className="cursor-pointer">Details</summary><span className="break-words font-mono text-[10px]">{p.error}</span></details>}
                          </div>
                        )}
                        {p?.status === "sent" && p.via && <div className="mt-1 text-[11px] text-muted">via {p.via}</div>}
                      </td>
                      <td className="pr-3 text-right whitespace-nowrap">
                        <button onClick={() => reveal(w)} className="p-1 text-muted hover:text-ink" aria-label="Copy mnemonic"><Eye className="size-4" /></button>
                        <button onClick={() => confirm(`Delete ${w.label}? Export its mnemonic first if it holds funds.`) && persist(wallets.filter((x) => x.id !== w.id))} className="p-1 text-muted hover:text-down" aria-label="Delete"><Trash2 className="size-4" /></button>
                      </td>
                    </tr>
                  );
                })}
                {!wallets.length && <tr><td colSpan={7} className="py-10 text-center text-muted">No wallets yet — generate a set or import a mnemonic.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2 border-t border-line p-3">
            <input className="input h-9 flex-1 font-mono text-xs" type="password" value={importText} onChange={(e) => setImportText(e.target.value)} placeholder="Import 24-word mnemonic" />
            <button onClick={doImport} disabled={!importText} className="btn btn-ghost h-9"><Upload className="size-4" /> Import</button>
          </div>
        </section>
        </div>

        <aside className="space-y-4">
          <section className="card p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><Send className="size-4" /> Fund wallets</h3>
            <p className="mt-1 text-xs text-muted">From your connected TON wallet via TON Connect.</p>
            <div className="mt-3 flex gap-2">
              <input className="input num" inputMode="decimal" value={fundTotal} onChange={(e) => setFundTotal(Number(e.target.value) || 0)} />
              <span className="self-center text-sm font-bold">GRAM</span>
            </div>
            <SplitPicker mode={fundMode} setMode={setFundMode} onShuffle={() => setSeed((s) => s + 1)} />
            <button onClick={fund} disabled={!active.length || fundTotal <= 0} className="btn btn-ghost mt-3 w-full">{wallet ? `Send to ${active.length} wallets` : "Connect TON wallet"}</button>
            <button onClick={topUpGas} disabled={!active.length} className="btn btn-ghost mt-2 w-full" title={`Sends just enough GRAM to bring each selected wallet to ${GAS_TARGET} GRAM`}>{lowGas.length ? `Top up gas · ${lowGas.length} wallet${lowGas.length === 1 ? "" : "s"} below ${GAS_TARGET} GRAM` : `Top up gas (to ${GAS_TARGET} GRAM)`}</button>
          </section>

          <OnchainBundle recipients={active.map((w) => ({ address: w.address, label: w.label }))} splits={tradeSplit} slippage={slippage} />

          <section className="card p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><Zap className="size-4" /> Bundle trade (any TON token)</h3>
            <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1">
              {(["buy", "sell"] as const).map((s) => (
                <button key={s} onClick={() => setSide(s)} className={`rounded-lg py-1.5 text-sm font-bold capitalize ${side === s ? (s === "buy" ? "bg-up-soft text-up" : "bg-down-soft text-down") : "text-muted"}`}>{s}</button>
              ))}
            </div>
            <label className="label mt-3 block">Jetton master address</label>
            <input className="input mt-1 font-mono text-xs" value={jetton} onChange={(e) => setJetton(e.target.value.trim())} placeholder="EQ… (copy CA from any token page)" />
            {side === "buy" ? (
              <>
                <label className="label mt-3 block">Total GRAM to spend</label>
                <input className="input num mt-1" inputMode="decimal" value={tradeTotal} onChange={(e) => setTradeTotal(Number(e.target.value) || 0)} />
              </>
            ) : (
              <>
                <label className="label mt-3 block">Sell from each wallet</label>
                <div className="mt-1 grid grid-cols-4 gap-1">
                  {[25, 50, 75, 100].map((p) => (
                    <button key={p} onClick={() => setSellPct(p)} className={`rounded-lg border py-2 text-sm font-semibold ${sellPct === p ? "border-down/50 bg-down-soft text-down" : "border-line hover:border-line-strong"}`}>{p === 100 ? "Max" : `${p}%`}</button>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-muted">
                  {heldTotal > 0n ? `${num(human((heldTotal * BigInt(sellPct)) / 100n), 2)} ${tok ? `$${tok.symbol}` : "tokens"} of ${num(human(heldTotal), 2)} held${px ? ` · ≈ $${num(human((heldTotal * BigInt(sellPct)) / 100n) * px, 2)}` : ""}` : validJetton ? "The selected wallets hold none of this token." : "Enter a jetton address."}
                </p>
              </>
            )}
            {side === "buy" && <SplitPicker mode={tradeMode} setMode={setTradeMode} onShuffle={() => setSeed((s) => s + 1)} />}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="block"><span className="label">Stagger (ms)</span><input className="input num mt-1 h-9 text-sm" value={stagger} onChange={(e) => setStagger(Number(e.target.value) || 0)} /></label>
              <label className="block"><span className="label">Slippage %</span><input className="input num mt-1 h-9 text-sm" value={slippage} onChange={(e) => setSlippage(Number(e.target.value) || 0)} /></label>
            </div>
            {!running && active.some((w) => progress[w.id]?.status === "error") && (
              <button onClick={retryFailed} className="btn btn-ghost mt-4 h-10 w-full">Retry {active.filter((w) => progress[w.id]?.status === "error").length} failed wallet{active.filter((w) => progress[w.id]?.status === "error").length === 1 ? "" : "s"}</button>
            )}
            <button onClick={() => execute()} disabled={running || !active.length || (side === "buy" ? tradeTotal <= 0 : heldTotal <= 0n)} className={`btn mt-4 h-11 w-full ${side === "buy" ? "btn-up" : "btn-down"}`}>
              {running ? "Executing…" : side === "buy" ? `Buy from ${active.length} wallets` : `Sell ${sellPct === 100 ? "all" : `${sellPct}%`} from ${active.filter((w) => (holdings[w.id] ?? 0n) > 0n).length} wallets`}
            </button>
            <p className="mt-2 text-[11px] text-muted">Buys and sells use the first route that works (Bitpad pool, STON.fi, DeDust, or Omniston, which also reaches TONCO and market makers), built for each wallet and signed locally. Sells take a share of what each wallet holds. Each swap attaches ~0.3 GRAM of gas set by the DEX (most of it is refunded right after), so keep ~0.4 GRAM per wallet; Top up gas does that in one signature.</p>
          </section>
        </aside>
      </div>
    </div>
  );
}

function SplitPicker({ mode, setMode, onShuffle }: { mode: SplitMode; setMode: (m: SplitMode) => void; onShuffle: () => void }) {
  return (
    <div className="mt-3 flex items-center gap-2">
      <div className="seg flex-1">
        {(["equal", "random", "weighted"] as SplitMode[]).map((m) => <button key={m} data-on={mode === m} onClick={() => setMode(m)} className="flex-1 capitalize">{m}</button>)}
      </div>
      {mode === "random" && <button onClick={onShuffle} className="btn btn-ghost h-8 w-8 px-0" aria-label="Reshuffle"><RefreshCw className="size-3.5" /></button>}
    </div>
  );
}
