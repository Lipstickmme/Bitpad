import { NextResponse, type NextRequest } from "next/server";
import { getPairAssets } from "@/lib/prices";
import { STOCK_TF, yahooCandles, type StockTf } from "@/lib/data/yahoo";
import { poolOhlcv, tokenPools } from "@/lib/data/gecko";
import { TIMEFRAMES, type Timeframe } from "@/lib/timeframes";
import { safe } from "@/lib/data/http";
import { Address } from "@ton/core";

const same = (a: string, b: string) => {
  try {
    return Address.parse(a).equals(Address.parse(b));
  } catch {
    return a === b;
  }
};

export const dynamic = "force-dynamic";

/**
 * ?src=market → real-market candles (Yahoo) · ?src=ton → the TON jetton's
 * deepest pool on GeckoTerminal (STON.fi / DeDust).
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ symbol: string }> }) {
  const sym = decodeURIComponent((await ctx.params).symbol);
  const a = (await getPairAssets()).assets.find((x) => x.symbol.toLowerCase() === sym.toLowerCase());
  if (!a) return NextResponse.json({ error: "unknown asset" }, { status: 404 });
  const q = req.nextUrl.searchParams;
  const tf = q.get("tf") ?? "1D";
  const headers = { "cache-control": "s-maxage=30" };
  if (q.get("src") === "ton") {
    if (!a.tonAddress) return NextResponse.json({ candles: [], source: null });
    const pools = await safe(tokenPools("ton", a.tonAddress), [], "stock ton pools");
    const top = pools.value[0];
    if (!top) return NextResponse.json({ candles: [], source: null });
    const map: Record<string, Timeframe> = { "15m": "15m", "1h": "1h", "1D": "1D", "1W": "1D" };
    const [unit, agg] = TIMEFRAMES[map[tf] ?? "1D"];
    const side = same(top.baseAddress, a.tonAddress) ? "base" : "quote";
    const c = await safe(poolOhlcv("ton", top.poolAddress, unit, agg, side), [], "stock ton ohlcv");
    return NextResponse.json({ candles: c.value, source: `${top.dex} · GeckoTerminal` }, { headers });
  }
  if (!a.yahoo) return NextResponse.json({ candles: [], source: null });
  const c = await safe(yahooCandles(a.yahoo, (tf in STOCK_TF ? tf : "1D") as StockTf), [], "yahoo candles");
  return NextResponse.json({ candles: c.value, source: c.value.length ? "Yahoo Finance (real market)" : null }, { headers });
}
