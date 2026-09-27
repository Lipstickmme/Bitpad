import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: { default: "Bitpad — the TON launchpad for paired tokens", template: "%s · Bitpad" },
  description: "Launch tokens paired with stocks, commodities and jettons. Liquidity goes straight into the pool — trade from block one. Cross-chain analytics, multi-wallet bundles and an AI copilot.",
  icons: { icon: "/logo.svg" },
};

export const viewport: Viewport = { themeColor: "#f5f7fa", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500&display=swap" />
      </head>
      <body className="min-h-screen">
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        <Providers>
          <Header />
          <main className="mx-auto w-full max-w-[1400px] px-4 pb-16 pt-4 sm:px-6">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
