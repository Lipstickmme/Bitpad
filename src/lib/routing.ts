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
 * same USD value is re-quoted in TON, then USDT. `pay` tells the caller which
 * asset the routes actually spend.
 */
export async function quoteBuy(token: MarketToken, pay: string, amount: number): Promise<{ routes: RouteQuote[]; pay: PayInfo | null; errors: string[]; switchedFrom?: string }> {
  await ensureRuntimeConfig();
  const first = await payInfo(pay);
  if (!first) return { routes: [], pay: null, errors: [`${pay} is not available on TON`] };
  const errors: string[] = [];
  const r = await quoteWith(token, first, amount, errors);
  if (r.length || !first.priceUsd) return { routes: r, pay: first, errors };
  const usdValue = amount * first.priceUsd;
  for (const alt of ["TON", "USDT"].filter((a) => a !== pay)) {
    const info = await payInfo(alt);
    if (!info?.priceUsd) continue;
    const altAmount = Number((usdValue / info.priceUsd).toFixed(info.decimals === 6 ? 2 : 4));
    const routes = await quoteWith(token, info, altAmount, errors);
    if (routes.length) return { routes, pay: info, errors: [], switchedFrom: pay };
  }
  return { routes: [], pay: first, errors };
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
