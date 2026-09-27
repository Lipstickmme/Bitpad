import { NextResponse } from "next/server";
import { getAnalytics } from "@/lib/analytics";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getAnalytics(), { headers: { "cache-control": "s-maxage=90, stale-while-revalidate=180" } });
}
