"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Rocket } from "lucide-react";
import type { MarketToken, PairKind } from "@/lib/types";
import { LayoutGrid, Rows3 } from "lucide-react";
import { TokenCard } from "./TokenCard";
import { TokenTable } from "./TokenTable";
import { SectionTitle } from "./ui";

const FILTERS: { id: "all" | PairKind | "ton" | "stable"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "ton", label: "TON pairs" },
  { id: "stable", label: "Stable pairs" },
  { id: "stock", label: "Stocks" },
  { id: "commodity", label: "Commodities" },
  { id: "jetton", label: "Jetton pairs" },
  { id: "crypto", label: "Cross-chain" },
];
const SORTS = [
  { id: "volume24h", label: "Volume" },
  { id: "marketCap", label: "Market cap" },
  { id: "change24h", label: "Gainers" },
  { id: "liquidityUsd", label: "Liquidity" },
] as const;

function match(t: MarketToken, f: (typeof FILTERS)[number]["id"]) {
  if (f === "all") return true;
  if (f === "ton") return t.pair.symbol === "TON";
  if (f === "stable") return /^USD/i.test(t.pair.symbol);
  if (f === "jetton") return t.pair.kind === "jetton" && t.pair.symbol !== "TON" && !/^USD/i.test(t.pair.symbol);
  return t.pair.kind === f;
}

export function MarketsView({ bitpad, ton, tonSource, factory }: { bitpad: MarketToken[]; ton: MarketToken[]; tonSource: string | null; factory: string | null }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [sort, setSort] = useState<(typeof SORTS)[number]["id"]>("volume24h");
  const [view, setView] = useState<"table" | "grid">("table");
  const val = (t: MarketToken) => (sort === "marketCap" ? t.marketCap ?? t.fdv ?? -1 : t[sort] ?? -Infinity);
  const sortList = (l: MarketToken[]) => l.filter((t) => match(t, filter)).sort((a, b) => val(b) - val(a));
  const bp = useMemo(() => sortList(bitpad), [bitpad, filter, sort]); // eslint-disable-line react-hooks/exhaustive-deps
  const mk = useMemo(() => sortList(ton), [ton, filter, sort]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="scroll-x flex gap-2">
          {FILTERS.map((f) => (
            <button key={f.id} onClick={() => setFilter(f.id)} className={`shrink-0 rounded-md border px-2.5 py-1 text-xs font-medium ${filter === f.id ? "border-ink bg-ink text-white" : "border-line bg-surface text-ink-2 hover:border-line-strong"}`}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="seg">
            {SORTS.map((s) => <button key={s.id} data-on={sort === s.id} onClick={() => setSort(s.id)}>{s.label}</button>)}
          </div>
          <div className="seg">
            <button data-on={view === "table"} onClick={() => setView("table")} aria-label="Table view"><Rows3 className="size-4" /></button>
            <button data-on={view === "grid"} onClick={() => setView("grid")} aria-label="Grid view"><LayoutGrid className="size-4" /></button>
          </div>
        </div>
      </div>

      <div>
        <SectionTitle right={<span className="text-xs text-muted">{factory ? "Indexed from the Bitpad factory on-chain" : "Factory not deployed yet"}</span>}>Bitpad launches</SectionTitle>
        {bp.length ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{bp.map((t) => <TokenCard key={t.address} token={t} />)}</div>
        ) : (
          <div className="card flex flex-col items-center gap-2 p-6 text-center">
            <Rocket className="size-5 text-brand" />
            <div className="text-sm font-semibold">{bitpad.length ? "No launches match this filter" : "No Bitpad launches yet"}</div>
            <p className="max-w-md text-sm text-ink-2">{factory ? "Be the first — pair your token with a stock, gold or a TON jetton and it lists here the moment the pool is live." : "Launches appear here once the BitpadFactory contract is deployed and configured."}</p>
            <Link href="/launch" className="btn btn-primary mt-2">Launch a token</Link>
          </div>
        )}
      </div>

      <div>
        <SectionTitle right={<span className="text-xs text-muted">{tonSource ? `Live · ${tonSource}` : "Market data unavailable"}</span>}>TON markets</SectionTitle>
        {mk.length ? (
          view === "table" ? <TokenTable tokens={mk.slice(0, 60)} /> : <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{mk.slice(0, 40).map((t) => <TokenCard key={t.address} token={t} />)}</div>
        ) : (
          <div className="card p-8 text-center text-sm text-muted">{ton.length ? "No markets match this filter." : "GeckoTerminal and STON.fi didn't respond. Retrying on the next refresh."}</div>
        )}
      </div>
    </section>
  );
}
