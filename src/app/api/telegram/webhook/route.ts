import { NextResponse, type NextRequest } from "next/server";
import { getTokens } from "@/lib/market";
import { config } from "@/lib/config";
import { price, pct, usd } from "@/lib/format";

/**
 * Telegram bot webhook. Register with:
 *   curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook?url=$APP_URL/api/telegram/webhook&secret_token=$TELEGRAM_WEBHOOK_SECRET"
 */
export async function POST(req: NextRequest) {
  const bot = process.env.TELEGRAM_BOT_TOKEN;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!bot) return NextResponse.json({ ok: false }, { status: 503 });
  if (secret && req.headers.get("x-telegram-bot-api-secret-token") !== secret) return NextResponse.json({ ok: false }, { status: 401 });

  const update = await req.json();
  const msg = update.message;
  if (!msg?.text) return NextResponse.json({ ok: true });
  const [cmd, arg] = String(msg.text).trim().split(/\s+/);
  const app = { text: "Open Bitpad", web_app: { url: config.appUrl } };
  let text = "";

  if (cmd.startsWith("/start")) {
    text = "<b>Bitpad</b> — launch tokens paired with stocks, gold and TON jettons. Liquidity is live from block one.\n\n/trending — top movers\n/price SYMBOL — token price";
  } else if (cmd.startsWith("/trending")) {
    const top = (await getTokens()).sort((a, b) => b.volume24h - a.volume24h).slice(0, 8);
    text = "<b>🔥 Trending on Bitpad</b>\n" + top.map((t, i) => `${i + 1}. <b>$${t.symbol}</b> / ${t.pair.symbol} · ${usd(t.marketCap, { compact: true })} · ${pct(t.change24h)}`).join("\n");
  } else if (cmd.startsWith("/price") && arg) {
    const t = (await getTokens()).find((x) => x.symbol.toLowerCase() === arg.replace("$", "").toLowerCase());
    text = t ? `<b>$${t.symbol}</b> ${price(t.priceUsd)} (${pct(t.change24h)})\nMC ${usd(t.marketCap, { compact: true })} · Vol ${usd(t.volume24h, { compact: true })}\nPaired with ${t.pair.symbol}` : `No token ${arg}`;
  } else {
    return NextResponse.json({ ok: true });
  }

  await fetch(`https://api.telegram.org/bot${bot}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: msg.chat.id, text, parse_mode: "HTML", reply_markup: { inline_keyboard: [[app]] } }),
  });
  return NextResponse.json({ ok: true });
}
