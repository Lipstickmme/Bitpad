"use client";
import { useEffect, useMemo, useState } from "react";
import { Pager } from "./Pager";

const PAGE = 25;
import { LayoutGrid, Rows3, Search } from "lucide-react";
import type { MarketToken, PairKind } from "@/lib/types";
import { TokenCard } from "./TokenCard";
import { TokenTable } from "./TokenTable";
import { QuickBuyAmount } from "./QuickBuy";
import { SectionTitle } from "./ui";
import { ChainMarket } from "./ChainMarket";

const FILTERS: { id: "all" | PairKind | "ton" | "stable"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "ton", label: "TON" },
  { id: "stable", label: "Stables" },
  { id: "stock", label: "Stocks" },
  { id: "commodity", label: "Commodities" },
  { id: "jetton", label: "Jettons" },
  { id: "crypto", label: "Cross-chain" },
];
const SORTS = [
  { id: "marketCap", label: "Market cap" },
  { id: "createdAt", label: "Newest" },
  { id: "volume24h", label: "24h volume" },
  { id: "change24h", label: "Gainers" },
] as const;

function match(t: MarketToken, f: (typeof FILTERS)[number]["id"]) {
  if (f === "all") return true;
  if (f === "ton") return t.pair.symbol === "TON";
  if (f === "stable") return /^USD/i.test(t.pair.symbol);
  if (f === "jetton") return t.pair.kind === "jetton" && t.pair.symbol !== "TON" && !/^USD/i.test(t.pair.symbol);
  return t.pair.kind === f;
}

export function MarketsView({ bitpad, ton, tonSource }: { bitpad: MarketToken[]; ton: MarketToken[]; tonSource: string | null }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [sort, setSort] = useState<(typeof SORTS)[number]["id"]>("marketCap");
  const [view, setView] = useState<"table" | "grid">("table");
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const val = (t: MarketToken) => (sort === "marketCap" ? t.marketCap ?? t.fdv ?? -1 : t[sort] ?? -Infinity);
  const hit = (t: MarketToken) => !term || t.symbol.toLowerCase().includes(term) || t.name.toLowerCase().includes(term) || t.address.toLowerCase() === term;
  const sortList = (l: MarketToken[]) => l.filter((t) => match(t, filter) && hit(t)).sort((a, b) => val(b) - val(a));
  const bp = useMemo(() => sortList(bitpad), [bitpad, filter, sort, term]); // eslint-disable-line react-hooks/exhaustive-deps
  const mk = useMemo(() => sortList(ton), [ton, filter, sort, term]); // eslint-disable-line react-hooks/exhaustive-deps
  // Pagination (25 per page); back to page 1 whenever the list changes
  const [page, setPage] = useState(0);
  const [bpPage, setBpPage] = useState(0);
  useEffect(() => { setPage(0); setBpPage(0); }, [filter, sort, term]);
  const mkPage = mk.slice(page * PAGE, (page + 1) * PAGE);
  const bpShown = bp.slice(bpPage * PAGE, (bpPage + 1) * PAGE);

  return (
    <section className="space-y-6">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex h-12 w-full items-center gap-3 rounded-xl border border-line bg-surface px-4 focus-within:border-line-strong sm:w-[420px]">
            <Search className="size-4 text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, ticker, or contract address" className="h-full min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted" />
          </label>
          <div className="scroll-x flex max-w-full items-center gap-1 sm:ml-auto">
            <span className="mr-2 shrink-0 text-sm text-muted">Sort</span>
            {SORTS.map((s) => (
              <button key={s.id} onClick={() => setSort(s.id)} className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${sort === s.id ? "bg-line-strong text-ink" : "text-ink-2 hover:text-ink"}`}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <div className="scroll-x flex max-w-full items-center gap-2">
          <span className="mr-1 shrink-0 text-sm text-muted">Paired with</span>
          {FILTERS.map((f) => (
            <button key={f.id} onClick={() => setFilter(f.id)} className={`shrink-0 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${filter === f.id ? "border-line-strong bg-line-strong text-ink" : "border-line text-ink-2 hover:border-line-strong hover:text-ink"}`}>
              {f.label}
            </button>
          ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <QuickBuyAmount />
            <div className="seg">
              <button data-on={view === "table"} onClick={() => setView("table")} aria-label="Table view"><Rows3 className="size-4" /></button>
              <button data-on={view === "grid"} onClick={() => setView("grid")} aria-label="Grid view"><LayoutGrid className="size-4" /></button>
            </div>
          </div>
        </div>
      </div>

      {!!bp.length && (
        <div>
          <SectionTitle right={<span className="text-xs text-muted">Read from the Bitpad factory on-chain</span>}>Creator jettons</SectionTitle>
          {view === "table" ? <TokenTable tokens={bpShown} /> : <Grid tokens={bpShown} />}
          <Pager page={bpPage} pageSize={PAGE} total={bp.length} onPage={setBpPage} />
        </div>
      )}

      <div id="ton-markets" className="scroll-mt-20">
        <SectionTitle right={<span className="text-xs text-muted">{tonSource ? `Live · ${tonSource}` : "Market data unavailable"}</span>}>TON markets</SectionTitle>
        {mk.length ? (
          <>
            {view === "table" ? <TokenTable tokens={mkPage} /> : <Grid tokens={mkPage} />}
            <Pager page={page} pageSize={PAGE} total={mk.length} onPage={(n) => { setPage(n); document.getElementById("ton-markets")?.scrollIntoView({ behavior: "smooth", block: "start" }); }} />
          </>
        ) : (
          <div className="card p-8 text-center text-sm text-muted">{ton.length ? "No markets match." : "GeckoTerminal and STON.fi didn't respond. Retrying on the next refresh."}</div>
        )}
      </div>

      <ChainMarket chain="ethereum" />
      <ChainMarket chain="solana" />
    </section>
  );
}

function Grid({ tokens }: { tokens: MarketToken[] }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{tokens.map((t) => <TokenCard key={t.address} token={t} />)}</div>;
}
