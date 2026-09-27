import { PAIR_ASSETS, findAsset } from "./assets";
import { fakeTonAddress, fakeTxHash, rngFor } from "./rng";
import type { BitpadToken, Candle, Holder, LaunchStatus, Trade } from "./types";

/**
 * Seeded preview catalogue. Shown until the Bitpad indexer / factory has live
 * launches; every record is tagged `source: "demo"` and the UI labels it.
 */
const SEEDS: { symbol: string; name: string; pair: string; mcap: number; status: LaunchStatus; desc: string; emoji: string }[] = [
  { symbol: "BITL", name: "Bitlievers", pair: "TON", mcap: 18_400_000, status: "trending", desc: "The flagship Bitlievers token. Fees from every Bitpad trade flow back to BITL holders.", emoji: "₿" },
  { symbol: "SPYCAT", name: "S&P Cat", pair: "SPYx", mcap: 9_870_000, status: "trending", desc: "A cat that only buys the index. Liquidity paired 1:1 against tokenized S&P 500.", emoji: "🐱" },
  { symbol: "GOLDY", name: "Goldy Locks", pair: "XAUt", mcap: 6_120_000, status: "live", desc: "Not too hot, not too cold. Every pool is backed by tokenized gold.", emoji: "🪙" },
  { symbol: "NVDOGE", name: "Nvidia Doge", pair: "NVDAx", mcap: 4_480_000, status: "trending", desc: "GPU-maxxing doge paired with tokenized NVIDIA.", emoji: "🐕" },
  { symbol: "GRAMPA", name: "Grampa", pair: "GRAM", mcap: 2_730_000, status: "live", desc: "The OG of TON. Paired with $GRAM.", emoji: "👴" },
  { symbol: "DIVI", name: "Dividend King", pair: "KO", mcap: 1_960_000, status: "live", desc: "Paired with a dividend aristocrat. Pool yield compounds from KO dividends.", emoji: "👑" },
  { symbol: "HOODIE", name: "Hoodie", pair: "HOODx", mcap: 1_510_000, status: "new", desc: "Robinhood-chain native, bridged to TON with a HOOD-backed pool.", emoji: "🧥" },
  { symbol: "TONKING", name: "Ton King", pair: "TON", mcap: 1_240_000, status: "live", desc: "Crowned on TON. Simple TON pair, deep liquidity from block one.", emoji: "💎" },
  { symbol: "MSTRBULL", name: "Saylor Bull", pair: "MSTRx", mcap: 980_000, status: "new", desc: "Leveraged conviction, paired with Strategy stock.", emoji: "🐂" },
  { symbol: "OILY", name: "Oily", pair: "WTI", mcap: 640_000, status: "new", desc: "Slick. Paired with crude oil price exposure.", emoji: "🛢️" },
  { symbol: "ZCAT", name: "Anonymous Cat", pair: "ZEC", mcap: 520_000, status: "live", desc: "Shielded cat, paired cross-chain with ZEC.", emoji: "🕶️" },
  { symbol: "SOLTON", name: "Sol-Ton Bridge", pair: "SOL", mcap: 410_000, status: "new", desc: "Two chains, one meme. SOL-paired via cross-chain routing.", emoji: "🌉" },
  { symbol: "USDTEE", name: "Tee", pair: "USDT", mcap: 305_000, status: "new", desc: "Stable pair, unstable vibes.", emoji: "👕" },
  { symbol: "APPLEJACK", name: "Apple Jack", pair: "AAPLx", mcap: 220_000, status: "new", desc: "An apple a day, paired with Apple stock.", emoji: "🍏" },
];

const DAY = 86_400_000;
const SUPPLY = 1_000_000_000;

function buildToken(seed: (typeof SEEDS)[number], i: number): BitpadToken {
  const r = rngFor(seed.symbol);
  const pair = findAsset(seed.pair) ?? PAIR_ASSETS[0];
  const priceUsd = seed.mcap / SUPPLY;
  const change24h = r.range(-22, 48) * (seed.status === "trending" ? 1.3 : 1);
  const liquidityUsd = seed.mcap * r.range(0.06, 0.16);
  const volume24h = seed.mcap * r.range(0.08, 0.6);
  const txns = Math.round(volume24h / r.range(80, 400));
  const buyShare = 0.5 + change24h / 400;
  const spark: number[] = [];
  let p = priceUsd / (1 + change24h / 100);
  for (let k = 0; k < 32; k++) {
    p *= 1 + r.normal() * 0.02 + change24h / 100 / 32;
    spark.push(p);
  }
  spark[spark.length - 1] = priceUsd;
  return {
    address: fakeTonAddress(seed.symbol),
    symbol: seed.symbol,
    name: seed.name,
    image: undefined,
    description: seed.desc,
    creator: fakeTonAddress(`creator:${seed.symbol}`),
    createdAt: Date.UTC(2026, 8, 27) - (i + 1) * r.range(0.3, 2.2) * DAY,
    pair,
    priceUsd,
    marketCap: seed.mcap,
    fdv: seed.mcap,
    liquidityUsd,
    volume24h,
    change24h,
    holders: Math.round(seed.mcap / r.range(900, 2600)),
    txns24h: txns,
    buys24h: Math.round(txns * buyShare),
    sells24h: Math.round(txns * (1 - buyShare)),
    totalSupply: SUPPLY,
    pairReserveUsd: liquidityUsd / 2,
    status: seed.status,
    spark,
    socials: { telegram: "https://t.me/bitlievers", x: "https://x.com/bitlievers" },
    source: "demo",
  };
}

export const DEMO_EMOJI: Record<string, string> = Object.fromEntries(SEEDS.map((s) => [s.symbol, s.emoji]));

export const DEMO_TOKENS: BitpadToken[] = SEEDS.map(buildToken);

export function demoToken(address: string): BitpadToken | undefined {
  return DEMO_TOKENS.find((t) => t.address === address || t.symbol.toLowerCase() === address.toLowerCase());
}

export const TIMEFRAMES = { "1m": 60, "5m": 300, "15m": 900, "1h": 3600, "4h": 14_400, "1D": 86_400 } as const;
export type Timeframe = keyof typeof TIMEFRAMES;

/** Random-walk candles that end exactly on the token's current price. */
export function demoCandles(token: BitpadToken, tf: Timeframe, count = 240, now = Date.now()): Candle[] {
  const step = TIMEFRAMES[tf];
  const r = rngFor(`${token.symbol}:${tf}`);
  const vol = 0.004 * Math.sqrt(step / 60);
  const end = Math.floor(now / 1000 / step) * step;
  const closes: number[] = new Array(count);
  closes[count - 1] = token.priceUsd;
  for (let i = count - 2; i >= 0; i--) {
    closes[i] = closes[i + 1] / (1 + r.normal() * vol + (r.next() < 0.02 ? r.normal() * vol * 6 : 0));
  }
  return closes.map((close, i) => {
    const open = i === 0 ? close * (1 + r.normal() * vol) : closes[i - 1];
    const wick = Math.abs(r.normal()) * vol * 0.6;
    return {
      time: end - (count - 1 - i) * step,
      open,
      close,
      high: Math.max(open, close) * (1 + wick),
      low: Math.min(open, close) * (1 - wick * r.next()),
      volume: (token.volume24h / (86_400 / step)) * r.range(0.2, 2.4),
    };
  });
}

const ROUTES = ["STON.fi", "STON.fi", "DeDust", "Omniston", "Bundle"];
export function demoTrades(token: BitpadToken, count = 40, now = Date.now()): Trade[] {
  const r = rngFor(`trades:${token.symbol}:${Math.floor(now / 60_000)}`);
  let t = now;
  return Array.from({ length: count }, (_, i) => {
    t -= r.range(4, 90) * 1000;
    const side = r.next() < token.buys24h / Math.max(1, token.txns24h) ? "buy" : "sell";
    const amountUsd = Math.exp(r.range(Math.log(15), Math.log(9000)));
    const priceUsd = token.priceUsd * (1 + r.normal() * 0.003);
    return {
      id: `${token.symbol}-${t}-${i}`,
      time: t,
      side,
      wallet: fakeTonAddress(`w:${token.symbol}:${r.int(0, 400)}`),
      amountUsd,
      amountToken: amountUsd / priceUsd,
      priceUsd,
      route: r.pick(ROUTES),
      txHash: fakeTxHash(`${token.symbol}:${t}`),
    };
  });
}

export function demoHolders(token: BitpadToken): Holder[] {
  const r = rngFor(`holders:${token.symbol}`);
  const rows: Holder[] = [
    { address: fakeTonAddress(`pool:${token.symbol}`), label: `STON.fi pool (${token.symbol}/${token.pair.symbol})`, share: r.range(14, 22), amount: 0 },
    { address: token.creator, label: "Creator", share: r.range(1, 4), amount: 0 },
  ];
  let rest = 100 - rows.reduce((s, h) => s + h.share, 0);
  for (let i = 0; i < 18; i++) {
    const share = rest * r.range(0.04, 0.12);
    rest -= share;
    rows.push({ address: fakeTonAddress(`h:${token.symbol}:${i}`), share, amount: 0 });
  }
  return rows
    .map((h) => ({ ...h, amount: (h.share / 100) * token.totalSupply }))
    .sort((a, b) => b.share - a.share);
}
