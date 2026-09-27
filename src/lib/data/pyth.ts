import { getJson } from "./http";

/** Pyth Hermes — free, no key. Equities, metals, FX and crypto price feeds. */
const HERMES = "https://hermes.pyth.network";

interface Feed {
  id: string;
  attributes: { symbol: string; base?: string; quote_currency?: string; asset_type?: string };
}

export interface PythWant {
  key: string;
  symbol: string; // e.g. AAPL, XAU, BTC
  type: "equity" | "metal" | "crypto" | "commodities";
}

async function feedId(w: PythWant): Promise<string | undefined> {
  const feeds = await getJson<Feed[]>(`${HERMES}/v2/price_feeds?query=${encodeURIComponent(w.symbol)}&asset_type=${w.type}`, { revalidate: 86_400 });
  const want = w.symbol.toUpperCase();
  const usd = feeds.filter((f) => (f.attributes.quote_currency ?? "USD") === "USD");
  // Prefer the regular-hours US equity feed / exact base match
  const exact = usd.filter((f) => (f.attributes.base ?? "").toUpperCase() === want);
  const pick = exact.find((f) => !/\.(PRE|POST|ON)$/i.test(f.attributes.symbol)) ?? exact[0] ?? usd.find((f) => f.attributes.symbol.toUpperCase().includes(`${want}/USD`));
  return pick?.id.replace(/^0x/, "");
}

type Parsed = { parsed: { id: string; price: { price: string; expo: number; publish_time: number } }[] };
const toMap = (r: Parsed) => new Map(r.parsed.map((p) => [p.id.replace(/^0x/, ""), Number(p.price.price) * 10 ** p.price.expo]));

/** Live prices + real 24h change (compares with the Hermes price 24h ago). */
export async function pythQuotes(wants: PythWant[]): Promise<Record<string, { price: number; change24h: number | null }>> {
  const ids = await Promise.all(wants.map((w) => feedId(w).catch(() => undefined)));
  const pairs = wants.map((w, i) => [w.key, ids[i]] as const).filter((p): p is readonly [string, string] => !!p[1]);
  if (!pairs.length) return {};
  const qs = pairs.map(([, id]) => `ids[]=${id}`).join("&");
  const [now, then] = await Promise.all([
    getJson<Parsed>(`${HERMES}/v2/updates/price/latest?${qs}&parsed=true`, { revalidate: 30 }),
    getJson<Parsed>(`${HERMES}/v2/updates/price/${Math.floor(Date.now() / 1000 / 300) * 300 - 86_400}?${qs}&parsed=true`, { revalidate: 300 }).catch(() => null),
  ]);
  const cur = toMap(now);
  const old = then ? toMap(then) : new Map<string, number>();
  const out: Record<string, { price: number; change24h: number | null }> = {};
  for (const [key, id] of pairs) {
    const p = cur.get(id);
    if (!p || !Number.isFinite(p)) continue;
    const o = old.get(id);
    out[key] = { price: p, change24h: o ? ((p - o) / o) * 100 : null };
  }
  return out;
}
