import { NextResponse } from "next/server";
import { getFeeRevenue } from "@/lib/fees";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getFeeRevenue(), { headers: { "cache-control": "s-maxage=60" } });
}
