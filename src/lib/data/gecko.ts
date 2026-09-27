import { getJson } from "./http";
import type { Candle, ChainId, Trade, TrendingPool } from "../types";
import { CHAINS } from "../chains";

/** GeckoTerminal public API — free, no key, ~30 req/min. https://www.geckoterminal.com/dex-api */
const BASE = "https://api.geckoterminal.com/api/v2";

interface GeckoToken {
  id: string;
  type: "token";
  attributes: { address: string; name: string; symbol: string; image_url?: string | null; decimals?: number };
}

interface GeckoPool {
  id: string;
  type: "pool";
  attributes: {
    name: string;
    address: string;
    base_token_price_usd: string | null;
    quote_token_price_usd?: string | null;
    fdv_usd: string | null;
    market_cap_usd?: string | null;
    reserve_in_usd: string | null;
    pool_created_at: string | null;
    price_change_percentage: Partial<Record<"m5" | "h1" | "h6" | "h24", string>>;
    transactions: Partial<Record<"m5" | "h1" | "h24", { buys: number; sells: number }>>;
    volume_usd: Partial<Record<"m5" | "h1" | "h6" | "h24", string>>;
  };
  relationships?: {
    dex?: { data?: { id: string } };
    base_token?: { data?: { id: string } };
    quote_token?: { data?: { id: string } };
  };
}

export interface GeckoPoolRow extends TrendingPool {
  dexId: string;
  poolAddress: string;
  baseAddress: string;
  baseName: string;
  baseImage?: string;
  quoteAddress: string;
  quoteImage?: string;
  quotePriceUsd: number | null;
  marketCap: number | null;
  changeM5: number;
  changeH6: number;
  buys24h: number;
  sells24h: number;
  createdAt: number;
}

const n = (v: string | null | undefined) => (v == null || v === "" ? null : Number(v));
const STABLES = ["USDT", "USDC", "USD₮", "DAI", "USDE", "FDUSD", "USD1", "JUSDT"];

export function quoteKind(quote: string): TrendingPool["quoteKind"] {
  const q = quote.toUpperCase().replace(/^W/, "");
  if (q === "TON" || q === "PTON") return "ton";
  if (STABLES.some((s) => q.startsWith(s))) return "stable";
  if (q === "ETH" || q === "STETH") return "eth";
  if (q === "SOL") return "sol";
  if (/^[A-Z]{1,5}x$/.test(quote)) return "stock";
  return "other";
}

/** Strip GeckoTerminal's "<network>_" prefix from relationship ids. */
const addrOf = (id?: string) => (id ? id.slice(id.indexOf("_") + 1) : "");

export function mapPools(res: { data: GeckoPool[]; included?: GeckoToken[] }, chain: ChainId): GeckoPoolRow[] {
  const tokens = new Map((res.included ?? []).filter((x) => x.type === "token").map((t) => [t.id, t.attributes]));
  return res.data.map((p) => {
    const a = p.attributes;
    const [baseSym = "?", quoteSym = "?"] = a.name.split(" / ").map((s) => s.trim().split(" ")[0]);
    const bt = tokens.get(p.relationships?.base_token?.data?.id ?? "");
    const qt = tokens.get(p.relationships?.quote_token?.data?.id ?? "");
    const created = a.pool_created_at ? Date.parse(a.pool_created_at) : NaN;
    const tx = a.transactions.h24 ?? { buys: 0, sells: 0 };
    const dexId = p.relationships?.dex?.data?.id ?? "unknown";
    const base = bt?.symbol ?? baseSym;
    const quote = qt?.symbol ?? quoteSym;
    return {
      id: p.id,
      chain,
      dex: dexId,
      dexId,
      name: a.name,
      base,
      quote,
      quoteKind: quoteKind(quote),
      poolAddress: a.address,
      baseAddress: bt?.address ?? addrOf(p.relationships?.base_token?.data?.id),
      baseName: bt?.name ?? base,
      baseImage: bt?.image_url && !bt.image_url.includes("missing") ? bt.image_url : undefined,
      quoteAddress: qt?.address ?? addrOf(p.relationships?.quote_token?.data?.id),
      quoteImage: qt?.image_url ?? undefined,
      priceUsd: n(a.base_token_price_usd) ?? 0,
      quotePriceUsd: n(a.quote_token_price_usd),
      change1h: n(a.price_change_percentage.h1) ?? 0,
      change24h: n(a.price_change_percentage.h24) ?? 0,
      changeM5: n(a.price_change_percentage.m5) ?? 0,
      changeH6: n(a.price_change_percentage.h6) ?? 0,
      volume24h: n(a.volume_usd.h24) ?? 0,
      liquidityUsd: n(a.reserve_in_usd) ?? 0,
      fdv: n(a.fdv_usd) ?? 0,
      marketCap: n(a.market_cap_usd),
      txns24h: tx.buys + tx.sells,
      buys24h: tx.buys,
      sells24h: tx.sells,
      ageHours: Number.isFinite(created) ? (Date.now() - created) / 3_600_000 : 0,
      createdAt: created,
      url: `https://www.geckoterminal.com/${CHAINS[chain].gecko}/pools/${a.address}`,
    };
  });
}

const INC = "include=base_token,quote_token,dex";

async function pools(path: string, chain: ChainId, revalidate = 120) {
  const sep = path.includes("?") ? "&" : "?";
  return mapPools(await getJson(`${BASE}${path}${sep}${INC}`, { revalidate }), chain);
}

const net = (chain: ChainId) => {
  const g = CHAINS[chain].gecko;
  if (!g) throw new Error(`${chain} not indexed by GeckoTerminal`);
  return g;
};

export const trendingPools = (chain: ChainId) => pools(`/networks/${net(chain)}/trending_pools?duration=24h`, chain);
export const newPools = (chain: ChainId) => pools(`/networks/${net(chain)}/new_pools`, chain);
export const topPools = (chain: ChainId, page = 1) => pools(`/networks/${net(chain)}/pools?sort=h24_volume_usd_desc&page=${page}`, chain, 180);
export const tokenPools = (chain: ChainId, token: string) => pools(`/networks/${net(chain)}/tokens/${token}/pools?sort=h24_volume_usd_liquidity_desc`, chain, 60);

export interface GeckoTokenInfo {
  address: string;
  name: string;
  symbol: string;
  image?: string;
  decimals?: number;
  totalSupply: number | null;
  priceUsd: number | null;
  fdv: number | null;
  marketCap: number | null;
  liquidityUsd: number | null;
  volume24h: number | null;
}

/** Up to 30 tokens per call. */
export async function tokensMulti(chain: ChainId, addresses: string[]): Promise<GeckoTokenInfo[]> {
  if (!addresses.length) return [];
  const res = await getJson<{ data: { attributes: Record<string, unknown> & { volume_usd?: { h24?: string } } }[] }>(
    `${BASE}/networks/${net(chain)}/tokens/multi/${addresses.slice(0, 30).join(",")}`,
    { revalidate: 60 },
  );
  return res.data.map(({ attributes: a }) => {
    const decimals = Number(a.decimals ?? 9);
    const supply = n(a.total_supply as string);
    return {
      address: String(a.address),
      name: String(a.name ?? ""),
      symbol: String(a.symbol ?? ""),
      image: a.image_url && !String(a.image_url).includes("missing") ? String(a.image_url) : undefined,
      decimals,
      totalSupply: supply == null ? null : supply / 10 ** decimals,
      priceUsd: n(a.price_usd as string),
      fdv: n(a.fdv_usd as string),
      marketCap: n(a.market_cap_usd as string),
      liquidityUsd: n(a.total_reserve_in_usd as string),
      volume24h: n(a.volume_usd?.h24),
    };
  });
}

export async function poolOhlcv(chain: ChainId, pool: string, timeframe: "minute" | "hour" | "day", aggregate: number, token: "base" | "quote" = "base"): Promise<Candle[]> {
  const res = await getJson<{ data: { attributes: { ohlcv_list: [number, number, number, number, number, number][] } } }>(
    `${BASE}/networks/${net(chain)}/pools/${pool}/ohlcv/${timeframe}?aggregate=${aggregate}&limit=300&currency=usd&token=${token}`,
    { revalidate: 20 },
  );
  return res.data.attributes.ohlcv_list
    .map(([time, open, high, low, close, volume]) => ({ time, open, high, low, close, volume }))
    .sort((a, b) => a.time - b.time);
}

interface GeckoTrade {
  id: string;
  attributes: {
    block_timestamp: string;
    tx_hash: string;
    tx_from_address: string;
    kind: "buy" | "sell";
    volume_in_usd: string;
    from_token_amount: string;
    to_token_amount: string;
    price_from_in_usd: string;
    price_to_in_usd: string;
  };
}

/** Recent trades on a pool, expressed from the base token's point of view. */
export async function poolTrades(chain: ChainId, pool: string, dexLabel: string): Promise<Trade[]> {
  const res = await getJson<{ data: GeckoTrade[] }>(`${BASE}/networks/${net(chain)}/pools/${pool}/trades`, { revalidate: 15 });
  return res.data.map((t) => {
    const a = t.attributes;
    const buy = a.kind === "buy";
    const amountToken = Number(buy ? a.to_token_amount : a.from_token_amount);
    return {
      id: t.id,
      time: Date.parse(a.block_timestamp),
      side: a.kind,
      wallet: a.tx_from_address,
      amountToken,
      amountUsd: Number(a.volume_in_usd),
      priceUsd: Number(buy ? a.price_to_in_usd : a.price_from_in_usd),
      route: dexLabel,
      txHash: a.tx_hash,
    };
  });
}
