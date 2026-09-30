import { Asset, Factory, JettonRoot, MAINNET_FACTORY_ADDR, PoolType, ReadinessStatus, VaultJetton, VaultNative } from "@dedust/sdk";
import { Address, toNano, type Sender, type SenderArguments } from "@ton/core";
import { config } from "../config";
import { tonClient, type TcMessage } from "./client";
import { toTcMessage } from "./swap";
import { commentCell, feeComment } from "../gref";

/**
 * DeDust v2 — quotes via on-chain get-methods (free, through toncenter) and
 * swap messages built with the official SDK. DeDust has no referral fee, so
 * Bitpad's platform fee is added as a separate message in the same request.
 */

/** A Sender that records what the SDK would send, so we can hand it to TON Connect. */
function capture(): Sender & { sent: SenderArguments[] } {
  const sent: SenderArguments[] = [];
  return { address: undefined, sent, send: async (args: SenderArguments) => void sent.push(args) };
}

const factory = () => tonClient().open(Factory.createFromAddress(MAINNET_FACTORY_ADDR));
const assetOf = (addr: string | "TON") => (addr === "TON" ? Asset.native() : Asset.jetton(Address.parse(addr)));

async function pool(inAddr: string | "TON", outAddr: string) {
  const p = tonClient().open(await factory().getPool(PoolType.VOLATILE, [assetOf(inAddr), assetOf(outAddr)]));
  if ((await p.getReadinessStatus()) !== ReadinessStatus.READY) return null;
  return p;
}

export async function dedustQuote(params: { pay: string | "TON"; token: string; amountIn: bigint }) {
  const p = await pool(params.pay, params.token);
  if (!p) return null;
  const assetIn = assetOf(params.pay);
  const [{ amountOut, tradeFee }, reserves, assets] = await Promise.all([p.getEstimatedSwapOut({ assetIn, amountIn: params.amountIn }), p.getReserves(), p.getAssets()]);
  const inIdx = assets[0].equals(assetIn) ? 0 : 1;
  const spot = (params.amountIn * reserves[1 - inIdx]) / (reserves[inIdx] || 1n);
  const impact = spot > 0n ? Math.max(0, 1 - Number(amountOut) / Number(spot)) * 100 : 0;
  return { amountOut, tradeFee, priceImpact: impact, pool: p.address.toString() };
}

/** Platform fee in nanoTON for a given TON amount (0 when no fee wallet is set). */
export function platformFee(tonAmount: bigint) {
  if (!config.feeWallet || config.swapFeeBps <= 0) return 0n;
  return (tonAmount * BigInt(config.swapFeeBps)) / 10_000n;
}

/** Platform fee transfer, tagged on-chain with the route and general referrer. */
function feeMessage(tonAmount: bigint, route: string, referrer?: string | null): TcMessage[] {
  const fee = platformFee(tonAmount);
  return fee > 0n ? [{ address: config.feeWallet, amount: fee.toString(), payload: commentCell(feeComment(route, referrer)).toBoc().toString("base64") }] : [];
}

/** TON → jetton on DeDust (+ platform fee message). */
export async function buildDedustBuyTx(params: { wallet: string; token: string; tonAmount: number; slippage: number; referrer?: string | null }): Promise<TcMessage[]> {
  const total = toNano(params.tonAmount.toFixed(9));
  const fee = platformFee(total);
  const amount = total - fee; // same total spend as the STON.fi route
  const q = await dedustQuote({ pay: "TON", token: params.token, amountIn: amount });
  if (!q) throw new Error("No ready DeDust TON pool for this token");
  const vault = tonClient().open(await factory().getNativeVault());
  const s = capture();
  await vault.sendSwap(s, {
    poolAddress: Address.parse(q.pool),
    amount,
    limit: (q.amountOut * BigInt(Math.floor((1 - params.slippage) * 10_000))) / 10_000n,
    gasAmount: toNano("0.25"),
  });
  return [...s.sent.map(toTcMessage), ...feeMessage(total, "dedust", params.referrer)];
}

/** Jetton → TON on DeDust. Platform fee is taken from the TON received estimate, paid alongside. */
export async function buildDedustSellTx(params: { wallet: string; token: string; units: bigint; slippage: number; referrer?: string | null }): Promise<TcMessage[]> {
  const q = await dedustQuote({ pay: params.token, token: "TON", amountIn: params.units }).catch(() => null)
    ?? (await (async () => {
      const p = await pool("TON", params.token);
      if (!p) return null;
      const r = await p.getEstimatedSwapOut({ assetIn: assetOf(params.token), amountIn: params.units });
      return { amountOut: r.amountOut, pool: p.address.toString() };
    })());
  if (!q) throw new Error("No ready DeDust TON pool for this token");
  const owner = Address.parse(params.wallet);
  const jettonVault = tonClient().open(await factory().getJettonVault(Address.parse(params.token)));
  const userWallet = tonClient().open(await tonClient().open(JettonRoot.createFromAddress(Address.parse(params.token))).getWallet(owner));
  const s = capture();
  await userWallet.sendTransfer(s, toNano("0.3"), {
    amount: params.units,
    destination: jettonVault.address,
    responseAddress: owner,
    forwardAmount: toNano("0.25"),
    forwardPayload: VaultJetton.createSwapPayload({
      poolAddress: Address.parse(q.pool),
      limit: (q.amountOut * BigInt(Math.floor((1 - params.slippage) * 10_000))) / 10_000n,
    }),
  });
  return [...s.sent.map(toTcMessage), ...feeMessage(q.amountOut, "dedust-sell", params.referrer)];
}

export { VaultNative };
