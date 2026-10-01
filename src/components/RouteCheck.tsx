"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Loader2, X } from "lucide-react";
import { Hint, Verified } from "./ui";

interface Result { verified: boolean; route: { ok: boolean; via: string; detail?: string }; pairable: { ok: boolean; detail: string } }
const KIND: Record<string, string> = { stock: "Stocks", commodity: "Commodities", jetton: "TON jettons", crypto: "Cross-chain" };

/** Live check of every catalog asset: buy route right now + can it back a creator jetton. */
export function RouteCheck({ assets }: { assets: { symbol: string; name: string; kind: string }[] }) {
  const [res, setRes] = useState<Record<string, Result | "error">>({});
  useEffect(() => {
    let alive = true;
    const queue = [...assets];
    const worker = async () => {
      for (let a = queue.shift(); a && alive; a = queue.shift()) {
        const r = await fetch(`/api/route-check?symbol=${encodeURIComponent(a.symbol)}`).then((x) => x.json()).catch(() => null);
        if (alive) setRes((s) => ({ ...s, [a.symbol]: r?.route ? r : "error" }));
      }
    };
    Promise.all(Array.from({ length: 4 }, worker));
    return () => { alive = false; };
  }, [assets]);

  const done = Object.keys(res).length;
  const buyable = Object.values(res).filter((r) => r !== "error" && r.route.ok).length;
  const pairable = Object.values(res).filter((r) => r !== "error" && r.pairable.ok).length;
  const Cell = ({ ok, children }: { ok: boolean; children: React.ReactNode }) => (
    <span className={`inline-flex items-start gap-1.5 ${ok ? "text-up" : "text-down"}`}>{ok ? <Check className="mt-0.5 size-3.5 shrink-0" /> : <X className="mt-0.5 size-3.5 shrink-0" />}<span className="text-ink-2">{children}</span></span>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="flex items-center gap-1.5 text-2xl font-bold tracking-tight">
            Route check
            <Hint>Runs a live quote worth about $20 for every asset in Bitpad&apos;s catalog (pools first, then STON.fi Omniston for stocks), and reads the factory to see whether each one can back a creator jetton. Nothing is bought.</Hint>
          </h1>
          <p className="text-sm text-ink-2">{done < assets.length ? `Checking ${done}/${assets.length}…` : `${buyable}/${assets.length} buyable right now · ${pairable}/${assets.length} can back a launch`}</p>
        </div>
        <Link href="/admin/pairs" className="btn btn-ghost ml-auto">Enable pairs →</Link>
      </div>
      <div className="card overflow-hidden">
        <div className="scroll-x">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="text-left text-xs text-muted"><tr className="border-b border-line"><th className="px-4 py-2 font-medium">Asset</th><th className="font-medium">Type</th><th className="font-medium">Buy route</th><th className="px-4 font-medium">Can back a launch</th></tr></thead>
            <tbody>
              {assets.map((a) => {
                const r = res[a.symbol];
                return (
                  <tr key={a.symbol} className="border-b border-line/60 align-top last:border-0">
                    <td className="px-4 py-2.5"><div className="flex items-center gap-1 font-medium">{a.symbol}{r && r !== "error" && r.verified && <Verified />}</div><div className="text-[11px] text-muted">{a.name}</div></td>
                    <td className="py-2.5 text-xs text-ink-2">{KIND[a.kind] ?? a.kind}</td>
                    <td className="py-2.5 text-xs">{!r ? <Loader2 className="size-3.5 animate-spin text-muted" /> : r === "error" ? <span className="text-down">Check failed</span> : <Cell ok={r.route.ok}>{r.route.via}{r.route.detail ? <span className="block text-muted">{r.route.detail}</span> : null}</Cell>}</td>
                    <td className="px-4 py-2.5 text-xs">{!r ? <Loader2 className="size-3.5 animate-spin text-muted" /> : r === "error" ? "—" : <Cell ok={r.pairable.ok}>{r.pairable.detail}</Cell>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
