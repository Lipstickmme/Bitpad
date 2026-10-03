import "server-only";
import type { ChainId } from "./types";
import { CHAINS } from "./chains";
import { getJson, memo, safe } from "./data/http";
import { jettonInfo } from "./data/tonapi";
import { jupByMints } from "./data/jupiter";

/**
 * Holder counts for token tables, per chain:
 *   TON      TonAPI (bulk, then one by one)
 *   Solana   Jupiter (holderCount, bulk)
 *   Ethereum Ethplorer, then GeckoTerminal
 *   other EVM GeckoTerminal
 * Cached 3h per token: holder counts move slowly and the sources are rate-limited.
 */
const TTL = 3 * 3_600_000;

export async function holderCounts(chain: ChainId, addresses: string[]): Promise<Record<string, number | null>> {
  const list = [...new Set(addresses)].slice(0, 40);
  const out: Record<string, number | null> = {};
  if (chain === "solana") {
    const m = (await safe(memo(`holders:sol:${list.sort().join(",")}`, TTL, () => jupByMints(list)), new Map(), "jupiter holders")).value;
    for (const a of list) out[a] = m.get(a)?.holderCount ?? null;
    return out;
  }
  if (chain === "ton") {
    const bulk = (await safe(memo(`holders:ton:${list.sort().join(",")}`, TTL, () => tonBulk(list)), {} as Record<string, number>, "tonapi bulk")).value;
    const missing = list.filter((a) => bulk[a] == null);
    for (const a of list) out[a] = bulk[a] ?? null;
    // free TonAPI is ~1 rps: fill a few gaps one by one, the rest next time
    for (const a of missing.slice(0, 6)) out[a] = (await safe(memo(`holders:ton1:${a}`, TTL, async () => (await jettonInfo(a)).holders_count ?? null), null, "tonapi jetton")).value;
    return out;
  }
  await pool(list, 3, async (a) => {
    out[a] = await memo(`holders:${chain}:${a.toLowerCase()}`, TTL, async () => {
      if (chain === "ethereum") {
        const e = await safe(getJson<{ holdersCount?: number }>(`https://api.ethplorer.io/getTokenInfo/${a}?apiKey=freekey`, { revalidate: 10_800 }), {}, "ethplorer");
        if (e.value.holdersCount) return e.value.holdersCount;
      }
      const net = CHAINS[chain]?.gecko;
      if (!net) return null;
      const g = await safe(getJson<{ data?: { attributes?: { holders?: { count?: number } } } }>(`https://api.geckoterminal.com/api/v2/networks/${net}/tokens/${a}/info`, { revalidate: 10_800 }), {}, "gecko token info");
      return g.value.data?.attributes?.holders?.count ?? null;
    }).catch(() => null);
  });
  return out;
}

async function tonBulk(addresses: string[]): Promise<Record<string, number>> {
  const res = await fetch("https://tonapi.io/v2/jettons/_bulk", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json", ...(process.env.TONAPI_KEY ? { authorization: `Bearer ${process.env.TONAPI_KEY}` } : {}) },
    body: JSON.stringify({ account_ids: addresses }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`tonapi bulk ${res.status}`);
  const j = (await res.json()) as { jettons?: { holders_count?: number; metadata?: { address?: string } }[] };
  // TonAPI answers in raw form; map back to the addresses we were given, in order
  const out: Record<string, number> = {};
  (j.jettons ?? []).forEach((x, i) => {
    if (x.holders_count != null && addresses[i]) out[addresses[i]] = x.holders_count;
  });
  return out;
}

async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) await fn(items[i++]);
  }));
}
