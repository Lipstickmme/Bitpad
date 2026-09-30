"use client";
import { Buffer } from "buffer";
import { TonConnectUIProvider, THEME } from "@tonconnect/ui-react";
import { useEffect } from "react";
import { TelegramBridge } from "./TelegramBridge";
import { captureGeneralReferral } from "@/lib/referral";
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
    // Match the Telegram Mini App chrome to Bitpad's dark theme
    window.Telegram?.WebApp?.setHeaderColor?.("#0a1215");
    window.Telegram?.WebApp?.expand?.();
    captureGeneralReferral(); // ?r=<wallet> on any page
  }, []);

  return (
    <TonConnectUIProvider manifestUrl={manifestUrl} uiPreferences={{ theme: THEME.DARK }}>
      <TelegramBridge />
      {children}
      <Toaster />
    </TonConnectUIProvider>
  );
}
