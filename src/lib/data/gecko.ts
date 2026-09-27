import { getJson } from "./http";
import type { ChainId, TrendingPool } from "../types";
import { CHAINS } from "../chains";

const BASE = "https://api.geckoterminal.com/api/v2";

interface GeckoPool {
  id: string;
  attributes: {
    name: string;
    address: string;
    base_token_price_usd: string | null;
    fdv_usd: string | null;
    reserve_in_usd: string | null;
    pool_created_at: string | null;
    price_change_percentage: Partial<Record<"m5" | "h1" | "h6" | "h24", string>>;
    transactions: Partial<Record<"h1" | "h24", { buys: number; sells: number }>>;
    volume_usd: Partial<Record<"h1" | "h24", string>>;
  };
  relationships?: { dex?: { data?: { id: string } } };
}

export interface SampledPool extends TrendingPool {
  dexId: string;
  buys24h: number;
  sells24h: number;
}

const STABLES = ["USDT", "USDC", "USD₮", "DAI", "USDE", "FDUSD", "USD1"];
function quoteKind(quote: string): TrendingPool["quoteKind"] {
  const q = quote.toUpperCase().replace(/^W/, "");
  if (q === "TON" || q === "PTON") return "ton";
  if (STABLES.some((s) => q.startsWith(s))) return "stable";
  if (q === "ETH" || q === "STETH") return "eth";
  if (q === "SOL") return "sol";
  if (/X$/.test(quote) && quote.length <= 6) return "stock";
  return "other";
}

function toPool(p: GeckoPool, chain: ChainId): SampledPool {
  const a = p.attributes;
  const [base = "?", quote = "?"] = a.name.split(" / ").map((s) => s.trim().split(" ")[0]);
  const created = a.pool_created_at ? Date.parse(a.pool_created_at) : Date.now();
  const tx = a.transactions.h24 ?? { buys: 0, sells: 0 };
  const dexId = p.relationships?.dex?.data?.id ?? "unknown";
  return {
    id: p.id,
    chain,
    dex: dexId,
    dexId,
    name: a.name,
    base,
    quote,
    quoteKind: quoteKind(quote),
    priceUsd: Number(a.base_token_price_usd ?? 0),
    change1h: Number(a.price_change_percentage.h1 ?? 0),
    change24h: Number(a.price_change_percentage.h24 ?? 0),
    volume24h: Number(a.volume_usd.h24 ?? 0),
    liquidityUsd: Number(a.reserve_in_usd ?? 0),
    fdv: Number(a.fdv_usd ?? 0),
    txns24h: tx.buys + tx.sells,
    buys24h: tx.buys,
    sells24h: tx.sells,
    ageHours: (Date.now() - created) / 3_600_000,
    url: `https://www.geckoterminal.com/${CHAINS[chain].gecko}/pools/${a.address}`,
  };
}

async function pools(path: string, chain: ChainId, revalidate = 120): Promise<SampledPool[]> {
  const res = await getJson<{ data: GeckoPool[] }>(`${BASE}${path}`, { revalidate });
  return res.data.map((p) => toPool(p, chain));
}

export function trendingPools(chain: ChainId) {
  const net = CHAINS[chain].gecko;
  if (!net) return Promise.resolve([]);
  return pools(`/networks/${net}/trending_pools?include=dex&duration=24h`, chain);
}

export function newPools(chain: ChainId) {
  const net = CHAINS[chain].gecko;
  if (!net) return Promise.resolve([]);
  return pools(`/networks/${net}/new_pools?include=dex`, chain);
}

export function topPools(chain: ChainId) {
  const net = CHAINS[chain].gecko;
  if (!net) return Promise.resolve([]);
  return pools(`/networks/${net}/pools?include=dex&sort=h24_volume_usd_desc`, chain, 300);
}

export async function poolOhlcv(chain: ChainId, pool: string, timeframe: "minute" | "hour" | "day", aggregate: number) {
  const net = CHAINS[chain].gecko;
  const res = await getJson<{ data: { attributes: { ohlcv_list: [number, number, number, number, number, number][] } } }>(
    `${BASE}/networks/${net}/pools/${pool}/ohlcv/${timeframe}?aggregate=${aggregate}&limit=300&currency=usd`,
    { revalidate: 30 },
  );
  return res.data.attributes.ohlcv_list
    .map(([time, open, high, low, close, volume]) => ({ time, open, high, low, close, volume }))
    .sort((a, b) => a.time - b.time);
}
