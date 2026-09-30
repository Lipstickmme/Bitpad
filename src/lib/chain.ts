import { Address, TupleReader, type TupleItem } from "@ton/core";
import { TonClient, TonClient4 } from "@ton/ton";
import { config } from "./config";
import { runGetV3 } from "./ton/v3-get";

/**
 * Get-method reads for Bitpad contracts, in order:
 *  1. toncenter v3 — typed stacks incl. the tuples Tact uses for optional
 *     structs; uses TONCENTER_API_KEY when set
 *  2. tonhub v4 (TonClient4) — typed too, but its public endpoint can 403
 *  3. toncenter v2 — fine for flat results only (@ton/ton's v2 parser leaves
 *     tuple members untyped: "Not a cell: -1")
 */
export type Runner = (address: Address, method: string, args: TupleItem[]) => Promise<TupleReader>;

let testRunner: Runner | null = null;
/** Tests plug a sandbox runner in here. */
export function setRunner(r: Runner | null) {
  testRunner = r;
}

let v4: TonClient4 | undefined;
let v2: TonClient | undefined;
const client4 = () => (v4 ??= new TonClient4({ endpoint: config.network === "testnet" ? "https://sandbox-v4.tonhubapi.com" : "https://mainnet-v4.tonhubapi.com", timeout: 10_000 }));
const client2 = () =>
  (v2 ??= new TonClient({
    endpoint: config.network === "testnet" ? "https://testnet.toncenter.com/api/v2/jsonRPC" : "https://toncenter.com/api/v2/jsonRPC",
    apiKey: process.env.TONCENTER_API_KEY || undefined,
  }));

let lastBlock: { seqno: number; at: number } | null = null;
async function seqno() {
  if (lastBlock && Date.now() - lastBlock.at < 3_000) return lastBlock.seqno;
  const b = await client4().getLastBlock();
  lastBlock = { seqno: b.last.seqno, at: Date.now() };
  return lastBlock.seqno;
}

export async function runGet(address: Address | string, method: string, args: TupleItem[] = []): Promise<TupleReader> {
  const addr = typeof address === "string" ? Address.parse(address) : address;
  if (testRunner) return testRunner(addr, method, args);
  const errors: string[] = [];
  try {
    return await runGetV3({ network: config.network, apiKey: process.env.TONCENTER_API_KEY || undefined }, addr, method, args);
  } catch (e) {
    if (/exited with/.test((e as Error).message)) throw e; // the contract answered: don't retry elsewhere
    errors.push((e as Error).message);
  }
  try {
    const r = await client4().runMethod(await seqno(), addr, method, args);
    if (r.exitCode !== 0 && r.exitCode !== 1) throw new Error(`${method} exited with ${r.exitCode}`);
    return r.reader;
  } catch (e) {
    errors.push(`tonhub v4: ${(e as Error).message}`);
  }
  try {
    return (await client2().runMethod(addr, method, args)).stack;
  } catch (e) {
    errors.push(`toncenter v2: ${(e as Error).message}`);
    throw new Error(`${method} unavailable — ${errors.join(" · ")}`);
  }
}

export const addressArg = (a: Address | string): TupleItem => ({ type: "slice", cell: beginAddr(typeof a === "string" ? Address.parse(a) : a) });
export const intArg = (n: number | bigint): TupleItem => ({ type: "int", value: BigInt(n) });

import { beginCell } from "@ton/core";
function beginAddr(a: Address) {
  return beginCell().storeAddress(a).endCell();
}
