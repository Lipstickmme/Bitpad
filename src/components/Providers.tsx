"use client";
import { Buffer } from "buffer";
import { TonConnectUIProvider, THEME } from "@tonconnect/ui-react";
import { useEffect } from "react";
import { TelegramBridge } from "./TelegramBridge";
import { Toaster } from "./Toast";

if (typeof window !== "undefined") {
  (window as unknown as { Buffer: typeof Buffer }).Buffer ??= Buffer;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const manifestUrl =
    typeof window === "undefined" ? "/tonconnect-manifest.json" : `${window.location.origin}/tonconnect-manifest.json`;

  useEffect(() => {
    // Keep the Telegram Mini App chrome in light mode to match Bitpad
    window.Telegram?.WebApp?.setHeaderColor?.("#f5f7fa");
    window.Telegram?.WebApp?.expand?.();
  }, []);

  return (
    <TonConnectUIProvider manifestUrl={manifestUrl} uiPreferences={{ theme: THEME.LIGHT }} actionsConfiguration={{ twaReturnUrl: `https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT || "bitpad_bot"}/app` }}>
      <TelegramBridge />
      {children}
      <Toaster />
    </TonConnectUIProvider>
  );
}
