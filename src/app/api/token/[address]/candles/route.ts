import { NextResponse, type NextRequest } from "next/server";
import { getCandles, getToken, TIMEFRAMES, type Timeframe } from "@/lib/market";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ address: string }> }) {
  const token = await getToken((await ctx.params).address);
  if (!token) return NextResponse.json({ error: "not found" }, { status: 404 });
  const tf = (req.nextUrl.searchParams.get("tf") ?? "15m") as Timeframe;
  return NextResponse.json(await getCandles(token, tf in TIMEFRAMES ? tf : "15m"), { headers: { "cache-control": "s-maxage=15" } });
}
