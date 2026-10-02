"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartCandlestick, Landmark, MessagesSquare, WalletCards, type LucideIcon } from "lucide-react";
import { Mark } from "./Brand";
import { haptic } from "./TelegramBridge";

const TABS: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: "/", label: "Markets", Icon: ChartCandlestick },
  { href: "/stocks", label: "Stocks", Icon: Landmark },
];
const TABS_RIGHT: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: "/portfolio", label: "Portfolio", Icon: WalletCards },
];

/** Thumb-reach tab bar on phones and in the Telegram Mini App (hidden from lg up). */
export function MobileNav() {
  const path = usePathname();
  const on = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  const tab = ({ href, label, Icon }: (typeof TABS)[number]) => (
    <Link key={href} href={href} onClick={() => haptic()} className={`mnav-tab ${on(href) ? "text-ink" : "text-muted"}`} aria-current={on(href) ? "page" : undefined}>
      <Icon className={`size-[21px] ${on(href) ? "text-brand" : ""}`} strokeWidth={1.75} />
      <span>{label}</span>
    </Link>
  );
  return (
    <nav className="mnav glass fixed inset-x-0 bottom-0 z-40 border-t border-line lg:hidden" aria-label="Quick navigation">
      <div className="mx-auto grid h-[var(--mnav-h)] max-w-md grid-cols-5 items-center px-1">
        {TABS.map(tab)}
        <Link href="/launch" onClick={() => haptic("medium")} className="mnav-tab" aria-label="Launch creator jetton">
          <span className="btn btn-launch grid size-11 place-items-center rounded-2xl p-0"><Mark size={22} /></span>
          <span className={on("/launch") ? "text-ink" : "text-muted"}>Launch</span>
        </Link>
        {TABS_RIGHT.map(tab)}
        <button onClick={() => { haptic(); window.dispatchEvent(new Event("bitpad:open-chat")); }} className="mnav-tab text-muted">
          <MessagesSquare className="size-[21px]" strokeWidth={1.75} />
          <span>Chat</span>
        </button>
      </div>
    </nav>
  );
}
