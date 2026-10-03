import { NextResponse } from "next/server";
import type { ChainId } from "@/lib/types";
import { CHAINS } from "@/lib/chains";
import { holderCounts } from "@/lib/holders";

/** GET /api/holders?chain=ton&a=addr1,addr2 → { counts: { addr: number | null } } (max 40 per call). */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const chain = (u.searchParams.get("chain") ?? "ton") as ChainId;
  if (!(chain in CHAINS)) return NextResponse.json({ error: "Unknown chain" }, { status: 400 });
  const addrs = (u.searchParams.get("a") ?? "").split(",").map((s) => s.trim()).filter((s) => /^[A-Za-z0-9:_\-]{20,80}$/.test(s)).slice(0, 40);
  if (!addrs.length) return NextResponse.json({ counts: {} });
  const counts = await holderCounts(chain, addrs);
  return NextResponse.json({ counts }, { headers: { "cache-control": "public, s-maxage=1800, stale-while-revalidate=3600" } });
}
