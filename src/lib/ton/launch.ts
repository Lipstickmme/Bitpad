import { Address, beginCell, toNano, type Cell } from "@ton/core";
import { config } from "../config";
import type { TcMessage } from "./client";

/**
 * Message builders for the Bitpad contracts. Opcodes/layouts must match
 * contracts/messages.tact — tests/launch-encoding.test.ts checks them against
 * the compiler-generated parsers.
 */
export const OP = {
  Launch: 0x42504c31,
  LaunchWithJetton: 0x42504c36,
  BuyTon: 0x42504c51,
  SwapIntent: 0x42504c52,
  ClaimFees: 0x42504c53,
  AddReferrer: 0x42504c55,
  RemoveReferrer: 0x42504c56,
  ClaimReferral: 0x42504c57,
  JettonTransfer: 0x0f8a7ea5,
} as const;

/** Gas the factory needs on top of fee + liquidity (LAUNCH_GAS 0.45 + margin; excess is refunded). */
export const LAUNCH_GAS = toNano("0.6");
/** Extra gas for jetton-paired launches (PAIR_SEND_GAS). */
export const PAIR_SEND_GAS = toNano("0.15");
/** Attach to BuyTon on top of amountIn (BUY_GAS 0.1 + margin). */
export const BUY_GAS = toNano("0.12");
/** forward_ton_amount for jetton → pool swaps (JETTON_OUT_GAS). */
export const SWAP_FWD = toNano("0.15");

export interface LaunchParams {
  name: string;
  symbol: string;
  description: string;
  image: string;
  supply: bigint; // whole tokens
  decimals?: number;
  /** 0–2000 = 0–20% of supply kept by the creator */
  creatorBps?: number;
  pairSymbol: string;
}

/** TEP-64 off-chain content: 0x01 + URI pointing at Bitpad's stateless metadata endpoint. */
export function metadataUri(p: LaunchParams): string {
  const json = JSON.stringify({ name: p.name, symbol: p.symbol, description: p.description, image: p.image, decimals: String(p.decimals ?? 9), bitpad_pair: p.pairSymbol });
  return `${config.appUrl}/api/jetton/metadata?d=${Buffer.from(json).toString("base64url")}`;
}

export function contentCell(p: LaunchParams): Cell {
  return beginCell().storeUint(0x01, 8).storeStringTail(metadataUri(p)).endCell();
}

const raw = (p: LaunchParams) => p.supply * 10n ** BigInt(p.decimals ?? 9);

function factory() {
  if (!config.factoryAddress) throw new Error("NEXT_PUBLIC_BITPAD_FACTORY is not configured");
  return config.factoryAddress;
}

/** Launch paired with TON. `pairTon` is the TON locked in the pool (nanoTON). */
export function buildLaunchTx(p: LaunchParams & { pairTon: bigint; launchFee: bigint }): TcMessage {
  const body = beginCell()
    .storeUint(OP.Launch, 32)
    .storeUint(BigInt(Date.now()), 64)
    .storeCoins(raw(p))
    .storeUint(p.creatorBps ?? 0, 16)
    .storeCoins(p.pairTon)
    .storeRef(contentCell(p))
    .endCell();
  return { address: factory(), amount: (p.launchFee + p.pairTon + LAUNCH_GAS).toString(), payload: body.toBoc().toString("base64") };
}

/**
 * Launch paired with a registered jetton: a jetton transfer from the creator's
 * wallet for that jetton to the factory, carrying LaunchWithJetton.
 */
export function buildJettonLaunchTx(p: LaunchParams & { creatorPairWallet: string; creator: string; pairUnits: bigint; launchFee: bigint }): TcMessage {
  const launch = beginCell().storeUint(OP.LaunchWithJetton, 32).storeCoins(raw(p)).storeUint(p.creatorBps ?? 0, 16).storeRef(contentCell(p)).endCell();
  const fwd = p.launchFee + LAUNCH_GAS + PAIR_SEND_GAS;
  const body = beginCell()
    .storeUint(OP.JettonTransfer, 32)
    .storeUint(BigInt(Date.now()), 64)
    .storeCoins(p.pairUnits)
    .storeAddress(Address.parse(factory()))
    .storeAddress(Address.parse(p.creator))
    .storeBit(false)
    .storeCoins(fwd)
    .storeBit(true)
    .storeRef(launch)
    .endCell();
  return { address: p.creatorPairWallet, amount: (fwd + toNano("0.1")).toString(), payload: body.toBoc().toString("base64") };
}

/**
 * Buy from a TON-paired Bitpad pool. `referrer` is the referral link used —
 * the creator's address or one of the token's registered referrers; the pool
 * refunds buys without a valid link.
 */
export function buildPoolBuyTx(pool: string, amountIn: bigint, minOut: bigint, referrer: string, recipient?: string): TcMessage {
  const b = beginCell()
    .storeUint(OP.BuyTon, 32)
    .storeUint(BigInt(Date.now()), 64)
    .storeCoins(amountIn)
    .storeCoins(minOut)
    .storeAddress(recipient ? Address.parse(recipient) : null)
    .storeAddress(Address.parse(referrer))
    .endCell();
  return { address: pool, amount: (amountIn + BUY_GAS).toString(), payload: b.toBoc().toString("base64") };
}

/**
 * Sell to a Bitpad pool (or buy with its pair jetton): a jetton transfer of
 * `amount` from `userJettonWallet` to the pool carrying SwapIntent.
 * `referrer` is required for pair-jetton buys, optional for sells.
 */
export function buildPoolSwapTx(p: { pool: string; userJettonWallet: string; user: string; amount: bigint; minOut: bigint; referrer?: string }): TcMessage {
  const intent = beginCell()
    .storeUint(OP.SwapIntent, 32)
    .storeCoins(p.minOut)
    .storeAddress(null)
    .storeAddress(p.referrer ? Address.parse(p.referrer) : null)
    .endCell();
  const body = beginCell()
    .storeUint(OP.JettonTransfer, 32)
    .storeUint(BigInt(Date.now()), 64)
    .storeCoins(p.amount)
    .storeAddress(Address.parse(p.pool))
    .storeAddress(Address.parse(p.user))
    .storeBit(false)
    .storeCoins(SWAP_FWD)
    .storeBit(true)
    .storeRef(intent)
    .endCell();
  return { address: p.userJettonWallet, amount: (SWAP_FWD + toNano("0.1")).toString(), payload: body.toBoc().toString("base64") };
}

/** Creator only: register / remove a referral link (max 20 active per token). */
export function buildReferrerTx(pool: string, referrer: string, remove = false): TcMessage {
  const b = beginCell().storeUint(remove ? OP.RemoveReferrer : OP.AddReferrer, 32).storeUint(0, 64).storeAddress(Address.parse(referrer)).endCell();
  return { address: pool, amount: toNano("0.05").toString(), payload: b.toBoc().toString("base64") };
}

/** Referrer pulls their accrued share (0.1 TON covers jetton pools; unused gas is returned). */
export function buildClaimReferralTx(pool: string): TcMessage {
  const b = beginCell().storeUint(OP.ClaimReferral, 32).storeUint(0, 64).endCell();
  return { address: pool, amount: toNano("0.1").toString(), payload: b.toBoc().toString("base64") };
}
