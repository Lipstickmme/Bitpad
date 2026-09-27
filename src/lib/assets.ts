import type { PairAsset } from "./types";
import { TON_ASSETS } from "./config";

/**
 * Pairable asset catalog. Prices here are reference values used until live
 * quotes arrive (Pyth for stocks/commodities, STON.fi for jettons).
 * Colors are brand-ish identity colors for avatars only — never for data series.
 */
export const PAIR_ASSETS: PairAsset[] = [
  // ── Tokenized stocks & ETFs ────────────────────────────────────────────
  { symbol: "SPYx", name: "S&P 500 ETF", kind: "stock", chain: "solana", badge: "XSTOCKS", color: "#d6293b", priceUsd: 668.4, change24h: 0.42, pythSymbol: "SPY", dividendYield: 1.12, exDividend: "2026-12-19", underlyingMarketCap: 612e9, sector: "Index ETF" },
  { symbol: "QQQx", name: "Nasdaq 100 ETF", kind: "stock", chain: "solana", badge: "XSTOCKS", color: "#1d6fd8", priceUsd: 598.1, change24h: 0.71, pythSymbol: "QQQ", dividendYield: 0.52, exDividend: "2026-12-22", underlyingMarketCap: 352e9, sector: "Index ETF" },
  { symbol: "AAPLx", name: "Apple", kind: "stock", chain: "solana", badge: "XSTOCKS", color: "#111111", priceUsd: 254.3, change24h: -0.35, pythSymbol: "AAPL", dividendYield: 0.41, exDividend: "2026-11-10", underlyingMarketCap: 3.78e12, sector: "Technology" },
  { symbol: "NVDAx", name: "NVIDIA", kind: "stock", chain: "solana", badge: "XSTOCKS", color: "#76b900", priceUsd: 187.6, change24h: 1.84, pythSymbol: "NVDA", dividendYield: 0.02, exDividend: "2026-12-04", underlyingMarketCap: 4.57e12, sector: "Semiconductors" },
  { symbol: "TSLAx", name: "Tesla", kind: "stock", chain: "solana", badge: "XSTOCKS", color: "#cc0000", priceUsd: 441.2, change24h: -2.1, pythSymbol: "TSLA", dividendYield: 0, underlyingMarketCap: 1.42e12, sector: "Automotive" },
  { symbol: "MSTRx", name: "Strategy", kind: "stock", chain: "solana", badge: "XSTOCKS", color: "#f7931a", priceUsd: 312.9, change24h: 3.2, pythSymbol: "MSTR", dividendYield: 0, underlyingMarketCap: 88e9, sector: "Bitcoin treasury" },
  { symbol: "COINx", name: "Coinbase", kind: "stock", chain: "solana", badge: "XSTOCKS", color: "#0052ff", priceUsd: 331.5, change24h: 1.1, pythSymbol: "COIN", dividendYield: 0, underlyingMarketCap: 84e9, sector: "Exchanges" },
  { symbol: "GOOGLx", name: "Alphabet", kind: "stock", chain: "solana", badge: "XSTOCKS", color: "#4285f4", priceUsd: 246.1, change24h: 0.2, pythSymbol: "GOOGL", dividendYield: 0.34, exDividend: "2026-12-08", underlyingMarketCap: 2.98e12, sector: "Technology" },
  { symbol: "HOODx", name: "Robinhood", kind: "stock", chain: "robinhood", badge: "RH CHAIN", color: "#00c805", priceUsd: 138.4, change24h: 2.6, pythSymbol: "HOOD", dividendYield: 0, underlyingMarketCap: 122e9, sector: "Brokerage" },
  { symbol: "KO", name: "Coca-Cola", kind: "stock", chain: "robinhood", badge: "RH CHAIN", color: "#f40009", priceUsd: 68.2, change24h: 0.1, pythSymbol: "KO", dividendYield: 2.98, exDividend: "2026-11-28", underlyingMarketCap: 294e9, sector: "Consumer staples" },

  // ── Commodities ────────────────────────────────────────────────────────
  { symbol: "XAUt", name: "Tether Gold", kind: "commodity", chain: "ton", badge: "GOLD", color: "#c9a227", priceUsd: 3712, change24h: 0.55, pythSymbol: "XAU", underlyingMarketCap: 25.1e12, sector: "Precious metals" },
  { symbol: "XAG", name: "Silver", kind: "commodity", chain: "ethereum", badge: "PYTH", color: "#9ea4ab", priceUsd: 44.1, change24h: 1.2, pythSymbol: "XAG", underlyingMarketCap: 2.5e12, sector: "Precious metals" },
  { symbol: "WTI", name: "Crude Oil", kind: "commodity", chain: "ethereum", badge: "PYTH", color: "#2b2b2b", priceUsd: 64.8, change24h: -0.9, pythSymbol: "WTI", sector: "Energy" },

  // ── TON jettons ────────────────────────────────────────────────────────
  { symbol: "TON", name: "Toncoin", kind: "jetton", chain: "ton", badge: "NATIVE", color: "#0098ea", priceUsd: 2.86, change24h: 1.4, tonAddress: TON_ASSETS.TON },
  { symbol: "USDT", name: "Tether USD", kind: "jetton", chain: "ton", badge: "STABLE", color: "#26a17b", priceUsd: 1, change24h: 0, tonAddress: TON_ASSETS.USDT },
  { symbol: "GRAM", name: "Gram", kind: "jetton", chain: "ton", badge: "JETTON", color: "#2f80ed", priceUsd: 0.0031, change24h: 4.8 },
  { symbol: "NOT", name: "Notcoin", kind: "jetton", chain: "ton", badge: "JETTON", color: "#000000", priceUsd: 0.0021, change24h: -1.3 },
  { symbol: "DOGS", name: "Dogs", kind: "jetton", chain: "ton", badge: "JETTON", color: "#3b3b3b", priceUsd: 0.00013, change24h: 2.2 },
  { symbol: "STON", name: "STON.fi", kind: "jetton", chain: "ton", badge: "JETTON", color: "#0b5cff", priceUsd: 1.02, change24h: 0.8 },

  // ── Cross-chain majors ─────────────────────────────────────────────────
  { symbol: "BTC", name: "Bitcoin", kind: "crypto", chain: "ethereum", badge: "CROSS-CHAIN", color: "#f7931a", priceUsd: 112400, change24h: 0.9, pythSymbol: "BTC" },
  { symbol: "ETH", name: "Ether", kind: "crypto", chain: "ethereum", badge: "CROSS-CHAIN", color: "#627eea", priceUsd: 4120, change24h: 1.6, pythSymbol: "ETH" },
  { symbol: "SOL", name: "Solana", kind: "crypto", chain: "solana", badge: "CROSS-CHAIN", color: "#9945ff", priceUsd: 214, change24h: 2.4, pythSymbol: "SOL" },
  { symbol: "ZEC", name: "Zcash", kind: "crypto", chain: "ethereum", badge: "CROSS-CHAIN", color: "#e8b30f", priceUsd: 71.4, change24h: -3.1, pythSymbol: "ZEC" },
];

export const PAIR_KIND_LABEL: Record<PairAsset["kind"], string> = {
  stock: "Stocks & ETFs",
  commodity: "Commodities",
  jetton: "TON jettons",
  crypto: "Cross-chain",
};

export function findAsset(symbol: string): PairAsset | undefined {
  return PAIR_ASSETS.find((a) => a.symbol.toLowerCase() === symbol.toLowerCase());
}

/** Assets a trader can pay with on Bitpad */
export const PAY_ASSETS = ["TON", "USDT", "GRAM", "USDC"] as const;
export type PayAsset = (typeof PAY_ASSETS)[number];
