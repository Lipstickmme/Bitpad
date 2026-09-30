import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { botUsername } from "@/lib/telegram";
import { ensureRuntimeConfig } from "@/lib/runtime";

export const metadata: Metadata = {
  title: { default: "BITPAD · Buy stocks on TON · Launch paired jettons", template: "%s · BITPAD" },
  description: "Launch tokens paired with stocks, commodities and jettons. Liquidity goes straight into the pool — trade from block one. Cross-chain analytics and multi-wallet bundles.",
  icons: { icon: "/favicon.png", apple: "/icon-180.png" },
};

export const viewport: Viewport = { themeColor: "#0a1215", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [bot, runtime] = await Promise.all([botUsername(), ensureRuntimeConfig().catch(() => null)]);
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen">
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        <Providers feeWallet={runtime?.feeWallet ?? ""}>
          <Header telegramBot={bot} />
          <main className="mx-auto w-full max-w-[1400px] px-4 pb-16 pt-5 sm:px-6">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
