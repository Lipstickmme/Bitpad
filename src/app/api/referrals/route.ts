import { NextResponse, type NextRequest } from "next/server";
import { getGeneralReferrals } from "@/lib/general-referrals";
import { norm } from "@/lib/gref";

export const dynamic = "force-dynamic";

/** GET /api/referrals?address=<wallet> — your referral stats + the leaderboard. */
export async function GET(req: NextRequest) {
  const r = await getGeneralReferrals();
  const me = norm(req.nextUrl.searchParams.get("address") ?? "");
  const rows = [...r.stats.values()];
  const mine = me ? r.stats.get(me) ?? null : null;
  return NextResponse.json(
    {
      ok: r.ok,
      feeWallet: r.feeWallet,
      shareBps: r.shareBps,
      me: mine ? { ...mine, history: mine.history.slice(0, 100) } : null,
      leaderboard: rows.sort((a, b) => b.earned - a.earned).slice(0, 10).map(({ history: _h, ...x }) => x),
      totals: { referrers: rows.length, fees: rows.reduce((s, x) => s + x.fees, 0), earned: rows.reduce((s, x) => s + x.earned, 0), paid: rows.reduce((s, x) => s + x.paid, 0) },
    },
    { headers: { "cache-control": "no-store" } },
  );
}
