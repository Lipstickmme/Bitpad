import { type NextRequest } from "next/server";
import { readSession, SESSION_COOKIE } from "@/lib/auth";
import { botToken } from "@/lib/telegram";
import { memo } from "@/lib/data/http";

export const dynamic = "force-dynamic";

/** Telegram's own CDNs only: nothing else is proxied. */
const CDN = /^https:\/\/([a-z0-9-]+\.)*(telesco\.pe|cdn-telegram\.org|telegram-cdn\.org|telegram\.org)\//i;
const DEFAULT_PIC = /t_logo|telegram_logo|og-image/i;
const MAX_BYTES = 512 * 1024;

/** Public profile photo URL from t.me/<username> (null when there's no photo or it's hidden). */
function publicPhoto(username: string): Promise<string | null> {
  return memo(`tg-avatar:${username.toLowerCase()}`, 6 * 3_600_000, async () => {
    const html = await fetch(`https://t.me/${username}`, { headers: { "user-agent": "Mozilla/5.0 (compatible; BitpadAvatar/1.0)" }, next: { revalidate: 21_600 } } as RequestInit).then((r) => (r.ok ? r.text() : ""));
    const img = html.match(/<img class="tgme_page_photo_image"[^>]*src="([^"]+)"/)?.[1] ?? html.match(/<meta property="og:image" content="([^"]+)"/)?.[1];
    return img && CDN.test(img) && !DEFAULT_PIC.test(img) ? img : null;
  }).catch(() => null);
}

/** The logged-in user's photo through the bot (works for anyone who has talked to it). */
async function botPhoto(userId: number): Promise<{ url: string } | null> {
  const token = botToken();
  if (!token) return null;
  return memo(`tg-avatar-id:${userId}`, 6 * 3_600_000, async () => {
    const api = (m: string, q: string) => fetch(`https://api.telegram.org/bot${token}/${m}?${q}`).then((r) => r.json());
    const photos = await api("getUserProfilePhotos", `user_id=${userId}&limit=1`);
    const sizes = photos?.result?.photos?.[0] as { file_id: string; width: number }[] | undefined;
    const pick = sizes?.sort((a, b) => Math.abs(a.width - 160) - Math.abs(b.width - 160))[0];
    if (!pick) return null;
    const f = await api("getFile", `file_id=${encodeURIComponent(pick.file_id)}`);
    return f?.result?.file_path ? { url: `https://api.telegram.org/file/bot${token}/${f.result.file_path}` } : null;
  }).catch(() => null);
}

/**
 * GET /api/tg/avatar?u=<username>  → public Telegram profile photo
 * GET /api/tg/avatar?me=1          → the logged-in user's photo
 * Streams the image (so the bot token never reaches the browser); 404 when
 * there's no photo, and the UI falls back to initials.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  let src: string | null = null;
  let isPrivate = false;
  if (q.get("me")) {
    const s = readSession(req.cookies.get(SESSION_COOKIE)?.value);
    if (s?.tg?.photo_url && CDN.test(s.tg.photo_url)) src = s.tg.photo_url;
    else if (s?.tg) src = (await botPhoto(s.tg.id))?.url ?? (s.tg.username ? await publicPhoto(s.tg.username) : null);
    isPrivate = true;
  } else {
    const u = q.get("u") ?? "";
    if (!/^[A-Za-z0-9_]{4,32}$/.test(u)) return new Response("bad username", { status: 400 });
    src = await publicPhoto(u);
  }
  if (!src) return new Response("no photo", { status: 404, headers: { "cache-control": "public, max-age=3600" } });
  const img = await fetch(src, { next: { revalidate: 21_600 } } as RequestInit).catch(() => null);
  const type = img?.headers.get("content-type") ?? "";
  if (!img?.ok || !/^image\/(jpeg|png|webp|gif)/.test(type)) return new Response("no photo", { status: 404 });
  const buf = await img.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) return new Response("too large", { status: 404 });
  return new Response(buf, {
    headers: {
      "content-type": type,
      "cache-control": isPrivate ? "private, max-age=21600" : "public, max-age=21600, s-maxage=86400",
      "x-content-type-options": "nosniff",
    },
  });
}
