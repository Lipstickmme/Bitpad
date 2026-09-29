"use client";
import { Buffer } from "buffer";
import { TonConnectUIProvider, THEME } from "@tonconnect/ui-react";
import { useEffect } from "react";
import { TelegramBridge } from "./TelegramBridge";
import { Toaster } from "./Toast";
import { config } from "@/lib/config";

if (typeof window !== "undefined") {
  (window as unknown as { Buffer: typeof Buffer }).Buffer ??= Buffer;
}

export function Providers({ children, feeWallet }: { children: React.ReactNode; feeWallet: string }) {
  // Fee wallet comes from the factory contract (read on the server)
  if (feeWallet && !config.feeWallet) config.feeWallet = feeWallet;
  const manifestUrl =
    typeof window === "undefined" ? "/tonconnect-manifest.json" : `${window.location.origin}/tonconnect-manifest.json`;

  useEffect(() => {
    // Keep the Telegram Mini App chrome in light mode to match Bitpad
    window.Telegram?.WebApp?.setHeaderColor?.("#f5f7fa");
    window.Telegram?.WebApp?.expand?.();
  }, []);

  return (
    <TonConnectUIProvider manifestUrl={manifestUrl} uiPreferences={{ theme: THEME.LIGHT }}>
      <TelegramBridge />
      {children}
      <Toaster />
    </TonConnectUIProvider>
  );
}
