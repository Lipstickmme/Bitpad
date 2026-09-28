import { NextResponse, type NextRequest } from "next/server";
import { botToken } from "@/lib/telegram";
import { readSession, signSession, verifyInitData, verifyLoginWidget, SESSION_COOKIE } from "@/lib/auth";

/** POST { initData } from a Mini App, or the Login Widget payload. */
export async function POST(req: NextRequest) {
  const bot = botToken();
  if (!bot) return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN not configured" }, { status: 503 });
  const body = await req.json();
  const user = typeof body.initData === "string" ? verifyInitData(body.initData, bot) : verifyLoginWidget(body, bot);
  if (!user) return NextResponse.json({ error: "invalid Telegram signature" }, { status: 401 });
  const prev = readSession(req.cookies.get(SESSION_COOKIE)?.value);
  const res = NextResponse.json({ user });
  res.cookies.set(SESSION_COOKIE, signSession({ tg: user, wallets: prev?.wallets ?? [], iat: Date.now() }), {
    httpOnly: true, secure: true, sameSite: "none", path: "/", maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

export async function GET(req: NextRequest) {
  return NextResponse.json({ session: readSession(req.cookies.get(SESSION_COOKIE)?.value) });
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
