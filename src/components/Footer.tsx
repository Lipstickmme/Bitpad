import Link from "next/link";
import { Logo, TelegramIcon, XIcon } from "./Brand";
import { config } from "@/lib/config";

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-4 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:px-6">
        <Logo size={40} />
        <p className="sm:ml-2">Buy tokenized stocks on TON. Launch creator jettons backed by them.</p>
        <div className="flex items-center gap-4 sm:ml-auto">
          <Link href="/analytics" className="hover:text-ink">Analytics</Link>
          <Link href="/revenue" className="hover:text-ink">Fees</Link>
          <Link href="/docs" className="hover:text-ink">Docs</Link>
          <Link href="/terms" className="hover:text-ink">Terms</Link>
          <a href={config.links.telegram} target="_blank" rel="noreferrer" className="hover:text-ink" aria-label="Telegram"><TelegramIcon /></a>
          <a href={config.links.x} target="_blank" rel="noreferrer" className="hover:text-ink" aria-label="X"><XIcon /></a>
        </div>
      </div>
    </footer>
  );
}
