"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BarChart3, BookOpen, CandlestickChart, Coins, Landmark, Layers, MessageCircle, Wallet, X } from "lucide-react";
import { Logo, Mark, TelegramIcon, XIcon } from "./Brand";
import { config } from "@/lib/config";

const NAV = [
  { href: "/", label: "Markets", Icon: CandlestickChart },
  { href: "/stocks", label: "Stocks", Icon: Landmark },
  { href: "/analytics", label: "Analytics", Icon: BarChart3 },
  { href: "/bundler", label: "Bundler", Icon: Layers },
  { href: "/portfolio", label: "Portfolio", Icon: Wallet },
  { href: "/revenue", label: "Revenue", Icon: Coins },
];

/** Open/close the drawer on phones and tablets (the header's menu button). */
export const toggleNav = () => window.dispatchEvent(new Event("bitpad:nav"));

/**
 * App navigation as a left sidebar: fixed on desktop, a slide-in drawer below
 * lg. Keeps the top bar free for search and the wallet.
 */
export function Sidebar() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  useEffect(() => {
    const t = () => setOpen((o) => !o);
    window.addEventListener("bitpad:nav", t);
    return () => window.removeEventListener("bitpad:nav", t);
  }, []);
  // Close the drawer after navigating
  useEffect(() => setOpen(false), [path]);

  const item = (href: string, label: string, Icon: typeof BookOpen) => (
    <Link
      key={href}
      href={href}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium transition-colors ${active(href) ? "bg-surface-2 text-ink" : "text-muted hover:bg-surface-2/60 hover:text-ink"}`}
    >
      <Icon className={`size-[18px] ${active(href) ? "text-brand" : ""}`} />
      {label}
    </Link>
  );

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)} aria-hidden />}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-line bg-bg transition-transform lg:w-60 lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
        aria-label="Main navigation"
      >
        <div className="flex h-[68px] shrink-0 items-center gap-2 border-b border-line px-4">
          <Logo size={40} />
          <button onClick={() => setOpen(false)} className="btn btn-ghost ml-auto w-9 px-0 lg:hidden" aria-label="Close menu"><X className="size-4" /></button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3">
          <Link href="/launch" className="btn btn-launch mb-4 h-11 w-full justify-center text-[14px] font-semibold"><Mark size={20} /> Launch Creator Jetton</Link>
          <nav className="space-y-0.5">
            {NAV.map((n) => item(n.href, n.label, n.Icon))}
            <button onClick={() => { setOpen(false); window.dispatchEvent(new Event("bitpad:open-chat")); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium text-muted transition-colors hover:bg-surface-2/60 hover:text-ink">
              <MessageCircle className="size-[18px]" /> Trench chat
            </button>
          </nav>
          <div className="mt-auto space-y-0.5 border-t border-line pt-3">
            {item("/docs", "Docs", BookOpen)}
            <div className="flex gap-2 px-1 pt-2">
              <a href={config.links.telegram} target="_blank" rel="noreferrer" className="btn btn-ghost w-10 px-0" aria-label="Telegram"><TelegramIcon /></a>
              <a href={config.links.x} target="_blank" rel="noreferrer" className="btn btn-ghost w-10 px-0" aria-label="X"><XIcon /></a>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
