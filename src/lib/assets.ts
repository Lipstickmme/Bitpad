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
  { symbol: "METAx", name: "Meta", kind: "stock", chain: "ton", badge: "XSTOCKS", color: "#0866ff", pythSymbol: "META", pythType: "equity", yahoo: "META", sector: "Technology", theme: "AI" },
  { symbol: "MSFTx", name: "Microsoft", kind: "stock", chain: "ton", badge: "XSTOCKS", color: "#00a4ef", pythSymbol: "MSFT", pythType: "equity", yahoo: "MSFT", sector: "Technology", theme: "AI" },
  { symbol: "AMZNx", name: "Amazon", kind: "stock", chain: "ton", badge: "XSTOCKS", color: "#ff9900", pythSymbol: "AMZN", pythType: "equity", yahoo: "AMZN", sector: "Consumer", theme: "Popular" },
  { symbol: "SPYx", name: "S&P 500 ETF", kind: "stock", chain: "ton", badge: "XSTOCKS", color: "#d6293b", pythSymbol: "SPY", pythType: "equity", yahoo: "SPY", sector: "Index ETF", theme: "Index" },
  { symbol: "QQQx", name: "Nasdaq 100 ETF", kind: "stock", chain: "ton", badge: "XSTOCKS", color: "#1d6fd8", pythSymbol: "QQQ", pythType: "equity", yahoo: "QQQ", sector: "Index ETF", theme: "Index" },
  { symbol: "AAPLx", name: "Apple", kind: "stock", chain: "ton", badge: "XSTOCKS", color: "#111111", pythSymbol: "AAPL", pythType: "equity", yahoo: "AAPL", sector: "Technology", theme: "Popular" },
  { symbol: "NVDAx", name: "NVIDIA", kind: "stock", chain: "ton", badge: "XSTOCKS", color: "#76b900", pythSymbol: "NVDA", pythType: "equity", yahoo: "NVDA", sector: "Semiconductors", theme: "AI" },
  { symbol: "TSLAx", name: "Tesla", kind: "stock", chain: "ton", badge: "XSTOCKS", color: "#cc0000", pythSymbol: "TSLA", pythType: "equity", yahoo: "TSLA", sector: "Automotive", theme: "Innovation" },
  { symbol: "MSTRx", name: "Strategy", kind: "stock", chain: "ton", badge: "XSTOCKS", color: "#f7931a", pythSymbol: "MSTR", pythType: "equity", yahoo: "MSTR", sector: "Bitcoin treasury", theme: "Crypto-linked" },
  { symbol: "COINx", name: "Coinbase", kind: "stock", chain: "ton", badge: "XSTOCKS", color: "#0052ff", pythSymbol: "COIN", pythType: "equity", yahoo: "COIN", sector: "Exchanges", theme: "Crypto-linked" },
  { symbol: "GOOGLx", name: "Alphabet", kind: "stock", chain: "ton", badge: "XSTOCKS", color: "#4285f4", pythSymbol: "GOOGL", pythType: "equity", yahoo: "GOOGL", sector: "Technology", theme: "AI" },
  { symbol: "HOODx", name: "Robinhood", kind: "stock", chain: "ton", badge: "XSTOCKS", color: "#00c805", pythSymbol: "HOOD", pythType: "equity", yahoo: "HOOD", sector: "Brokerage", theme: "Crypto-linked" },
  { symbol: "KOx", name: "Coca-Cola", kind: "stock", chain: "ton", badge: "XSTOCKS", color: "#f40009", pythSymbol: "KO", pythType: "equity", yahoo: "KO", sector: "Consumer staples", theme: "Popular" },

  // More xStocks. Each is only shown and sold where a verified token exists
  // (STON.fi-verified on TON, Jupiter-verified on Solana); the rest drop out.
  { symbol: "GMEx", name: "GameStop", kind: "stock", chain: "ton", badge: "XSTOCKS", color: "#e41b23", pythSymbol: "GME", pythType: "equity", yahoo: "GME", sector: "Retail", theme: "Meme" },
  { symbol: "OPENx", name: "Opendoor", kind: "stock", chain: "ton", badge: "XSTOCKS", color: "#1c64f2", pythSymbol: "OPEN", pythType: "equity", yahoo: "OPEN", sector: "Real estate tech", theme: "Meme" },
  { symbol: "PLTRx", name: "Palantir", kind: "stock", chain: "ton", badge: "XSTOCKS", color: "#101113", pythSymbol: "PLTR", pythType: "equity", yahoo: "PLTR", sector: "AI software", theme: "AI" },
  { symbol: "AMDx", name: "AMD", kind: "stock", chain: "ton", badge: "XSTOCKS", color: "#ed1c24", pythSymbol: "AMD", pythType: "equity", yahoo: "AMD", sector: "Semiconductors", theme: "AI" },
  { symbol: "AVGOx", name: "Broadcom", kind: "stock", chain: "ton", badge: "XSTOCKS", color: "#cc092f", pythSymbol: "AVGO", pythType: "equity", yahoo: "AVGO", sector: "Semiconductors", theme: "AI" },
  { symbol: "ORCLx", name: "Oracle", kind: "stock", chain: "ton", badge: "XSTOCKS", color: "#c74634", pythSymbol: "ORCL", pythType: "equity", yahoo: "ORCL", sector: "AI cloud", theme: "AI" },
  { symbol: "MRVLx", name: "Marvell", kind: "stock", chain: "ton", badge: "XSTOCKS", color: "#c8102e", pythSymbol: "MRVL", pythType: "equity", yahoo: "MRVL", sector: "Semiconductors", theme: "AI" },
  { symbol: "CRWDx", name: "CrowdStrike", kind: "stock", chain: "ton", badge: "XSTOCKS", color: "#fc0000", pythSymbol: "CRWD", pythType: "equity", yahoo: "CRWD", sector: "Cybersecurity", theme: "AI" },
  { symbol: "INTCx", name: "Intel", kind: "stock", chain: "ton", badge: "XSTOCKS", color: "#0071c5", pythSymbol: "INTC", pythType: "equity", yahoo: "INTC", sector: "Semiconductors", theme: "AI" },
  { symbol: "LLYx", name: "Eli Lilly", kind: "stock", chain: "ton", badge: "XSTOCKS", color: "#d52b1e", pythSymbol: "LLY", pythType: "equity", yahoo: "LLY", sector: "Biotech & pharma", theme: "Innovation" },
  { symbol: "NVOx", name: "Novo Nordisk", kind: "stock", chain: "ton", badge: "XSTOCKS", color: "#001965", pythSymbol: "NVO", pythType: "equity", yahoo: "NVO", sector: "Biotech & pharma", theme: "Innovation" },
  { symbol: "AZNx", name: "AstraZeneca", kind: "stock", chain: "ton", badge: "XSTOCKS", color: "#830051", pythSymbol: "AZN", pythType: "equity", yahoo: "AZN", sector: "Biotech & pharma", theme: "Innovation" },
  { symbol: "MRKx", name: "Merck", kind: "stock", chain: "ton", badge: "XSTOCKS", color: "#00857c", pythSymbol: "MRK", pythType: "equity", yahoo: "MRK", sector: "Biotech & pharma", theme: "Innovation" },
  { symbol: "PFEx", name: "Pfizer", kind: "stock", chain: "ton", badge: "XSTOCKS", color: "#0093d0", pythSymbol: "PFE", pythType: "equity", yahoo: "PFE", sector: "Biotech & pharma", theme: "Innovation" },
  { symbol: "NFLXx", name: "Netflix", kind: "stock", chain: "ton", badge: "XSTOCKS", color: "#e50914", pythSymbol: "NFLX", pythType: "equity", yahoo: "NFLX", sector: "Media", theme: "Popular" },
  { symbol: "MCDx", name: "McDonald's", kind: "stock", chain: "ton", badge: "XSTOCKS", color: "#ffc72c", pythSymbol: "MCD", pythType: "equity", yahoo: "MCD", sector: "Consumer", theme: "Popular" },
  { symbol: "JPMx", name: "JPMorgan", kind: "stock", chain: "ton", badge: "XSTOCKS", color: "#5f4b3a", pythSymbol: "JPM", pythType: "equity", yahoo: "JPM", sector: "Banks", theme: "Popular" },
  { symbol: "Vx", name: "Visa", kind: "stock", chain: "ton", badge: "XSTOCKS", color: "#1a1f71", pythSymbol: "V", pythType: "equity", yahoo: "V", sector: "Payments", theme: "Popular" },
  { symbol: "WMTx", name: "Walmart", kind: "stock", chain: "ton", badge: "XSTOCKS", color: "#0071ce", pythSymbol: "WMT", pythType: "equity", yahoo: "WMT", sector: "Retail", theme: "Popular" },
  { symbol: "CRCLx", name: "Circle", kind: "stock", chain: "ton", badge: "XSTOCKS", color: "#3d5afe", pythSymbol: "CRCL", pythType: "equity", yahoo: "CRCL", sector: "Stablecoins", theme: "Crypto-linked" },
  { symbol: "GLDx", name: "SPDR Gold ETF", kind: "stock", chain: "ton", badge: "XSTOCKS", color: "#d4af37", pythSymbol: "GLD", pythType: "equity", yahoo: "GLD", sector: "Gold ETF", theme: "Metals" },

  // Commodities
  { symbol: "XAUt", name: "Tether Gold", kind: "commodity", chain: "ton", badge: "GOLD", color: "#c9a227", pythSymbol: "XAU", pythType: "metal", yahoo: "GC=F", coingecko: "tether-gold", tonSymbols: ["XAUt0", "XAUt", "XAUT"], sector: "Precious metals" },
  { symbol: "XAG", name: "Silver", kind: "commodity", chain: "ethereum", badge: "SILVER", color: "#9ea4ab", pythSymbol: "XAG", pythType: "metal", yahoo: "SI=F", sector: "Precious metals" },
  { symbol: "WTI", name: "Crude Oil", kind: "commodity", chain: "ethereum", badge: "OIL", color: "#2b2b2b", yahoo: "CL=F", sector: "Energy" },

  // TON jettons
  { symbol: "TON", name: "Gram (prev. Toncoin)", kind: "jetton", chain: "ton", badge: "NATIVE", color: "#0098ea", tonAddress: TON_ASSETS.TON, pythSymbol: "TON", pythType: "crypto", coingecko: "the-open-network" },
  { symbol: "USDT", name: "Tether USD", kind: "jetton", chain: "ton", badge: "STABLE", color: "#26a17b", tonAddress: TON_ASSETS.USDT, coingecko: "tether" },
  { symbol: "NOT", name: "Notcoin", kind: "jetton", chain: "ton", badge: "JETTON", color: "#000000", tonSymbols: ["NOT"], coingecko: "notcoin" },
  { symbol: "DOGS", name: "Dogs", kind: "jetton", chain: "ton", badge: "JETTON", color: "#3b3b3b", tonSymbols: ["DOGS"] },
  { symbol: "STON", name: "STON.fi", kind: "jetton", chain: "ton", badge: "JETTON", color: "#0b5cff", tonSymbols: ["STON"] },

  // Cross-chain majors
  { symbol: "BTC", name: "Bitcoin", kind: "crypto", chain: "ethereum", badge: "CROSS-CHAIN", color: "#f7931a", pythSymbol: "BTC", pythType: "crypto", coingecko: "bitcoin", tonSymbols: ["tgBTC", "jWBTC"], solSymbols: ["cbBTC", "WBTC"] },
  { symbol: "ETH", name: "Ether", kind: "crypto", chain: "ethereum", badge: "CROSS-CHAIN", color: "#627eea", pythSymbol: "ETH", pythType: "crypto", coingecko: "ethereum", tonSymbols: ["jWETH", "WETH"], solSymbols: ["WETH", "ETH"] },
  { symbol: "SOL", name: "Solana", kind: "crypto", chain: "solana", badge: "CROSS-CHAIN", color: "#9945ff", pythSymbol: "SOL", pythType: "crypto", coingecko: "solana" },
  { symbol: "ZEC", name: "Zcash", kind: "crypto", chain: "ethereum", badge: "CROSS-CHAIN", color: "#e8b30f", pythSymbol: "ZEC", pythType: "crypto", coingecko: "zcash" },
  { symbol: "BNB", name: "BNB", kind: "crypto", chain: "bsc", badge: "CROSS-CHAIN", color: "#f3ba2f", pythSymbol: "BNB", pythType: "crypto", coingecko: "binancecoin", tonSymbols: ["jBNB"] },
  { symbol: "TRX", name: "Tron", kind: "crypto", chain: "tron", badge: "CROSS-CHAIN", color: "#ff060a", pythSymbol: "TRX", pythType: "crypto", coingecko: "tron", tonSymbols: ["jTRX"] },
  { symbol: "XRP", name: "XRP", kind: "crypto", chain: "ethereum", badge: "CROSS-CHAIN", color: "#23292f", pythSymbol: "XRP", pythType: "crypto", coingecko: "ripple" },
  { symbol: "DOGE", name: "Dogecoin", kind: "crypto", chain: "ethereum", badge: "CROSS-CHAIN", color: "#c2a633", pythSymbol: "DOGE", pythType: "crypto", coingecko: "dogecoin", tonSymbols: ["jDOGE"] },
  { symbol: "USDC", name: "USD Coin (bridged)", kind: "crypto", chain: "ethereum", badge: "STABLE", color: "#2775ca", coingecko: "usd-coin", tonSymbols: ["jUSDC", "USDC"] },
  { symbol: "USDe", name: "Ethena USDe", kind: "crypto", chain: "ethereum", badge: "STABLE", color: "#111111", coingecko: "ethena-usde", tonSymbols: ["USDe"] },
];

export const PAIR_KIND_LABEL: Record<PairAsset["kind"], string> = {
  stock: "Stocks & ETFs",
  commodity: "Commodities",
  jetton: "TON jettons",
  crypto: "Cross-chain",
  creator: "Creator jettons",
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
