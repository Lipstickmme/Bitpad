export type ChainId =
  | "ton"
  | "solana"
  | "ethereum"
  | "base"
  | "bsc"
  | "arbitrum"
  | "robinhood";

export type PairKind = "stock" | "commodity" | "jetton" | "crypto";

export interface PairAsset {
  symbol: string;
  name: string;
  kind: PairKind;
  /** Chain the asset natively lives on */
  chain: ChainId;
  /** Tokenized issuer / venue label shown as a badge (XSTOCKS, PYTH, STON.FI…) */
  badge: string;
  color: string;
  priceUsd: number;
  change24h: number;
  /** Jetton master on TON when the asset can be paired on-chain today */
  tonAddress?: string;
  /** Pyth Hermes symbol, used for live pricing of stocks & commodities */
  pythSymbol?: string;
  /** Annual dividend / yield in % (stocks, ETFs, yield-bearing assets) */
  dividendYield?: number;
  /** Next ex-dividend date (ISO) */
  exDividend?: string;
  /** Market capitalisation of the underlying asset */
  underlyingMarketCap?: number;
  sector?: string;
}

export type LaunchStatus = "new" | "live" | "trending" | "graduated";

export interface BitpadToken {
  address: string;
  symbol: string;
  name: string;
  image?: string;
  description: string;
  creator: string;
  createdAt: number;
  pair: PairAsset;
  priceUsd: number;
  marketCap: number;
  fdv: number;
  liquidityUsd: number;
  volume24h: number;
  change24h: number;
  holders: number;
  txns24h: number;
  buys24h: number;
  sells24h: number;
  totalSupply: number;
  /** Share of the pool denominated in the paired asset (USD) */
  pairReserveUsd: number;
  status: LaunchStatus;
  spark: number[];
  socials?: { telegram?: string; x?: string; website?: string };
  /** "demo" = seeded preview data, "live" = pulled from chain / indexer */
  source: "demo" | "live";
}

export interface Candle {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Trade {
  id: string;
  time: number;
  side: "buy" | "sell";
  wallet: string;
  amountToken: number;
  amountUsd: number;
  priceUsd: number;
  route: string;
  txHash: string;
}

export interface Holder {
  address: string;
  label?: string;
  share: number;
  amount: number;
}

export interface LaunchpadStat {
  id: string;
  name: string;
  chain: ChainId;
  kind: "launchpad" | "dex";
  mechanism: string;
  color: string;
  volume24h: number;
  volumeChange: number;
  launches24h: number;
  /** Tokens sampled whose 24h price change is > 0 */
  wins: number;
  /** Tokens sampled whose 24h price change is <= 0 */
  losses: number;
  avgReturn24h: number;
  medianReturn24h: number;
  topGainer?: { symbol: string; change: number };
  buySellRatio: number;
  fees24h?: number;
  source: "live" | "demo";
}

export interface ChainStat {
  chain: ChainId;
  volume24h: number;
  change24h: number;
  newPools24h: number;
  fomo: number; // 0–100
  buySellRatio: number;
  source: "live" | "demo";
}

export interface TrendingPool {
  id: string;
  chain: ChainId;
  dex: string;
  name: string;
  base: string;
  quote: string;
  quoteKind: "ton" | "stable" | "eth" | "sol" | "stock" | "other";
  priceUsd: number;
  change1h: number;
  change24h: number;
  volume24h: number;
  liquidityUsd: number;
  fdv: number;
  txns24h: number;
  ageHours: number;
  url?: string;
}

export interface PairTypeStat {
  kind: string;
  label: string;
  volume24h: number;
  avgReturn24h: number;
  winRate: number;
  pools: number;
}

export interface AnalyticsSnapshot {
  updatedAt: number;
  launchpads: LaunchpadStat[];
  dexes: LaunchpadStat[];
  chains: ChainStat[];
  trending: TrendingPool[];
  pairTypes: PairTypeStat[];
  history: { date: string; [launchpad: string]: number | string }[];
  sources: { name: string; ok: boolean }[];
}

export interface RouteQuote {
  id: string;
  venue: string;
  chain: ChainId;
  kind: "onchain" | "crosschain" | "external";
  payAsset: string;
  payAmount: number;
  receiveAmount: number;
  receiveUsd: number;
  priceImpact: number;
  platformFeeUsd: number;
  networkFeeUsd: number;
  etaSeconds: number;
  best?: boolean;
  live: boolean;
  note?: string;
  deepLink?: string;
}
