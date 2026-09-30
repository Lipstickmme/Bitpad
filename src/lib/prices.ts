import "server-only";
import { ASSET_DEFS } from "./assets";
import { pythQuotes, type PythWant } from "./data/pyth";
import { yahooQuote } from "./data/yahoo";
import { cgPrices } from "./data/coingecko";
import { jupResolve } from "./data/jupiter";
import { resolveTonSymbol } from "./data/stonfi";
import { tokenRates } from "./data/tonapi";
import { safe, memo } from "./data/http";
import type { PairAsset } from "./types";

/**
 * Live pair-asset quotes with real fallbacks:
 *  stocks      Pyth → Yahoo → Jupiter (xStock token price)    dividends: Yahoo
 *  commodities Pyth → CoinGecko → Yahoo futures
 *  crypto      Pyth → CoinGecko
 *  jettons     STON.fi dex price → TonAPI rates → CoinGecko
 * Nothing is invented: if every source fails the price is null.
 */
export async function getPairAssets(): Promise<{ assets: PairAsset[]; live: boolean }> {
  return memo("pair-assets", 30_000, load);
}

async function load(): Promise<{ assets: PairAsset[]; live: boolean }> {
  const wants: PythWant[] = ASSET_DEFS.filter((a) => a.pythSymbol && a.pythType).map((a) => ({ key: a.symbol, symbol: a.pythSymbol!, type: a.pythType! }));
  const cgIds = ASSET_DEFS.map((a) => a.coingecko).filter((x): x is string => !!x);

  const [pyth, cg, tonResolved, jup, yahoo] = await Promise.all([
    safe(pythQuotes(wants), {}, "pyth"),
    safe(cgPrices(cgIds), {}, "coingecko"),
    Promise.all(ASSET_DEFS.map(async (a) => {
      if (a.tonAddress || (!a.tonSymbols && a.kind !== "stock")) return undefined;
      for (const s of a.tonSymbols ?? [a.symbol]) {
        const hit = await resolveTonSymbol(s).catch(() => undefined);
        if (hit) return hit;
      }
      return undefined;
    })),
    Promise.all(ASSET_DEFS.map((a) => (a.kind === "stock" ? jupResolve(a.symbol).catch(() => undefined) : undefined))),
    Promise.all(ASSET_DEFS.map((a) => (a.yahoo ? yahooQuote(a.yahoo).catch(() => null) : null))),
  ]);

  const jettonAddrs = ASSET_DEFS.map((a, i) => a.tonAddress ?? tonResolved[i]?.contractAddress).filter((x): x is string => !!x);
  const rates = await safe(tokenRates(jettonAddrs), {}, "tonapi rates");

  let anyLive = false;
  const assets = ASSET_DEFS.map((def, i): PairAsset => {
    const { tonSymbols: _t, ...base } = def;
    const ston = tonResolved[i];
    const j = jup[i];
    const y = yahoo[i];
    const tonAddress = def.tonAddress ?? ston?.contractAddress;
    const tr = tonAddress ? rates.value[tonAddress] : undefined;
    const c = def.coingecko ? cg.value[def.coingecko] : undefined;
    const p = pyth.value[def.symbol];

    const candidates: [string, number | null | undefined, number | null | undefined][] =
      def.kind === "stock" ? [["Pyth", p?.price, p?.change24h], ["Yahoo", y?.price, y?.change24h], ["Jupiter", j?.usdPrice, j?.stats24h?.priceChange]]
      : def.kind === "commodity" ? [["Pyth", p?.price, p?.change24h], ["CoinGecko", c?.usd, c?.usd_24h_change], ["Yahoo", y?.price, y?.change24h]]
      : def.kind === "crypto" ? [["Pyth", p?.price, p?.change24h], ["CoinGecko", c?.usd, c?.usd_24h_change]]
      : [["STON.fi", ston?.dexPriceUsd ? Number(ston.dexPriceUsd) : undefined, undefined], ["TonAPI", tr?.prices?.USD, tr?.diff_24h?.USD ? parseFloat(tr.diff_24h.USD) : undefined], ["Pyth", p?.price, p?.change24h], ["CoinGecko", c?.usd, c?.usd_24h_change]];
    const hit = candidates.find(([, v]) => v != null && Number.isFinite(v) && v > 0);
    // 24h change: first source that has one
    const change = hit?.[2] ?? candidates.map(([, , ch]) => ch).find((ch) => ch != null && Number.isFinite(ch)) ?? null;
    if (hit) anyLive = true;

    return {
      ...base,
      image: ston?.imageUrl ?? j?.icon,
      priceUsd: hit ? Number(hit[1]) : null,
      change24h: change,
      priceSource: hit?.[0],
      tonAddress,
      solanaMint: j?.id,
      oraclePriceUsd: def.kind === "stock" || def.kind === "commodity" ? p?.price ?? y?.price ?? null : undefined,
      tonPriceUsd: tonAddress ? (ston?.dexPriceUsd ? Number(ston.dexPriceUsd) : tr?.prices?.USD ?? null) : null,
      nextDividendEst: y?.lastDividend && y.dividendsPerYear > 0 ? nextDividend(y.lastDividend.date * 1000, y.dividendsPerYear) : null,
      dividendYield: def.kind === "stock" ? y?.dividendYield ?? null : undefined,
      lastDividend: y?.lastDividend,
      dividendsPerYear: y?.dividendsPerYear,
    };
  });
  return { assets, live: anyLive };
}

/** Next payment ≈ last one + the usual interval, rolled forward past today. */
export function nextDividend(lastMs: number, perYear: number, now = Date.now()) {
  const step = (365.25 / perYear) * 86_400_000;
  let t = lastMs + step;
  while (t < now - 86_400_000) t += step;
  return t;
}
