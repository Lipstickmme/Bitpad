import { StonApiClient } from "@ston-fi/api";
import { memo } from "./http";

/** STON.fi public API — free, no key. */
export const ston = new StonApiClient();

export type StonAsset = Awaited<ReturnType<StonApiClient["getAssets"]>>[number];

/** Full TON asset list (prices, images, liquidity tags). Cached 10 min in memory. */
export const stonAssets = () => memo("ston:assets", 10 * 60_000, () => ston.getAssets());

const BAD = new Set(["asset:blacklisted", "asset:deprecated", "asset:fake", "asset:honeypot", "asset:suspicious", "asset:dmca_complaint"]);
export const isSafe = (a: StonAsset) => !a.blacklisted && !a.deprecated && !a.tags.some((t) => BAD.has(t));

/** Resolve a ticker (e.g. "GRAM", "SPYx") to its canonical TON jetton. */
export async function resolveTonSymbol(symbol: string): Promise<StonAsset | undefined> {
  const s = symbol.toLowerCase();
  const matches = (await stonAssets()).filter((a) => a.symbol.toLowerCase() === s && isSafe(a));
  return matches.sort((a, b) => Number(b.defaultSymbol) - Number(a.defaultSymbol) || (b.popularityIndex ?? 0) - (a.popularityIndex ?? 0))[0];
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
