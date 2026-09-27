import { getJson } from "./http";

/** Jupiter token API (lite tier) — free, no key. Resolves Solana mints, e.g. xStocks. */
export interface JupToken {
  id: string; // mint
  name: string;
  symbol: string;
  icon?: string;
  usdPrice?: number;
  isVerified?: boolean;
  stats24h?: { priceChange?: number };
}

export async function jupSearch(query: string): Promise<JupToken[]> {
  return getJson<JupToken[]>(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(query)}`, { revalidate: 600 });
}

export async function jupResolve(symbol: string): Promise<JupToken | undefined> {
  const list = await jupSearch(symbol);
  return list.filter((t) => t.symbol.toLowerCase() === symbol.toLowerCase()).sort((a, b) => Number(!!b.isVerified) - Number(!!a.isVerified))[0];
}

export const jupSwapUrl = (outputMint: string) => `https://jup.ag/swap/USDC-${outputMint}`;
