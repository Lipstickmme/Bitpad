import { NextResponse, type NextRequest } from "next/server";
import { Address } from "@ton/core";
import { bundlerFeeBps, readPool, readReferrers } from "@/lib/bitpad";

export const dynamic = "force-dynamic";

const same = (a?: string | null, b?: string | null) => {
  try {
    return !!a && !!b && Address.parse(a).equals(Address.parse(b));
  } catch {
    return false;
  }
};

/**
 * Live BitpadPool state for the trade panel and dashboards.
 *   ?address=<pool>&me=<wallet>&ref=<referral link wallet>
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const address = q.get("address");
  if (!address) return NextResponse.json({ error: "address required" }, { status: 400 });
  try {
    const [pool, referrers, bundleFee] = await Promise.all([readPool(address), readReferrers(address).catch(() => []), bundlerFeeBps()]);
    const me = q.get("me");
    const ref = q.get("ref");
    const refRow = referrers.find((r) => same(r.address, ref));
    return NextResponse.json({
      pool,
      referrers,
      bundlerFeeBps: bundleFee,
      // a link is usable for buys if it's the creator or an active registered referrer
      refValid: !!ref && (same(ref, pool.creator) || !!refRow?.active),
      me: me ? { isCreator: same(me, pool.creator), referrer: referrers.find((r) => same(r.address, me)) ?? null } : null,
    }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: `Pool unavailable: ${(e as Error).message}` }, { status: 502 });
  }
}
