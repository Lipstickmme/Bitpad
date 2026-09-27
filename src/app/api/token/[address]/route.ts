import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "@/lib/market";
import { demoCandles, demoHolders, demoTrades, TIMEFRAMES, type Timeframe } from "@/lib/demo";

export async function GET(req: NextRequest, ctx: { params: Promise<{ address: string }> }) {
  const { address } = await ctx.params;
  const token = await getToken(address);
  if (!token) return NextResponse.json({ error: "not found" }, { status: 404 });
  const tf = (req.nextUrl.searchParams.get("tf") ?? "1m") as Timeframe;
  const safeTf: Timeframe = tf in TIMEFRAMES ? tf : "1m";
  return NextResponse.json({
    token,
    candles: demoCandles(token, safeTf),
    trades: demoTrades(token),
    holders: demoHolders(token),
  });
}
