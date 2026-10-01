import { NextResponse, type NextRequest } from "next/server";
import { getChainMarket } from "@/lib/chain-market";

export async function GET(req: NextRequest) {
  const chain = req.nextUrl.searchParams.get("chain");
  if (chain !== "ethereum" && chain !== "solana") return NextResponse.json({ error: "chain must be ethereum or solana" }, { status: 400 });
  return NextResponse.json(await getChainMarket(chain), { headers: { "cache-control": "public, s-maxage=120, stale-while-revalidate=300" } });
}
