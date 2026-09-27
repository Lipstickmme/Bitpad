import "server-only";
import { Address, Cell, TupleBuilder } from "@ton/core";
import { TonClient } from "@ton/ton";
import { config } from "./config";
import { memo } from "./data/http";

/**
 * Bitpad launch indexer — reads BitpadFactory's on-chain registry with
 * get-methods (launch_count, minter(i)) and each minter's content/creator.
 * Launch data is immutable, so each launch is fetched once and cached.
 */
export interface Launch {
  index: number;
  minter: string;
  creator?: string;
  pairAddress?: string;
  meta: { name?: string; symbol?: string; description?: string; image?: string; decimals?: string; bitpad_pair?: string };
}

let client: TonClient | undefined;
function tc() {
  client ??= new TonClient({
    endpoint: config.network === "testnet" ? "https://testnet.toncenter.com/api/v2/jsonRPC" : "https://toncenter.com/api/v2/jsonRPC",
    apiKey: process.env.TONCENTER_API_KEY || config.toncenterKey || undefined,
  });
  return client;
}

const fmt = (a: Address) => a.toString({ testOnly: config.network === "testnet" });

/** Decode TEP-64 off-chain content (0x01 + URI). Bitpad URIs embed the JSON in `d`. */
export async function decodeContent(cell: Cell): Promise<Launch["meta"]> {
  const s = cell.beginParse();
  if (s.loadUint(8) !== 0x01) return {};
  const uri = s.loadStringTail();
  try {
    const d = new URL(uri).searchParams.get("d");
    if (d) return JSON.parse(Buffer.from(d, "base64url").toString("utf8"));
  } catch {
    /* not a Bitpad URI */
  }
  try {
    const res = await fetch(uri.replace(/^ipfs:\/\//, "https://ipfs.io/ipfs/"), { next: { revalidate: 86_400 } } as RequestInit);
    return (await res.json()) as Launch["meta"];
  } catch {
    return {};
  }
}

async function readLaunch(factory: Address, index: number): Promise<Launch | null> {
  const args = new TupleBuilder();
  args.writeNumber(index);
  const m = await tc().runMethod(factory, "minter", args.build());
  const minter = m.stack.readAddressOpt();
  if (!minter) return null;
  const data = await tc().runMethod(minter, "get_jetton_data");
  data.stack.readBigNumber(); // total supply
  data.stack.readBoolean(); // mintable
  data.stack.readAddress(); // admin
  const meta = await decodeContent(data.stack.readCell());
  let creator: string | undefined;
  let pairAddress: string | undefined;
  try {
    const info = (await tc().runMethod(minter, "bitpad_info")).stack.readCell().beginParse();
    creator = fmt(info.loadAddress());
    info.loadUint(64);
    if (info.loadBit()) pairAddress = fmt(info.loadAddress());
  } catch {
    /* older minter without bitpad_info */
  }
  return { index, minter: fmt(minter), creator, pairAddress, meta };
}

/** Latest launches, newest first. Empty when no factory is configured. */
export async function getLaunches(limit = 60): Promise<{ launches: Launch[]; count: number; factory: string | null; ok: boolean }> {
  if (!config.factoryAddress) return { launches: [], count: 0, factory: null, ok: true };
  const factory = Address.parse(config.factoryAddress);
  try {
    const count = await memo("factory:count", 30_000, async () => Number((await tc().runMethod(factory, "launch_count")).stack.readBigNumber()));
    const out: Launch[] = [];
    // sequential: toncenter's free tier is ~1 rps without an API key
    for (let i = count - 1; i >= Math.max(0, count - limit); i--) {
      const l = await memo(`launch:${config.factoryAddress}:${i}`, 7 * 86_400_000, () => readLaunch(factory, i)).catch(() => null);
      if (l) out.push(l);
    }
    return { launches: out, count, factory: config.factoryAddress, ok: true };
  } catch (e) {
    console.warn("[launches] factory read failed:", (e as Error).message);
    return { launches: [], count: 0, factory: config.factoryAddress, ok: false };
  }
}
