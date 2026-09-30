import "server-only";
import starter from "../../scripts/pairs.starter.json";
import { resolveTonSymbol, stonAsset } from "./data/stonfi";
import { getRegisteredPairs } from "./launches";
import { getBitpadTokens } from "./market";
import { creatorBoard } from "./creators";
import { PAIR_KIND } from "./ton/launch";

export interface PairCandidate {
  symbol: string;
  name: string;
  kind: keyof typeof PAIR_KIND;
  master: string | null;
  decimals: number;
  priceUsd: number | null;
  minUsd: number;
  /** Minimum launch liquidity in raw units (string for JSON) */
  minUnits: string;
  source: "starter" | "creator";
  verified?: boolean;
  status: "registered" | "pending" | "disabled" | "new" | "unresolved";
}

const units = (usd: number, px: number | null, dec: number) => (px && usd ? BigInt(Math.ceil((usd / px) * 10 ** dec)).toString() : "0");

/**
 * Everything that could be a Bitpad pair: the starter list (stocks, gold,
 * jettons, bridged BTC/ETH/USDC…, resolved live on STON.fi) plus creator
 * jettons launched on Bitpad, each with its registry status in the factory.
 */
export async function getPairCandidates(): Promise<PairCandidate[]> {
  const rows = starter.pairs as { symbol: string; kind: string; master?: string; minUsd?: number }[];
  const fromStarter = await Promise.all(rows.map(async (r): Promise<PairCandidate> => {
    const hit = r.master ? await stonAsset(r.master).catch(() => undefined) : await resolveTonSymbol(r.symbol).catch(() => undefined);
    const master = r.master ?? hit?.contractAddress ?? null;
    const decimals = hit?.decimals ?? 9;
    const px = hit?.dexPriceUsd ? Number(hit.dexPriceUsd) : null;
    const minUsd = r.minUsd ?? 50;
    return { symbol: r.symbol, name: hit?.displayName ?? r.symbol, kind: r.kind as keyof typeof PAIR_KIND, master, decimals, priceUsd: px, minUsd, minUnits: units(minUsd, px, decimals), source: "starter", status: master ? "new" : "unresolved" };
  }));
  const { tokens } = await getBitpadTokens().catch(() => ({ tokens: [] }));
  const fromCreators = creatorBoard(tokens).map(({ token: t }): PairCandidate => ({
    symbol: t.symbol, name: `${t.name}${t.bitpad!.creatorJetton!.tg ? ` · @${t.bitpad!.creatorJetton!.tg}` : ""}`, kind: "creator", master: t.address, decimals: 9,
    priceUsd: t.priceUsd, minUsd: 20, minUnits: units(20, t.priceUsd, 9), source: "creator", verified: t.bitpad!.creatorJetton!.verified, status: "new",
  }));
  const all = [...fromStarter, ...fromCreators];
  const reg = await getRegisteredPairs(all.map((c) => c.master).filter((m): m is string => !!m));
  for (const c of all) {
    const r = reg.find((x) => x.master === c.master);
    if (r) c.status = !r.enabled ? "disabled" : r.ready ? "registered" : "pending";
  }
  return all;
}
