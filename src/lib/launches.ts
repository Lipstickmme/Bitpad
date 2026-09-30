import "server-only";
import { Address, Cell } from "@ton/core";
import { runGet, intArg, addressArg } from "./chain";
import { config, LEGACY_FACTORIES } from "./config";
import { memo } from "./data/http";

/**
 * Bitpad launch indexer — reads BitpadFactory's on-chain registry with
 * get-methods (launch_count, minter(i)) and each minter's content/creator.
 * Launch data is immutable, so each launch is fetched once and cached.
 */
export interface Launch {
  index: number;
  minter: string;
  pool?: string;
  /** total supply in raw units */
  supply?: string;
  creator?: string;
  pairAddress?: string;
  meta: { name?: string; symbol?: string; description?: string; image?: string; decimals?: string; bitpad_pair?: string };
}

export const fmt = (a: Address) => a.toString({ testOnly: config.network === "testnet" });

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
  const minter = (await runGet(factory, "minter", [intArg(index)])).readAddressOpt();
  if (!minter) return null;
  const pool = (await runGet(factory, "pool", [intArg(index)])).readAddressOpt();
  const data = await runGet(minter, "get_jetton_data");
  const supply = data.readBigNumber();
  data.readBoolean(); // mintable
  data.readAddress(); // admin
  const meta = await decodeContent(data.readCell());
  let creator: string | undefined;
  let pairAddress: string | undefined;
  try {
    const info = (await runGet(minter, "bitpad_info")).readCell().beginParse();
    creator = fmt(info.loadAddress());
    info.loadUint(64);
    if (info.loadBit()) pairAddress = fmt(info.loadAddress());
  } catch {
    /* older minter without bitpad_info */
  }
  return { index, minter: fmt(minter), pool: pool ? fmt(pool) : undefined, supply: supply.toString(), creator, pairAddress, meta };
}

/** Latest launches, newest first. Empty when no factory is configured. */
export async function getLaunches(limit = 60): Promise<{ launches: Launch[]; count: number; factory: string | null; ok: boolean }> {
  if (!config.factoryAddress) return { launches: [], count: 0, factory: null, ok: true };
  // Current factory first, then earlier ones (their launches keep trading)
  const all = [config.factoryAddress, ...LEGACY_FACTORIES.filter((f) => f !== config.factoryAddress)];
  const out: Launch[] = [];
  let count = 0;
  let ok = false;
  for (const addr of all) {
    const factory = Address.parse(addr);
    try {
      const n = await memo(`factory:count:${addr}`, 15_000, async () => (await runGet(factory, "launch_count")).readNumber());
      count += n;
      ok = true;
      // sequential: toncenter's free tier is ~1 rps without an API key
      for (let i = n - 1; i >= Math.max(0, n - limit) && out.length < limit; i--) {
        const l = await memo(`launch:${addr}:${i}`, 7 * 86_400_000, () => readLaunch(factory, i)).catch(() => null);
        if (l) out.push(l);
      }
    } catch (e) {
      console.warn(`[launches] factory ${addr} read failed:`, (e as Error).message);
    }
  }
  return { launches: out, count, factory: config.factoryAddress, ok };
}

export interface FactoryConfig {
  launches: number;
  feeWallet: string;
  launchFee: bigint;
  protocolFeeBps: number;
  creatorFeeBps: number;
  minTonLiquidity: bigint;
}

/** Live factory settings (launch fee, trade fees, minimum liquidity) from its `config()` getter. */
export async function getFactoryConfig(): Promise<FactoryConfig | null> {
  if (!config.factoryAddress) return null;
  try {
    return await memo("factory:config", 15_000, async () => {
      // non-optional struct getters return their fields directly on the stack (Tact)
      const s = await runGet(config.factoryAddress, "config");
      s.readAddress(); // owner
      const feeWallet = fmt(s.readAddress());
      const launchFee = s.readBigNumber();
      const protocolFeeBps = s.readNumber();
      const creatorFeeBps = s.readNumber();
      const minTonLiquidity = s.readBigNumber();
      s.readBigNumber(); // tonPythFeedId
      const launches = s.readNumber();
      return { launches, feeWallet, launchFee, protocolFeeBps, creatorFeeBps, minTonLiquidity };
    });
  } catch (e) {
    console.warn("[factory] config read failed:", (e as Error).message);
    return null;
  }
}

export interface RegisteredPair {
  master: string;
  symbol: string;
  decimals: number;
  minLiquidity: string; // raw units
  enabled: boolean;
  ready: boolean; // factory discovered its wallet (TEP-89)
}

/** Which of these jetton masters are registered as pairs in the factory (pair(master) getter). */
export async function getRegisteredPairs(masters: string[]): Promise<RegisteredPair[]> {
  if (!config.factoryAddress || !masters.length) return [];
  const factory = Address.parse(config.factoryAddress);
  const out: RegisteredPair[] = [];
  for (const m of [...new Set(masters)]) {
    const r = await memo(`pair:${m}`, 300_000, async () => {
      const s = (await runGet(factory, "pair", [addressArg(m)])).readTupleOpt();
      if (!s) return null;
      const symbol = s.readString();
      const decimals = s.readNumber();
      s.readNumber(); // kind
      s.readBigNumber(); // pythFeedId
      const minLiquidity = s.readBigNumber().toString();
      const wallet = s.readAddressOpt();
      const enabled = s.readBoolean();
      return { master: m, symbol, decimals, minLiquidity, enabled, ready: !!wallet };
    }).catch(() => null);
    if (r) out.push(r);
  }
  return out;
}
