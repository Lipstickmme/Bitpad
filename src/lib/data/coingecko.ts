import { getJson, memo } from "./http";

/** CoinGecko public API — free, no key (~10–30 req/min). */
export async function cgPrices(ids: string[]): Promise<Record<string, { usd: number; usd_24h_change?: number }>> {
  if (!ids.length) return {};
  return getJson(`https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=usd&include_24hr_change=true`, { revalidate: 120 });
}

/** CoinGecko platform ids for the chains Bitpad lists. */
export const CG_PLATFORM: Partial<Record<string, string>> = {
  ethereum: "ethereum", solana: "solana", base: "base", bsc: "binance-smart-chain", arbitrum: "arbitrum-one",
  polygon: "polygon-pos", avalanche: "avalanche", ton: "the-open-network",
};

export interface CgListed { id: string; symbol: string; name: string }

/**
 * Every contract CoinGecko has reviewed and listed, keyed "platform:address"
 * (EVM addresses lower-cased). Copycats with a look-alike ticker aren't in it.
 * The list is several MB, so it skips the fetch cache and lives in memory for 12h.
 */
export function cgListedIndex(): Promise<Map<string, CgListed>> {
  return memo("cg:listed", 12 * 3_600_000, async () => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20_000);
    try {
      const res = await fetch("https://api.coingecko.com/api/v3/coins/list?include_platform=true", { signal: ctrl.signal, cache: "no-store", headers: { accept: "application/json" } });
      if (!res.ok) throw new Error(`coingecko list ${res.status}`);
      const list = (await res.json()) as { id: string; symbol: string; name: string; platforms?: Record<string, string | null> }[];
      const idx = new Map<string, CgListed>();
      for (const c of list)
        for (const [platform, addr] of Object.entries(c.platforms ?? {}))
          if (addr) idx.set(`${platform}:${platform === "solana" ? addr : addr.toLowerCase()}`, { id: c.id, symbol: c.symbol, name: c.name });
      return idx;
    } finally {
      clearTimeout(timer);
    }
  });
}

export async function cgListed(chain: string, address: string): Promise<CgListed | undefined> {
  const p = CG_PLATFORM[chain];
  if (!p) return undefined;
  return (await cgListedIndex()).get(`${p}:${chain === "solana" ? address : address.toLowerCase()}`);
}
