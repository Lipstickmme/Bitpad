import { NextResponse, type NextRequest } from "next/server";
import { botToken, botUsername, webhookSecret } from "@/lib/telegram";

export const dynamic = "force-dynamic";

/**
 * One-time bot setup: open https://<your-site>/api/telegram/setup after
 * deploying. Points the bot's webhook at this deployment (with the derived
 * secret) and sets its menu button to open the Mini App. Idempotent.
 */
export async function GET(req: NextRequest) {
  const token = botToken();
  if (!token) return NextResponse.json({ ok: false, error: "TELEGRAM_BOT_TOKEN is not set" }, { status: 503 });
  const origin = req.nextUrl.origin;
  if (!origin.startsWith("https://")) return NextResponse.json({ ok: false, error: "Telegram requires an https URL" }, { status: 400 });
  const call = (method: string, body: object) =>
    fetch(`https://api.telegram.org/bot${token}/${method}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
  const [hook, menu] = await Promise.all([
    call("setWebhook", { url: `${origin}/api/telegram/webhook`, secret_token: webhookSecret(), allowed_updates: ["message"] }),
    call("setChatMenuButton", { menu_button: { type: "web_app", text: "Open Bitpad", web_app: { url: origin } } }),
  ]);
  return NextResponse.json({ ok: !!hook.ok && !!menu.ok, bot: await botUsername(), webhook: hook.description ?? hook, menuButton: menu.description ?? menu });
}
