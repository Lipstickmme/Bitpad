import { NextResponse } from "next/server";
import { getBitpadTokens, getTonMarket } from "@/lib/market";
import { getPairAssets } from "@/lib/prices";

export const dynamic = "force-dynamic";

export async function GET() {
  const [bitpad, ton, pa] = await Promise.all([getBitpadTokens(), getTonMarket(), getPairAssets()]);
  return NextResponse.json({ bitpad, ton, assets: pa.assets, assetsLive: pa.live }, { headers: { "cache-control": "s-maxage=30, stale-while-revalidate=60" } });
}
