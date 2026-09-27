import "server-only";
import { StonApiClient } from "@ston-fi/api";
import { config, TON_ASSETS } from "./config";
import type { BitpadToken, RouteQuote } from "./types";
import { CHAINS } from "./chains";

const ston = new StonApiClient();

const PAY_USD: Record<string, number> = { TON: 2.86, USDT: 1, USDC: 1, GRAM: 0.0031 };

/**
 * Aggregates buy routes for a token. On-chain TON venues are quoted live via
 * STON.fi's simulator (with Bitpad's referral fee applied); cross-chain
 * routes are estimated and hand off to the destination venue.
 */
export async function quoteBuy(token: BitpadToken, payAsset: string, payAmount: number, tonUsd = PAY_USD.TON): Promise<RouteQuote[]> {
  const payUsd = payAmount * (payAsset === "TON" ? tonUsd : PAY_USD[payAsset] ?? 1);
  const feeRate = config.swapFeeBps / 10_000;
  const platformFeeUsd = payUsd * feeRate;
  const ideal = (payUsd - platformFeeUsd) / token.priceUsd;
  const impact = (usd: number, depthMul: number) => Math.min(45, (usd / Math.max(1, token.liquidityUsd * depthMul)) * 100);

  const routes: RouteQuote[] = [];

  // 1) STON.fi — live simulation when the token has a real pool
  let stonLive: RouteQuote | undefined;
  if (token.source === "live") {
    try {
      const offerAddress = payAsset === "USDT" ? TON_ASSETS.USDT : TON_ASSETS.TON;
      const sim = await ston.simulateSwap({
        offerAddress,
        askAddress: token.address,
        offerUnits: String(BigInt(Math.floor(payAmount * 1e9))),
        slippageTolerance: "0.01",
        ...(config.feeWallet ? { referralAddress: config.feeWallet, referralFeeBps: String(config.swapFeeBps) } : {}),
      });
      const recv = Number(sim.askUnits) / 1e9;
      stonLive = {
        id: "stonfi", venue: "STON.fi v2", chain: "ton", kind: "onchain", payAsset, payAmount,
        receiveAmount: recv, receiveUsd: recv * token.priceUsd, priceImpact: Number(sim.priceImpact) * 100,
        platformFeeUsd, networkFeeUsd: 0.08, etaSeconds: 6, live: true,
      };
    } catch {
      /* fall through to estimate */
    }
  }
  const stonImpact = impact(payUsd, 1);
  routes.push(
    stonLive ?? {
      id: "stonfi", venue: "STON.fi v2", chain: "ton", kind: "onchain", payAsset, payAmount,
      receiveAmount: ideal * (1 - stonImpact / 100) * 0.997, receiveUsd: 0, priceImpact: stonImpact,
      platformFeeUsd, networkFeeUsd: 0.08, etaSeconds: 6, live: false,
    },
  );

  const dedustImpact = impact(payUsd, 0.55);
  routes.push({
    id: "dedust", venue: "DeDust", chain: "ton", kind: "onchain", payAsset, payAmount,
    receiveAmount: ideal * (1 - dedustImpact / 100) * 0.9975, receiveUsd: 0, priceImpact: dedustImpact,
    platformFeeUsd, networkFeeUsd: 0.1, etaSeconds: 7, live: false,
  });

  // Split route: 70/30 across both TON venues lowers impact on size
  const splitImpact = impact(payUsd * 0.7, 1) * 0.7 + impact(payUsd * 0.3, 0.55) * 0.3;
  routes.push({
    id: "split", venue: "Split · STON.fi 70% + DeDust 30%", chain: "ton", kind: "onchain", payAsset, payAmount,
    receiveAmount: ideal * (1 - splitImpact / 100) * 0.9971, receiveUsd: 0, priceImpact: splitImpact,
    platformFeeUsd, networkFeeUsd: 0.16, etaSeconds: 8, live: false,
  });

  // Omniston RFQ — cross-chain settlement into TON
  const omniImpact = impact(payUsd, 1.2);
  routes.push({
    id: "omniston", venue: "Omniston RFQ", chain: "ton", kind: "crosschain", payAsset, payAmount,
    receiveAmount: ideal * (1 - omniImpact / 100) * 0.995, receiveUsd: 0, priceImpact: omniImpact,
    platformFeeUsd, networkFeeUsd: 0.25, etaSeconds: 25, live: false,
    note: "Resolvers compete to fill; settles on TON",
  });

  // Paired asset lives off-TON → offer the native venue as an external route
  if (token.pair.chain !== "ton") {
    const chain = token.pair.chain;
    routes.push({
      id: `ext-${chain}`, venue: chain === "solana" ? "Jupiter (via bridge)" : chain === "robinhood" ? "Pons (RH chain)" : "Uniswap (via bridge)",
      chain, kind: "external", payAsset, payAmount,
      receiveAmount: ideal * 0.985, receiveUsd: 0, priceImpact: impact(payUsd, 1.5),
      platformFeeUsd, networkFeeUsd: chain === "ethereum" ? 3.5 : 0.4, etaSeconds: 90, live: false,
      note: `Buys the ${token.pair.symbol} leg natively on ${CHAINS[chain].name}`,
      deepLink: chain === "solana" ? `https://jup.ag/swap/USDC-${token.pair.symbol}` : chain === "robinhood" ? "https://ponsfamily.com" : `https://app.uniswap.org/swap?outputCurrency=${token.pair.symbol}`,
    });
  }

  for (const r of routes) r.receiveUsd = r.receiveAmount * token.priceUsd - r.networkFeeUsd;
  const best = routes.reduce((a, b) => (b.receiveUsd > a.receiveUsd ? b : a));
  best.best = true;
  return routes.sort((a, b) => b.receiveUsd - a.receiveUsd);
}
