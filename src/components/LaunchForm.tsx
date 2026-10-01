"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTonAddress, useTonConnectUI } from "@tonconnect/ui-react";
import { BadgeCheck, Check, Info, Rocket, Search, UserRound } from "lucide-react";
import { useApp } from "@/lib/store";
import type { PairAsset, PairKind } from "@/lib/types";
import { PAIR_KIND_LABEL } from "@/lib/assets";
import { config, TON_ASSETS } from "@/lib/config";
import { num, price, usd } from "@/lib/format";
import { AssetDot, Change, PairBadge, Verified } from "./ui";
import { toast } from "./Toast";
import { haptic } from "./TelegramBridge";
import { sendTx } from "@/lib/ton/send";

const KINDS: PairKind[] = ["stock", "commodity", "jetton", "crypto", "creator"];
type Step = "form" | "deploying" | "seeding" | "done";

/** Live factory settings, read on-chain by the server (null when the factory isn't deployed/reachable). */
export interface FactoryInfo { launchFee: string; minTonLiquidity: string; tradeFeeBps: number; launches: number }

export interface RegisteredPairInfo { master: string; decimals: number; minLiquidity: string }

/**
 * Every Bitpad launch is a creator jetton: the creator's own coin, backed by a
 * pool against a stock, commodity, jetton or another creator's jetton, with
 * referral links on top. Logged in with Telegram, the creator's identity is
 * signed into the metadata (verified badge).
 */
export function LaunchForm({ assets, factory, registeredPairs, initialPair }: { assets: PairAsset[]; factory: FactoryInfo | null; registeredPairs: RegisteredPairInfo[]; initialPair?: string }) {
  const router = useRouter();
  const wallet = useTonAddress();
  const [tc] = useTonConnectUI();
  const { tgUser } = useApp();
  const preset = initialPair ? assets.find((a) => a.tonAddress === initialPair) : undefined;
  const [kind, setKind] = useState<PairKind>(preset?.kind ?? "stock");
  const [q, setQ] = useState("");
  const [pair, setPair] = useState<PairAsset>(preset || assets.find((a) => a.symbol === "SPYx") || assets[0]);
  const [customJetton, setCustomJetton] = useState("");
  const [f, setF] = useState({ name: "", symbol: "", image: "", description: "", telegram: "", x: "", website: "" });
  const [supply, setSupply] = useState(1_000_000_000);
  const [poolPct, setPoolPct] = useState(90);
  const [pairUsd, setPairUsd] = useState(2000);
  const [step, setStep] = useState<Step>("form");

  const list = assets.filter((a) => a.kind === kind && (!q || `${a.symbol} ${a.name}`.toLowerCase().includes(q.toLowerCase())));
  const poolTokens = (supply * poolPct) / 100;
  const startPrice = pairUsd / poolTokens;
  const startMcap = startPrice * supply;
  const pairUnits = pair.priceUsd ? pairUsd / pair.priceUsd : null;
  const pairAddress = customJetton || pair.tonAddress;
  const onChainPair = !!pairAddress;
  const isTonPair = !pairAddress || pairAddress === TON_ASSETS.TON;
  // Jetton pairs must be registered + enabled in the factory, else the launch would be refunded
  const reg = !isTonPair ? registeredPairs.find((r) => r.master === pairAddress) : undefined;
  const pairUsable = isTonPair || !!reg;
  const minTon = factory ? Number(factory.minTonLiquidity) / 1e9 : 0;
  const belowMin = isTonPair && pairUnits != null && pairUnits < minTon;
  const valid = pairUsable && !belowMin && f.name.trim().length >= 2 && /^[A-Z0-9]{2,10}$/.test(f.symbol) && supply > 0 && pairUsd > 0 && pairUnits != null;

  function prefillFromTelegram() {
    if (!tgUser) return;
    setF((s) => ({
      ...s,
      name: s.name || [tgUser.first_name, tgUser.last_name].filter(Boolean).join(" "),
      symbol: s.symbol || (tgUser.username ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10),
      telegram: s.telegram || (tgUser.username ? `https://t.me/${tgUser.username}` : ""),
    }));
  }
  // Prefill name, ticker and Telegram link from the Telegram login (also when logging in on this page)
  useEffect(() => {
    prefillFromTelegram();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tgUser]);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF((s) => ({ ...s, [k]: k === "symbol" ? e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") : e.target.value }));

  async function launch() {
    haptic("medium");
    if (!wallet) return tc.openModal();
    if (!config.factoryAddress || !factory) {
      toast.error("Factory unreachable", "Couldn't read the Bitpad factory contract just now — refresh and try again.");
      return;
    }
    try {
      setStep("deploying");
      const { buildLaunchTx, buildJettonLaunchTx } = await import("@/lib/ton/launch");
      const { toNano } = await import("@ton/core");
      const extra: Record<string, string> = {};
      if (/^https:\/\//.test(f.telegram)) extra.telegram = f.telegram;
      if (/^https:\/\//.test(f.x)) extra.x = f.x;
      extra.bitpad_type = "creator";
      if (tgUser?.username) {
        // Bitpad signs your Telegram identity + this wallet + ticker (verified badge)
        const proof = await fetch("/api/creator", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ wallet, symbol: f.symbol }) }).then((r) => r.json());
        if (proof.error) throw new Error(proof.error);
        Object.assign(extra, proof);
      }
      const base = { name: f.name, symbol: f.symbol, description: f.description, image: f.image, supply: BigInt(supply), creatorBps: Math.round((100 - poolPct) * 100), pairSymbol: pair.symbol, launchFee: BigInt(factory!.launchFee), extra };
      let message;
      if (!pairAddress || pairAddress === TON_ASSETS.TON) {
        // One transaction: jetton + pool deployed, TON liquidity locked, trading open
        message = buildLaunchTx({ ...base, pairTon: toNano(pairUnits!.toFixed(9)) });
      } else {
        // Jetton-paired: transfer the pair jetton to the factory with the launch payload.
        const { JettonMaster, Address } = await import("@ton/ton");
        const { tonClient } = await import("@/lib/ton/client");
        const master = tonClient().open(JettonMaster.create(Address.parse(pairAddress)));
        const myWallet = (await master.getWalletAddress(Address.parse(wallet))).toString();
        const decimals = reg?.decimals ?? 9;
        message = buildJettonLaunchTx({ ...base, creatorPairWallet: myWallet, creator: wallet, pairUnits: BigInt(Math.floor(pairUnits! * 10 ** decimals)) });
      }
      await sendTx(tc, [message]);
      haptic("success");
      toast.success(`$${f.symbol} is launching`, `Token and ${f.symbol}/${pair.symbol} pool deploy in one go — liquidity is locked. Waiting for it to land on-chain…`);
      // Find the new launch in the factory registry, then open its page
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        const d = await fetch(`/api/bitpad/launch-of?creator=${encodeURIComponent(wallet)}&since=${factory!.launches}`).then((r) => r.json()).catch(() => null);
        if (d?.launch?.minter) {
          setStep("done");
          toast.success(`$${f.symbol} is live`, "Opening your token page — add referral links there.");
          router.push(`/token/${d.launch.minter}`);
          return;
        }
      }
      setStep("done");
      toast.info("Still confirming", "Your launch was sent; it'll appear under creator jettons shortly.");
    } catch (e) {
      setStep("form");
      haptic("error");
      toast.error("Launch interrupted", (e as Error).message);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Launch your creator jetton</h1>
          <p className="text-sm text-ink-2">Your own coin, backed by a stock, gold, a jetton or another creator. The pool is live from the first block, you earn the creator fee on every trade, and your referral links pay the people who bring buyers.</p>
        </div>

        <section className="card flex flex-wrap items-center gap-3 p-4">
          {tgUser?.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={tgUser.photo_url} alt="" className="size-10 rounded-full" />
          ) : (
            <span className="grid size-10 place-items-center rounded-full bg-surface-2"><UserRound className="size-5 text-muted" /></span>
          )}
          <div className="min-w-0 flex-1 text-sm">
            {tgUser ? (
              <>
                <div className="flex items-center gap-1.5 font-semibold">{[tgUser.first_name, tgUser.last_name].filter(Boolean).join(" ")} <BadgeCheck className="size-4 text-brand" /></div>
                <div className="text-xs text-ink-2">{tgUser.username ? `@${tgUser.username} · Bitpad signs this identity into your jetton, so it shows as verified.` : "Set a Telegram username, then log in again, to get the verified badge."}</div>
              </>
            ) : (
              <>
                <div className="font-semibold">Not verified</div>
                <div className="text-xs text-ink-2">Log in with Telegram (top right) so your jetton carries a verified link to your account. You can still launch without it, but it will show as unverified.</div>
              </>
            )}
          </div>
        </section>

        <section className="card p-5">
          <h2 className="text-sm font-semibold">1 · Token details</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Name"><input className="input" value={f.name} onChange={set("name")} placeholder="S&P Cat" maxLength={32} /></Field>
            <Field label="Ticker"><input className="input font-mono" value={f.symbol} onChange={set("symbol")} placeholder="SPYCAT" maxLength={10} /></Field>
            <Field label="Image URL" className="sm:col-span-2"><input className="input" value={f.image} onChange={set("image")} placeholder="https://… (png, jpg, gif)" /></Field>
            <Field label="Description" className="sm:col-span-2"><textarea className="input h-20 py-2" value={f.description} onChange={set("description")} placeholder="What is it, who is it for?" maxLength={280} /></Field>
            <Field label="Telegram"><input className="input" value={f.telegram} onChange={set("telegram")} placeholder="https://t.me/…" /></Field>
            <Field label="X"><input className="input" value={f.x} onChange={set("x")} placeholder="https://x.com/…" /></Field>
          </div>
        </section>

        <section className="card p-5">
          <h2 className="text-sm font-semibold">2 · Back it with</h2>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="seg">
              {KINDS.map((k) => <button key={k} data-on={kind === k} onClick={() => setKind(k)}>{PAIR_KIND_LABEL[k]}</button>)}
            </div>
            <div className="relative ml-auto w-full sm:w-52">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <input className="input h-9 pl-9 text-sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter assets" />
            </div>
          </div>
          {kind === "creator" && !list.length && <p className="mt-3 rounded-lg bg-surface-2 p-3 text-xs text-ink-2">No creator jettons are enabled as pairs yet. Once a creator&apos;s jetton is enabled, you can back yours with it.</p>}
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((a) => (
              <button key={a.symbol} onClick={() => { setPair(a); setCustomJetton(""); }} className={`flex items-center gap-3 rounded-xl border p-3 text-left ${pair.symbol === a.symbol ? "border-brand bg-brand-soft/50 ring-2 ring-brand-soft" : "border-line hover:border-line-strong"}`}>
                <AssetDot asset={a} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-sm font-bold">{a.symbol}{a.verified && <Verified />} {pair.symbol === a.symbol && <Check className="size-3.5 text-brand" />}</div>
                  <div className="truncate text-xs text-muted">{a.name}{a.dividendYield ? ` · ${a.dividendYield}% div` : ""}{a.kind === "creator" ? ` · ${a.badge.includes("✓") ? "verified" : "unverified"}` : ""}</div>
                </div>
                <div className="text-right">
                  <div className="num text-xs font-semibold">{a.priceUsd != null ? price(a.priceUsd) : "—"}</div>
                  <Change value={a.change24h} className="text-[11px]" />
                </div>
              </button>
            ))}
          </div>
          <Field label="…or pair with any TON jetton (paste master address)" className="mt-3">
            <input className="input font-mono text-xs" value={customJetton} onChange={(e) => setCustomJetton(e.target.value.trim())} placeholder="EQ…" />
          </Field>
          <p className={`mt-3 flex items-start gap-2 rounded-lg p-2.5 text-xs ${pairUsable ? "bg-up-soft text-up" : "bg-warn-soft text-warn"}`}>
            <Info className="mt-0.5 size-3.5 shrink-0" />
            {isTonPair
              ? "TON pair — your token and its Bitpad pool are created in one transaction, with the liquidity locked."
              : pairUsable
                ? `${pair.symbol} is enabled on Bitpad — you send ${pair.symbol} as the pool's liquidity in the launch transaction.`
                : onChainPair
                  ? `${pair.symbol} exists on TON but isn't enabled as a Bitpad pair yet (the factory owner registers pairs with npm run pair:add).`
                  : `${pair.symbol} lives on another chain. It can be paired once a TON version is bridged and registered.`}
          </p>
        </section>

        <section className="card p-5">
          <h2 className="text-sm font-semibold">3 · Liquidity</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Total supply"><input className="input num" inputMode="numeric" value={supply} onChange={(e) => setSupply(Number(e.target.value.replace(/\D/g, "")) || 0)} /></Field>
            <Field label={`${pair.symbol} to deposit (USD value)`}><input className="input num" inputMode="decimal" value={pairUsd} onChange={(e) => setPairUsd(Number(e.target.value.replace(/[^0-9.]/g, "")) || 0)} /></Field>
            <Field label={`Supply into the pool: ${poolPct}%`} className="sm:col-span-2">
              <input type="range" min={50} max={100} value={poolPct} onChange={(e) => setPoolPct(Number(e.target.value))} className="w-full accent-[var(--color-brand)]" />
              <div className="flex justify-between text-xs text-muted"><span>50% (rest to creator)</span><span>100% (fair launch)</span></div>
            </Field>
          </div>
        </section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <div className="card p-5">
          <div className="text-xs font-bold uppercase tracking-wider text-muted">Launch preview</div>
          <div className="mt-3 flex items-center gap-3">
            <div className="grid size-12 place-items-center overflow-hidden rounded-full border border-line bg-surface-2 text-xs font-bold">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {f.image ? <img src={f.image} alt="" className="size-full object-cover" /> : (f.symbol || "?").slice(0, 3)}
            </div>
            <div>
              <div className="font-bold text-brand">${f.symbol || "TICKER"}</div>
              <div className="text-sm text-ink-2">{f.name || "Token name"}</div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-sm text-ink-2">Backed by <AssetDot asset={pair} /> <b className="text-ink">{pair.symbol}</b> <PairBadge asset={pair} /></div>
          <dl className="num mt-4 space-y-2 text-sm">
            <Row k="Starting price" v={price(startPrice)} />
            <Row k="Starting market cap" v={usd(startMcap, { compact: true })} />
            <Row k="Pool" v={`${num(poolTokens, 0)} ${f.symbol || "TOKEN"} + ${pairUnits != null ? pairUnits.toLocaleString("en-US", { maximumFractionDigits: 4 }) : "?"} ${pair.symbol}`} />
            <Row k="Pool depth" v={usd(pairUsd * 2, { compact: true })} />
            <Row k="Liquidity" v="Locked forever (no LP tokens)" />
          </dl>
          <div className="mt-4 space-y-2 rounded-xl bg-surface-2 p-3 text-xs">
            <Row k="Launch fee" v={factory ? `${Number(factory.launchFee) / 1e9} TON` : "—"} />
            <Row k="Network gas (est.)" v="≈ 0.5 TON" />
            <Row k="Trading fee" v={factory ? `${(factory.tradeFeeBps / 100).toFixed(2)}% (protocol + creator)` : "—"} />
          </div>
          <button onClick={launch} disabled={!valid || step === "deploying" || step === "seeding"} className="btn btn-primary mt-4 h-12 w-full text-base">
            <Rocket className="size-4" />
            {!wallet ? "Connect TON wallet" : step === "deploying" ? "Deploying jetton…" : step === "done" ? "Launched ✓" : "Launch creator jetton"}
          </button>
          {!valid && <p className="mt-2 text-center text-xs text-muted">{!pairUsable ? `${pair.symbol} isn't enabled as a pair on Bitpad yet — pick TON or an enabled pair.` : pairUnits == null ? `No live price for ${pair.symbol} right now.` : belowMin ? `Minimum liquidity is ${minTon} TON.` : "Name, a 2–10 character ticker and liquidity are required."}</p>}
        </div>
        <div className="card p-4 text-xs text-ink-2">
          <div className="mb-1 font-bold text-ink">Why direct liquidity?</div>
          Bonding curves make early buyers exit liquidity for later ones and force a “graduation” migration. On Bitpad the pool exists from the first block, so price
          tracks real demand against a real asset — and LP fees accrue from trade one.
        </div>
      </aside>
    </div>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block space-y-1.5 ${className}`}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{k}</dt>
      <dd className="text-right font-semibold">{v}</dd>
    </div>
  );
}
