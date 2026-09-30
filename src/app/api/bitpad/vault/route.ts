import { NextResponse, type NextRequest } from "next/server";
import { readStaker, readVault } from "@/lib/bitpad";

export const dynamic = "force-dynamic";

/** GET /api/bitpad/vault?pool=<pool>&me=<wallet> — the launch's staking vault and your position. */
export async function GET(req: NextRequest) {
  const pool = req.nextUrl.searchParams.get("pool");
  const me = req.nextUrl.searchParams.get("me");
  if (!pool) return NextResponse.json({ error: "pool required" }, { status: 400 });
  try {
    const vault = await readVault(pool);
    if (!vault) return NextResponse.json({ vault: null });
    return NextResponse.json({ vault, me: me ? await readStaker(vault.address, me) : null }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: `Vault unavailable: ${(e as Error).message}` }, { status: 502 });
  }
}
