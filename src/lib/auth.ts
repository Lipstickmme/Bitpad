import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { sessionSecret } from "./telegram";

export type { TelegramUser } from "./auth-types";
import type { TelegramUser } from "./auth-types";
export interface Session {
  tg?: TelegramUser;
  wallets: { chain: "ton" | "solana" | "evm"; address: string }[];
  iat: number;
}

const MAX_AGE = 60 * 60 * 24; // auth_date freshness window (s)

function eq(a: string, b: string) {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Telegram Login Widget — https://core.telegram.org/widgets/login#checking-authorization */
export function verifyLoginWidget(data: Record<string, string | number>, botToken: string): TelegramUser | null {
  const { hash, ...rest } = data;
  if (!hash) return null;
  const check = Object.keys(rest).sort().map((k) => `${k}=${rest[k]}`).join("\n");
  const secret = createHash("sha256").update(botToken).digest();
  const sig = createHmac("sha256", secret).update(check).digest("hex");
  if (!eq(sig, String(hash))) return null;
  if (Date.now() / 1000 - Number(rest.auth_date) > MAX_AGE) return null;
  return { id: Number(rest.id), first_name: String(rest.first_name ?? ""), last_name: rest.last_name as string | undefined, username: rest.username as string | undefined, photo_url: rest.photo_url as string | undefined };
}

/** Telegram Mini App initData — https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app */
export function verifyInitData(initData: string, botToken: string): TelegramUser | null {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");
  const check = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join("\n");
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const sig = createHmac("sha256", secret).update(check).digest("hex");
  if (!eq(sig, hash)) return null;
  if (Date.now() / 1000 - Number(params.get("auth_date")) > MAX_AGE) return null;
  try {
    return JSON.parse(params.get("user") ?? "null");
  } catch {
    return null;
  }
}

const secret = sessionSecret;

export function signSession(s: Session): string {
  const body = Buffer.from(JSON.stringify(s)).toString("base64url");
  const sig = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

const SESSION_TTL_MS = 30 * 86_400_000;

export function readSession(token?: string): Session | null {
  if (!token || !process.env.TELEGRAM_BOT_TOKEN) return null; // no bot token → no sessions (the dev secret is never trusted)
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expect = createHmac("sha256", secret()).update(body).digest("base64url");
  if (expect.length !== sig.length || !timingSafeEqual(Buffer.from(expect), Buffer.from(sig))) return null;
  try {
    const s = JSON.parse(Buffer.from(body, "base64url").toString()) as Session;
    return Date.now() - Number(s.iat) < SESSION_TTL_MS ? s : null;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = "bitpad_session";

/**
 * Bot login (no Login Widget, so no /setdomain needed): the bot answers
 * `/start login_<nonce>` with a short-lived signed link carrying the Telegram
 * user it saw in the (webhook-verified) update.
 */
const LOGIN_TTL_MS = 10 * 60_000;
export const LOGIN_NONCE_COOKIE = "bitpad_tg_nonce";

export function signLoginToken(user: TelegramUser, nonce: string, now = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ u: user, n: nonce, e: now + LOGIN_TTL_MS })).toString("base64url");
  const sig = createHmac("sha256", secret()).update(`login:${body}`).digest("base64url");
  return `${body}.${sig}`;
}

export function readLoginToken(token: string | null | undefined, now = Date.now()): { user: TelegramUser; nonce: string } | null {
  if (!token || !process.env.TELEGRAM_BOT_TOKEN) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expect = createHmac("sha256", secret()).update(`login:${body}`).digest("base64url");
  if (expect.length !== sig.length || !timingSafeEqual(Buffer.from(expect), Buffer.from(sig))) return null;
  try {
    const d = JSON.parse(Buffer.from(body, "base64url").toString()) as { u: TelegramUser; n: string; e: number };
    return now < d.e && d.u?.id ? { user: d.u, nonce: d.n } : null;
  } catch {
    return null;
  }
}
