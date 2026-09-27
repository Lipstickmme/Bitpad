import { StonApiClient } from "@ston-fi/api";
import { dexFactory } from "@ston-fi/sdk";
import type { SenderArguments } from "@ton/core";
import { TON_ASSETS } from "../config";
import { tonClient, type TcMessage } from "./client";
import { toTcMessage } from "./swap";

const api = new StonApiClient();

/**
 * Seed a brand-new STON.fi v2 pool: new jetton ⟷ paired asset. Both sides are
 * deposited in one TON Connect request (two messages), so trading starts the
 * moment the pool is created — no bonding curve.
 */
export async function buildSeedPoolTx(params: {
  wallet: string;
  jetton: string;
  jettonUnits: bigint;
  /** jetton master of the paired asset, or TON_ASSETS.TON for native TON */
  pairAddress: string;
  pairUnits: bigint;
}): Promise<TcMessage[]> {
  // Any v2 CPI router works for pool creation; take the one STON.fi routes TON through.
  const sim = await api.simulateSwap({ offerAddress: TON_ASSETS.TON, askAddress: TON_ASSETS.USDT, offerUnits: "1000000000", slippageTolerance: "0.01" });
  if (!sim.router.poolCreationEnabled) throw new Error("STON.fi router does not allow pool creation right now");
  const { Router, pTON } = dexFactory(sim.router);
  const router = tonClient().open(Router.create(sim.router.address)) as unknown as {
    getProvideLiquidityJettonTxParams(p: object): Promise<SenderArguments>;
    getProvideLiquidityTonTxParams(p: object): Promise<SenderArguments>;
  };
  const isTon = params.pairAddress === TON_ASSETS.TON;

  const tokenSide = await router.getProvideLiquidityJettonTxParams({
    userWalletAddress: params.wallet,
    sendTokenAddress: params.jetton,
    otherTokenAddress: isTon ? sim.router.ptonMasterAddress : params.pairAddress,
    sendAmount: params.jettonUnits,
    minLpOut: "1",
  });
  const pairSide = isTon
    ? await router.getProvideLiquidityTonTxParams({
        userWalletAddress: params.wallet,
        proxyTon: pTON.create(sim.router.ptonMasterAddress),
        otherTokenAddress: params.jetton,
        sendAmount: params.pairUnits,
        minLpOut: "1",
      })
    : await router.getProvideLiquidityJettonTxParams({
        userWalletAddress: params.wallet,
        sendTokenAddress: params.pairAddress,
        otherTokenAddress: params.jetton,
        sendAmount: params.pairUnits,
        minLpOut: "1",
      });
  return [toTcMessage(tokenSide), toTcMessage(pairSide)];
}
