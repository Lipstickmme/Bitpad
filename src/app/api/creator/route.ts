import { NextResponse, type NextRequest } from "next/server";
import { Address } from "@ton/core";
import { readSession, SESSION_COOKIE } from "@/lib/auth";
import { creatorBoard, signCreator } from "@/lib/creators";
import { getBitpadTokens } from "@/lib/market";

export const dynamic = "force-dynamic";

/** Creator jettons launched on Bitpad (verified first), with the tokens paired against each. */
export async function GET() {
  const { tokens, ok } = await getBitpadTokens();
  const board = creatorBoard(tokens).map(({ token, paired }) => ({
    address: token.address, symbol: token.symbol, name: token.name, image: token.image, creator: token.bitpad?.creator,
    profile: token.bitpad?.creatorJetton, priceUsd: token.priceUsd, marketCap: token.marketCap, change24h: token.change24h, pairedCount: paired.length,
  }));
  return NextResponse.json({ creators: board, ok });
}

/**
 * Sign the logged-in Telegram identity for a creator-jetton launch from
 * `wallet` with ticker `symbol`. Requires a Telegram session with a username.
 */
export async function POST(req: NextRequest) {
  const s = readSession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!s?.tg) return NextResponse.json({ error: "Log in with Telegram to launch a creator jetton" }, { status: 401 });
  if (!s.tg.username) return NextResponse.json({ error: "Set a Telegram username first (Settings → Username), then log in again" }, { status: 400 });
  const body = (await req.json().catch(() => ({}))) as { wallet?: string; symbol?: string };
  const symbol = String(body.symbol ?? "").toUpperCase();
  if (!/^[A-Z0-9]{2,10}$/.test(symbol)) return NextResponse.json({ error: "Bad ticker" }, { status: 400 });
  try {
    Address.parse(String(body.wallet));
  } catch {
    return NextResponse.json({ error: "Connect a TON wallet first" }, { status: 400 });
  }
  const tg = s.tg;
  const name = [tg.first_name, tg.last_name].filter(Boolean).join(" ").slice(0, 64);
  return NextResponse.json({
    creator_tg: tg.username,
    creator_tg_id: String(tg.id),
    creator_name: name,
    creator_sig: signCreator(tg.id, tg.username!, String(body.wallet), symbol),
  });
}
