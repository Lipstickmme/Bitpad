import type { PairAsset } from "./types";
import { TON_ASSETS } from "./config";

type Def = Omit<PairAsset, "priceUsd" | "change24h"> & { tonSymbols?: string[] };

/**
 * Pairable asset catalog — identities and price-source ids only. Every price,
 * 24h change, dividend yield, TON jetton address and Solana mint is resolved
 * live in `prices.ts`.
 */
export const ASSET_DEFS: Def[] = [
  // Tokenized stocks & ETFs — xStocks (Backed Finance), live on TON via STON.fi and on Solana
  { symbol: "METAx", name: "Meta", kind: "stock", chain: "ton", badge: "XSTOCKS", color: "#0866ff", pythSymbol: "META", pythType: "equity", yahoo: "META", sector: "Technology" },
  { symbol: "MSFTx", name: "Microsoft", kind: "stock", chain: "ton", badge: "XSTOCKS", color: "#00a4ef", pythSymbol: "MSFT", pythType: "equity", yahoo: "MSFT", sector: "Technology" },
  { symbol: "AMZNx", name: "Amazon", kind: "stock", chain: "ton", badge: "XSTOCKS", color: "#ff9900", pythSymbol: "AMZN", pythType: "equity", yahoo: "AMZN", sector: "Consumer" },
  { symbol: "SPYx", name: "S&P 500 ETF", kind: "stock", chain: "ton", badge: "XSTOCKS", color: "#d6293b", pythSymbol: "SPY", pythType: "equity", yahoo: "SPY", sector: "Index ETF" },
  { symbol: "QQQx", name: "Nasdaq 100 ETF", kind: "stock", chain: "ton", badge: "XSTOCKS", color: "#1d6fd8", pythSymbol: "QQQ", pythType: "equity", yahoo: "QQQ", sector: "Index ETF" },
  { symbol: "AAPLx", name: "Apple", kind: "stock", chain: "ton", badge: "XSTOCKS", color: "#111111", pythSymbol: "AAPL", pythType: "equity", yahoo: "AAPL", sector: "Technology" },
  { symbol: "NVDAx", name: "NVIDIA", kind: "stock", chain: "ton", badge: "XSTOCKS", color: "#76b900", pythSymbol: "NVDA", pythType: "equity", yahoo: "NVDA", sector: "Semiconductors" },
  { symbol: "TSLAx", name: "Tesla", kind: "stock", chain: "ton", badge: "XSTOCKS", color: "#cc0000", pythSymbol: "TSLA", pythType: "equity", yahoo: "TSLA", sector: "Automotive" },
  { symbol: "MSTRx", name: "Strategy", kind: "stock", chain: "ton", badge: "XSTOCKS", color: "#f7931a", pythSymbol: "MSTR", pythType: "equity", yahoo: "MSTR", sector: "Bitcoin treasury" },
  { symbol: "COINx", name: "Coinbase", kind: "stock", chain: "ton", badge: "XSTOCKS", color: "#0052ff", pythSymbol: "COIN", pythType: "equity", yahoo: "COIN", sector: "Exchanges" },
  { symbol: "GOOGLx", name: "Alphabet", kind: "stock", chain: "ton", badge: "XSTOCKS", color: "#4285f4", pythSymbol: "GOOGL", pythType: "equity", yahoo: "GOOGL", sector: "Technology" },
  { symbol: "HOODx", name: "Robinhood", kind: "stock", chain: "ton", badge: "XSTOCKS", color: "#00c805", pythSymbol: "HOOD", pythType: "equity", yahoo: "HOOD", sector: "Brokerage" },
  { symbol: "KOx", name: "Coca-Cola", kind: "stock", chain: "ton", badge: "XSTOCKS", color: "#f40009", pythSymbol: "KO", pythType: "equity", yahoo: "KO", sector: "Consumer staples" },

  // Commodities
  { symbol: "XAUt", name: "Tether Gold", kind: "commodity", chain: "ton", badge: "GOLD", color: "#c9a227", pythSymbol: "XAU", pythType: "metal", yahoo: "GC=F", coingecko: "tether-gold", tonSymbols: ["XAUt0", "XAUt", "XAUT"], sector: "Precious metals" },
  { symbol: "XAG", name: "Silver", kind: "commodity", chain: "ethereum", badge: "SILVER", color: "#9ea4ab", pythSymbol: "XAG", pythType: "metal", yahoo: "SI=F", sector: "Precious metals" },
  { symbol: "WTI", name: "Crude Oil", kind: "commodity", chain: "ethereum", badge: "OIL", color: "#2b2b2b", yahoo: "CL=F", sector: "Energy" },

  // TON jettons
  { symbol: "TON", name: "Toncoin", kind: "jetton", chain: "ton", badge: "NATIVE", color: "#0098ea", tonAddress: TON_ASSETS.TON, pythSymbol: "TON", pythType: "crypto", coingecko: "the-open-network" },
  { symbol: "USDT", name: "Tether USD", kind: "jetton", chain: "ton", badge: "STABLE", color: "#26a17b", tonAddress: TON_ASSETS.USDT, coingecko: "tether" },
  { symbol: "GRAM", name: "Gram", kind: "jetton", chain: "ton", badge: "JETTON", color: "#2f80ed", tonSymbols: ["GRAM"] },
  { symbol: "NOT", name: "Notcoin", kind: "jetton", chain: "ton", badge: "JETTON", color: "#000000", tonSymbols: ["NOT"], coingecko: "notcoin" },
  { symbol: "DOGS", name: "Dogs", kind: "jetton", chain: "ton", badge: "JETTON", color: "#3b3b3b", tonSymbols: ["DOGS"] },
  { symbol: "STON", name: "STON.fi", kind: "jetton", chain: "ton", badge: "JETTON", color: "#0b5cff", tonSymbols: ["STON"] },

  // Cross-chain majors
  { symbol: "BTC", name: "Bitcoin", kind: "crypto", chain: "ethereum", badge: "CROSS-CHAIN", color: "#f7931a", pythSymbol: "BTC", pythType: "crypto", coingecko: "bitcoin", tonSymbols: ["tgBTC", "jWBTC"] },
  { symbol: "ETH", name: "Ether", kind: "crypto", chain: "ethereum", badge: "CROSS-CHAIN", color: "#627eea", pythSymbol: "ETH", pythType: "crypto", coingecko: "ethereum", tonSymbols: ["jWETH", "WETH"] },
  { symbol: "SOL", name: "Solana", kind: "crypto", chain: "solana", badge: "CROSS-CHAIN", color: "#9945ff", pythSymbol: "SOL", pythType: "crypto", coingecko: "solana" },
  { symbol: "ZEC", name: "Zcash", kind: "crypto", chain: "ethereum", badge: "CROSS-CHAIN", color: "#e8b30f", pythSymbol: "ZEC", pythType: "crypto", coingecko: "zcash" },
];

export const PAIR_KIND_LABEL: Record<PairAsset["kind"], string> = {
  stock: "Stocks & ETFs",
  commodity: "Commodities",
  jetton: "TON jettons",
  crypto: "Cross-chain",
};

/** Deterministic identity color for tokens we have no brand color for. */
export function colorFor(key: string) {
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `hsl(${h % 360} 55% 45%)`;
}

/** A PairAsset shell for an arbitrary quote token (e.g. a pool's quote jetton). */
export function adHocAsset(symbol: string, opts: Partial<PairAsset> = {}): PairAsset {
  const def = ASSET_DEFS.find((a) => a.symbol.toLowerCase() === symbol.toLowerCase() || (symbol === "USD₮" && a.symbol === "USDT"));
  if (def) return { ...def, priceUsd: null, change24h: null, ...opts };
  return { symbol, name: symbol, kind: "jetton", chain: "ton", badge: "JETTON", color: colorFor(symbol), priceUsd: null, change24h: null, ...opts };
}

export const PAY_ASSETS = ["TON", "USDT", "GRAM", "USDC"] as const;
export type PayAsset = (typeof PAY_ASSETS)[number];
