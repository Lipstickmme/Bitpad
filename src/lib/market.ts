import "server-only";
import { PAIR_ASSETS } from "./assets";
import { DEMO_TOKENS } from "./demo";
import { pythPrices } from "./data/pyth";
import { safe } from "./data/http";
import type { BitpadToken, PairAsset } from "./types";

/** Pair assets with live prices merged in where available. */
export async function getPairAssets(): Promise<{ assets: PairAsset[]; live: boolean }> {
  const { value: prices, ok } = await safe(pythPrices(PAIR_ASSETS.filter((a) => a.pythSymbol)), {}, "pyth");
  return {
    live: ok && Object.keys(prices).length > 0,
    assets: PAIR_ASSETS.map((a) => (prices[a.symbol] ? { ...a, priceUsd: prices[a.symbol] } : a)),
  };
}

export async function getTokens(): Promise<BitpadToken[]> {
  const { assets } = await getPairAssets();
  const bySym = new Map(assets.map((a) => [a.symbol, a]));
  // Live launches from the factory indexer would be merged here.
  return DEMO_TOKENS.map((t) => ({ ...t, pair: bySym.get(t.pair.symbol) ?? t.pair }));
}

export async function getToken(address: string): Promise<BitpadToken | undefined> {
  const tokens = await getTokens();
  return tokens.find((t) => t.address === address || t.symbol.toLowerCase() === address.toLowerCase());
}
