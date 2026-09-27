"use client";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { price } from "@/lib/format";

interface Hit { address: string; symbol: string; name: string; image?: string; priceUsd: number | null }

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

  const [results, setResults] = useState<Hit[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const term = q.trim();
    if (!term) return setResults([]);
    setBusy(true);
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(term)}`)
        .then((r) => r.json())
        .then((d) => setResults(d.results ?? []))
        .catch(() => setResults([]))
        .finally(() => setBusy(false));
    }, 250);
    return () => clearTimeout(t);
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
              <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                if (/^(EQ|UQ|0:)/.test(q.trim())) go(q.trim());
                else if (results[0]) go(results[0].address);
              }} placeholder="TON token name, ticker or contract address" className="h-12 flex-1 bg-transparent text-sm outline-none" />
            </div>
            <ul className="max-h-[50vh] overflow-y-auto p-1.5">
              {results.map((t) => (
                <li key={t.address}>
                  <button onClick={() => go(t.address)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-surface-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {t.image ? <img src={t.image} alt="" className="size-8 rounded-full" /> : <span className="grid size-8 place-items-center rounded-full bg-surface-2 text-xs font-bold">{t.symbol.slice(0, 2)}</span>}
                    <span className="min-w-0 flex-1"><span className="font-semibold">{t.symbol}</span> <span className="truncate text-xs text-muted">{t.name}</span></span>
                    <span className="num text-sm">{t.priceUsd != null ? price(t.priceUsd) : "—"}</span>
                  </button>
                </li>
              ))}
              {!results.length && <li className="px-3 py-6 text-center text-sm text-muted">{!q.trim() ? "Search every token on STON.fi, or paste a jetton address" : busy ? "Searching…" : "No matches"}</li>}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
