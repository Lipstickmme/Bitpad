"use client";
import { useState, useSyncExternalStore } from "react";
import { Zap } from "lucide-react";
import type { ChainId } from "@/lib/types";
import { useApp } from "@/lib/store";
import { toast } from "./Toast";
import { haptic } from "./TelegramBridge";

const useHydrated = () => useSyncExternalStore(() => () => {}, () => true, () => false);
const NATIVE: Partial<Record<ChainId, string>> = { solana: "SOL", ethereum: "ETH", base: "ETH", bsc: "BNB", arbitrum: "ETH" };
export const xBuyable = (chain: ChainId) => chain in NATIVE;

/**
 * Quick buy for tokens on Solana and EVM chains. The quick-buy amount (TON) is
 * converted to its USD value and paid in the chain's native coin from the
 * connected Phantom / MetaMask-style wallet, on LI.FI's best route.
 */
export function XBuyButton({ chain, token, symbol, className = "" }: { chain: ChainId; token: string; symbol: string; className?: string }) {
  const { quickBuy, slippage, external, addExternal } = useApp();
  const hydrated = useHydrated();
  const [busy, setBusy] = useState(false);
  const isSol = chain === "solana";

  async function wallet(): Promise<string> {
    const have = external.find((w) => w.chain === (isSol ? "solana" : "evm"));
    if (isSol) {
      const p = window.phantom?.solana ?? window.solana;
      if (!p) throw new Error("Install Phantom, Solflare or Backpack to buy on Solana");
      if (have) return have.address;
      const r = await p.connect();
      addExternal({ chain: "solana", address: r.publicKey.toString(), provider: p.isPhantom ? "Phantom" : "Solana" });
      return r.publicKey.toString();
    }
    if (!window.ethereum) throw new Error("Install MetaMask, Rabby or Coinbase Wallet to buy on EVM chains");
    const [addr] = (await window.ethereum.request({ method: "eth_requestAccounts" })) as string[];
    if (!have || have.address.toLowerCase() !== addr.toLowerCase()) addExternal({ chain: "evm", address: addr, provider: window.ethereum.isMetaMask ? "MetaMask" : "EVM" });
    return addr;
  }

  async function go(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    haptic("medium");
    setBusy(true);
    try {
      const from = await wallet();
      const qs = new URLSearchParams({ chain, token, from, ton: String(quickBuy), slippage: String(slippage) });
      const q = await fetch(`/api/xquote?${qs}`).then((r) => r.json());
      if (q.error) throw new Error(q.error);
      if (isSol) {
        const { VersionedTransaction } = await import("@solana/web3.js");
        const tx = VersionedTransaction.deserialize(Uint8Array.from(atob(q.tx.data), (c) => c.charCodeAt(0)));
        const p = window.phantom?.solana ?? window.solana;
        if (!p?.signAndSendTransaction) throw new Error("This Solana wallet can't sign transactions here");
        await p.signAndSendTransaction(tx);
      } else {
        const want = `0x${Number(q.tx.chainId).toString(16)}`;
        const cur = (await window.ethereum!.request({ method: "eth_chainId" })) as string;
        if (cur.toLowerCase() !== want) await window.ethereum!.request({ method: "wallet_switchEthereumChain", params: [{ chainId: want }] });
        await window.ethereum!.request({ method: "eth_sendTransaction", params: [{ from, to: q.tx.to, data: q.tx.data, value: q.tx.value, ...(q.tx.gasLimit ? { gas: q.tx.gasLimit } : {}) }] });
      }
      haptic("success");
      const out = Number(q.toAmount) / 10 ** q.toDecimals;
      toast.success(`Buying $${symbol}`, `≈${out.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${q.toSymbol} for ~$${q.fromAmountUsd.toFixed(2)} in ${NATIVE[chain]} via ${q.toolName}.`);
    } catch (err) {
      haptic("error");
      toast.error("Buy not sent", (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={go}
      disabled={busy}
      title={`Buy ~${quickBuy} TON worth of $${symbol}, paid in ${NATIVE[chain]}`}
      className={`inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-line bg-surface-2 px-2 text-xs font-semibold text-ink transition-colors hover:border-brand/50 hover:text-brand-ink disabled:opacity-50 ${className}`}
    >
      <Zap className="size-3.5 text-brand" />
      <span className="num">{busy ? "…" : hydrated ? `${quickBuy}` : ""}</span>
      <span className="text-[10px] text-muted">TON in {NATIVE[chain]}</span>
    </button>
  );
}
