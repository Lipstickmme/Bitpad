import { NextResponse, type NextRequest } from "next/server";
import { launchOf } from "@/lib/bitpad";

export const dynamic = "force-dynamic";

/** ?creator=<wallet>&since=<launch index> → the creator's launch once it's on-chain. */
export async function GET(req: NextRequest) {
  const creator = req.nextUrl.searchParams.get("creator");
  const since = Number(req.nextUrl.searchParams.get("since") ?? 0);
  if (!creator) return NextResponse.json({ error: "creator required" }, { status: 400 });
  try {
    const l = await launchOf(creator, since);
    return NextResponse.json({ launch: l ? { index: l.index, minter: l.minter, pool: l.pool, symbol: l.meta.symbol } : null });
  } catch (e) {
    return NextResponse.json({ launch: null, error: (e as Error).message });
  }
}
