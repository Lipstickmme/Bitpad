import { NextResponse, type NextRequest } from "next/server";
import { searchTokens } from "@/lib/market";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    return NextResponse.json({ results: await searchTokens(req.nextUrl.searchParams.get("q") ?? "") });
  } catch {
    return NextResponse.json({ results: [], error: "search unavailable" }, { status: 502 });
  }
}
