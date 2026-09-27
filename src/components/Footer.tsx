import Link from "next/link";
import { Logo } from "./Brand";

export function Footer() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-4 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:px-6">
        <Logo size={24} />
        <p className="sm:ml-4">Launch paired tokens on TON. Liquidity lives in the pool from block one.</p>
        <div className="flex gap-4 sm:ml-auto">
          <Link href="/analytics" className="hover:text-ink">Analytics</Link>
          <Link href="/revenue" className="hover:text-ink">Fees</Link>
          <Link href="/terms" className="hover:text-ink">Terms</Link>
        </div>
      </div>
    </footer>
  );
}
