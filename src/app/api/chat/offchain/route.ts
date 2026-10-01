import { NextResponse, type NextRequest } from "next/server";
import { readSession, SESSION_COOKIE } from "@/lib/auth";
import { formatOffchain, offchainEnabled, OFFCHAIN_MAX, postOffchain } from "@/lib/chat-offchain";
import { isAllowedGif, STICKERS } from "@/lib/chat";

export const dynamic = "force-dynamic";

// Best-effort flood control per server instance (plus a per-browser cookie)
const lastPost = new Map<number, number>();
const GAP_MS = 6_000;
const THROTTLE_COOKIE = "bitpad_chat_last";

/** Free, off-chain Trench Chat message from a Telegram-logged-in user (stored in the Telegram channel). */
export async function POST(req: NextRequest) {
  if (!offchainEnabled()) return NextResponse.json({ error: "Free chat isn't set up on this site yet." }, { status: 503 });
  const s = readSession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!s?.tg) return NextResponse.json({ error: "Log in with Telegram to chat for free." }, { status: 401 });
  const now = Date.now();
  const last = Math.max(lastPost.get(s.tg.id) ?? 0, Number(req.cookies.get(THROTTLE_COOKIE)?.value) || 0);
  if (now - last < GAP_MS) return NextResponse.json({ error: "Slow down a little: one message every few seconds." }, { status: 429 });

  const body = (await req.json().catch(() => ({}))) as { text?: string; parent?: string | null; sticker?: string | null; gif?: string | null };
  // eslint-disable-next-line no-control-regex
  const text = String(body.text ?? "").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").trim().slice(0, OFFCHAIN_MAX);
  const sticker = body.sticker && (STICKERS as readonly string[]).includes(body.sticker) ? body.sticker : null;
  const gif = body.gif && isAllowedGif(body.gif) ? body.gif : null;
  const parent = body.parent && /^(tg:\d{1,12}|[0-9a-f]{64})$/.test(body.parent) ? body.parent : null;
  if (!text && !sticker && !gif) return NextResponse.json({ error: "Write something first." }, { status: 400 });

  lastPost.set(s.tg.id, now);
  if (lastPost.size > 5000) lastPost.clear();
  const name = [s.tg.first_name, s.tg.last_name].filter(Boolean).join(" ") || "Anon";
  try {
    const id = await postOffchain(formatOffchain({ name, username: s.tg.username, text, parent, sticker, gif }));
    const res = NextResponse.json({ id: `tg:${id}` });
    res.cookies.set(THROTTLE_COOKIE, String(now), { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 });
    return res;
  } catch (e) {
    lastPost.delete(s.tg.id);
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
