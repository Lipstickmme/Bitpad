import { getJson } from "./http";

export interface LlamaProtocol {
  name: string;
  displayName?: string;
  slug?: string;
  category?: string;
  chains?: string[];
  total24h?: number | null;
  total7d?: number | null;
  change_1d?: number | null;
}

const Q = "excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true";

export async function dexVolumes() {
  const res = await getJson<{ protocols: LlamaProtocol[] }>(`https://api.llama.fi/overview/dexs?${Q}`, { revalidate: 600, timeoutMs: 12000 });
  return res.protocols;
}

export async function protocolFees() {
  const res = await getJson<{ protocols: LlamaProtocol[] }>(`https://api.llama.fi/overview/fees?${Q}`, { revalidate: 600, timeoutMs: 12000 });
  return res.protocols;
}

export async function chainDexVolume(chain: string) {
  const res = await getJson<{ total24h?: number; change_1d?: number }>(`https://api.llama.fi/overview/dexs/${encodeURIComponent(chain)}?${Q}`, { revalidate: 600 });
  return { total24h: res.total24h ?? 0, change1d: res.change_1d ?? 0 };
}

export async function volumeHistory(slug: string, days = 14) {
  const res = await getJson<{ totalDataChart?: [number, number][] }>(
    `https://api.llama.fi/summary/dexs/${encodeURIComponent(slug)}?excludeTotalDataChartBreakdown=true`,
    { revalidate: 1800, timeoutMs: 12000 },
  );
  return (res.totalDataChart ?? []).slice(-days);
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Protocols matching a venue: needles and names compared without spaces or
 * punctuation ("pump.fun" = "Pump Fun" = "pumpfun"). When the venue's chain is
 * given, protocols DefiLlama lists only on other chains are skipped, so a short
 * needle can't pick up an unrelated project elsewhere.
 */
export function matchProtocol(list: LlamaProtocol[], needles: string[], chain?: string): LlamaProtocol[] {
  const n = needles.map(norm).filter((x) => x.length >= 3);
  return list.filter((p) => {
    if (chain && p.chains?.length && !p.chains.some((c) => c.toLowerCase() === chain.toLowerCase())) return false;
    const hay = norm(`${p.name}|${p.displayName ?? ""}|${p.slug ?? ""}`);
    return n.some((x) => hay.includes(x));
  });
}
