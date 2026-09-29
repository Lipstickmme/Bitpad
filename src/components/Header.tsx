"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus, Menu, X } from "lucide-react";
import { useState } from "react";
import { Logo, TelegramIcon, XIcon } from "./Brand";
import { ConnectMenu } from "./ConnectMenu";
import { SearchBox } from "./SearchBox";
import { config } from "@/lib/config";

const NAV = [
  { href: "/", label: "Markets" },
  { href: "/analytics", label: "Analytics" },
  { href: "/bundler", label: "Bundler" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/revenue", label: "Revenue" },
];

export function Header({ telegramBot }: { telegramBot: string }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-[68px] max-w-[1400px] items-center gap-6 px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`rounded-md px-3 py-2 text-[15px] font-medium transition-colors ${active(n.href) ? "text-ink" : "text-muted hover:text-ink"}`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <SearchBox />
          <a href={config.links.telegram} target="_blank" rel="noreferrer" className="btn btn-ghost hidden w-10 px-0 md:inline-flex" aria-label="Telegram"><TelegramIcon /></a>
          <a href={config.links.x} target="_blank" rel="noreferrer" className="btn btn-ghost hidden w-10 px-0 md:inline-flex" aria-label="X"><XIcon /></a>
          <Link href="/launch" className="btn btn-primary hidden sm:inline-flex"><Plus className="size-4" /> <span className="hidden md:inline">Launch token</span></Link>
          <ConnectMenu telegramBot={telegramBot} />
          <button className="btn btn-ghost w-10 px-0 lg:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menu">
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </div>
      {open && (
        <nav className="border-t border-line bg-surface px-4 py-2 lg:hidden">
          {[...NAV, { href: "/launch", label: "Launch token" }].map((n) => (
            <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className={`block rounded-md px-3 py-2.5 text-sm font-medium ${active(n.href) ? "bg-surface-2 text-ink" : "text-ink-2"}`}>
              {n.label}
            </Link>
          ))}
          <div className="flex gap-2 px-3 py-2.5">
            <a href={config.links.telegram} target="_blank" rel="noreferrer" className="btn btn-ghost w-10 px-0" aria-label="Telegram"><TelegramIcon /></a>
            <a href={config.links.x} target="_blank" rel="noreferrer" className="btn btn-ghost w-10 px-0" aria-label="X"><XIcon /></a>
          </div>
        </nav>
      )}
    </header>
  );
}
