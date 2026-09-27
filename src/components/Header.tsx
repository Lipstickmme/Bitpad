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
  { href: "/token/BITL", label: "$BITL" },
  { href: "/analytics", label: "Analytics" },
  { href: "/bundler", label: "Bundler" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/copilot", label: "Copilot" },
  { href: "/revenue", label: "Revenue" },
];

export function Header() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-4 px-4 sm:px-6">
        <Logo />
        <nav className="ml-2 hidden items-center lg:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`relative rounded-lg px-2.5 py-2 text-sm font-semibold transition-colors ${active(n.href) ? "text-ink" : "text-muted hover:text-ink"}`}
            >
              {n.label}
              {active(n.href) && <span className="absolute inset-x-2.5 -bottom-[13px] h-0.5 rounded bg-brand" />}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <SearchBox />
          <a href={config.links.telegram} target="_blank" rel="noreferrer" className="btn btn-ghost hidden w-10 px-0 xl:inline-flex" aria-label="Telegram"><TelegramIcon /></a>
          <a href={config.links.x} target="_blank" rel="noreferrer" className="btn btn-ghost hidden w-10 px-0 xl:inline-flex" aria-label="X"><XIcon /></a>
          <Link href="/launch" className="btn btn-primary hidden sm:inline-flex"><Plus className="size-4" /> <span className="hidden md:inline">Launch token</span><span className="md:hidden">Launch</span></Link>
          <ConnectMenu />
          <button className="btn btn-ghost w-10 px-0 lg:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menu">
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </div>
      {open && (
        <nav className="border-t border-line bg-surface px-4 py-2 lg:hidden">
          {[...NAV, { href: "/launch", label: "Launch token" }].map((n) => (
            <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className={`block rounded-lg px-3 py-2.5 text-sm font-semibold ${active(n.href) ? "bg-brand-soft text-brand-ink" : "text-ink-2"}`}>
              {n.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
