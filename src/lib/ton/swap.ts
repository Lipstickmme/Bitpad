import { StonApiClient } from "@ston-fi/api";
import { dexFactory } from "@ston-fi/sdk";
import type { SenderArguments } from "@ton/core";
import { toNano } from "@ton/core";
import { config, TON_ASSETS } from "../config";
import { tonClient, type TcMessage } from "./client";

const api = new StonApiClient();

export function toTcMessage(tx: SenderArguments): TcMessage {
  return {
    address: tx.to.toString(),
    amount: tx.value.toString(),
    payload: tx.body?.toBoc().toString("base64"),
  };
}

function referral() {
  return config.feeWallet && config.swapFeeBps > 0
    ? { referralAddress: config.feeWallet, referralValue: config.swapFeeBps }
    : {};
}

/**
 * Build a TON → jetton (or USDT → jetton) swap on STON.fi v2 with Bitpad's
 * referral fee attached. Returns a TON Connect message ready to sign.
 */
export type PayWith = "TON" | "USDT" | "GRAM" | "USDC";

/** Jetton master + decimals for the pay assets with fixed addresses. */
export function payAssetInfo(p: PayWith): { address: string; decimals: number } | null {
  switch (p) {
    case "TON": return { address: TON_ASSETS.TON, decimals: 9 };
    case "USDT": return { address: TON_ASSETS.USDT, decimals: 6 };
    // GRAM / USDC are resolved live (STON.fi asset list) and passed in via `payAsset`
    default: return null;
  }
}

export interface BuyParams {
  wallet: string;
  jetton: string;
  amount: number;
  payWith?: PayWith;
  /** Resolved pay asset (from /api/quote); overrides env lookup */
  payAsset?: { address: string; decimals: number };
  slippage?: number;
}

export async function buildBuyTx(params: BuyParams): Promise<{ message: TcMessage; expectedOut: string; minOut: string; priceImpact: number }> {
  const { tx, sim } = await buildBuyArgs(params);
  return { message: toTcMessage(tx), expectedOut: sim.askUnits, minOut: sim.minAskUnits, priceImpact: Number(sim.priceImpact) * 100 };
}

/** Raw sender arguments — used by the multi-wallet bundler, which signs locally. */
export async function buildBuyArgs(params: BuyParams) {
  const payWith = params.payWith ?? "TON";
  const info = params.payAsset ?? payAssetInfo(payWith);
  if (!info) throw new Error(`${payWith} jetton address is not configured`);
  const offerAddress = info.address;
  const offerUnits = info.address === TON_ASSETS.TON ? toNano(params.amount.toFixed(9)) : BigInt(Math.floor(params.amount * 10 ** info.decimals));
  const sim = await api.simulateSwap({
    offerAddress,
    askAddress: params.jetton,
    offerUnits: offerUnits.toString(),
    slippageTolerance: String(params.slippage ?? 0.01),
    ...(config.feeWallet ? { referralAddress: config.feeWallet, referralFeeBps: String(config.swapFeeBps) } : {}),
  });
  const { Router, pTON } = dexFactory(sim.router);
  const router = tonClient().open(Router.create(sim.router.address));
  const proxyTon = pTON.create(sim.router.ptonMasterAddress);

  const common = {
    userWalletAddress: params.wallet,
    offerAmount: sim.offerUnits,
    minAskAmount: sim.minAskUnits,
    ...referral(),
  };
  // Both routers expose the same method names across v1/v2 in practice; cast
  // keeps us independent of the union returned by dexFactory.
  const r = router as unknown as {
    getSwapTonToJettonTxParams(p: object): Promise<SenderArguments>;
    getSwapJettonToJettonTxParams(p: object): Promise<SenderArguments>;
  };
  const tx =
    offerAddress === TON_ASSETS.TON
      ? await r.getSwapTonToJettonTxParams({ ...common, proxyTon, askJettonAddress: params.jetton })
      : await r.getSwapJettonToJettonTxParams({ ...common, offerJettonAddress: offerAddress, askJettonAddress: params.jetton });

  return { tx, sim };
}

/** Sell a jetton back to TON on STON.fi v2. `units` is raw jetton units. */
export async function buildSellTx(params: { wallet: string; jetton: string; units: bigint; slippage?: number }) {
  const { tx, sim } = await buildSellArgs(params);
  return { message: toTcMessage(tx), expectedOut: sim.askUnits };
}

export async function buildSellArgs(params: { wallet: string; jetton: string; units: bigint; slippage?: number }) {
  const sim = await api.simulateSwap({
    offerAddress: params.jetton,
    askAddress: TON_ASSETS.TON,
    offerUnits: params.units.toString(),
    slippageTolerance: String(params.slippage ?? 0.01),
    ...(config.feeWallet ? { referralAddress: config.feeWallet, referralFeeBps: String(config.swapFeeBps) } : {}),
  });
  const { Router, pTON } = dexFactory(sim.router);
  const router = tonClient().open(Router.create(sim.router.address)) as unknown as {
    getSwapJettonToTonTxParams(p: object): Promise<SenderArguments>;
  };
  const tx = await router.getSwapJettonToTonTxParams({
    userWalletAddress: params.wallet,
    offerJettonAddress: params.jetton,
    offerAmount: sim.offerUnits,
    minAskAmount: sim.minAskUnits,
    proxyTon: pTON.create(sim.router.ptonMasterAddress),
    ...referral(),
  });
  return { tx, sim };
}
