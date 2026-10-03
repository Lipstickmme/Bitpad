import "server-only";
import type { ChainId } from "./types";
import { cgListedIndex, CG_PLATFORM } from "./data/coingecko";
import { jupByMints } from "./data/jupiter";
import { rawAddr, verifiedTon } from "./data/stonfi";
import { memo, safe } from "./data/http";

/**
 * Which token contracts are the genuine ones, per chain:
 *   TON     STON.fi's canonical token for its ticker, or marked essential, with no risk tags
 *   Solana  Jupiter-verified, or listed on CoinGecko
 *   EVM     listed on CoinGecko (its review ties a coin to one contract per chain)
 * Copycats that borrow a ticker fail all of these. Returns the subset of
 * `addresses` that pass; on a source outage nothing is marked verified.
 */
export async function verifiedOn(chain: ChainId, addresses: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  if (!addresses.length) return out;
  if (chain === "ton") {
    const set = (await safe(verifiedTon(), new Set<string>(), "ston verified")).value;
    for (const a of addresses) if (set.has(rawAddr(a))) out.add(a);
    return out;
  }
  const platform = CG_PLATFORM[chain];
  const [cg, jup] = await Promise.all([
    platform ? safe(cgListedIndex(), new Map(), "coingecko listed") : Promise.resolve({ value: new Map(), ok: false }),
    chain === "solana" ? safe(memo(`jup:mints:${[...addresses].sort().join(",")}`, 30 * 60_000, () => jupByMints(addresses)), new Map(), "jupiter mints") : Promise.resolve({ value: new Map(), ok: false }),
  ]);
  for (const a of addresses) {
    if (jup.value.get(a)?.isVerified) out.add(a);
    else if (platform && cg.value.has(`${platform}:${chain === "solana" ? a : a.toLowerCase()}`)) out.add(a);
  }
  return out;
}
