import { NextResponse, type NextRequest } from "next/server";
import { poolOhlcv } from "@/lib/data/gecko";
import { TIMEFRAMES, type Timeframe } from "@/lib/timeframes";
import { CHAINS } from "@/lib/chains";
import type { ChainId } from "@/lib/types";
import { safe } from "@/lib/data/http";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ chain: string; pool: string }> }) {
  const { chain, pool } = await ctx.params;
  if (!(chain in CHAINS) || !CHAINS[chain as ChainId].gecko) return NextResponse.json({ error: "unknown chain" }, { status: 400 });
  const tf = (req.nextUrl.searchParams.get("tf") ?? "15m") as Timeframe;
  const [unit, agg] = TIMEFRAMES[tf in TIMEFRAMES ? tf : "15m"];
  const c = await safe(poolOhlcv(chain as ChainId, pool, unit, agg), [], "pool ohlcv");
  return NextResponse.json({ candles: c.value, source: c.ok ? "GeckoTerminal" : null }, { headers: { "cache-control": "s-maxage=15" } });
}
