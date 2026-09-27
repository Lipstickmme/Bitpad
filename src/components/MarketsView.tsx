"use client";
import { useMemo, useState } from "react";
import type { BitpadToken, PairKind } from "@/lib/types";
import { TokenCard } from "./TokenCard";
import { SectionTitle } from "./ui";

const FILTERS: { id: "all" | PairKind; label: string }[] = [
  { id: "all", label: "All" },
  { id: "stock", label: "Stocks" },
  { id: "commodity", label: "Commodities" },
  { id: "jetton", label: "TON jettons" },
  { id: "crypto", label: "Cross-chain" },
];
const SORTS = [
  { id: "marketCap", label: "Market cap" },
  { id: "volume24h", label: "Volume" },
  { id: "change24h", label: "Gainers" },
  { id: "createdAt", label: "Newest" },
] as const;

export function MarketsView({ tokens }: { tokens: BitpadToken[] }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [sort, setSort] = useState<(typeof SORTS)[number]["id"]>("marketCap");

  const list = useMemo(
    () => tokens.filter((t) => filter === "all" || t.pair.kind === filter).sort((a, b) => b[sort] - a[sort]),
    [tokens, filter, sort],
  );

  return (
    <section>
      <SectionTitle
        right={
          <div className="seg">
            {SORTS.map((s) => (
              <button key={s.id} data-on={sort === s.id} onClick={() => setSort(s.id)}>{s.label}</button>
            ))}
          </div>
        }
      >
        All tokens
      </SectionTitle>
      <div className="scroll-x mb-4 flex gap-2">
        {FILTERS.map((f) => (
          <button key={f.id} onClick={() => setFilter(f.id)} className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold ${filter === f.id ? "border-ink bg-ink text-white" : "border-line bg-surface text-ink-2 hover:border-line-strong"}`}>
            {f.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {list.map((t) => <TokenCard key={t.address} token={t} />)}
      </div>
    </section>
  );
}
