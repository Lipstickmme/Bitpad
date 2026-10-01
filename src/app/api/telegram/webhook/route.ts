import { NextResponse, type NextRequest } from "next/server";
import { getBitpadTokens, getTonMarket, getToken, searchTokens } from "@/lib/market";
import { botToken, webhookSecret } from "@/lib/telegram";
import { price, pct, usd } from "@/lib/format";

/** Token names come from on-chain metadata: escape them for Telegram's HTML parse mode. */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Telegram bot webhook. Register it once by opening /api/telegram/setup on the deployed site. */
export async function POST(req: NextRequest) {
  const bot = botToken();
  if (!bot) return NextResponse.json({ ok: false }, { status: 503 });
  if (req.headers.get("x-telegram-bot-api-secret-token") !== webhookSecret()) return NextResponse.json({ ok: false }, { status: 401 });

  const update = await req.json();
  const msg = update.message;
  if (!msg?.text) return NextResponse.json({ ok: true });
  const [cmd, arg] = String(msg.text).trim().split(/\s+/);
  const origin = req.nextUrl.origin;
  const app = { text: "🚀 Open BITPAD", web_app: { url: origin } };
  let text = "";

  if (cmd === "/start" && /^login_[a-f0-9]{32}$/.test(arg ?? "") && msg.from?.id) {
    // Bot login: the update is webhook-verified, so msg.from is the real Telegram user
    const { signLoginToken } = await import("@/lib/auth");
    const f = msg.from;
    const user = { id: Number(f.id), first_name: String(f.first_name ?? ""), last_name: f.last_name, username: f.username };
    const link = `${origin}/api/auth/telegram/bot?t=${signLoginToken(user, arg.slice(6))}`;
    await fetch(`https://api.telegram.org/bot${bot}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: msg.chat.id, text: "Tap below to finish logging in to <b>Bitpad</b>. The link works for 10 minutes.\n\nDidn't ask to log in? Ignore this message.", parse_mode: "HTML", reply_markup: { inline_keyboard: [[{ text: "✅ Log in to Bitpad", url: link }]] } }),
    });
    return NextResponse.json({ ok: true });
  } else if (cmd === "/start" && arg === "app") {
    // From the channel's "Open BITPAD" button: one tap opens the Mini App (phone and desktop Telegram)
    text = "Tap below to open <b>BITPAD</b> right here in Telegram.";
  } else if (cmd.startsWith("/start")) {
    text = "<b>Bitpad</b> — buy tokenized stocks on TON and launch creator jettons backed by them.\n\n/trending — top movers\n/price SYMBOL — token price";
  } else if (cmd.startsWith("/trending")) {
    const [bp, ton] = await Promise.all([getBitpadTokens(), getTonMarket()]);
    const list = [...bp.tokens, ...ton.tokens].sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0)).slice(0, 8);
    text = list.length
      ? "<b>🔥 Trending on TON</b>\n" + list.map((t, i) => `${i + 1}. <b>$${esc(t.symbol)}</b> / ${esc(t.pair.symbol)} · ${t.marketCap ?? t.fdv ? usd((t.marketCap ?? t.fdv)!, { compact: true }) : "—"} · ${t.change24h != null ? pct(t.change24h) : "—"}`).join("\n")
      : "Market data is unavailable right now.";
  } else if (cmd.startsWith("/price") && arg) {
    const hit = (await searchTokens(arg.replace("$", "")).catch(() => []))[0];
    const t = hit ? await getToken(hit.address) : undefined;
    text = t
      ? `<b>$${esc(t.symbol)}</b> ${t.priceUsd != null ? price(t.priceUsd) : "—"}${t.change24h != null ? ` (${pct(t.change24h)})` : ""}\nMC ${t.marketCap != null ? usd(t.marketCap, { compact: true }) : "—"} · Vol ${t.volume24h != null ? usd(t.volume24h, { compact: true }) : "—"}\n${origin}/token/${t.address}`
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
