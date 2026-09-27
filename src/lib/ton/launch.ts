import { Address, beginCell, toNano, type Cell } from "@ton/core";
import { config } from "../config";
import type { TcMessage } from "./client";

/** Must match `message(0x42504c31) Launch` in contracts/bitpad_factory.tact */
export const OP_LAUNCH = 0x42504c31;

export interface LaunchParams {
  name: string;
  symbol: string;
  description: string;
  image: string;
  supply: bigint; // whole tokens
  decimals?: number;
  pairSymbol: string;
  pairAddress?: string;
}

/**
 * TEP-64 off-chain content: 0x01 prefix + URI. The URI points at Bitpad's
 * stateless metadata endpoint, which decodes the JSON embedded in the query.
 */
export function metadataUri(p: LaunchParams): string {
  const json = JSON.stringify({ name: p.name, symbol: p.symbol, description: p.description, image: p.image, decimals: String(p.decimals ?? 9), bitpad_pair: p.pairSymbol });
  return `${config.appUrl}/api/jetton/metadata?d=${Buffer.from(json).toString("base64url")}`;
}

function contentCell(p: LaunchParams): Cell {
  return beginCell().storeUint(0x01, 8).storeStringTail(metadataUri(p)).endCell();
}

export function buildLaunchTx(p: LaunchParams): TcMessage {
  if (!config.factoryAddress) throw new Error("NEXT_PUBLIC_BITPAD_FACTORY is not configured");
  const decimals = p.decimals ?? 9;
  const body = beginCell()
    .storeUint(OP_LAUNCH, 32)
    .storeUint(BigInt(Date.now()), 64)
    .storeCoins(p.supply * 10n ** BigInt(decimals))
    .storeRef(contentCell(p))
    .storeAddress(p.pairAddress ? Address.parse(p.pairAddress) : null)
    .endCell();
  return {
    address: config.factoryAddress,
    // launch fee + gas for minter deploy & initial mint
    amount: (toNano(config.launchFeeTon.toString()) + toNano("0.3")).toString(),
    payload: body.toBoc().toString("base64"),
  };
}
