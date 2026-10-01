"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { BookOpenText, Boxes, ChartCandlestick, ChartNoAxesCombined, HandCoins, Landmark, MessagesSquare, PanelLeftClose, PanelLeftOpen, WalletCards, X, type LucideIcon } from "lucide-react";
import { Mark, TelegramIcon, XIcon } from "./Brand";
import { config } from "@/lib/config";

const NAV: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: "/", label: "Markets", Icon: ChartCandlestick },
  { href: "/stocks", label: "Stocks", Icon: Landmark },
  { href: "/analytics", label: "Analytics", Icon: ChartNoAxesCombined },
  { href: "/bundler", label: "Bundler", Icon: Boxes },
  { href: "/portfolio", label: "Portfolio", Icon: WalletCards },
  { href: "/revenue", label: "Revenue", Icon: HandCoins },
];
const KEY = "bitpad:sidebar";

/** Open/close the drawer on phones and tablets (the header's menu button). */
export const toggleNav = () => window.dispatchEvent(new Event("bitpad:nav"));

/** Runs before paint (layout <head>) so a collapsed sidebar doesn't flash open. */
export const SIDEBAR_BOOT = `try{if(localStorage.getItem("${KEY}")==="collapsed")document.documentElement.dataset.sidebar="collapsed"}catch(e){}`;

/**
 * App navigation: a left sidebar on desktop that collapses to an icon rail
 * (button or Ctrl/⌘+B, remembered), and a slide-in drawer below lg.
 */
export function Sidebar() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  useEffect(() => setCollapsed(document.documentElement.dataset.sidebar === "collapsed"), []);
  const toggleCollapsed = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      document.documentElement.dataset.sidebar = next ? "collapsed" : "open";
      try { localStorage.setItem(KEY, next ? "collapsed" : "open"); } catch { /* private mode */ }
      return next;
    });
  }, []);

  useEffect(() => {
    const t = () => setOpen((o) => !o);
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") { e.preventDefault(); toggleCollapsed(); }
    };
    window.addEventListener("bitpad:nav", t);
    window.addEventListener("keydown", key);
    return () => { window.removeEventListener("bitpad:nav", t); window.removeEventListener("keydown", key); };
  }, [toggleCollapsed]);
  // Close the drawer after navigating
  useEffect(() => setOpen(false), [path]);

  const itemCls = (on: boolean) =>
    `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium transition-colors ${on ? "bg-white/[0.06] text-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.08),inset_0_0_0_1px_rgb(255_255_255/0.06)]" : "text-muted hover:bg-white/[0.04] hover:text-ink"}`;
  const icon = (Icon: LucideIcon, on: boolean) => <Icon className={`size-[19px] shrink-0 ${on ? "text-brand" : ""}`} strokeWidth={1.75} />;

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)} aria-hidden />}
      <aside className={`sidebar glass fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-line lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`} aria-label="Main navigation">
        <div className="flex h-[68px] shrink-0 items-center gap-2 border-b border-line px-4">
          <Link href="/" className="flex min-w-0 items-center gap-2.5" aria-label="Bitpad home">
            <Mark size={36} />
            <span className="sb-label text-lg font-extrabold tracking-[0.08em]">BITPAD</span>
          </Link>
          <button onClick={() => setOpen(false)} className="btn btn-ghost ml-auto w-9 px-0 lg:hidden" aria-label="Close menu"><X className="size-4" /></button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden p-3">
          <Link href="/launch" title="Launch Creator Jetton" className="btn btn-launch sb-launch mb-4 h-11 w-full justify-center text-[14px] font-semibold"><Mark size={20} /> <span className="sb-label">Launch Creator Jetton</span></Link>
          <nav className="space-y-0.5">
            {NAV.map(({ href, label, Icon }) => (
              <Link key={href} href={href} title={label} className={itemCls(active(href))}>{icon(Icon, active(href))}<span className="sb-label">{label}</span></Link>
            ))}
            <button onClick={() => { setOpen(false); window.dispatchEvent(new Event("bitpad:open-chat")); }} title="Trench chat" className={`${itemCls(false)} w-full`}>
              {icon(MessagesSquare, false)}<span className="sb-label">Trench chat</span>
            </button>
          </nav>
          <div className="mt-auto space-y-0.5 border-t border-line pt-3">
            <Link href="/docs" title="Docs" className={itemCls(active("/docs"))}>{icon(BookOpenText, active("/docs"))}<span className="sb-label">Docs</span></Link>
            <div className="sb-socials flex gap-2 px-1 pt-2">
              <a href={config.links.telegram} target="_blank" rel="noreferrer" className="btn btn-ghost w-10 px-0" aria-label="Telegram"><TelegramIcon /></a>
              <a href={config.links.x} target="_blank" rel="noreferrer" className="btn btn-ghost w-10 px-0" aria-label="X"><XIcon /></a>
            </div>
            <button onClick={toggleCollapsed} title={collapsed ? "Expand sidebar (Ctrl+B)" : "Collapse sidebar (Ctrl+B)"} className={`${itemCls(false)} hidden w-full lg:flex`} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
              {icon(collapsed ? PanelLeftOpen : PanelLeftClose, false)}<span className="sb-label">Collapse</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
