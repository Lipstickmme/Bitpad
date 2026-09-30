import "server-only";
import type { ChainId } from "./types";
import { dsChain, dsSearch, type DsPair } from "./data/dexscreener";
import { memo, safe } from "./data/http";

/**
 * Tokenized stocks and commodities living on Solana and EVM chains, plus the
 * popular tokens that trade against them (e.g. launches paired with xStocks).
 * Found live through DexScreener search. A token counts only when its symbol
 * matches exactly and its best pool holds real liquidity, so copycats with a
 * look-alike symbol and an empty pool are dropped.
 */
const TICKERS = ["TSLA", "NVDA", "AAPL", "SPY", "QQQ", "MSTR", "COIN", "GOOGL", "META", "AMZN", "MSFT", "HOOD", "CRCL"];
const ISSUERS: { suffix: string; issuer: string }[] = [
  { suffix: "x", issuer: "xStocks" },
  { suffix: "on", issuer: "Ondo" },
];
const COMMODITIES: Record<string, { name: string; issuer: string; underlying: string }> = {
  PAXG: { name: "PAX Gold", issuer: "Paxos", underlying: "Gold" },
  XAUT: { name: "Tether Gold", issuer: "Tether", underlying: "Gold" },
  XAUT0: { name: "Tether Gold (OFT)", issuer: "Tether", underlying: "Gold" },
};
const CHAINS: ChainId[] = ["solana", "ethereum", "base", "bsc", "arbitrum", "polygon", "avalanche"];
const MIN_LIQ_ASSET = 20_000;
const MIN_LIQ_PAIRED = 5_000;
const MIN_VOL_PAIRED = 1_000;

export interface XStock {
  symbol: string;
  name: string;
  kind: "stock" | "commodity";
  issuer: string;
  underlying: string;
  chain: ChainId;
  address: string;
  image?: string;
  priceUsd: number | null;
  change24h: number | null;
  liquidityUsd: number;
  volume24h: number;
  url: string;
}

export interface StockPaired {
  chain: ChainId;
  dex: string;
  base: string;
  baseName: string;
  baseAddress: string;
  quote: string;
  pairAddress: string;
  image?: string;
  priceUsd: number | null;
  change24h: number | null;
  liquidityUsd: number;
  volume24h: number;
  marketCap: number | null;
  url: string;
}

function identify(symbol: string): { kind: "stock" | "commodity"; issuer: string; underlying: string; name?: string } | null {
  const up = symbol.toUpperCase();
  const c = COMMODITIES[up];
  if (c) return { kind: "commodity", issuer: c.issuer, underlying: c.underlying, name: c.name };
  for (const t of TICKERS)
    for (const i of ISSUERS) if (symbol.toLowerCase() === (t + i.suffix).toLowerCase()) return { kind: "stock", issuer: i.issuer, underlying: t };
  return null;
}

export async function getXChainStocks(): Promise<{ assets: XStock[]; paired: StockPaired[]; live: boolean }> {
  return memo("xchain-stocks", 300_000, load);
}

async function load() {
  const queries = [...TICKERS.flatMap((t) => ISSUERS.map((i) => t + i.suffix)), ...Object.keys(COMMODITIES)];
  const res = await Promise.all(queries.map((q) => safe(dsSearch(q), [] as DsPair[], `ds search ${q}`)));
  const pairs = new Map<string, DsPair>();
  for (const r of res) for (const p of r.value) pairs.set(`${p.chainId}:${p.pairAddress}`, p);

  const assets = new Map<string, XStock>();
  const paired = new Map<string, StockPaired>();
  for (const p of pairs.values()) {
    const chain = dsChain(p.chainId);
    if (!chain || !CHAINS.includes(chain)) continue;
    const liq = p.liquidity?.usd ?? 0;
    const base = identify(p.baseToken.symbol);
    if (base) {
      if (liq < MIN_LIQ_ASSET) continue;
      const k = `${chain}:${p.baseToken.address.toLowerCase()}`;
      const prev = assets.get(k);
      const vol = (prev?.volume24h ?? 0) + (p.volume?.h24 ?? 0);
      if (!prev || prev.liquidityUsd < liq)
        assets.set(k, {
          symbol: p.baseToken.symbol, name: base.name ?? p.baseToken.name, kind: base.kind, issuer: base.issuer, underlying: base.underlying,
          chain, address: p.baseToken.address, image: p.info?.imageUrl,
          priceUsd: p.priceUsd ? Number(p.priceUsd) : null, change24h: p.priceChange?.h24 ?? null,
          liquidityUsd: liq, volume24h: vol, url: p.url,
        });
      else prev.volume24h = vol;
      continue;
    }
    // A non-stock token quoted in a stock token: the "paired with stocks" launches
    if (identify(p.quoteToken.symbol) && liq >= MIN_LIQ_PAIRED && (p.volume?.h24 ?? 0) >= MIN_VOL_PAIRED) {
      const k = `${chain}:${p.baseToken.address.toLowerCase()}`;
      if (!paired.has(k) || paired.get(k)!.liquidityUsd < liq)
        paired.set(k, {
          chain, dex: p.dexId, base: p.baseToken.symbol, baseName: p.baseToken.name, baseAddress: p.baseToken.address, quote: p.quoteToken.symbol,
          pairAddress: p.pairAddress, image: p.info?.imageUrl, priceUsd: p.priceUsd ? Number(p.priceUsd) : null, change24h: p.priceChange?.h24 ?? null,
          liquidityUsd: liq, volume24h: p.volume?.h24 ?? 0, marketCap: p.marketCap ?? p.fdv ?? null, url: p.url,
        });
    }
  }
  return {
    assets: [...assets.values()].sort((a, b) => b.liquidityUsd - a.liquidityUsd),
    paired: [...paired.values()].sort((a, b) => b.volume24h - a.volume24h).slice(0, 30),
    live: res.some((r) => r.ok),
  };
}
