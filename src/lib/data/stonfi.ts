import { StonApiClient } from "@ston-fi/api";
import { Address } from "@ton/core";
import { memo } from "./http";

/** STON.fi public API — free, no key. */
export const ston = new StonApiClient();

export type StonAsset = Awaited<ReturnType<StonApiClient["getAssets"]>>[number];

/** Full TON asset list (prices, images, liquidity tags). Cached 10 min in memory. */
export const stonAssets = () => memo("ston:assets", 10 * 60_000, () => ston.getAssets());

const BAD = new Set(["asset:blacklisted", "asset:deprecated", "asset:fake", "asset:honeypot", "asset:suspicious", "asset:dmca_complaint"]);
export const isSafe = (a: StonAsset) => !a.blacklisted && !a.deprecated && !a.tags.some((t) => BAD.has(t));

/**
 * The genuine TON jetton for an asset that may trade under several tickers
 * (e.g. BTC as tgBTC or jWBTC): only STON.fi-verified candidates (canonical for
 * their ticker or essential, no risk tags), and of those the most traded one,
 * the cheapest to buy. Look-alikes with the same ticker never qualify.
 */
export async function resolveVerifiedTon(symbols: string[]): Promise<StonAsset | undefined> {
  const want = new Set(symbols.map((s) => s.toLowerCase()));
  const vset = await verifiedTon();
  const hits = (await stonAssets()).filter((a) => want.has(a.symbol.toLowerCase()) && isSafe(a) && vset.has(rawAddr(a.contractAddress)));
  return hits.sort((a, b) => (b.popularityIndex ?? 0) - (a.popularityIndex ?? 0))[0];
}

export async function stonAsset(address: string): Promise<StonAsset | undefined> {
  const list = await stonAssets();
  return list.find((a) => a.contractAddress === address) ?? (await ston.getAsset(address).catch(() => undefined));
}

/** Swaps on a given pool in the last `minutes` (API caps windows; used as a trades fallback). */
export async function stonPoolSwaps(pool: string, minutes = 60) {
  const until = new Date();
  const since = new Date(until.getTime() - minutes * 60_000);
  const ops = await ston.getOperations({ since, until });
  return ops.filter((o) => o.operation.poolAddress === pool && o.operation.operationType === "Swap" && o.operation.success);
}

/**
 * TON jettons we can show as verified: STON.fi lists them as the canonical
 * token for their ticker (default symbol) or as essential, and they carry no
 * risk tags. Raw-form addresses.
 */
export const verifiedTon = () =>
  memo("ston:verified", 10 * 60_000, async () => {
    const set = new Set<string>();
    for (const a of await stonAssets()) {
      if (!isSafe(a) || !(a.defaultSymbol || a.tags.includes("asset:essential"))) continue;
      try { set.add(Address.parse(a.contractAddress).toRawString()); } catch { /* skip */ }
    }
    return set;
  });

export const rawAddr = (a: string) => {
  try {
    return Address.parse(a).toRawString();
  } catch {
    return a;
  }
};
