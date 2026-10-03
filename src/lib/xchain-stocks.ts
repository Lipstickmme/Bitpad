import "server-only";
import type { ChainId } from "./types";
import { dsChain, dsSearch, type DsPair } from "./data/dexscreener";
import { memo, safe } from "./data/http";
import { verifiedOn } from "./verify";
import { cgListed } from "./data/coingecko";

/**
 * Tokenized stocks and commodities living on Solana and EVM chains, plus the
 * popular tokens that trade against them (e.g. launches paired with xStocks).
 * Found live through DexScreener search, then checked: only the genuine
 * contract counts (Jupiter-verified on Solana, CoinGecko-listed under the same
 * ticker on EVM chains). Copycats with a borrowed ticker are dropped even when
 * they have liquidity. One token per asset per chain is kept: the most liquid
 * one, which is the cheapest to buy (least price impact for the same route fee).
 * "Paired" tokens count only when they trade against that genuine token.
 */
const TICKERS = [
  // big tech & index
  "TSLA", "NVDA", "AAPL", "SPY", "QQQ", "GOOGL", "META", "AMZN", "MSFT", "NFLX",
  // AI
  "PLTR", "AMD", "AVGO", "ORCL", "CRWV", "SMCI", "ARM", "TSM", "MRVL", "CRWD", "INTC",
  // meme favourites
  "GME", "AMC", "OPEN",
  // innovation: biotech, space, quantum, nuclear
  "LLY", "NVO", "MRNA", "CRSP", "RKLB", "IONQ", "OKLO",
  // crypto-linked
  "MSTR", "COIN", "HOOD", "CRCL", "IBIT",
  // popular
  "KO", "MCD", "JPM", "V", "WMT",
  // metals ETFs
  "GLD", "SLV", "IAU",
];
const ISSUERS: { suffix: string; issuer: string }[] = [
  { suffix: "x", issuer: "xStocks" },
  { suffix: "on", issuer: "Ondo" },
];
const COMMODITIES: Record<string, { name: string; issuer: string; underlying: string }> = {
  PAXG: { name: "PAX Gold", issuer: "Paxos", underlying: "Gold" },
  XAUT: { name: "Tether Gold", issuer: "Tether", underlying: "Gold" },
  XAUT0: { name: "Tether Gold (OFT)", issuer: "Tether", underlying: "Gold" },
  KAU: { name: "Kinesis Gold", issuer: "Kinesis", underlying: "Gold" },
  KAG: { name: "Kinesis Silver", issuer: "Kinesis", underlying: "Silver" },
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
  /** Genuine contract (Jupiter-verified / CoinGecko-listed) */
  verified?: boolean;
  /** When its oldest seen pool was created (ms) */
  createdAt?: number;
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
  createdAt?: number;
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
  return memo("xchain-stocks", 600_000, load);
}

async function load() {
  const queries = [...TICKERS.flatMap((t) => ISSUERS.map((i) => t + i.suffix)), ...Object.keys(COMMODITIES)];
  const res = await Promise.all(queries.map((q) => safe(dsSearch(q), [] as DsPair[], `ds search ${q}`)));
  const pairs = new Map<string, DsPair>();
  for (const r of res) for (const p of r.value) pairs.set(`${p.chainId}:${p.pairAddress}`, p);

  const assets = new Map<string, XStock>();
  const paired = new Map<string, StockPaired & { quoteAddress: string }>();
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
          liquidityUsd: liq, volume24h: vol, url: p.url, createdAt: Math.min(prev?.createdAt ?? Infinity, p.pairCreatedAt ?? Infinity),
        });
      else {
        prev.volume24h = vol;
        if (p.pairCreatedAt && (!prev.createdAt || p.pairCreatedAt < prev.createdAt)) prev.createdAt = p.pairCreatedAt;
      }
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
          createdAt: p.pairCreatedAt, quoteAddress: p.quoteToken.address,
        });
    }
  }
  // Keep only genuine contracts…
  const genuine: XStock[] = [];
  for (const chain of CHAINS) {
    const list = [...assets.values()].filter((a) => a.chain === chain);
    const ok = await verifiedOn(chain, list.map((a) => a.address));
    for (const a of list) {
      if (!ok.has(a.address)) continue;
      // on EVM the CoinGecko listing must also carry this ticker (not a different coin at that address)
      if (chain !== "solana") {
        const cg = await cgListed(chain, a.address);
        if (!cg || cg.symbol.toLowerCase() !== a.symbol.toLowerCase()) continue;
      }
      genuine.push({ ...a, verified: true, createdAt: Number.isFinite(a.createdAt) ? a.createdAt : undefined });
    }
  }
  // …and one per asset per chain: the most liquid issuer's token
  const best = new Map<string, XStock>();
  for (const a of genuine) {
    const k = `${a.chain}:${a.kind}:${a.underlying}`;
    const cur = best.get(k);
    if (!cur || cur.liquidityUsd < a.liquidityUsd) best.set(k, a);
  }
  const kept = [...best.values()];
  const keptAddr = new Set(kept.map((a) => `${a.chain}:${a.address.toLowerCase()}`));
  return {
    assets: kept.sort((a, b) => b.liquidityUsd - a.liquidityUsd),
    paired: [...paired.values()]
      .filter((p) => keptAddr.has(`${p.chain}:${p.quoteAddress.toLowerCase()}`))
      .map(({ quoteAddress: _q, ...p }) => p)
      .sort((a, b) => b.volume24h - a.volume24h)
      .slice(0, 30),
    live: res.some((r) => r.ok),
  };
}
