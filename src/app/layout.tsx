import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { Footer } from "@/components/Footer";
import { TrenchChat } from "@/components/TrenchChat";
import { botUsername } from "@/lib/telegram";
import { ensureRuntimeConfig } from "@/lib/runtime";

export const metadata: Metadata = {
  title: { default: "BITPAD · Buy stocks on TON · Launch creator jettons", template: "%s · BITPAD" },
  description: "Buy tokenized stocks and gold on TON. Launch your creator jetton backed by stocks, commodities or jettons, live from block one, and earn on every trade through referral links.",
  icons: { icon: "/favicon.png", apple: "/icon-180.png" },
};

export const viewport: Viewport = { themeColor: "#0a1215", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [bot, runtime] = await Promise.all([botUsername(), ensureRuntimeConfig().catch(() => null)]);
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen">
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        <Providers feeWallet={runtime?.feeWallet ?? ""} twaReturnUrl={bot ? `https://t.me/${bot}${process.env.TELEGRAM_APP_NAME ? `/${process.env.TELEGRAM_APP_NAME}` : ""}` : undefined}>
          <Sidebar />
          <div className="lg:pl-60">
            <Header telegramBot={bot} />
            <main className="mx-auto w-full max-w-[1400px] px-4 pb-16 pt-5 sm:px-6">{children}</main>
            <Footer />
          </div>
          <TrenchChat />
        </Providers>
      </body>
    </html>
  );
}
