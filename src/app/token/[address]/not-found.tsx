import Link from "next/link";
import { SearchX } from "lucide-react";

export default function TokenNotFound() {
  return (
    <div className="mx-auto max-w-md pt-10 text-center">
      <div className="card p-8">
        <SearchX className="mx-auto size-6 text-muted" />
        <h1 className="mt-3 text-lg font-semibold">Token not found</h1>
        <p className="mt-1 text-sm text-ink-2">
          No TON jetton data came back for this address. Either it isn&apos;t a jetton master, or TonAPI, toncenter, GeckoTerminal and DexScreener are all
          unreachable right now — try again in a minute.
        </p>
        <Link href="/" className="btn btn-primary mt-4">Back to markets</Link>
      </div>
    </div>
  );
}
