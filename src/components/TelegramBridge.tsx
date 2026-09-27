"use client";
import { useEffect } from "react";
import { useApp } from "@/lib/store";

/** Inside Telegram: verify initData server-side and sign the user in silently. */
export function TelegramBridge() {
  const setTgUser = useApp((s) => s.setTgUser);
  useEffect(() => {
    const wa = window.Telegram?.WebApp;
    wa?.ready?.();
    if (!wa?.initData) return;
    fetch("/api/auth/telegram", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ initData: wa.initData }) })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.user && setTgUser(d.user))
      .catch(() => {});
  }, [setTgUser]);
  return null;
}

/** Haptic tap when running as a Mini App (no-op on the web). */
export function haptic(kind: "light" | "medium" | "success" | "error" = "light") {
  const h = typeof window !== "undefined" ? window.Telegram?.WebApp?.HapticFeedback : undefined;
  if (!h) return;
  if (kind === "success" || kind === "error") h.notificationOccurred(kind);
  else h.impactOccurred(kind);
}
