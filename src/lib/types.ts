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
  /** Issuer / venue label shown as a badge (XSTOCKS, GOLD, NATIVE…) */
  badge: string;
  color: string;
  image?: string;
  /** Live values — null when no source answered */
  priceUsd: number | null;
  change24h: number | null;
  priceSource?: string;
  /** Jetton master on TON, resolved live from STON.fi's asset list */
  tonAddress?: string;
  /** Solana mint (e.g. xStocks), resolved live from Jupiter */
  solanaMint?: string;
  /** Price source ids */
  pythSymbol?: string;
  pythType?: "equity" | "metal" | "crypto" | "commodities";
  yahoo?: string;
  coingecko?: string;
  /** Trailing-12-month dividend yield in % (from Yahoo dividend events) */
  dividendYield?: number | null;
  lastDividend?: { amount: number; date: number };
  dividendsPerYear?: number;
  sector?: string;
}

export interface MarketToken {
  address: string;
  symbol: string;
  name: string;
  image?: string;
  description?: string;
  decimals: number;
  totalSupply: number | null;
  holders: number | null;
  /** The asset the main pool is paired against (Bitpad pair, or the pool's quote token) */
  pair: PairAsset;
  poolAddress?: string;
  /** Whether this token is the base or quote asset of `poolAddress` */
  poolSide?: "base" | "quote";
  dex?: string;
  priceUsd: number | null;
  marketCap: number | null;
  fdv: number | null;
  liquidityUsd: number | null;
  volume24h: number | null;
  change24h: number | null;
  /** Real % changes over 5m/1h/6h/24h, used to draw card sparklines */
  changes?: { m5: number; h1: number; h6: number; h24: number };
  buys24h: number | null;
  sells24h: number | null;
  createdAt?: number;
  /** Launched through the Bitpad factory — trades on its BitpadPool */
  bitpad?: {
    index: number;
    creator?: string;
    pool?: string;
    pairMaster?: string | null; // null = TON
    pairDecimals?: number;
    tradingOpen?: boolean;
    protocolFeeBps?: number;
    creatorFeeBps?: number;
  };
  socials?: { telegram?: string; x?: string; website?: string };
  /** Which APIs supplied this record */
  sources: string[];
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
  share: number | null;
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
  /** Where volume24h came from: DefiLlama protocol totals, a sum over sampled pools, or Bitpad's own pools on-chain */
  volumeSource?: "defillama" | "sampled" | "onchain";
  /** "live" = measured now; "partial" = protocol volume only; "unavailable" = no source answered */
  source: "live" | "partial" | "unavailable";
}

export interface ChainStat {
  chain: ChainId;
  volume24h: number;
  change24h: number;
  newPools24h: number;
  fomo: number; // 0–100
  /** FOMO inputs, each normalised 0–1: buy/sell pressure (40%), 1h momentum (30%), volume acceleration (30%) */
  fomoParts?: { pressure: number; momentum: number; volume: number };
  /** Pools sampled on this chain */
  sampled?: number;
  buySellRatio: number;
  source: "live" | "unavailable";
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
  /** Base token contract — lets TON rows quick-buy */
  baseAddress?: string;
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
  bitpad: { launches: number; factory: string | null };
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
  /** Pre-built TON Connect messages when the route can execute directly */
  executable?: boolean;
  note?: string;
  deepLink?: string;
}
