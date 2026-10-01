"use client";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Logo, Mark } from "./Brand";
import { ConnectMenu } from "./ConnectMenu";
import { SearchBox } from "./SearchBox";
import { toggleNav } from "./Sidebar";

/** Top bar: search and wallet. Navigation lives in the sidebar (a drawer below lg). */
export function Header({ telegramBot }: { telegramBot: string }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-[68px] max-w-[1400px] items-center gap-2 px-3 sm:gap-3 sm:px-6">
        <button className="btn btn-ghost w-10 shrink-0 px-0 lg:hidden" onClick={toggleNav} aria-label="Menu"><Menu className="size-4" /></button>
        <div className="lg:hidden"><Logo size={40} /></div>
        <div className="ml-auto flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2">
          <SearchBox />
          <Link href="/launch" className="btn btn-launch hidden sm:inline-flex lg:hidden"><Mark /> Launch</Link>
          <ConnectMenu telegramBot={telegramBot} />
        </div>
      </div>
    </header>
  );
}
