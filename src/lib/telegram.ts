import "server-only";
import { createHash } from "node:crypto";
import { memo } from "./data/http";

/** Everything Telegram derives from TELEGRAM_BOT_TOKEN — no extra env vars. */
export const botToken = () => process.env.TELEGRAM_BOT_TOKEN ?? "";

const derive = (label: string) => createHash("sha256").update(`bitpad:${label}:${botToken()}`).digest("hex");

/** Signs Bitpad session cookies. */
export const sessionSecret = () => (botToken() ? derive("session") : "dev-only-secret");

/** `secret_token` for the bot webhook (Telegram allows [A-Za-z0-9_-], max 256). */
export const webhookSecret = () => derive("webhook").slice(0, 64);

/** Bot username for the Login Widget, from Telegram's getMe (cached for a day). */
export async function botUsername(): Promise<string> {
  if (!botToken()) return "";
  try {
    return await memo("tg:getMe", 86_400_000, async () => {
      const r = await fetch(`https://api.telegram.org/bot${botToken()}/getMe`, { next: { revalidate: 86_400 } } as RequestInit);
      const j = (await r.json()) as { ok: boolean; result?: { username?: string } };
      if (!j.ok || !j.result?.username) throw new Error("getMe failed");
      return j.result.username;
    });
  } catch {
    return "";
  }
}
