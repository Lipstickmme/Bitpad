import "server-only";
import { chainDexVolume, dexVolumes, matchProtocol, protocolFees, volumeHistory, type LlamaProtocol } from "./data/llama";
import { newPools, trendingPools, type SampledPool } from "./data/gecko";
import { safe } from "./data/http";
import { DEXES, LAUNCHPADS, type Venue } from "./venues";
import { DEMO_TOKENS } from "./demo";
import { rngFor } from "./rng";
import type { AnalyticsSnapshot, ChainId, ChainStat, LaunchpadStat, PairTypeStat, TrendingPool } from "./types";

const SCAN_CHAINS: ChainId[] = ["ton", "solana", "ethereum", "base", "bsc"];
const LLAMA_CHAIN: Partial<Record<ChainId, string>> = { ton: "TON", solana: "Solana", ethereum: "Ethereum", base: "Base", bsc: "BSC", arbitrum: "Arbitrum" };

function median(xs: number[]) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function sampleStats(pools: SampledPool[]) {
  const ch = pools.map((p) => p.change24h);
  const wins = ch.filter((c) => c > 0).length;
  const buys = pools.reduce((s, p) => s + p.buys24h, 0);
  const sells = pools.reduce((s, p) => s + p.sells24h, 0);
  const top = [...pools].sort((a, b) => b.change24h - a.change24h)[0];
  return {
    wins,
    losses: ch.length - wins,
    avg: ch.length ? ch.reduce((a, b) => a + b, 0) / ch.length : 0,
    med: median(ch),
    ratio: sells ? buys / sells : buys ? 2 : 1,
    top: top ? { symbol: top.base, change: top.change24h } : undefined,
    volume: pools.reduce((s, p) => s + p.volume24h, 0),
  };
}

/** Seeded, date-stable preview numbers for a venue with no live feed. */
function demoVenue(v: Venue): LaunchpadStat {
  const day = new Date().toISOString().slice(0, 10);
  const r = rngFor(`${v.id}:${day}`);
  const scale: Record<string, number> = { pumpfun: 9e7, bonk: 3e7, stonkfun: 6e6, pons: 3e6, fourmeme: 2.5e7, clanker: 1.2e7, blum: 2e6, stonfi: 2.2e7, dedust: 8e6, uniswap: 2.1e9, pumpswap: 3.5e8, raydium: 1.1e9, aerodrome: 4.5e8, pancake: 1.6e9 };
  const launches = v.kind === "launchpad" ? r.int(40, v.id === "pumpfun" ? 24000 : 1800) : 0;
  const n = r.int(18, 40);
  const wins = Math.round(n * r.range(0.18, 0.55));
  return {
    id: v.id, name: v.name, chain: v.chain, kind: v.kind, mechanism: v.mechanism, color: v.color,
    volume24h: (scale[v.id] ?? 1e6) * r.range(0.7, 1.3),
    volumeChange: r.range(-35, 45),
    launches24h: launches,
    wins, losses: n - wins,
    avgReturn24h: r.range(-38, 25),
    medianReturn24h: r.range(-60, 5),
    topGainer: { symbol: r.pick(["PEPE2", "MOON", "GIGA", "CAT", "FROG", "BOBO"]), change: r.range(120, 2400) },
    buySellRatio: r.range(0.7, 1.5),
    fees24h: (scale[v.id] ?? 1e6) * r.range(0.004, 0.012),
    source: "demo",
  };
}

function bitpadStat(): LaunchpadStat {
  const v = LAUNCHPADS[0];
  const t = DEMO_TOKENS;
  const wins = t.filter((x) => x.change24h > 0).length;
  const buys = t.reduce((s, x) => s + x.buys24h, 0);
  const sells = t.reduce((s, x) => s + x.sells24h, 0);
  const top = [...t].sort((a, b) => b.change24h - a.change24h)[0];
  return {
    id: v.id, name: v.name, chain: v.chain, kind: "launchpad", mechanism: v.mechanism, color: v.color,
    volume24h: t.reduce((s, x) => s + x.volume24h, 0),
    volumeChange: 18.4,
    launches24h: t.filter((x) => x.status === "new").length,
    wins, losses: t.length - wins,
    avgReturn24h: t.reduce((s, x) => s + x.change24h, 0) / t.length,
    medianReturn24h: median(t.map((x) => x.change24h)),
    topGainer: { symbol: top.symbol, change: top.change24h },
    buySellRatio: sells ? buys / sells : 1,
    source: "demo",
  };
}

function venueStat(v: Venue, sampled: SampledPool[], dex: LlamaProtocol[], fees: LlamaProtocol[]): LaunchpadStat {
  const mine = sampled.filter((p) => p.chain === v.chain && v.geckoMatch.some((m) => p.dexId.toLowerCase().includes(m)));
  const vol = matchProtocol(dex, v.llamaMatch);
  const fee = matchProtocol(fees, v.llamaMatch);
  if (!mine.length && !vol.length && !fee.length) return demoVenue(v);
  const s = sampleStats(mine);
  const volume = vol.reduce((a, p) => a + (p.total24h ?? 0), 0);
  const fallback = demoVenue(v);
  return {
    id: v.id, name: v.name, chain: v.chain, kind: v.kind, mechanism: v.mechanism, color: v.color,
    volume24h: volume || s.volume || fallback.volume24h,
    volumeChange: vol[0]?.change_1d ?? fee[0]?.change_1d ?? 0,
    launches24h: v.kind === "launchpad" ? mine.filter((p) => p.ageHours <= 24).length : 0,
    wins: mine.length ? s.wins : fallback.wins,
    losses: mine.length ? s.losses : fallback.losses,
    avgReturn24h: mine.length ? s.avg : fallback.avgReturn24h,
    medianReturn24h: mine.length ? s.med : fallback.medianReturn24h,
    topGainer: s.top ?? fallback.topGainer,
    buySellRatio: mine.length ? s.ratio : fallback.buySellRatio,
    fees24h: fee.reduce((a, p) => a + (p.total24h ?? 0), 0) || undefined,
    source: "live",
  };
}

function fomoScore(pools: SampledPool[], volChange: number) {
  if (!pools.length) return 50;
  const s = sampleStats(pools);
  const h1 = pools.reduce((a, p) => a + p.change1h, 0) / pools.length;
  const ratio = Math.min(1, Math.max(0, (s.ratio - 0.6) / 1.0)); // 0.6→0, 1.6→1
  const mom = Math.min(1, Math.max(0, (h1 + 10) / 30)); // -10%→0, +20%→1
  const vol = Math.min(1, Math.max(0, (volChange + 30) / 80)); // -30%→0, +50%→1
  return Math.round(100 * (0.4 * ratio + 0.3 * mom + 0.3 * vol));
}

function demoHistory(names: string[]) {
  const out: AnalyticsSnapshot["history"] = [];
  for (let d = 13; d >= 0; d--) {
    const date = new Date(Date.now() - d * 86_400_000).toISOString().slice(5, 10);
    const row: AnalyticsSnapshot["history"][number] = { date };
    for (const n of names) row[n] = demoVenue([...LAUNCHPADS, ...DEXES].find((v) => v.name === n)!).volume24h * rngFor(`${n}:${date}`).range(0.6, 1.4);
    out.push(row);
  }
  return out;
}

export async function getAnalytics(): Promise<AnalyticsSnapshot> {
  const [samples, dex, fees, chainVols] = await Promise.all([
    Promise.all(SCAN_CHAINS.map(async (c) => {
      const [n, t] = await Promise.all([safe(newPools(c), [], `gecko new ${c}`), safe(trendingPools(c), [], `gecko trending ${c}`)]);
      return { chain: c, fresh: n.value, trending: t.value, ok: n.ok || t.ok };
    })),
    safe(dexVolumes(), [] as LlamaProtocol[], "llama dexs"),
    safe(protocolFees(), [] as LlamaProtocol[], "llama fees"),
    Promise.all(SCAN_CHAINS.map((c) => safe(chainDexVolume(LLAMA_CHAIN[c]!), { total24h: 0, change1d: 0 }, `llama chain ${c}`))),
  ]);

  const sampled = samples.flatMap((s) => [...s.fresh, ...s.trending]);
  const uniq = [...new Map(sampled.map((p) => [p.id, p])).values()];

  const launchpads = [bitpadStat(), ...LAUNCHPADS.slice(1).map((v) => venueStat(v, uniq, dex.value, fees.value))];
  const dexes = DEXES.map((v) => venueStat(v, uniq, dex.value, fees.value));

  const chains: ChainStat[] = SCAN_CHAINS.map((c, i) => {
    const s = samples[i];
    const cv = chainVols[i];
    const pools = [...s.fresh, ...s.trending];
    const st = sampleStats(pools);
    if (!s.ok && !cv.ok) {
      const r = rngFor(`chain:${c}:${new Date().toISOString().slice(0, 10)}`);
      return { chain: c, volume24h: { ton: 4e7, solana: 3.2e9, ethereum: 2.4e9, base: 1.1e9, bsc: 1.9e9 }[c as "ton"] * r.range(0.8, 1.2), change24h: r.range(-20, 25), newPools24h: r.int(40, 900), fomo: r.int(25, 85), buySellRatio: r.range(0.8, 1.3), source: "demo" };
    }
    return { chain: c, volume24h: cv.value.total24h || st.volume, change24h: cv.value.change1d, newPools24h: s.fresh.length, fomo: fomoScore(pools, cv.value.change1d), buySellRatio: st.ratio, source: "live" };
  });

  const trending: TrendingPool[] = (uniq.length ? samples.flatMap((s) => s.trending) : demoTrending())
    .sort((a, b) => b.volume24h - a.volume24h)
    .slice(0, 40);

  const groups: Record<string, { label: string; pools: { change24h: number; volume24h: number }[] }> = {
    ton: { label: "TON pairs", pools: [] },
    eth: { label: "ETH pairs", pools: [] },
    sol: { label: "SOL pairs", pools: [] },
    stable: { label: "Stable pairs", pools: [] },
    stock: { label: "Stock pairs", pools: [] },
  };
  for (const p of uniq.length ? uniq : demoTrending()) groups[p.quoteKind]?.pools.push(p);
  for (const t of DEMO_TOKENS) {
    const k = t.pair.kind === "stock" || t.pair.kind === "commodity" ? "stock" : t.pair.symbol === "TON" ? "ton" : null;
    if (k) groups[k].pools.push(t);
  }
  const pairTypes: PairTypeStat[] = Object.entries(groups).map(([kind, g]) => ({
    kind,
    label: g.label,
    pools: g.pools.length,
    volume24h: g.pools.reduce((s, p) => s + p.volume24h, 0),
    avgReturn24h: g.pools.length ? g.pools.reduce((s, p) => s + p.change24h, 0) / g.pools.length : 0,
    winRate: g.pools.length ? (100 * g.pools.filter((p) => p.change24h > 0).length) / g.pools.length : 0,
  }));

  const histVenues = DEXES.filter((v) => v.llamaSlug).slice(0, 5);
  const hist = await Promise.all(histVenues.map((v) => safe(volumeHistory(v.llamaSlug!), [], `llama history ${v.id}`)));
  let history: AnalyticsSnapshot["history"];
  if (hist.every((h) => h.ok && h.value.length)) {
    const dates = hist[0].value.map(([ts]) => ts);
    history = dates.map((ts, i) => {
      const row: AnalyticsSnapshot["history"][number] = { date: new Date(ts * 1000).toISOString().slice(5, 10) };
      histVenues.forEach((v, j) => (row[v.name] = hist[j].value[i]?.[1] ?? 0));
      return row;
    });
  } else {
    history = demoHistory(histVenues.map((v) => v.name));
  }

  return {
    updatedAt: Date.now(),
    launchpads,
    dexes,
    chains,
    trending,
    pairTypes,
    history,
    sources: [
      { name: "GeckoTerminal", ok: samples.some((s) => s.ok) },
      { name: "DefiLlama", ok: dex.ok || fees.ok },
      { name: "Bitpad indexer", ok: false },
    ],
  };
}

function demoTrending(): TrendingPool[] {
  const r = rngFor(`trending:${new Date().toISOString().slice(0, 13)}`);
  const bases = ["PEPE", "WIF", "BONK", "NOT", "DOGS", "GIGA", "POPCAT", "BRETT", "MOG", "TURBO", "FROG", "REDO", "HMSTR", "CATI", "SPX", "NEIRO"];
  const quotes: [string, TrendingPool["quoteKind"], ChainId, string][] = [
    ["TON", "ton", "ton", "stonfi_v2"], ["TON", "ton", "ton", "dedust"], ["SOL", "sol", "solana", "pumpswap"], ["SOL", "sol", "solana", "raydium"],
    ["WETH", "eth", "ethereum", "uniswap_v3"], ["WETH", "eth", "base", "aerodrome"], ["USDT", "stable", "bsc", "pancakeswap_v3"], ["SPYx", "stock", "solana", "stonkfun"],
  ];
  return Array.from({ length: 40 }, (_, i) => {
    const [quote, kind, chain, dex] = r.pick(quotes);
    const base = r.pick(bases);
    const vol = Math.exp(r.range(Math.log(2e5), Math.log(6e7)));
    return {
      id: `demo-${i}`, chain, dex, name: `${base} / ${quote}`, base, quote, quoteKind: kind,
      priceUsd: Math.exp(r.range(-14, 0)), change1h: r.range(-12, 18), change24h: r.range(-60, 180),
      volume24h: vol, liquidityUsd: vol * r.range(0.05, 0.6), fdv: vol * r.range(2, 40),
      txns24h: r.int(300, 60000), ageHours: r.range(1, 900),
    };
  });
}
