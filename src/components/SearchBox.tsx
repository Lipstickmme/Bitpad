"use client";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { DEMO_TOKENS, DEMO_EMOJI } from "@/lib/demo";
import { usd, pct } from "@/lib/format";

export function SearchBox() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => { if (open) setTimeout(() => input.current?.focus(), 10); }, [open]);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    return DEMO_TOKENS.filter((t) => !s || t.symbol.toLowerCase().includes(s) || t.name.toLowerCase().includes(s) || t.pair.symbol.toLowerCase().includes(s) || t.address.toLowerCase() === s).slice(0, 8);
  }, [q]);

  const go = (addr: string) => { setOpen(false); setQ(""); router.push(`/token/${addr}`); };

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn btn-ghost hidden w-48 justify-start text-muted 2xl:inline-flex">
        <Search className="size-4" /> Search
        <kbd className="ml-auto rounded border border-line px-1.5 font-mono text-[10px]">Ctrl K</kbd>
      </button>
      <button onClick={() => setOpen(true)} className="btn btn-ghost w-10 px-0 2xl:hidden" aria-label="Search"><Search className="size-4" /></button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink/20 p-4 pt-[12vh] backdrop-blur-sm" onMouseDown={() => setOpen(false)}>
          <div className="card w-full max-w-lg overflow-hidden shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 border-b border-line px-4">
              <Search className="size-4 text-muted" />
              <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && results[0] && go(results[0].address)} placeholder="Token, pair asset or contract address" className="h-12 flex-1 bg-transparent text-sm outline-none" />
            </div>
            <ul className="max-h-[50vh] overflow-y-auto p-1.5">
              {results.map((t) => (
                <li key={t.address}>
                  <button onClick={() => go(t.address)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-surface-2">
                    <span className="grid size-8 place-items-center rounded-full bg-surface-2 text-base">{DEMO_EMOJI[t.symbol]}</span>
                    <span className="flex-1"><span className="font-semibold">${t.symbol}</span> <span className="text-xs text-muted">/ {t.pair.symbol}</span></span>
                    <span className="num text-sm">{usd(t.marketCap, { compact: true })}</span>
                    <span className={`num w-16 text-right text-xs font-semibold ${t.change24h >= 0 ? "text-up" : "text-down"}`}>{pct(t.change24h)}</span>
                  </button>
                </li>
              ))}
              {!results.length && <li className="px-3 py-6 text-center text-sm text-muted">No matches</li>}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
