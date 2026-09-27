import { NextResponse } from "next/server";
import { getPairAssets } from "@/lib/prices";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getPairAssets(), { headers: { "cache-control": "s-maxage=30, stale-while-revalidate=60" } });
}
