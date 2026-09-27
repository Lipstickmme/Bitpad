import { getJson } from "./http";

/** CoinGecko public API — free, no key (~10–30 req/min). */
export async function cgPrices(ids: string[]): Promise<Record<string, { usd: number; usd_24h_change?: number }>> {
  if (!ids.length) return {};
  return getJson(`https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=usd&include_24hr_change=true`, { revalidate: 120 });
}
