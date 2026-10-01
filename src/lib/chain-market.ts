import "server-only";
import type { ChainId, TrendingPool } from "./types";
import { topPools, trendingPools } from "./data/gecko";
import { getXChainStocks } from "./xchain-stocks";
import { memo, safe } from "./data/http";

export type MarketChain = "ethereum" | "solana";

export interface ChainMarket {
  chain: MarketChain;
  /** Tokenized stocks/gold on this chain and tokens paired with them */
  stocks: TrendingPool[];
  trending: TrendingPool[];
  top: TrendingPool[];
  live: boolean;
}

/**
 * ETH and SOL markets for the home page: stock pairs first (xStocks, Ondo,
 * PAXG/XAUT and tokens quoted in them), then GeckoTerminal's trending and
 * top pools. The UI groups the rest by what each pool is paired against.
 */
export function getChainMarket(chain: MarketChain): Promise<ChainMarket> {
  return memo(`chain-market:${chain}`, 120_000, async () => {
    const [trend, top1, top2, x] = await Promise.all([
      safe(trendingPools(chain), [], `gecko trending ${chain}`),
      safe(topPools(chain, 1), [], `gecko top ${chain}`),
      safe(topPools(chain, 2), [], `gecko top2 ${chain}`),
      safe(getXChainStocks(), { assets: [], paired: [], live: false }, "xchain stocks"),
    ]);
    const stockAssets: TrendingPool[] = x.value.assets.filter((a) => a.chain === chain).map((a) => ({
      id: `asset:${a.chain}:${a.address}`, chain: a.chain as ChainId, dex: a.issuer, name: a.symbol, base: a.symbol, quote: a.underlying,
      quoteKind: "stock", priceUsd: a.priceUsd ?? 0, change1h: 0, change24h: a.change24h ?? 0, volume24h: a.volume24h, liquidityUsd: a.liquidityUsd,
      fdv: 0, marketCap: null, txns24h: 0, ageHours: 0, url: a.url, baseAddress: a.address, baseImage: a.image,
    }));
    const stockPaired: TrendingPool[] = x.value.paired.filter((p) => p.chain === chain).map((p) => ({
      id: `pair:${p.chain}:${p.pairAddress}`, chain: p.chain as ChainId, dex: p.dex, name: `${p.base} / ${p.quote}`, base: p.base, quote: p.quote,
      quoteKind: "stock", priceUsd: p.priceUsd ?? 0, change1h: 0, change24h: p.change24h ?? 0, volume24h: p.volume24h, liquidityUsd: p.liquidityUsd,
      fdv: 0, marketCap: p.marketCap, txns24h: 0, ageHours: 0, url: p.url, baseAddress: p.baseAddress, poolAddress: p.pairAddress, baseImage: p.image,
    }));
    const seen = new Set<string>();
    const dedupe = (rows: TrendingPool[]) => rows.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
    const trending = dedupe(trend.value);
    const top = dedupe([...top1.value, ...top2.value]).sort((a, b) => b.volume24h - a.volume24h);
    return { chain, stocks: [...stockAssets, ...stockPaired], trending, top, live: trend.ok || top1.ok };
  });
}
