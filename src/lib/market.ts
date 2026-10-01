import "server-only";
import { adHocAsset } from "./assets";
import { getPairAssets } from "./prices";
import { getLaunches, type Launch } from "./launches";
import { creatorProfile } from "./creators";
import { poolOhlcv, poolTrades, tokenPools, tokensMulti, topPools, trendingPools, type GeckoPoolRow } from "./data/gecko";
import { dsTokenPairs } from "./data/dexscreener";
import { isSafe, ston, stonAsset, stonAssets, stonPoolSwaps } from "./data/stonfi";
import { friendly, jettonHolders, jettonInfo, rateChart } from "./data/tonapi";
import { tcJettonHolders, tcJettonMaster } from "./data/toncenter";
import { firstOf, memo, safe } from "./data/http";
import { TON_ASSETS } from "./config";
import { eventsToCandles, eventsToTrades, poolEvents, readPool } from "./bitpad";
import { spotPrice } from "./bitpad-math";
import type { Candle, Holder, MarketToken, PairAsset, Trade } from "./types";

const TON_LIKE = new Set(["TON", "PTON", "WTON", "PROXY_TON"]);
const isTonAddr = (a?: string) => !!a && (a === TON_ASSETS.TON || /^(EQ|UQ)AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/.test(a));

async function pairFor(symbol: string, address?: string, priceUsd?: number | null, image?: string): Promise<PairAsset> {
  const { assets } = await getPairAssets();
  const sym = TON_LIKE.has(symbol.toUpperCase()) || isTonAddr(address) ? "TON" : symbol === "USD₮" ? "USDT" : symbol;
  const known = assets.find((a) => (address && a.tonAddress === address) || a.symbol.toLowerCase() === sym.toLowerCase());
  if (known) return known;
  return adHocAsset(sym, { tonAddress: address, priceUsd: priceUsd ?? null, image });
}

async function fromPool(p: GeckoPoolRow, source: string): Promise<MarketToken> {
  return {
    address: p.baseAddress,
    symbol: p.base,
    name: p.baseName,
    image: p.baseImage,
    decimals: 9,
    totalSupply: null,
    holders: null,
    pair: await pairFor(p.quote, p.quoteAddress, p.quotePriceUsd, p.quoteImage),
    poolAddress: p.poolAddress,
    poolSide: "base",
    dex: p.dexId,
    priceUsd: p.priceUsd || null,
    marketCap: p.marketCap,
    fdv: p.fdv || null,
    liquidityUsd: p.liquidityUsd || null,
    volume24h: p.volume24h,
    volume1h: p.volume1h,
    change24h: p.change24h,
    changes: { m5: p.changeM5, h1: p.change1h, h6: p.changeH6, h24: p.change24h },
    buys24h: p.buys24h,
    sells24h: p.sells24h,
    createdAt: Number.isFinite(p.createdAt) ? p.createdAt : undefined,
    sources: [source],
  };
}

/** Keep the most liquid pool per base token; drop pools whose base is TON or a stablecoin. */
function bestPerToken(rows: GeckoPoolRow[]) {
  const best = new Map<string, GeckoPoolRow>();
  for (const r of rows) {
    if (TON_LIKE.has(r.base.toUpperCase()) || r.quoteKind === "stable" && r.baseAddress === TON_ASSETS.USDT) continue;
    if (r.baseAddress === TON_ASSETS.USDT) continue;
    const cur = best.get(r.baseAddress);
    if (!cur || cur.liquidityUsd < r.liquidityUsd) best.set(r.baseAddress, r);
  }
  return [...best.values()];
}

/** STON.fi fallback: pools with 24h volume + asset list for prices/images. */
async function stonMarket(): Promise<MarketToken[]> {
  const [pools, assets] = await Promise.all([memo("ston:pools", 5 * 60_000, () => ston.getPools()), stonAssets()]);
  const byAddr = new Map(assets.map((a) => [a.contractAddress, a]));
  const rows: MarketToken[] = [];
  for (const p of pools.filter((x) => !x.deprecated).sort((a, b) => Number(b.volume24HUsd ?? 0) - Number(a.volume24HUsd ?? 0)).slice(0, 200)) {
    const [a0, a1] = [byAddr.get(p.token0Address), byAddr.get(p.token1Address)];
    if (!a0 || !a1) continue;
    // base = the non-TON / non-stable side
    const baseIsA1 = a0.kind === "Ton" || a0.kind === "Wton" || a0.contractAddress === TON_ASSETS.USDT || /^pTON$/i.test(a0.symbol);
    const [b, q] = baseIsA1 ? [a1, a0] : [a0, a1];
    if (!isSafe(b) || b.contractAddress === TON_ASSETS.USDT) continue;
    rows.push({
      address: b.contractAddress, symbol: b.symbol, name: b.displayName ?? b.symbol, image: b.imageUrl, decimals: b.decimals,
      totalSupply: null, holders: null,
      pair: await pairFor(q.symbol, q.contractAddress, q.dexPriceUsd ? Number(q.dexPriceUsd) : null, q.imageUrl),
      poolAddress: p.address, dex: "stonfi",
      priceUsd: b.dexPriceUsd ? Number(b.dexPriceUsd) : null, marketCap: null, fdv: null,
      liquidityUsd: p.lpTotalSupplyUsd ? Number(p.lpTotalSupplyUsd) : null,
      volume24h: p.volume24HUsd ? Number(p.volume24HUsd) : null,
      change24h: null, buys24h: null, sells24h: null, sources: ["STON.fi"],
    });
  }
  const seen = new Set<string>();
  return rows.filter((r) => !seen.has(r.address) && seen.add(r.address));
}

/** Live TON market: GeckoTerminal → STON.fi. */
export async function getTonMarket(): Promise<{ tokens: MarketToken[]; source: string | null }> {
  const res = await firstOf<MarketToken[]>("ton market", [
    ["GeckoTerminal", async () => {
      // 20 pools per page; 7 pages ≈ 140 pools → ~100+ distinct tokens (cached 3 min by the fetch layer)
      const [first, ...rest] = await Promise.all([topPools("ton", 1), ...[2, 3, 4, 5, 6, 7].map((n) => topPools("ton", n).catch(() => [])), trendingPools("ton").catch(() => [])]);
      return Promise.all(bestPerToken([...first, ...rest.flat()]).map((p) => fromPool(p, "GeckoTerminal")));
    }],
    ["STON.fi", stonMarket],
  ], (v) => !!v?.length);
  return { tokens: res.value ?? [], source: res.source };
}

/** Bitpad launches with market data computed from their pools on-chain. */
export async function getBitpadTokens(): Promise<{ tokens: MarketToken[]; count: number; factory: string | null; ok: boolean }> {
  return memo("bitpad:tokens", 20_000, async () => {
    const { launches, count, factory, ok } = await getLaunches(100);
    const tokens = (await Promise.all(launches.map((l) => bitpadToken(l).catch(() => null)))).filter((t): t is MarketToken => !!t);
    return { tokens, count, factory, ok };
  });
}

/** Launch metadata is user-supplied: only plain https links are passed on. */
const safeUrl = (u?: string) => (u && /^https:\/\/[^\s"'<>]+$/.test(u) ? u : undefined);

/** Build a MarketToken for a Bitpad launch from BitpadPool state + Swapped events. */
async function bitpadToken(l: Launch): Promise<MarketToken> {
  const [pool, meta] = await Promise.all([l.pool ? readPool(l.pool).catch(() => null) : null, jettonInfo(l.minter).catch(() => null)]);
  const pair = await pairFor(pool?.pairMaster ? l.meta.bitpad_pair ?? "?" : "TON", pool?.pairMaster ?? TON_ASSETS.TON);
  const pairUsd = pair.priceUsd;
  const supply = l.supply ? Number(l.supply) / 1e9 : null;
  let priceUsd: number | null = null;
  let liquidityUsd: number | null = null;
  let volume24h: number | null = null;
  let change24h: number | null = null;
  let buys = 0;
  let sells = 0;
  let created: number | undefined;
  let source: string | null = null;
  if (pool) {
    const st = { reserveToken: BigInt(pool.reserveToken), reservePair: BigInt(pool.reservePair) };
    const pxPair = spotPrice(st, pool.pairDecimals);
    priceUsd = pairUsd != null ? pxPair * pairUsd : null;
    liquidityUsd = pairUsd != null ? 2 * (Number(st.reservePair) / 10 ** pool.pairDecimals) * pairUsd : null;
    const ev = await poolEvents(pool.address);
    source = ev.source;
    const dayAgo = Date.now() - 86_400_000;
    const recent = ev.events.filter((e) => e.time >= dayAgo);
    buys = recent.filter((e) => e.buy).length;
    sells = recent.length - buys;
    const pairVol = recent.reduce((acc, e) => acc + Number(e.buy ? e.amountIn : e.amountOut) / 10 ** pool.pairDecimals, 0);
    volume24h = pairUsd != null ? pairVol * pairUsd : null;
    // price 24h ago = price after the last trade before the window (or the oldest trade we have)
    const before = ev.events.find((e) => e.time < dayAgo) ?? ev.events[ev.events.length - 1];
    if (before && pxPair) change24h = ((pxPair - spotPrice(before, pool.pairDecimals)) / spotPrice(before, pool.pairDecimals)) * 100;
    created = ev.events.length ? ev.events[ev.events.length - 1].time : undefined;
  }
  return {
    address: l.minter,
    symbol: l.meta.symbol ?? meta?.metadata.symbol ?? "?",
    name: l.meta.name ?? meta?.metadata.name ?? "Unnamed",
    image: l.meta.image || meta?.metadata.image,
    description: l.meta.description ?? meta?.metadata.description,
    decimals: 9,
    totalSupply: supply,
    holders: meta?.holders_count ?? null,
    pair,
    poolAddress: pool?.address,
    poolSide: "base",
    dex: "bitpad",
    priceUsd,
    marketCap: priceUsd != null && supply ? priceUsd * supply : null,
    fdv: priceUsd != null && supply ? priceUsd * supply : null,
    liquidityUsd,
    volume24h,
    change24h,
    buys24h: pool ? buys : null,
    sells24h: pool ? sells : null,
    createdAt: created,
    bitpad: {
      ...(pool
        ? { index: l.index, creator: pool.creator, pool: pool.address, pairMaster: pool.pairMaster, pairDecimals: pool.pairDecimals, tradingOpen: pool.tradingOpen, protocolFeeBps: pool.protocolFeeBps, creatorFeeBps: pool.creatorFeeBps }
        : { index: l.index, creator: l.creator, pool: l.pool }),
      creatorJetton: creatorProfile(l),
    },
    ...(safeUrl(l.meta.telegram) || safeUrl(l.meta.x) ? { socials: { telegram: safeUrl(l.meta.telegram), x: safeUrl(l.meta.x) } } : {}),
    sources: ["Bitpad pool (on-chain)", source ? `trades via ${source}` : ""].filter(Boolean),
  };
}

interface JMeta {
  name?: string;
  symbol?: string;
  image?: string;
  description?: string;
  decimals: number;
  supply?: string;
  holders: number | null;
  social?: string[];
  websites?: string[];
}

/** Full detail for any TON jetton. */
export async function getToken(address: string): Promise<MarketToken | undefined> {
  const addr = normalise(address);
  if (!addr) return undefined;
  const [launches, meta, pools] = await Promise.all([
    getLaunches(),
    firstOf<JMeta | null | undefined>("jetton meta", [
      ["TonAPI", async () => { const j = await jettonInfo(addr); return { name: j.metadata.name, symbol: j.metadata.symbol, image: j.metadata.image, description: j.metadata.description, decimals: Number(j.metadata.decimals ?? 9), supply: j.total_supply, holders: j.holders_count, social: j.metadata.social, websites: j.metadata.websites }; }],
      ["toncenter", async () => { const m = await tcJettonMaster(addr); return m && { name: m.name, symbol: m.symbol, image: m.image, description: m.description, decimals: m.decimals, supply: m.totalSupply, holders: null as number | null, social: undefined, websites: undefined }; }],
      ["STON.fi", async () => { const a = await stonAsset(addr); return a && { name: a.displayName, symbol: a.symbol, image: a.imageUrl, description: undefined, decimals: a.decimals, supply: undefined, holders: null as number | null, social: undefined, websites: undefined }; }],
    ], (v) => !!v?.symbol),
    firstOf<GeckoPoolRow[]>("token pools", [
      ["GeckoTerminal", () => tokenPools("ton", addr)],
      ["DexScreener", () => dsTokenPairs("ton", [addr])],
    ], (v) => !!v?.length),
  ]);
  const m = meta.value;
  const launch = launches.launches.find((l) => l.minter === addr);
  // Bitpad launches trade on their own pool — build the token from chain state
  if (launch?.pool) return bitpadToken(launch);
  const top = pools.value?.sort((a, b) => b.liquidityUsd - a.liquidityUsd)[0];
  if (!m && !top && !launch) return undefined;

  // token may be the quote side of its best pool
  const isBase = !top || top.baseAddress === addr;
  const priceUsd = top ? (isBase ? top.priceUsd : top.quotePriceUsd) : null;
  const decimals = m?.decimals ?? 9;
  const supply = m?.supply ? Number(m.supply) / 10 ** decimals : null;
  const stonPx = priceUsd ? null : await stonAsset(addr).then((a) => (a?.dexPriceUsd ? Number(a.dexPriceUsd) : null)).catch(() => null);
  const px = priceUsd || stonPx;
  const pair = launch
    ? await pairFor(launch.meta.bitpad_pair ?? "TON", launch.pairAddress)
    : top ? await pairFor(isBase ? top.quote : top.base, isBase ? top.quoteAddress : top.baseAddress, isBase ? top.quotePriceUsd : top.priceUsd, isBase ? top.quoteImage : top.baseImage)
    : await pairFor("TON");

  const social = (m?.social ?? []).concat(m?.websites ?? []);
  return {
    address: addr,
    symbol: m?.symbol ?? top?.base ?? launch?.meta.symbol ?? "?",
    name: m?.name ?? top?.baseName ?? launch?.meta.name ?? "",
    image: m?.image ?? top?.baseImage,
    description: m?.description ?? launch?.meta.description,
    decimals,
    totalSupply: supply,
    holders: m?.holders ?? null,
    pair,
    poolAddress: top?.poolAddress,
    poolSide: top ? (isBase ? "base" : "quote") : undefined,
    dex: top?.dexId,
    priceUsd: px,
    marketCap: isBase ? top?.marketCap ?? (px && supply ? px * supply : null) : px && supply ? px * supply : null,
    fdv: px && supply ? px * supply : top?.fdv || null,
    liquidityUsd: top?.liquidityUsd ?? null,
    volume24h: top?.volume24h ?? null,
    change24h: isBase ? top?.change24h ?? null : null,
    changes: top && isBase ? { m5: top.changeM5, h1: top.change1h, h6: top.changeH6, h24: top.change24h } : undefined,
    buys24h: isBase ? top?.buys24h ?? null : top?.sells24h ?? null,
    sells24h: isBase ? top?.sells24h ?? null : top?.buys24h ?? null,
    createdAt: top && Number.isFinite(top.createdAt) ? top.createdAt : undefined,
    bitpad: launch ? { index: launch.index, creator: launch.creator } : undefined,
    socials: {
      telegram: social.find((s) => /t\.me\//.test(s)),
      x: social.find((s) => /(twitter|x)\.com\//.test(s)),
      website: social.find((s) => !/t\.me\/|twitter\.com|x\.com/.test(s)),
    },
    sources: [meta.source, pools.source, stonPx ? "STON.fi" : null, launch ? "Bitpad factory" : null].filter((x): x is string => !!x),
  };
}

function normalise(a: string) {
  try {
    // accept raw 0:… or any friendly form; GeckoTerminal/DexScreener use bounceable EQ…
    return friendly(decodeURIComponent(a).trim());
  } catch {
    return null;
  }
}

import { TIMEFRAMES, type Timeframe } from "./timeframes";
export { TIMEFRAMES, type Timeframe };

/** Candles: GeckoTerminal OHLCV → TonAPI price chart (line → candles). */
export async function getCandles(token: MarketToken, tf: Timeframe): Promise<{ candles: Candle[]; source: string | null }> {
  const [unit, agg, step] = TIMEFRAMES[tf];
  if (token.bitpad?.pool) {
    const ev = await poolEvents(token.bitpad.pool);
    return { candles: eventsToCandles(ev.events, token.bitpad.pairDecimals ?? 9, token.pair.priceUsd, step), source: ev.source ? `Bitpad pool · ${ev.source}` : null };
  }
  const res = await firstOf<Candle[]>("candles", [
    ["GeckoTerminal", async () => {
      if (!token.poolAddress) return [];
      return poolOhlcv("ton", token.poolAddress, unit, agg, token.poolSide ?? "base");
    }],
    ["TonAPI", async () => {
      const end = Math.floor(Date.now() / 1000);
      const pts = await rateChart(token.address, end - step * 200, end, 200);
      return pts.map(([t, p], i) => {
        const o = i ? pts[i - 1][1] : p;
        return { time: t, open: o, close: p, high: Math.max(o, p), low: Math.min(o, p), volume: 0 };
      });
    }],
  ], (v) => !!v?.length);
  return { candles: res.value ?? [], source: res.source };
}

/** Trades: GeckoTerminal → STON.fi operations for the pool. */
export async function getTrades(token: MarketToken): Promise<{ trades: Trade[]; source: string | null }> {
  if (token.bitpad?.pool) {
    const ev = await poolEvents(token.bitpad.pool);
    return { trades: eventsToTrades(ev.events.slice(0, 100), token.bitpad.pairDecimals ?? 9, token.pair.priceUsd, "Bitpad"), source: ev.source };
  }
  if (!token.poolAddress) return { trades: [], source: null };
  const res = await firstOf<Trade[]>("trades", [
    ["GeckoTerminal", async () => {
      const t = await poolTrades("ton", token.poolAddress!, token.dex ?? "DEX");
      if (token.poolSide !== "quote") return t;
      // GeckoTerminal reports from the base token's side; flip when our token is the quote
      return t.map((x) => ({ ...x, side: x.side === "buy" ? "sell" : "buy", amountToken: token.priceUsd ? x.amountUsd / token.priceUsd : 0, priceUsd: token.priceUsd ?? 0 }));
    }],
    ["STON.fi", async () => {
      const ops = await stonPoolSwaps(token.poolAddress!, 180);
      return ops.map((o): Trade => {
        const op = o.operation;
        const mine0 = op.asset0Address === token.address;
        const delta = BigInt(mine0 ? op.asset0Delta : op.asset1Delta);
        const amountToken = Number(delta < 0n ? -delta : delta) / 10 ** token.decimals;
        return {
          id: op.poolTxHash,
          time: Date.parse(op.poolTxTimestamp),
          side: delta < 0n ? "buy" : "sell", // pool paid tokens out → user bought
          wallet: op.walletAddress,
          amountToken,
          amountUsd: token.priceUsd ? amountToken * token.priceUsd : 0,
          priceUsd: token.priceUsd ?? 0,
          route: "STON.fi",
          txHash: op.walletTxHash,
        };
      }).sort((a, b) => b.time - a.time);
    }],
  ], (v) => !!v?.length);
  return { trades: res.value ?? [], source: res.source };
}

/** Top holders: TonAPI → toncenter v3. */
export async function getHolders(token: MarketToken): Promise<{ holders: Holder[]; total: number | null; source: string | null }> {
  const res = await firstOf<{ rows: { owner: string; name?: string; balance: string }[]; total: number | null }>("holders", [
    ["TonAPI", async () => jettonHolders(token.address, 25)],
    ["toncenter", async () => ({ rows: await tcJettonHolders(token.address, 25), total: null })],
  ], (v) => !!v?.rows.length);
  const supply = token.totalSupply;
  const pool = token.poolAddress;
  return {
    total: res.value?.total ?? token.holders,
    source: res.source,
    holders: (res.value?.rows ?? []).map((r) => {
      const amount = Number(r.balance) / 10 ** token.decimals;
      const owner = friendly(r.owner);
      return {
        address: owner,
        label: pool && friendly(pool) === owner ? `${token.dex ?? "DEX"} pool` : r.name,
        amount,
        share: supply ? (amount / supply) * 100 : null,
      };
    }),
  };
}

/** Search TON jettons by symbol, name or address (STON.fi asset list). */
export async function searchTokens(q: string) {
  const s = q.trim().toLowerCase();
  if (!s) return [];
  const list = await stonAssets();
  return list
    .filter((a) => isSafe(a) && a.kind === "Jetton" && (a.symbol.toLowerCase().includes(s) || (a.displayName ?? "").toLowerCase().includes(s) || a.contractAddress.toLowerCase() === s))
    .sort((a, b) => Number(b.symbol.toLowerCase() === s) - Number(a.symbol.toLowerCase() === s) || (b.popularityIndex ?? 0) - (a.popularityIndex ?? 0))
    .slice(0, 10)
    .map((a) => ({ address: a.contractAddress, symbol: a.symbol, name: a.displayName ?? a.symbol, image: a.imageUrl, priceUsd: a.dexPriceUsd ? Number(a.dexPriceUsd) : null }));
}
