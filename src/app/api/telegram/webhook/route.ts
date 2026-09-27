import { NextResponse, type NextRequest } from "next/server";
import { getBitpadTokens, getTonMarket, getToken, searchTokens } from "@/lib/market";
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
    const [bp, ton] = await Promise.all([getBitpadTokens(), getTonMarket()]);
    const list = [...bp.tokens, ...ton.tokens].sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0)).slice(0, 8);
    text = list.length
      ? "<b>🔥 Trending on TON</b>\n" + list.map((t, i) => `${i + 1}. <b>$${t.symbol}</b> / ${t.pair.symbol} · ${t.marketCap ?? t.fdv ? usd((t.marketCap ?? t.fdv)!, { compact: true }) : "—"} · ${t.change24h != null ? pct(t.change24h) : "—"}`).join("\n")
      : "Market data is unavailable right now.";
  } else if (cmd.startsWith("/price") && arg) {
    const hit = (await searchTokens(arg.replace("$", "")).catch(() => []))[0];
    const t = hit ? await getToken(hit.address) : undefined;
    text = t
      ? `<b>$${t.symbol}</b> ${t.priceUsd != null ? price(t.priceUsd) : "—"}${t.change24h != null ? ` (${pct(t.change24h)})` : ""}\nMC ${t.marketCap != null ? usd(t.marketCap, { compact: true }) : "—"} · Vol ${t.volume24h != null ? usd(t.volume24h, { compact: true }) : "—"}\n${config.appUrl}/token/${t.address}`
      : `No TON token matches ${arg}`;
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
