import "server-only";
import { botToken } from "./telegram";
import { memo } from "./data/http";
import { isAllowedGif, STICKERS } from "./chat";

/**
 * Off-chain Trench Chat: free messages from Telegram-logged-in users, stored
 * on Telegram's servers. The Bitpad bot posts each one into a public channel
 * (TELEGRAM_CHAT_CHANNEL, the bot must be an admin there), and the feed is
 * read back from the channel's public web preview (t.me/s/<channel>). No
 * database. Messages are plain text in a fixed shape:
 *
 *   💬 Name (@username)
 *   message text…
 *   #sticker gm | #gif https://media.giphy.com/…   (optional)
 *   ↪ <parent id>                                   (optional, replies)
 */
export const chatChannel = () => (process.env.TELEGRAM_CHAT_CHANNEL ?? "").replace(/^@|^https:\/\/t\.me\//, "").trim();
export const offchainEnabled = () => !!botToken() && /^[A-Za-z0-9_]{4,32}$/.test(chatChannel());

export const OFFCHAIN_MAX = 500;
const HEAD = "💬 ";

export interface OffchainMessage {
  id: string; // "tg:<message id>"
  time: number;
  author: string; // "@username" or display name
  authorName: string;
  kind: "post" | "reply";
  parent: string | null;
  text: string;
  media: { type: "gif"; url: string } | { type: "sticker"; id: string } | null;
  url: string;
}

export function formatOffchain(p: { name: string; username?: string; text: string; parent?: string | null; sticker?: string | null; gif?: string | null }): string {
  const who = `${p.name.replace(/[\r\n]/g, " ").slice(0, 64)}${p.username ? ` (@${p.username})` : ""}`;
  const lines = [`${HEAD}${who}`, p.text];
  if (p.sticker) lines.push(`#sticker ${p.sticker}`);
  if (p.gif) lines.push(`#gif ${p.gif}`);
  if (p.parent) lines.push(`↪ ${p.parent}`);
  return lines.filter((l) => l !== "").join("\n");
}

const PARENT_RE = /^(tg:\d+|[0-9a-f]{64})$/;
export function parseOffchain(raw: string, id: number, time: number, channel: string): OffchainMessage | null {
  if (!raw.startsWith(HEAD)) return null;
  const lines = raw.split("\n");
  const head = lines.shift()!.slice(HEAD.length);
  const m = head.match(/^(.*?)(?: \(@([A-Za-z0-9_]{3,32})\))?$/);
  const name = (m?.[1] ?? head).trim();
  const username = m?.[2];
  let parent: string | null = null;
  let media: OffchainMessage["media"] = null;
  while (lines.length) {
    const last = lines[lines.length - 1];
    const r = last.match(/^↪ (\S+)$/);
    const s = last.match(/^#sticker (\w+)$/);
    const g = last.match(/^#gif (\S+)$/);
    if (r && PARENT_RE.test(r[1])) parent = r[1];
    else if (s && (STICKERS as readonly string[]).includes(s[1])) media = { type: "sticker", id: s[1] };
    else if (g && isAllowedGif(g[1])) media = { type: "gif", url: g[1] };
    else break;
    lines.pop();
  }
  return {
    id: `tg:${id}`, time, author: username ? `@${username}` : name, authorName: name, kind: parent ? "reply" : "post", parent,
    text: lines.join("\n").trim().slice(0, OFFCHAIN_MAX), media, url: `https://t.me/${channel}/${id}`,
  };
}

const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const htmlText = (h: string) =>
  h.replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (x, n) => ENT[n.toLowerCase()] ?? x);

/** Parse the public channel preview page into our messages (oldest → newest as on the page). */
export function parseChannelPage(html: string, channel: string): OffchainMessage[] {
  const out: OffchainMessage[] = [];
  const blocks = html.split('class="tgme_widget_message_wrap').slice(1);
  for (const b of blocks) {
    const post = b.match(/data-post="[^"/]+\/(\d+)"/);
    const text = b.match(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    const time = b.match(/<time[^>]*datetime="([^"]+)"/);
    if (!post || !text) continue;
    const msg = parseOffchain(htmlText(text[1]).trim(), Number(post[1]), time ? Date.parse(time[1]) : 0, channel);
    if (msg) out.push(msg);
  }
  return out;
}

async function page(channel: string, before?: number): Promise<string> {
  const res = await fetch(`https://t.me/s/${channel}${before ? `?before=${before}` : ""}`, { headers: { "user-agent": "Mozilla/5.0 (compatible; BitpadChat/1.0)" }, cache: "no-store" });
  if (!res.ok) throw new Error(`t.me ${res.status}`);
  return res.text();
}

/** Latest off-chain messages (two preview pages ≈ 40), newest first. */
export function getOffchain(): Promise<{ messages: OffchainMessage[]; ok: boolean }> {
  const channel = chatChannel();
  if (!offchainEnabled()) return Promise.resolve({ messages: [], ok: false });
  return memo("chat:offchain", 4_000, async () => {
    const first = parseChannelPage(await page(channel), channel);
    const oldest = Math.min(...first.map((m) => Number(m.id.slice(3))));
    const more = first.length >= 15 && Number.isFinite(oldest) ? parseChannelPage(await page(channel, oldest).catch(() => ""), channel) : [];
    const seen = new Set<string>();
    const all = [...first, ...more].filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)));
    return { messages: all.sort((a, b) => b.time - a.time), ok: true };
  }).catch(() => ({ messages: [], ok: false }));
}

/** Post through the bot. Returns the new message id. */
export async function postOffchain(text: string): Promise<number> {
  const res = await fetch(`https://api.telegram.org/bot${botToken()}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: `@${chatChannel()}`, text, disable_web_page_preview: true }),
  });
  const d = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: { message_id: number }; description?: string };
  if (!d.ok || !d.result) throw new Error(d.description?.includes("chat not found") || d.description?.includes("not enough rights") ? "The chat channel isn't set up for the bot yet." : "Telegram didn't accept the message. Try again.");
  return d.result.message_id;
}
