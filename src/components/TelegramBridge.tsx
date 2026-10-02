"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useApp } from "@/lib/store";

/** Inside Telegram: verify initData server-side and sign the user in silently. */
export function TelegramBridge() {
  const setTgUser = useApp((s) => s.setTgUser);
  useEffect(() => {
    const wa = window.Telegram?.WebApp;
    wa?.ready?.();
    if (!wa?.initData) {
      // On the web: keep the remembered Telegram user only while the server session is valid
      fetch("/api/auth/telegram")
        .then((r) => r.json())
        .then((d) => setTgUser(d.session?.tg ?? undefined))
        .catch(() => {});
      return;
    }
    fetch("/api/auth/telegram", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ initData: wa.initData }) })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.user && setTgUser(d.user))
      .catch(() => {});
  }, [setTgUser]);
  return <MiniAppChrome />;
}

/**
 * Mini App polish: full height, dark chrome, no swipe-to-close while scrolling
 * charts and lists, Telegram's safe areas (fullscreen / notch) as CSS vars, and
 * Telegram's own back button for in-app navigation.
 */
function MiniAppChrome() {
  const path = usePathname();
  const router = useRouter();

  useEffect(() => {
    const wa = window.Telegram?.WebApp;
    if (!wa?.initData) return;
    const root = document.documentElement;
    root.dataset.tg = "1";
    wa.expand?.();
    try {
      wa.setHeaderColor?.("#0a1215");
      wa.setBackgroundColor?.("#071014");
      wa.setBottomBarColor?.("#0a1215");
      wa.disableVerticalSwipes?.();
    } catch { /* older Telegram clients */ }
    const insets = () => {
      const s = wa.safeAreaInset, c = wa.contentSafeAreaInset;
      root.style.setProperty("--safe-top", `${(s?.top ?? 0) + (c?.top ?? 0)}px`);
      root.style.setProperty("--safe-bottom", `${(s?.bottom ?? 0) + (c?.bottom ?? 0)}px`);
    };
    insets();
    for (const e of ["safeAreaChanged", "contentSafeAreaChanged", "fullscreenChanged"]) wa.onEvent?.(e, insets);
    return () => { for (const e of ["safeAreaChanged", "contentSafeAreaChanged", "fullscreenChanged"]) wa.offEvent?.(e, insets); };
  }, []);

  // Telegram's header back button on every page but home
  useEffect(() => {
    const bb = window.Telegram?.WebApp?.initData ? window.Telegram.WebApp.BackButton : undefined;
    if (!bb) return;
    const back = () => (window.history.length > 1 ? router.back() : router.push("/"));
    if (path === "/") bb.hide(); else bb.show();
    bb.onClick(back);
    return () => bb.offClick(back);
  }, [path, router]);

  return null;
}

/** Haptic tap when running as a Mini App (no-op on the web). */
export function haptic(kind: "light" | "medium" | "success" | "error" = "light") {
  const h = typeof window !== "undefined" ? window.Telegram?.WebApp?.HapticFeedback : undefined;
  if (!h) return;
  if (kind === "success" || kind === "error") h.notificationOccurred(kind);
  else h.impactOccurred(kind);
}
