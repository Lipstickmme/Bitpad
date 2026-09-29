import { Address, TupleReader, type TupleItem } from "@ton/core";
import { TonClient, TonClient4 } from "@ton/ton";
import { config } from "./config";

/**
 * Get-method reads for Bitpad contracts.
 *
 * Primary: TON v4 API (TonClient4) — returns fully typed stacks, including the
 * tuples Tact uses for struct getters (pool_data, config, pair, referrer).
 * Fallback: toncenter v2 — fine for flat results, but @ton/ton's v2 parser
 * leaves tuple members untyped ("Not a cell: -1"), so it's never used first.
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
  try {
    const r = await client4().runMethod(await seqno(), addr, method, args);
    if (r.exitCode !== 0 && r.exitCode !== 1) throw new Error(`${method} exited with ${r.exitCode}`);
    return r.reader;
  } catch (e) {
    // v2 fallback — only safe for flat results
    try {
      return (await client2().runMethod(addr, method, args)).stack;
    } catch {
      throw e;
    }
  }
}

export const addressArg = (a: Address | string): TupleItem => ({ type: "slice", cell: beginAddr(typeof a === "string" ? Address.parse(a) : a) });
export const intArg = (n: number | bigint): TupleItem => ({ type: "int", value: BigInt(n) });

import { beginCell } from "@ton/core";
function beginAddr(a: Address) {
  return beginCell().storeAddress(a).endCell();
}
