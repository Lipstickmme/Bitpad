"use client";
import { useState } from "react";

/**
 * Telegram profile picture (via /api/tg/avatar), falling back to initials.
 * `username` for anyone with a public username; `me` for the logged-in user.
 */
export function TgAvatar({ username, me, name, size = 28, className = "" }: { username?: string | null; me?: boolean; name?: string; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  const clean = username?.replace(/^@/, "");
  const src = me ? "/api/tg/avatar?me=1" : clean && /^[A-Za-z0-9_]{4,32}$/.test(clean) ? `/api/tg/avatar?u=${clean}` : null;
  const initials = (name || clean || "?").replace(/^@/, "").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const style = { width: size, height: size, fontSize: Math.max(9, size * 0.38) };
  if (!src || failed) {
    return <span className={`inline-grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#2a3c43] to-[#142126] font-bold text-ink-2 ${className}`} style={style} aria-hidden>{initials}</span>;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} className={`shrink-0 rounded-full object-cover ${className}`} style={style} />;
}
