import "server-only";
import type { ChainId } from "./types";

/**
 * Buys on Solana and EVM chains route through LI.FI's free aggregator API
 * (Jupiter, Uniswap, 1inch, PancakeSwap … and bridges). LI.FI supports an
 * integrator fee taken from the user's input and collected for the integrator,
 * which is how Bitpad earns on these routes. Fees only accrue once the
 * integrator id is registered with a payout wallet in the LI.FI partner portal,
 * so the fee is sent only when LIFI_INTEGRATOR is set.
 */
const BASE = "https://li.quest/v1";

export const LIFI_CHAIN: Partial<Record<ChainId, { key: string; evmId?: number; native: string; symbol: string; decimals: number }>> = {
  solana: { key: "SOL", native: "11111111111111111111111111111111", symbol: "SOL", decimals: 9 },
  ethereum: { key: "ETH", evmId: 1, native: "0x0000000000000000000000000000000000000000", symbol: "ETH", decimals: 18 },
  base: { key: "BAS", evmId: 8453, native: "0x0000000000000000000000000000000000000000", symbol: "ETH", decimals: 18 },
  bsc: { key: "BSC", evmId: 56, native: "0x0000000000000000000000000000000000000000", symbol: "BNB", decimals: 18 },
  arbitrum: { key: "ARB", evmId: 42161, native: "0x0000000000000000000000000000000000000000", symbol: "ETH", decimals: 18 },
  polygon: { key: "POL", evmId: 137, native: "0x0000000000000000000000000000000000000000", symbol: "POL", decimals: 18 },
  avalanche: { key: "AVA", evmId: 43114, native: "0x0000000000000000000000000000000000000000", symbol: "AVAX", decimals: 18 },
};

/**
 * LI.FI only accepts an integrator id of 1–23 letters, digits, "-", "_" or "."
 * (the name registered in the LI.FI partner portal — not a wallet or API key).
 * An invalid value would make every quote fail, so it's ignored: buys still
 * work, just without the platform fee, and the server log says why.
 */
export const INTEGRATOR_RE = /^[A-Za-z0-9_.-]{1,23}$/;
export function lifiIntegrator(raw = process.env.LIFI_INTEGRATOR): string | null {
  const v = raw?.trim();
  if (!v) return null;
  if (INTEGRATOR_RE.test(v)) return v;
  console.warn(`[lifi] LIFI_INTEGRATOR isn't a valid LI.FI integrator id (1–23 of A-Z a-z 0-9 - _ .); quoting without a fee`);
  return null;
}

/** LI.FI's diamond (same address on every EVM chain it supports). */
export const LIFI_DIAMOND = "0x1231deb6f5749ef6ce6943a275a1d3e7486f4eae";

/** Platform fee on LI.FI routes, as a fraction (0.005 = 0.5%). */
export const LIFI_FEE = 0.005;

function headers(): Record<string, string> {
  const key = process.env.LIFI_API_KEY;
  return { accept: "application/json", ...(key ? { "x-lifi-api-key": key } : {}) };
}

async function get<T>(path: string): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetch(`${BASE}${path}`, { headers: headers(), signal: ctrl.signal, cache: "no-store" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((body as { message?: string }).message ?? `LI.FI ${res.status}`);
    return body as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function nativeUsd(chain: ChainId): Promise<number> {
  const c = LIFI_CHAIN[chain];
  if (!c) throw new Error(`${chain} isn't routable`);
  const t = await get<{ priceUSD?: string }>(`/token?chain=${c.key}&token=${c.native}`);
  const p = Number(t.priceUSD);
  if (!(p > 0)) throw new Error(`No ${c.symbol} price from LI.FI`);
  return p;
}

export interface LifiQuote {
  tool: string;
  toolName: string;
  fromAmount: string;
  fromAmountUsd: number;
  toAmount: string;
  toAmountMin: string;
  toSymbol: string;
  toDecimals: number;
  feeCharged: boolean;
  /** EVM: { to, data, value, gasLimit, chainId } · Solana: { data } (base64 versioned transaction) */
  tx: { to?: string; data: string; value?: string; gasLimit?: string; chainId?: number };
}

/** Quote a native → token swap worth `usd`, paid from `from` on the token's chain. */
export async function quoteNativeBuy(chain: ChainId, token: string, usd: number, from: string, slippage: number): Promise<LifiQuote> {
  const c = LIFI_CHAIN[chain];
  if (!c) throw new Error(`${chain} isn't routable yet`);
  const px = await nativeUsd(chain);
  const amount = BigInt(Math.floor((usd / px) * 10 ** Math.min(c.decimals, 12))) * 10n ** BigInt(Math.max(0, c.decimals - 12));
  const integrator = lifiIntegrator();
  const qs = new URLSearchParams({
    fromChain: c.key,
    toChain: c.key,
    fromToken: c.native,
    toToken: token,
    fromAmount: amount.toString(),
    fromAddress: from,
    toAddress: from,
    slippage: String(Math.min(0.5, Math.max(0.001, slippage))),
    integrator: integrator || "bitpad",
    ...(integrator ? { fee: String(LIFI_FEE) } : {}),
  });
  type Raw = {
    tool: string;
    toolDetails?: { name?: string };
    action: { fromAmount: string; toToken: { symbol: string; decimals: number } };
    estimate: { toAmount: string; toAmountMin: string; fromAmountUSD?: string };
    transactionRequest: { to?: string; data: string; value?: string; gasLimit?: string; chainId?: number };
  };
  const q = await get<Raw>(`/quote?${qs}`);
  // Never hand the user a transaction we didn't expect: on EVM it must call LI.FI's
  // diamond and spend no more than the quoted native amount.
  if (c.evmId) {
    if (q.transactionRequest.to?.toLowerCase() !== LIFI_DIAMOND) throw new Error("LI.FI returned an unexpected contract; not signing it");
    if (Number(q.transactionRequest.chainId) !== c.evmId) throw new Error("LI.FI returned a transaction for another chain");
    if (BigInt(q.transactionRequest.value ?? 0) > BigInt(q.action.fromAmount)) throw new Error("LI.FI transaction spends more than quoted");
  }
  return {
    tool: q.tool,
    toolName: q.toolDetails?.name ?? q.tool,
    fromAmount: q.action.fromAmount,
    fromAmountUsd: Number(q.estimate.fromAmountUSD ?? usd),
    toAmount: q.estimate.toAmount,
    toAmountMin: q.estimate.toAmountMin,
    toSymbol: q.action.toToken.symbol,
    toDecimals: q.action.toToken.decimals,
    feeCharged: !!integrator,
    tx: q.transactionRequest,
  };
}
