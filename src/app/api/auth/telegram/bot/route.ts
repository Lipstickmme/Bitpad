import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { botToken, botUsername } from "@/lib/telegram";
import { LOGIN_NONCE_COOKIE, readLoginToken, readSession, signSession, SESSION_COOKIE, type TelegramUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const cookieOpts = { httpOnly: true, secure: true, sameSite: "none" as const, path: "/", maxAge: 60 * 60 * 24 * 30 };

function login(req: NextRequest, user: TelegramUser, to: string) {
  const prev = readSession(req.cookies.get(SESSION_COOKIE)?.value);
  const res = NextResponse.redirect(new URL(to, req.nextUrl.origin), 303);
  res.cookies.set(SESSION_COOKIE, signSession({ tg: user, wallets: prev?.wallets ?? [], iat: Date.now() }), cookieOpts);
  res.cookies.delete(LOGIN_NONCE_COOKIE);
  return res;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
function page(title: string, body: string, status = 200) {
  return new NextResponse(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · Bitpad</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0a1215;color:#e6eef0;font:15px/1.5 system-ui,sans-serif}main{max-width:360px;padding:28px;border:1px solid #1f2e33;border-radius:16px;background:#0f191d;text-align:center}h1{font-size:19px;margin:0 0 8px}p{color:#9fb0b5;margin:0 0 18px}button,a.b{display:inline-block;border:0;border-radius:10px;padding:11px 18px;background:#e5484d;color:#fff;font:600 15px system-ui;cursor:pointer;text-decoration:none}</style></head><body><main>${body}</main></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "x-frame-options": "DENY" } },
  );
}

/** Start: remember a nonce in this browser and send the user to the bot. */
export async function PUT() {
  if (!botToken()) return NextResponse.json({ error: "Telegram login isn't set up on this site yet." }, { status: 503 });
  const bot = await botUsername();
  if (!bot) return NextResponse.json({ error: "Couldn't reach the Telegram bot. Try again in a moment." }, { status: 503 });
  const nonce = randomBytes(16).toString("hex");
  const res = NextResponse.json({ url: `https://t.me/${bot}?start=login_${nonce}` });
  res.cookies.set(LOGIN_NONCE_COOKIE, nonce, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 600 });
  return res;
}

/**
 * The bot's login link. Same browser that started (nonce cookie matches):
 * log in straight away. Any other browser: ask first, so nobody can log you
 * into their account by sending you their link.
 */
export async function GET(req: NextRequest) {
  const t = req.nextUrl.searchParams.get("t");
  const d = readLoginToken(t);
  if (!d) return page("Link expired", `<h1>This login link has expired</h1><p>Login links work for 10 minutes. Start again from Bitpad.</p><a class="b" href="/">Back to Bitpad</a>`, 400);
  if (req.cookies.get(LOGIN_NONCE_COOKIE)?.value === d.nonce) return login(req, d.user, "/?tg=ok");
  const who = d.user.username ? `@${d.user.username}` : d.user.first_name;
  return page("Confirm login", `<h1>Log in as ${esc(who)}?</h1><p>Only continue if you just asked to log in to Bitpad from Telegram.</p><form method="post"><input type="hidden" name="t" value="${esc(t!)}"><button>Log in to Bitpad</button></form>`);
}

/** Confirmation from the page above (same-origin form only). */
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  if ((origin && origin !== req.nextUrl.origin) || req.headers.get("sec-fetch-site") === "cross-site") return page("Not allowed", "<h1>Not allowed</h1><p>Start the login from Bitpad.</p>", 403);
  const form = await req.formData().catch(() => null);
  const d = readLoginToken(String(form?.get("t") ?? ""));
  if (!d) return page("Link expired", `<h1>This login link has expired</h1><p>Start again from Bitpad.</p><a class="b" href="/">Back to Bitpad</a>`, 400);
  return login(req, d.user, "/?tg=ok");
}
