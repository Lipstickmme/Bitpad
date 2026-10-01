import { NextResponse, type NextRequest } from "next/server";
import { botToken, botUsername, webhookSecret } from "@/lib/telegram";
import { chatChannel, offchainEnabled } from "@/lib/chat-offchain";

export const dynamic = "force-dynamic";

/**
 * One-time bot setup: open https://<your-site>/api/telegram/setup after
 * deploying. Points the bot's webhook at this deployment (with the derived
 * secret), sets its menu button to open the Mini App, and (when
 * TELEGRAM_CHAT_CHANNEL is set) posts and pins an "Open BITPAD" message in
 * the channel, once: if it's already pinned, nothing is posted. Idempotent.
 */
export async function GET(req: NextRequest) {
  const token = botToken();
  if (!token) return NextResponse.json({ ok: false, error: "TELEGRAM_BOT_TOKEN is not set" }, { status: 503 });
  const origin = req.nextUrl.origin;
  if (!origin.startsWith("https://")) return NextResponse.json({ ok: false, error: "Telegram requires an https URL" }, { status: 400 });
  // Only the production deployment may point the bot at itself (a preview URL would hijack the webhook)
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") return NextResponse.json({ ok: false, error: "Run this on the production deployment" }, { status: 403 });
  if (prod && req.nextUrl.host !== prod && !req.nextUrl.host.endsWith(`.${prod}`) && process.env.VERCEL_ENV !== "production") return NextResponse.json({ ok: false, error: `Open it on https://${prod}` }, { status: 403 });
  const call = (method: string, body: object) =>
    fetch(`https://api.telegram.org/bot${token}/${method}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
  const [hook, menu] = await Promise.all([
    call("setWebhook", { url: `${origin}/api/telegram/webhook`, secret_token: webhookSecret(), allowed_updates: ["message"] }),
    call("setChatMenuButton", { menu_button: { type: "web_app", text: "Open BITPAD", web_app: { url: origin } } }),
  ]);
  const bot = await botUsername();
  let channel: string = "not configured (set TELEGRAM_CHAT_CHANNEL)";
  if (offchainEnabled() && bot) {
    const chat = `@${chatChannel()}`;
    const info = await call("getChat", { chat_id: chat });
    if (!info.ok) channel = `can't open ${chat}: add the bot as an admin`;
    else if (String(info.result?.pinned_message?.text ?? "").includes("BITPAD")) channel = "button already pinned";
    else {
      // Channels can't use web_app buttons: a t.me Mini App link opens BITPAD inside Telegram (phone and desktop apps)
      const appLink = process.env.TELEGRAM_APP_NAME ? `https://t.me/${bot}/${process.env.TELEGRAM_APP_NAME}` : `https://t.me/${bot}?startapp`;
      const sent = await call("sendMessage", {
        chat_id: chat,
        text: "🚀 BITPAD\nBuy tokenized stocks on TON and launch creator jettons backed by them.\n\nChat here for free from Trench Chat on Bitpad.",
        disable_web_page_preview: true,
        reply_markup: { inline_keyboard: [[{ text: "🚀 Open BITPAD", url: appLink }], [{ text: "🖥 Open on the web", url: origin }]] },
      });
      const pinned = sent.ok ? await call("pinChatMessage", { chat_id: chat, message_id: sent.result.message_id, disable_notification: true }) : sent;
      channel = pinned.ok ? "Open BITPAD button posted and pinned" : `couldn't post: ${pinned.description ?? "unknown error"}`;
    }
  }
  return NextResponse.json({ ok: !!hook.ok && !!menu.ok, bot, webhook: hook.description ?? hook, menuButton: menu.description ?? menu, channel });
}
