import { getJson } from "./http";
import type { ChainId } from "../types";
import { quoteKind, type GeckoPoolRow } from "./gecko";

/** DexScreener public API — free, no key, 300 req/min. https://docs.dexscreener.com/api/reference */
const BASE = "https://api.dexscreener.com";

const DS_CHAIN: Partial<Record<ChainId, string>> = { ton: "ton", solana: "solana", ethereum: "ethereum", base: "base", bsc: "bsc", arbitrum: "arbitrum", polygon: "polygon", avalanche: "avalanche", sui: "sui", tron: "tron" };
const FROM_DS: Record<string, ChainId> = Object.fromEntries(Object.entries(DS_CHAIN).map(([k, v]) => [v, k as ChainId]));

export interface DsPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string };
  priceUsd?: string;
  priceChange?: Partial<Record<"m5" | "h1" | "h6" | "h24", number>>;
  txns?: Partial<Record<"h24", { buys: number; sells: number }>>;
  volume?: Partial<Record<"h24", number>>;
  liquidity?: { usd?: number };
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
  info?: { imageUrl?: string; websites?: { url: string }[]; socials?: { type: string; url: string }[] };
}

export function mapDsPair(p: DsPair): GeckoPoolRow | null {
  const chain = FROM_DS[p.chainId];
  if (!chain) return null;
  const tx = p.txns?.h24 ?? { buys: 0, sells: 0 };
  return {
    id: `${p.chainId}_${p.pairAddress}`,
    chain,
    dex: p.dexId,
    dexId: p.dexId,
    name: `${p.baseToken.symbol} / ${p.quoteToken.symbol}`,
    base: p.baseToken.symbol,
    quote: p.quoteToken.symbol,
    quoteKind: quoteKind(p.quoteToken.symbol),
    poolAddress: p.pairAddress,
    baseAddress: p.baseToken.address,
    baseName: p.baseToken.name,
    baseImage: p.info?.imageUrl,
    quoteAddress: p.quoteToken.address,
    quotePriceUsd: null,
    priceUsd: Number(p.priceUsd ?? 0),
    change1h: p.priceChange?.h1 ?? 0,
    change24h: p.priceChange?.h24 ?? 0,
    changeM5: p.priceChange?.m5 ?? 0,
    changeH6: p.priceChange?.h6 ?? 0,
    volume24h: p.volume?.h24 ?? 0,
    liquidityUsd: p.liquidity?.usd ?? 0,
    fdv: p.fdv ?? 0,
    marketCap: p.marketCap ?? null,
    txns24h: tx.buys + tx.sells,
    buys24h: tx.buys,
    sells24h: tx.sells,
    ageHours: p.pairCreatedAt ? (Date.now() - p.pairCreatedAt) / 3_600_000 : 0,
    createdAt: p.pairCreatedAt ?? NaN,
    url: p.url,
  };
}

/** All pairs for up to 30 token addresses on one chain. */
export async function dsTokenPairs(chain: ChainId, addresses: string[]): Promise<(GeckoPoolRow & { socials?: DsPair["info"] })[]> {
  const c = DS_CHAIN[chain];
  if (!c || !addresses.length) return [];
  const pairs = await getJson<DsPair[]>(`${BASE}/tokens/v1/${c}/${addresses.slice(0, 30).join(",")}`, { revalidate: 60 });
  return pairs.map((p) => ({ ...mapDsPair(p)!, socials: p.info })).filter((p) => p.chain);
}

/** Top boosted tokens across chains → their best pairs (trending fallback). */
export async function dsTrending(chains: ChainId[]): Promise<GeckoPoolRow[]> {
  const boosts = await getJson<{ chainId: string; tokenAddress: string }[]>(`${BASE}/token-boosts/top/v1`, { revalidate: 300 });
  const byChain = new Map<ChainId, string[]>();
  for (const b of boosts) {
    const c = FROM_DS[b.chainId];
    if (c && chains.includes(c)) byChain.set(c, [...(byChain.get(c) ?? []), b.tokenAddress]);
  }
  const rows = await Promise.all([...byChain].map(([c, addrs]) => dsTokenPairs(c, addrs).catch(() => [])));
  // keep the most liquid pair per token
  const best = new Map<string, GeckoPoolRow>();
  for (const r of rows.flat()) {
    const k = `${r.chain}:${r.baseAddress}`;
    if (!best.has(k) || best.get(k)!.liquidityUsd < r.liquidityUsd) best.set(k, r);
  }
  return [...best.values()];
}

/** Free-text pair search (symbol, name or address); up to ~30 pairs across all chains. */
export async function dsSearch(q: string): Promise<DsPair[]> {
  const r = await getJson<{ pairs?: DsPair[] }>(`${BASE}/latest/dex/search?q=${encodeURIComponent(q)}`, { revalidate: 600 });
  return r.pairs ?? [];
}

export const dsChain = (id: string): ChainId | undefined => FROM_DS[id];
