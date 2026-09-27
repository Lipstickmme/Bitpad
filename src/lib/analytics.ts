import "server-only";
import { chainDexVolume, dexVolumes, matchProtocol, protocolFees, volumeHistory, type LlamaProtocol } from "./data/llama";
import { newPools, trendingPools, type GeckoPoolRow } from "./data/gecko";
import { dsTrending } from "./data/dexscreener";
import { memo, safe } from "./data/http";
import { DEXES, LAUNCHPADS, type Venue } from "./venues";
import { getBitpadTokens } from "./market";
import type { AnalyticsSnapshot, ChainId, ChainStat, LaunchpadStat, PairTypeStat, TrendingPool } from "./types";

const SCAN_CHAINS: ChainId[] = ["ton", "solana", "ethereum", "base", "bsc"];
const LLAMA_CHAIN: Partial<Record<ChainId, string>> = { ton: "TON", solana: "Solana", ethereum: "Ethereum", base: "Base", bsc: "BSC", arbitrum: "Arbitrum" };

function median(xs: number[]) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function sampleStats(pools: { change24h: number; volume24h: number; buys24h: number; sells24h: number; base: string }[]) {
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

function empty(v: Venue): LaunchpadStat {
  return { id: v.id, name: v.name, chain: v.chain, kind: v.kind, mechanism: v.mechanism, color: v.color, volume24h: 0, volumeChange: 0, launches24h: 0, wins: 0, losses: 0, avgReturn24h: 0, medianReturn24h: 0, buySellRatio: 1, source: "unavailable" };
}

function venueStat(v: Venue, sampled: GeckoPoolRow[], dex: LlamaProtocol[], fees: LlamaProtocol[]): LaunchpadStat {
  const mine = sampled.filter((p) => p.chain === v.chain && v.geckoMatch.some((m) => p.dexId.toLowerCase().includes(m)));
  const vol = matchProtocol(dex, v.llamaMatch);
  const fee = matchProtocol(fees, v.llamaMatch);
  if (!mine.length && !vol.length && !fee.length) return empty(v);
  const s = sampleStats(mine);
  const volume = vol.reduce((a, p) => a + (p.total24h ?? 0), 0);
  return {
    id: v.id, name: v.name, chain: v.chain, kind: v.kind, mechanism: v.mechanism, color: v.color,
    volume24h: volume || s.volume,
    volumeChange: vol[0]?.change_1d ?? fee[0]?.change_1d ?? 0,
    launches24h: v.kind === "launchpad" ? mine.filter((p) => p.ageHours <= 24).length : 0,
    wins: s.wins,
    losses: s.losses,
    avgReturn24h: s.avg,
    medianReturn24h: s.med,
    topGainer: s.top,
    buySellRatio: s.ratio,
    fees24h: fee.reduce((a, p) => a + (p.total24h ?? 0), 0) || undefined,
    source: mine.length ? "live" : "partial",
  };
}

function fomoScore(pools: GeckoPoolRow[], volChange: number) {
  const s = sampleStats(pools);
  const h1 = pools.reduce((a, p) => a + p.change1h, 0) / pools.length;
  const ratio = Math.min(1, Math.max(0, (s.ratio - 0.6) / 1.0));
  const mom = Math.min(1, Math.max(0, (h1 + 10) / 30));
  const vol = Math.min(1, Math.max(0, (volChange + 30) / 80));
  return Math.round(100 * (0.4 * ratio + 0.3 * mom + 0.3 * vol));
}

export function getAnalytics(): Promise<AnalyticsSnapshot> {
  return memo("analytics", 90_000, build);
}

async function build(): Promise<AnalyticsSnapshot> {
  const [samples, dex, fees, chainVols, bitpad] = await Promise.all([
    Promise.all(SCAN_CHAINS.map(async (c) => {
      const [n, t] = await Promise.all([safe(newPools(c), [], `gecko new ${c}`), safe(trendingPools(c), [], `gecko trending ${c}`)]);
      return { chain: c, fresh: n.value, trending: t.value, ok: n.ok || t.ok };
    })),
    safe(dexVolumes(), [] as LlamaProtocol[], "llama dexs"),
    safe(protocolFees(), [] as LlamaProtocol[], "llama fees"),
    Promise.all(SCAN_CHAINS.map((c) => safe(chainDexVolume(LLAMA_CHAIN[c]!), { total24h: 0, change1d: 0 }, `llama chain ${c}`))),
    safe(getBitpadTokens(), { tokens: [], count: 0, factory: null, ok: false }, "bitpad"),
  ]);

  // GeckoTerminal down → DexScreener boosted tokens as the pool sample
  const geckoOk = samples.some((s) => s.ok);
  const ds = geckoOk ? { value: [] as GeckoPoolRow[], ok: false } : await safe(dsTrending(SCAN_CHAINS), [], "dexscreener trending");
  const sampled = geckoOk ? samples.flatMap((s) => [...s.fresh, ...s.trending]) : ds.value;
  const uniq = [...new Map(sampled.map((p) => [p.id, p])).values()];

  // Bitpad's own row from the on-chain registry + live pool data
  const bt = bitpad.value.tokens.filter((t) => t.change24h != null);
  const bs = sampleStats(bt.map((t) => ({ change24h: t.change24h!, volume24h: t.volume24h ?? 0, buys24h: t.buys24h ?? 0, sells24h: t.sells24h ?? 0, base: t.symbol })));
  const bv = LAUNCHPADS[0];
  const bitpadRow: LaunchpadStat = {
    id: bv.id, name: bv.name, chain: bv.chain, kind: "launchpad", mechanism: bv.mechanism, color: bv.color,
    volume24h: bs.volume, volumeChange: 0,
    launches24h: bitpad.value.tokens.length, wins: bs.wins, losses: bs.losses, avgReturn24h: bs.avg, medianReturn24h: bs.med,
    topGainer: bs.top, buySellRatio: bs.ratio,
    source: bitpad.value.factory && bitpad.value.ok ? "live" : "unavailable",
  };

  const launchpads = [bitpadRow, ...LAUNCHPADS.slice(1).map((v) => venueStat(v, uniq, dex.value, fees.value))];
  const dexes = DEXES.map((v) => venueStat(v, uniq, dex.value, fees.value));

  const chains: ChainStat[] = SCAN_CHAINS.map((c, i) => {
    const s = samples[i];
    const cv = chainVols[i];
    const pools = geckoOk ? [...s.fresh, ...s.trending] : uniq.filter((p) => p.chain === c);
    if (!pools.length && !cv.ok) return { chain: c, volume24h: 0, change24h: 0, newPools24h: 0, fomo: 0, buySellRatio: 1, source: "unavailable" };
    const st = sampleStats(pools);
    return {
      chain: c,
      volume24h: cv.value.total24h || st.volume,
      change24h: cv.value.change1d,
      newPools24h: s.fresh.filter((p) => p.ageHours <= 24).length,
      fomo: pools.length ? fomoScore(pools, cv.value.change1d) : 0,
      buySellRatio: st.ratio,
      source: "live",
    };
  });

  const trending: TrendingPool[] = (geckoOk ? samples.flatMap((s) => s.trending) : uniq).sort((a, b) => b.volume24h - a.volume24h).slice(0, 40);

  const groups: Record<string, { label: string; pools: { change24h: number; volume24h: number }[] }> = {
    ton: { label: "TON pairs", pools: [] },
    eth: { label: "ETH pairs", pools: [] },
    sol: { label: "SOL pairs", pools: [] },
    stable: { label: "Stable pairs", pools: [] },
    stock: { label: "Stock-paired", pools: [] },
  };
  for (const p of uniq) groups[p.quoteKind]?.pools.push(p);
  for (const t of bitpad.value.tokens) {
    if (t.change24h == null) continue;
    const k = t.pair.kind === "stock" || t.pair.kind === "commodity" ? "stock" : t.pair.symbol === "TON" ? "ton" : null;
    if (k) groups[k].pools.push({ change24h: t.change24h, volume24h: t.volume24h ?? 0 });
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
  const okHist = histVenues.map((v, j) => ({ v, h: hist[j] })).filter((x) => x.h.ok && x.h.value.length);
  const dates = okHist[0]?.h.value.map(([ts]) => ts) ?? [];
  const history = dates.map((ts, i) => {
    const row: AnalyticsSnapshot["history"][number] = { date: new Date(ts * 1000).toISOString().slice(5, 10) };
    for (const { v, h } of okHist) row[v.name] = h.value.find(([t]) => t === ts)?.[1] ?? h.value[i]?.[1] ?? 0;
    return row;
  });

  return {
    updatedAt: Date.now(),
    launchpads,
    dexes,
    chains,
    trending,
    pairTypes,
    history,
    sources: [
      { name: "GeckoTerminal", ok: geckoOk },
      { name: "DexScreener", ok: ds.ok },
      { name: "DefiLlama", ok: dex.ok || fees.ok },
      { name: "Bitpad factory", ok: !!bitpad.value.factory && bitpad.value.ok },
    ].filter((s) => s.name !== "DexScreener" || !geckoOk),
    bitpad: { launches: bitpad.value.count, factory: bitpad.value.factory },
  };
}
