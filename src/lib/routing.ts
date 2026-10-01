import "server-only";
import { toNano } from "@ton/core";
import { simulateWithFee } from "./ton/ston-sim";
import { config, TON_ASSETS } from "./config";
import { dedustQuote, platformFee } from "./ton/dedust";
import { getPairAssets } from "./prices";
import { ensureRuntimeConfig } from "./runtime";
import type { MarketToken, RouteQuote } from "./types";

export interface PayInfo {
  symbol: string;
  address: string;
  decimals: number;
  priceUsd: number | null;
}

/** Pay assets on TON — addresses from env or resolved live via STON.fi. */
export async function payInfo(symbol: string): Promise<PayInfo | null> {
  const { assets } = await getPairAssets();
  const px = (s: string) => assets.find((a) => a.symbol === s)?.priceUsd ?? null;
  if (symbol === "TON") return { symbol, address: TON_ASSETS.TON, decimals: 9, priceUsd: px("TON") };
  if (symbol === "USDT") return { symbol, address: TON_ASSETS.USDT, decimals: 6, priceUsd: 1 };
  const hit = assets.find((a) => a.symbol === symbol && a.tonAddress);
  if (hit?.tonAddress) return { symbol, address: hit.tonAddress, decimals: symbol === "USDC" ? 6 : 9, priceUsd: hit.priceUsd };
  const { resolveTonSymbol } = await import("./data/stonfi");
  const r = await resolveTonSymbol(symbol).catch(() => undefined);
  return r ? { symbol, address: r.contractAddress, decimals: r.decimals, priceUsd: r.dexPriceUsd ? Number(r.dexPriceUsd) : null } : null;
}

/**
 * Real buy quotes only: STON.fi's swap simulator and DeDust's on-chain pool
 * estimate. STON.fi quotes a single pool, so when the chosen pay asset has no
 * pool with the token (e.g. GRAM → AAPLx, which trades against USDT/TON) the
 * same USD value is re-quoted in TON, then USDT. Tokenized stocks with no
 * pool at all (xStocks trade through market makers) are quoted on STON.fi's
 * Omniston aggregator. `pay` tells the caller which asset the routes spend.
 */
export async function quoteBuy(token: MarketToken, pay: string, amount: number, opts: { omniston?: boolean } = { omniston: true }): Promise<{ routes: RouteQuote[]; pay: PayInfo | null; errors: string[]; switchedFrom?: string; candidates?: { info: PayInfo; amount: number }[] }> {
  await ensureRuntimeConfig();
  const first = await payInfo(pay);
  if (!first) return { routes: [], pay: null, errors: [`${pay} is not available on TON`] };
  const errors: string[] = [];
  const r = await quoteWith(token, first, amount, errors);
  if (r.length) return { routes: r, pay: first, errors };
  // Same USD value in TON and USDT (pools often only exist against those)
  const candidates: { info: PayInfo; amount: number }[] = [{ info: first, amount }];
  if (first.priceUsd) {
    const usdValue = amount * first.priceUsd;
    for (const alt of ["TON", "USDT"].filter((a) => a !== pay)) {
      const info = await payInfo(alt);
      if (info?.priceUsd) candidates.push({ info, amount: Number((usdValue / info.priceUsd).toFixed(info.decimals === 6 ? 2 : 4)) });
    }
  }
  // Re-quote the alternatives at the same time and keep the first that has a route
  const alts = await Promise.all(candidates.slice(1).map(async (c) => ({ ...c, routes: await quoteWith(token, c.info, c.amount, errors) })));
  const hit = alts.find((a) => a.routes.length);
  if (hit) return { routes: hit.routes, pay: hit.info, errors: [], switchedFrom: pay };
  // No AMM pool at all: stocks & gold trade through Omniston's market makers
  if (await isStockAsset(token.address)) {
    if (opts.omniston) {
      let unreachable = false;
      for (const c of candidates) {
        const o = await omnistonRoute(token, c.info, c.amount).catch((e) => { errors.push(`Omniston: ${(e as Error).message}`); unreachable = true; return null; });
        if (o) return { routes: [o], pay: c.info, errors: [], switchedFrom: c.info.symbol !== pay ? pay : undefined, candidates };
        if (unreachable) break;
      }
      if (!unreachable) errors.push("Omniston: no market maker quoted this amount");
    }
    return { routes: [], pay: first, errors, candidates };
  }
  return { routes: [], pay: first, errors };
}

/** Tokenized stocks and commodities from the pair catalog (the assets Omniston is used for). */
export async function isStockAsset(address: string): Promise<boolean> {
  const { assets } = await getPairAssets();
  return assets.some((a) => (a.kind === "stock" || a.kind === "commodity") && a.tonAddress === address);
}

async function omnistonRoute(token: MarketToken, info: PayInfo, amount: number): Promise<RouteQuote | null> {
  const { omniQuote } = await import("./ton/omniston");
  const units = BigInt(Math.floor(amount * 10 ** info.decimals));
  const q = await omniQuote(info.address, token.address, units);
  if (!q) return null;
  const recv = Number(q.outputUnits) / 10 ** token.decimals;
  const payUsd = info.priceUsd ? amount * info.priceUsd : null;
  return {
    id: "omniston", venue: `STON.fi Omniston · ${q.resolver}`, chain: "ton", kind: "onchain", payAsset: info.symbol, payAmount: amount,
    receiveAmount: recv, receiveUsd: token.priceUsd ? recv * token.priceUsd : 0, priceImpact: 0,
    platformFeeUsd: payUsd != null ? payUsd * (config.swapFeeBps / 10_000) : 0, networkFeeUsd: 0, etaSeconds: 15, live: true, executable: true, best: true,
    note: "Market-maker quote via STON.fi's aggregator",
  };
}

async function quoteWith(token: MarketToken, info: PayInfo, amount: number, errors: string[]): Promise<RouteQuote[]> {
  const pay = info.symbol;
  const units = BigInt(Math.floor(amount * 10 ** info.decimals));
  const payUsd = info.priceUsd ? amount * info.priceUsd : null;
  const feeUsd = payUsd != null ? payUsd * (config.swapFeeBps / 10_000) : 0;
  const routes: RouteQuote[] = [];

  const [stonRes, dedustRes] = await Promise.allSettled([
    simulateWithFee({ offerAddress: info.address, askAddress: token.address, offerUnits: units.toString(), slippageTolerance: "0.01" }).then((r) => r.sim),
    pay === "TON" ? dedustQuote({ pay: "TON", token: token.address, amountIn: toNano(amount.toFixed(9)) - platformFee(toNano(amount.toFixed(9))) }) : Promise.resolve(null),
  ]);

  const dec = 10 ** token.decimals;
  if (stonRes.status === "fulfilled") {
    const s = stonRes.value;
    const recv = Number(s.askUnits) / dec;
    routes.push({
      id: "stonfi", venue: `STON.fi v${s.router.majorVersion}`, chain: "ton", kind: "onchain", payAsset: pay, payAmount: amount,
      receiveAmount: recv, receiveUsd: token.priceUsd ? recv * token.priceUsd : 0, priceImpact: Number(s.priceImpact) * 100,
      platformFeeUsd: feeUsd, networkFeeUsd: info.priceUsd && pay === "TON" ? Number(s.gasParams.estimatedGasConsumption) / 1e9 * info.priceUsd : 0,
      etaSeconds: 8, live: true, executable: true,
    });
  } else errors.push(`STON.fi (${pay}): ${(stonRes.reason as Error)?.message ?? "no route"}`);

  if (dedustRes.status === "fulfilled" && dedustRes.value) {
    const d = dedustRes.value;
    const recv = Number(d.amountOut) / dec;
    routes.push({
      id: "dedust", venue: "DeDust", chain: "ton", kind: "onchain", payAsset: pay, payAmount: amount,
      // DeDust has no referral fee: Bitpad's fee is a separate transfer carved out of the same total
      receiveAmount: recv, receiveUsd: token.priceUsd ? recv * token.priceUsd : 0, priceImpact: d.priceImpact,
      platformFeeUsd: feeUsd, networkFeeUsd: 0, etaSeconds: 8, live: true, executable: true,
    });
  } else if (dedustRes.status === "rejected") errors.push(`DeDust: ${(dedustRes.reason as Error)?.message ?? "no pool"}`);

  if (routes.length) routes.reduce((a, b) => (b.receiveAmount > a.receiveAmount ? b : a)).best = true;
  return routes.sort((a, b) => b.receiveAmount - a.receiveAmount);
}
