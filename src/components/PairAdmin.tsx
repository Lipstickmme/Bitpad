"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Address } from "@ton/core";
import { useTonAddress, useTonConnectUI } from "@tonconnect/ui-react";
import { BadgeCheck } from "lucide-react";
import type { PairCandidate } from "@/lib/pair-candidates";
import { price, shortAddr } from "@/lib/format";
import { buildAddPairTx, PAIR_KIND, ADD_PAIR_VALUE } from "@/lib/ton/launch";
import { sendTx } from "@/lib/ton/send";
import { Hint } from "./ui";
import { toast } from "./Toast";

const STATUS: Record<PairCandidate["status"], { label: string; cls: string }> = {
  registered: { label: "Enabled", cls: "text-up" },
  pending: { label: "Waiting for wallet", cls: "text-warn" },
  disabled: { label: "Disabled", cls: "text-muted" },
  new: { label: "Not registered", cls: "text-ink-2" },
  unresolved: { label: "Not on STON.fi", cls: "text-down" },
};

/**
 * Factory owner: register every pair asset in one go from the browser. Each
 * AddPair costs ~0.15 TON (the factory asks the jetton for its wallet); the
 * wallet signs them in batches of as many messages as it supports.
 */
export function PairAdmin({ candidates, owner }: { candidates: PairCandidate[]; owner: string | null }) {
  const router = useRouter();
  const wallet = useTonAddress();
  const [tc] = useTonConnectUI();
  const isOwner = useMemo(() => {
    try {
      return !!wallet && !!owner && Address.parse(wallet).equals(Address.parse(owner));
    } catch {
      return false;
    }
  }, [wallet, owner]);
  const addable = (c: PairCandidate) => c.status === "new" && !!c.master;
  const [picked, setPicked] = useState<Set<string>>(() => new Set(candidates.filter((c) => addable(c) && (c.source === "starter" || c.verified)).map((c) => c.master!)));
  const [busy, setBusy] = useState<string | null>(null);
  const todo = candidates.filter((c) => addable(c) && picked.has(c.master!));
  const toggle = (m: string) => setPicked((s) => { const n = new Set(s); if (n.has(m)) n.delete(m); else n.add(m); return n; });

  async function registerAll() {
    if (!wallet) return tc.openModal();
    const msgs = todo.map((c) => buildAddPairTx({ master: c.master!, symbol: c.symbol, decimals: c.decimals, kind: PAIR_KIND[c.kind] ?? PAIR_KIND.jetton, minLiquidity: BigInt(c.minUnits) }));
    // As many messages per signature as the wallet allows (W5: up to 255, older wallets: 4)
    const feat = tc.wallet?.device.features.find((f) => typeof f === "object" && f.name === "SendTransaction") as { maxMessages?: number } | undefined;
    const size = Math.max(1, Math.min(feat?.maxMessages ?? 4, 50));
    try {
      for (let i = 0; i < msgs.length; i += size) {
        setBusy(`Signing ${i / size + 1} of ${Math.ceil(msgs.length / size)}…`);
        await sendTx(tc, msgs.slice(i, i + size));
      }
      toast.success("Pairs sent", `${msgs.length} registrations sent. Each becomes usable once the factory learns its jetton wallet (usually under a minute).`);
      setTimeout(() => router.refresh(), 30_000);
    } catch (e) {
      toast.error("Registration stopped", (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const groups: [string, PairCandidate[]][] = [
    ["Creator jettons", candidates.filter((c) => c.kind === "creator")],
    ["Stocks & commodities", candidates.filter((c) => c.kind === "stock" || c.kind === "commodity")],
    ["Cross-chain (bridged BTC, ETH, USDC…)", candidates.filter((c) => c.kind === "crypto")],
    ["TON jettons & stables", candidates.filter((c) => c.kind === "jetton" || c.kind === "stable")],
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="flex items-center gap-1.5 text-2xl font-bold tracking-tight">
            Pair assets
            <Hint>Launches can only pair with jettons registered in the factory. Only the factory owner can register them. Tick what you want and register it all at once from your owner wallet: each costs about 0.15 TON, mostly forwarded to the jetton to discover the factory&apos;s wallet. <b>Min. backing</b> is the least a creator must deposit of that asset to launch a jetton backed by it: e.g. at least $50 of SPYx goes into the new pool as its liquidity (locked forever). It isn&apos;t a buy or a fee. It&apos;s stored in the factory in the asset&apos;s own units, converted from USD at today&apos;s price when you register ($50 for starter assets, $20 for creator jettons). TON-backed launches use the factory&apos;s own TON minimum instead.</Hint>
          </h1>
          <p className="text-sm text-ink-2">Owner {owner ? <span className="font-mono">{shortAddr(owner, 6, 6)}</span> : "unknown (factory unreachable)"} · {isOwner ? <span className="text-up">you are connected as the owner</span> : wallet ? <span className="text-warn">connected wallet is not the owner</span> : "connect the owner wallet"}</p>
        </div>
        <button onClick={registerAll} disabled={!!busy || !todo.length || (!!wallet && !isOwner)} className="btn btn-primary ml-auto">
          {busy ?? (!wallet ? "Connect owner wallet" : `Register ${todo.length} pair${todo.length === 1 ? "" : "s"} · ≈${((Number(ADD_PAIR_VALUE) / 1e9) * todo.length).toFixed(2)} TON`)}
        </button>
      </div>

      {groups.map(([title, rows]) => rows.length > 0 && (
        <section key={title} className="card overflow-hidden">
          <div className="border-b border-line px-4 py-3 text-sm font-semibold">{title}</div>
          <div className="scroll-x">
            <table className="w-full min-w-[640px] text-sm">
              <tbody className="num">
                {rows.map((c) => (
                  <tr key={`${c.source}:${c.symbol}:${c.master}`} className="border-b border-line/60 last:border-0">
                    <td className="w-10 px-4 py-2.5">
                      <input type="checkbox" disabled={!addable(c)} checked={!!c.master && addable(c) && picked.has(c.master)} onChange={() => c.master && toggle(c.master)} className="accent-[var(--color-brand)]" aria-label={`Register ${c.symbol}`} />
                    </td>
                    <td className="font-medium">
                      <span className="inline-flex items-center gap-1">{c.symbol}{c.verified && <BadgeCheck className="size-3.5 text-brand" />}</span>
                      <div className="max-w-[220px] truncate text-[11px] font-normal text-muted">{c.name}{c.kind === "creator" && !c.verified ? " · unverified" : ""}</div>
                    </td>
                    <td className="font-mono text-xs text-muted">{c.master ? shortAddr(c.master, 6, 6) : "—"}</td>
                    <td className="text-right">{c.priceUsd != null ? price(c.priceUsd) : "—"}</td>
                    <td className="text-right text-xs text-ink-2" title="Least a creator must deposit of this asset as pool liquidity when launching a jetton backed by it">min backing ${c.minUsd}</td>
                    <td className={`px-4 text-right text-xs ${STATUS[c.status].cls}`}>{STATUS[c.status].label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
