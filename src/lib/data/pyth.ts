import { getJson } from "./http";
import type { PairAsset } from "../types";

const HERMES = "https://hermes.pyth.network";

const TYPE: Record<PairAsset["kind"], string> = {
  stock: "equity",
  commodity: "metal",
  crypto: "crypto",
  jetton: "crypto",
};

interface Feed {
  id: string;
  attributes: { symbol: string; base?: string; quote_currency?: string };
}

/** Find the Pyth feed id for a symbol (e.g. AAPL → Equity.US.AAPL/USD). Cached for a day. */
async function feedId(asset: PairAsset): Promise<string | undefined> {
  if (!asset.pythSymbol) return undefined;
  const type = asset.symbol === "WTI" ? "commodities" : TYPE[asset.kind];
  const feeds = await getJson<Feed[]>(
    `${HERMES}/v2/price_feeds?query=${encodeURIComponent(asset.pythSymbol)}&asset_type=${type}`,
    { revalidate: 86_400 },
  );
  const want = asset.pythSymbol.toUpperCase();
  const exact = feeds.find((f) => (f.attributes.base ?? "").toUpperCase() === want && (f.attributes.quote_currency ?? "USD") === "USD");
  return (exact ?? feeds.find((f) => f.attributes.symbol.toUpperCase().includes(`${want}/USD`)))?.id;
}

/** Live USD prices keyed by asset symbol. Assets without a feed are omitted. */
export async function pythPrices(assets: PairAsset[]): Promise<Record<string, number>> {
  const ids = await Promise.all(assets.map((a) => feedId(a).catch(() => undefined)));
  const pairs = assets.map((a, i) => [a.symbol, ids[i]] as const).filter(([, id]) => !!id) as [string, string][];
  if (!pairs.length) return {};
  const qs = pairs.map(([, id]) => `ids[]=${id}`).join("&");
  const res = await getJson<{ parsed: { id: string; price: { price: string; expo: number } }[] }>(
    `${HERMES}/v2/updates/price/latest?${qs}&parsed=true`,
    { revalidate: 30 },
  );
  const byId = new Map(res.parsed.map((p) => [p.id.replace(/^0x/, ""), Number(p.price.price) * 10 ** p.price.expo]));
  const out: Record<string, number> = {};
  for (const [sym, id] of pairs) {
    const v = byId.get(id.replace(/^0x/, ""));
    if (v && Number.isFinite(v)) out[sym] = v;
  }
  return out;
}
