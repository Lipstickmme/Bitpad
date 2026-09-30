import "server-only";
import { Address, Cell, Dictionary, type Slice } from "@ton/core";
import { fmt, getLaunches, type Launch } from "./launches";
import { runGet, addressArg } from "./chain";
import { getJson, memo } from "./data/http";
import { jettonInfo } from "./data/tonapi";
import type { Candle, Trade } from "./types";
import { spotPrice } from "./bitpad-math";

/** On-chain reads for Bitpad pools (BitpadPool getters + Swapped events). */

export interface PoolInfo {
  address: string;
  index: number;
  tokenMaster: string;
  pairMaster: string | null; // null = TON
  creator: string;
  reserveToken: string; // bigint as string (JSON-safe)
  reservePair: string;
  protocolFeesAccrued: string;
  creatorFeesAccrued: string;
  referralFeesAccrued: string;
  activeReferrers: number;
  protocolFeeBps: number;
  creatorFeeBps: number;
  tradingOpen: boolean;
  pairDecimals: number;
}

export interface ReferrerRow {
  address: string;
  active: boolean;
  accrued: string;
  earned: string;
  volume: string;
}


async function pairDecimals(master: string | null) {
  if (!master) return 9;
  return memo(`decimals:${master}`, 86_400_000, async () => Number((await jettonInfo(master)).metadata.decimals ?? 9)).catch(() => 9);
}

export async function readPool(pool: string): Promise<PoolInfo> {
  return memo(`pool:${pool}`, 8_000, async () => {
    // non-optional struct getters return their fields directly on the stack (Tact)
    const s = await runGet(pool, "pool_data");
    const index = s.readNumber();
    s.readAddress(); // factory
    const tokenMaster = s.readAddressOpt();
    const pairMaster = s.readAddressOpt();
    s.readAddressOpt(); // pairWallet
    s.readAddressOpt(); // tokenWallet
    const creator = s.readAddressOpt();
    const r = {
      reserveToken: s.readBigNumber(),
      reservePair: s.readBigNumber(),
      protocolFeesAccrued: s.readBigNumber(),
      creatorFeesAccrued: s.readBigNumber(),
      referralFeesAccrued: s.readBigNumber(),
      activeReferrers: s.readNumber(),
      protocolFeeBps: s.readNumber(),
      creatorFeeBps: s.readNumber(),
      tradingOpen: s.readBoolean(),
    };
    const pm = pairMaster ? fmt(pairMaster) : null;
    return {
      address: pool,
      index,
      tokenMaster: tokenMaster ? fmt(tokenMaster) : "",
      pairMaster: pm,
      creator: creator ? fmt(creator) : "",
      reserveToken: r.reserveToken.toString(),
      reservePair: r.reservePair.toString(),
      protocolFeesAccrued: r.protocolFeesAccrued.toString(),
      creatorFeesAccrued: r.creatorFeesAccrued.toString(),
      referralFeesAccrued: r.referralFeesAccrued.toString(),
      activeReferrers: r.activeReferrers,
      protocolFeeBps: r.protocolFeeBps,
      creatorFeeBps: r.creatorFeeBps,
      tradingOpen: r.tradingOpen,
      pairDecimals: await pairDecimals(pm),
    };
  });
}

const referrerValue = {
  serialize: () => {
    throw new Error("read-only");
  },
  parse: (src: Slice) => {
    const s = src.loadRef().beginParse();
    return { active: s.loadBit(), accrued: s.loadCoins(), earned: s.loadCoins(), volume: s.loadCoins() };
  },
};

/** All referral links of a pool with their on-chain stats. */
export async function readReferrers(pool: string): Promise<ReferrerRow[]> {
  return memo(`refs:${pool}`, 8_000, async () => {
    const cell = (await runGet(pool, "referrers")).readCellOpt();
    const dict = Dictionary.loadDirect(Dictionary.Keys.Address(), referrerValue, cell);
    return dict.keys().map((k) => {
      const v = dict.get(k)!;
      return { address: fmt(k), active: v.active, accrued: v.accrued.toString(), earned: v.earned.toString(), volume: v.volume.toString() };
    });
  });
}

export async function isReferrer(pool: string, addr: string) {
  try {
    return (await runGet(pool, "is_referrer", [addressArg(addr)])).readBoolean();
  } catch {
    return false;
  }
}

/** A jetton master's wallet address for an owner (TEP-74 get_wallet_address). */
export async function jettonWalletOf(master: string, owner: string) {
  return memo(`jw:${master}:${owner}`, 86_400_000, async () =>
    fmt((await runGet(master, "get_wallet_address", [addressArg(owner)])).readAddress()),
  );
}

// ── Trades from Swapped events ────────────────────────────────────────────

const OP_SWAPPED = 0x42504c54;

export interface SwapEvent {
  hash: string;
  time: number; // ms
  buy: boolean;
  trader: string;
  amountIn: bigint;
  amountOut: bigint;
  reserveToken: bigint;
  reservePair: bigint;
}

export function parseSwapped(body: Cell): Omit<SwapEvent, "hash" | "time"> | null {
  try {
    const s = body.beginParse();
    if (s.loadUint(32) !== OP_SWAPPED) return null;
    return { buy: s.loadBit(), trader: fmt(s.loadAddress()), amountIn: s.loadCoins(), amountOut: s.loadCoins(), reserveToken: s.loadCoins(), reservePair: s.loadCoins() };
  } catch {
    return null;
  }
}

const tcHeaders = () => (process.env.TONCENTER_API_KEY ? { "x-api-key": process.env.TONCENTER_API_KEY } : undefined);

async function eventsToncenter(pool: string): Promise<SwapEvent[]> {
  const res = await getJson<{ transactions: { hash: string; now: number; out_msgs: { destination: string | null; message_content?: { body?: string } }[] }[] }>(
    `https://toncenter.com/api/v3/transactions?account=${encodeURIComponent(pool)}&limit=256&sort=desc`,
    { revalidate: 10, headers: tcHeaders() },
  );
  return res.transactions.flatMap((t) =>
    t.out_msgs
      .filter((m) => !m.destination && m.message_content?.body)
      .map((m) => parseSwapped(Cell.fromBase64(m.message_content!.body!)))
      .filter((e): e is NonNullable<typeof e> => !!e)
      .map((e) => ({ ...e, hash: t.hash, time: t.now * 1000 })),
  );
}

async function eventsTonapi(pool: string): Promise<SwapEvent[]> {
  const res = await getJson<{ transactions: { hash: string; utime: number; out_msgs: { destination?: unknown; raw_body?: string }[] }[] }>(
    `https://tonapi.io/v2/blockchain/accounts/${encodeURIComponent(pool)}/transactions?limit=256&sort_order=desc`,
    { revalidate: 10, headers: process.env.TONAPI_KEY ? { authorization: `Bearer ${process.env.TONAPI_KEY}` } : undefined },
  );
  return res.transactions.flatMap((t) =>
    t.out_msgs
      .filter((m) => !m.destination && m.raw_body)
      .map((m) => parseSwapped(Cell.fromBoc(Buffer.from(m.raw_body!, "hex"))[0]))
      .filter((e): e is NonNullable<typeof e> => !!e)
      .map((e) => ({ ...e, hash: t.hash, time: t.utime * 1000 })),
  );
}

/** Recent swaps on a pool, newest first (toncenter v3 → TonAPI). */
export async function poolEvents(pool: string): Promise<{ events: SwapEvent[]; source: string | null }> {
  return memo(`events:${pool}`, 10_000, async () => {
    for (const [name, fn] of [["toncenter", eventsToncenter], ["TonAPI", eventsTonapi]] as const) {
      try {
        return { events: (await fn(pool)).sort((a, b) => b.time - a.time), source: name };
      } catch {
        /* try next */
      }
    }
    return { events: [], source: null };
  });
}

/** Map swap events to trades (USD via the pair asset's current price). */
export function eventsToTrades(events: SwapEvent[], pairDecimals: number, pairUsd: number | null, route: string): Trade[] {
  return events.map((e) => {
    const pairAmt = Number(e.buy ? e.amountIn : e.amountOut) / 10 ** pairDecimals;
    const tokAmt = Number(e.buy ? e.amountOut : e.amountIn) / 1e9;
    const px = spotPrice(e, pairDecimals);
    return {
      id: `${e.hash}:${e.buy ? "b" : "s"}`,
      time: e.time,
      side: e.buy ? "buy" : "sell",
      wallet: e.trader,
      amountToken: tokAmt,
      amountUsd: pairUsd ? pairAmt * pairUsd : 0,
      priceUsd: pairUsd ? px * pairUsd : 0,
      route,
      txHash: e.hash,
    };
  });
}

/** OHLC candles from swap events (price after each trade). */
export function eventsToCandles(events: SwapEvent[], pairDecimals: number, pairUsd: number | null, stepSec: number): Candle[] {
  const asc = [...events].sort((a, b) => a.time - b.time);
  const out: Candle[] = [];
  let prevClose: number | null = null;
  for (const e of asc) {
    const px = spotPrice(e, pairDecimals) * (pairUsd ?? 1);
    const vol = (Number(e.buy ? e.amountIn : e.amountOut) / 10 ** pairDecimals) * (pairUsd ?? 1);
    const t = Math.floor(e.time / 1000 / stepSec) * stepSec;
    const last = out[out.length - 1];
    if (last && last.time === t) {
      last.close = px;
      last.high = Math.max(last.high, px);
      last.low = Math.min(last.low, px);
      last.volume += vol;
    } else {
      const open = prevClose ?? px;
      out.push({ time: t, open, close: px, high: Math.max(open, px), low: Math.min(open, px), volume: vol });
    }
    prevClose = px;
  }
  return out;
}

/** Find the launch a creator just made (index ≥ since). */
export async function launchOf(creator: string, since: number): Promise<Launch | null> {
  const { launches } = await getLaunches(20);
  const me = Address.parse(creator);
  return launches.find((l) => l.index >= since && l.creator && Address.parse(l.creator).equals(me)) ?? null;
}

/** BitpadBundler fee in bps (its fee_bps getter). */
export async function bundlerFeeBps(): Promise<number> {
  const { config } = await import("./config");
  return memo("bundler:fee", 300_000, async () => (await runGet(config.bundlerAddress, "fee_bps")).readNumber()).catch(() => 0);
}

export interface VaultInfo {
  address: string;
  totalStaked: string;
  stakers: number;
  rewardsTotal: string; // nanoTON ever distributed
  carry: string; // nanoTON waiting for the first staker
}

/** The launch's StakeVault, or null for pools deployed before vaults existed. */
export async function readVault(pool: string): Promise<VaultInfo | null> {
  return memo(`vault:${pool}`, 8_000, async () => {
    let vault: string;
    try {
      vault = fmt((await runGet(pool, "vault")).readAddress());
    } catch {
      return null; // older pool without a vault getter
    }
    try {
      const s = await runGet(vault, "vault_data"); // flat struct on the stack
      s.readAddress(); // pool
      s.readAddress(); // tokenMaster
      s.readAddress(); // tokenWallet
      const totalStaked = s.readBigNumber();
      const stakers = s.readNumber();
      s.readBigNumber(); // accPerShare
      return { address: vault, totalStaked: totalStaked.toString(), stakers, rewardsTotal: s.readBigNumber().toString(), carry: s.readBigNumber().toString() };
    } catch {
      return { address: vault, totalStaked: "0", stakers: 0, rewardsTotal: "0", carry: "0" }; // not deployed yet
    }
  });
}

/** Staked jettons and claimable TON for one wallet. */
export async function readStaker(vault: string, who: string): Promise<{ amount: string; pending: string }> {
  try {
    const s = await runGet(vault, "staker", [addressArg(who)]);
    const amount = s.readBigNumber();
    s.readBigNumber(); // debt
    return { amount: amount.toString(), pending: s.readBigNumber().toString() };
  } catch {
    return { amount: "0", pending: "0" };
  }
}
