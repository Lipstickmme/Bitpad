import { NextResponse, type NextRequest } from "next/server";
import { runHealth } from "@/lib/health";

export const dynamic = "force-dynamic";

/** GET /api/health → live check of every environment variable (pass/fail only, never values). */
export async function GET(req: NextRequest) {
  const res = await runHealth(req.nextUrl.origin);
  return NextResponse.json(res, { headers: { "cache-control": "no-store" } });
}
