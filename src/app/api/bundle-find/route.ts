import { NextResponse, type NextRequest } from "next/server";
import { Address } from "@ton/core";
import { accountEventsPaged, friendly } from "@/lib/data/tonapi";
import { safe } from "@/lib/data/http";

export const dynamic = "force-dynamic";

const FUND_COMMENT = "Bitpad bundle";

/**
 * GET /api/bundle-find?owner=<main wallet> → the W5 wallets this wallet sent GRAM to,
 * which is how bundler burners get funded. Helps people who lost a browser's vault
 * see where their burners are and what they hold. It can't recover keys: moving
 * those funds still needs the backup or the 24 words.
 */
export async function GET(req: NextRequest) {
  const owner = req.nextUrl.searchParams.get("owner") ?? "";
  let raw: string;
  try {
    raw = Address.parse(owner).toRawString();
  } catch {
    return NextResponse.json({ error: "Not a TON address" }, { status: 400 });
  }
  const events = await safe(accountEventsPaged(owner, 1000), [], "tonapi events");
  if (!events.ok) return NextResponse.json({ error: "Couldn't read this wallet's history right now. Try again in a minute." }, { status: 502 });

  const byTo = new Map<string, { sent: number; count: number; last: number; tagged: boolean }>();
  for (const e of events.value)
    for (const a of e.actions) {
      const t = a.TonTransfer;
      if (a.type !== "TonTransfer" || a.status !== "ok" || !t) continue;
      let from: string, to: string;
      try {
        from = Address.parse(t.sender.address).toRawString();
        to = Address.parse(t.recipient.address).toRawString();
      } catch { continue; }
      if (from !== raw || to === raw) continue;
      const cur = byTo.get(to) ?? { sent: 0, count: 0, last: 0, tagged: false };
      cur.sent += t.amount / 1e9;
      cur.count += 1;
      cur.last = Math.max(cur.last, e.timestamp * 1000);
      cur.tagged ||= t.comment === FUND_COMMENT;
      byTo.set(to, cur);
    }
  const candidates = [...byTo.entries()].sort((a, b) => b[1].last - a[1].last).slice(0, 100);

  // Which recipients are W5 wallets (what the bundler creates), and what they hold now
  const info = new Map<string, { balance: number; interfaces: string[] }>();
  if (candidates.length) {
    const res = await fetch("https://tonapi.io/v2/accounts/_bulk", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json", ...(process.env.TONAPI_KEY ? { authorization: `Bearer ${process.env.TONAPI_KEY}` } : {}) },
      body: JSON.stringify({ account_ids: candidates.map(([a]) => a) }),
      signal: AbortSignal.timeout(10_000),
    }).catch(() => null);
    const j = res?.ok ? ((await res.json()) as { accounts?: { address: string; balance: number; interfaces?: string[] }[] }) : null;
    for (const a of j?.accounts ?? []) {
      try { info.set(Address.parse(a.address).toRawString(), { balance: a.balance / 1e9, interfaces: a.interfaces ?? [] }); } catch { /* skip */ }
    }
  }
  const wallets = candidates
    .map(([to, v]) => ({ address: friendly(to, false), ...v, balance: info.get(to)?.balance ?? null, w5: info.get(to)?.interfaces.some((i) => /wallet_v5/i.test(i)) ?? null }))
    .filter((w) => w.tagged || w.w5 !== false);
  return NextResponse.json({ wallets, scanned: events.value.length });
}
