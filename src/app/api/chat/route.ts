import { NextResponse, type NextRequest } from "next/server";
import { Address } from "@ton/core";
import { getChat } from "@/lib/chat-feed";
import { accountJettons } from "@/lib/data/tonapi";

export const dynamic = "force-dynamic";

/**
 * GET /api/chat?me=<wallet>                → room address, posts, which ones you liked
 * GET /api/chat?holds=<token>&me=<wallet>  → can this wallet post a call on that token
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const me = q.get("me");
  const holdsToken = q.get("holds");
  if (holdsToken) {
    if (!me) return NextResponse.json({ holds: false });
    try {
      const t = Address.parse(holdsToken);
      const list = await accountJettons(me);
      const hit = list.find((b) => Address.parse(b.jetton.address).equals(t));
      return NextResponse.json({ holds: !!hit && BigInt(hit.balance) > 0n, symbol: hit?.jetton.symbol ?? null });
    } catch {
      return NextResponse.json({ holds: false, error: "Couldn't check your balance" });
    }
  }
  const c = await getChat();
  const liked = (id: string) => {
    if (!me) return false;
    try {
      const m = Address.parse(me);
      return (c.likedBy?.[id] ?? []).some((a) => Address.parse(a).equals(m));
    } catch {
      return false;
    }
  };
  return NextResponse.json(
    { room: c.room, deployed: c.deployed, ok: c.ok, messages: c.messages.slice(0, 150).map((m) => ({ ...m, liked: liked(m.id) })) },
    { headers: { "cache-control": "no-store" } },
  );
}
