"use client";
import { useState, useSyncExternalStore } from "react";
import { Zap } from "lucide-react";
import type { ChainId } from "@/lib/types";
import { useApp } from "@/lib/store";
import { useQuickBuy } from "./QuickBuy";
import { toast } from "./Toast";
import { haptic } from "./TelegramBridge";

const useHydrated = () => useSyncExternalStore(() => () => {}, () => true, () => false);
const NATIVE: Partial<Record<ChainId, string>> = { solana: "SOL", ethereum: "ETH", base: "ETH", bsc: "BNB", arbitrum: "ETH" };
export const xBuyable = (chain: ChainId) => chain in NATIVE;

/** Poll until the chain reports confirmed/failed (max ~75s). */
async function waitFor(check: () => Promise<string>): Promise<"confirmed" | "failed" | "pending"> {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const s = await check().catch(() => "pending");
    if (s === "confirmed" || s === "failed") return s;
  }
  return "pending";
}

/**
 * Quick buy for tokens on Solana and EVM chains. The quick-buy amount (TON) is
 * converted to its USD value and paid in the chain's native coin from the
 * connected Phantom / MetaMask-style wallet, on LI.FI's best route.
 */
export function XBuyButton({ chain, token, symbol, className = "" }: { chain: ChainId; token: string; symbol: string; className?: string }) {
  const { slippage, external, addExternal } = useApp();
  const { asset, amount } = useQuickBuy();
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
      const qs = new URLSearchParams({ chain, token, from, amount: String(amount), asset, slippage: String(slippage) });
      const q = await fetch(`/api/xquote?${qs}`).then((r) => r.json());
      if (q.error) throw new Error(q.error);
      const out = Number(q.toAmount) / 10 ** q.toDecimals;
      const what = `≈${out.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${q.toSymbol} for ~$${q.fromAmountUsd.toFixed(2)} in ${NATIVE[chain]} via ${q.toolName}`;
      const spend = BigInt(q.fromAmount);
      let result: "confirmed" | "failed" | "pending";
      if (isSol) {
        // Refuse up front if the wallet can't cover the buy + fees (~0.01 SOL for fees and token-account rent)
        const bal = await fetch(`/api/solana?op=balance&address=${from}`).then((r) => r.json());
        if (typeof bal.lamports === "number" && BigInt(bal.lamports) < spend + 10_000_000n)
          throw new Error(`Not enough SOL: you have ${(bal.lamports / 1e9).toFixed(4)}, this buy needs ~${(Number(spend + 10_000_000n) / 1e9).toFixed(4)} incl. fees`);
        const { VersionedTransaction } = await import("@solana/web3.js");
        const tx = VersionedTransaction.deserialize(Uint8Array.from(atob(q.tx.data), (c) => c.charCodeAt(0)));
        const p = window.phantom?.solana ?? window.solana;
        if (!p?.signAndSendTransaction) throw new Error("This Solana wallet can't sign transactions here");
        const { signature } = await p.signAndSendTransaction(tx);
        toast.info(`Buying $${symbol}`, "Sent. Waiting for Solana to confirm…");
        result = await waitFor(async () => (await fetch(`/api/solana?op=status&sig=${signature}`).then((r) => r.json())).status);
      } else {
        const eth = window.ethereum!;
        const want = `0x${Number(q.tx.chainId).toString(16)}`;
        const cur = (await eth.request({ method: "eth_chainId" })) as string;
        if (cur.toLowerCase() !== want) await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: want }] });
        const bal = BigInt((await eth.request({ method: "eth_getBalance", params: [from, "latest"] })) as string);
        const gasPrice = BigInt((await eth.request({ method: "eth_gasPrice" })) as string);
        const need = BigInt(q.tx.value ?? 0) + BigInt(q.tx.gasLimit ?? 300_000) * gasPrice;
        if (bal < need) throw new Error(`Not enough ${NATIVE[chain]}: you have ${(Number(bal) / 1e18).toFixed(5)}, this buy needs ~${(Number(need) / 1e18).toFixed(5)} incl. gas`);
        const hash = (await eth.request({ method: "eth_sendTransaction", params: [{ from, to: q.tx.to, data: q.tx.data, value: q.tx.value, ...(q.tx.gasLimit ? { gas: q.tx.gasLimit } : {}) }] })) as string;
        toast.info(`Buying $${symbol}`, "Sent. Waiting for confirmation…");
        result = await waitFor(async () => {
          const r = (await eth.request({ method: "eth_getTransactionReceipt", params: [hash] })) as { status?: string } | null;
          return !r ? "pending" : r.status === "0x1" ? "confirmed" : "failed";
        });
      }
      if (result === "failed") throw new Error("The transaction failed on-chain (nothing was bought). Check your balance and slippage.");
      haptic("success");
      if (result === "confirmed") toast.success(`Bought $${symbol}`, `${what}.`);
      else toast.info(`$${symbol} buy submitted`, `${what}. Not confirmed yet; check your wallet in a minute.`);
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
      title={`Buy ~${amount} ${asset} worth of $${symbol}, paid in ${NATIVE[chain]}`}
      className={`inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-line bg-surface-2 px-2 text-xs font-semibold text-ink transition-colors hover:border-brand/50 hover:text-brand-ink disabled:opacity-50 ${className}`}
    >
      <Zap className="size-3.5 text-brand" />
      <span className="num">{busy ? "…" : hydrated ? `${amount}` : ""}</span>
      <span className="text-[10px] text-muted">{hydrated ? asset : ""} in {NATIVE[chain]}</span>
    </button>
  );
}
