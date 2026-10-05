"use client";
import { useEffect, useMemo, useState } from "react";
import { Download, ExternalLink } from "lucide-react";
import { ago, shortAddr } from "@/lib/format";
import { clearTxLog, downloadText, loadTxLog, onTxLog, toCsv, type TxEntry } from "@/lib/txlog";
import { Hint } from "./ui";
import { Pager } from "./Pager";

interface Row {
  chain: string;
  hash: string;
  time: number;
  title: string;
  detail: string;
  status: "ok" | "failed" | "pending";
  url: string;
  spam?: boolean;
}
type View = { key: string; time: number; chain: string; title: string; detail: string; status: "ok" | "failed" | "pending"; url?: string; hash?: string; spam?: boolean; bitpad?: TxEntry };

const CHAIN_LABEL: Record<string, string> = { ton: "TON", solana: "Solana", ethereum: "Ethereum", base: "Base", bsc: "BNB", arbitrum: "Arbitrum", polygon: "Polygon", avalanche: "Avalanche" };
const FILTERS = ["all", "ton", "solana", "ethereum", "base", "bitpad"] as const;
const PAGE = 25;
const STATUS: Record<View["status"], string> = { ok: "text-up", failed: "text-down", pending: "text-ink-2" };
const EXPLORER: Record<string, (h: string) => string> = {
  ton: (h) => `https://tonviewer.com/transaction/${h}`,
  solana: (h) => `https://solscan.io/tx/${h}`,
  ethereum: (h) => `https://etherscan.io/tx/${h}`,
  base: (h) => `https://basescan.org/tx/${h}`,
  bsc: (h) => `https://bscscan.com/tx/${h}`,
  arbitrum: (h) => `https://arbiscan.io/tx/${h}`,
  polygon: (h) => `https://polygonscan.com/tx/${h}`,
  avalanche: (h) => `https://snowtrace.io/tx/${h}`,
};

/**
 * Every transaction of the connected wallets, newest first: on-chain history
 * from TON, Solana, Ethereum and Base, merged with Bitpad's own log of what was
 * sent from the app (labelled, e.g. "⚡ Buy $TSLAx"). Exports to CSV.
 */
export function PortfolioHistory({ ton, sol, evm }: { ton?: string; sol?: string; evm?: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [sources, setSources] = useState<Record<string, boolean | null>>({});
  const [log, setLog] = useState<TxEntry[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [showSpam, setShowSpam] = useState(false);
  const [page, setPage] = useState(0);

  useEffect(() => {
    const read = () => setLog(loadTxLog());
    read();
    return onTxLog(read);
  }, []);
  useEffect(() => {
    if (!ton && !sol && !evm) return;
    let live = true;
    const load = () =>
      fetch(`/api/history?${new URLSearchParams({ ...(ton && { ton }), ...(sol && { sol }), ...(evm && { evm }) })}`)
        .then((r) => r.json())
        .then((d) => { if (live) { setRows(d.rows ?? []); setSources(d.sources ?? {}); } })
        .catch(() => live && setRows([]));
    load();
    const t = setInterval(load, 60_000);
    return () => { live = false; clearInterval(t); };
  }, [ton, sol, evm, log.length]);

  const merged = useMemo<View[]>(() => {
    const out: View[] = (rows ?? []).map((r) => ({ key: `${r.chain}:${r.hash}`, ...r }));
    const used = new Set<number>();
    const extra: View[] = [];
    for (const e of log) {
      // Solana / EVM: exact hash; TON: the wallet event closest in time (the log keeps the message hash, the indexer the transaction hash)
      let i = e.hash ? out.findIndex((v, j) => !used.has(j) && v.chain === e.chain && (v.hash ?? "").toLowerCase() === e.hash!.toLowerCase()) : -1;
      if (i < 0 && e.chain === "ton" && !/^Bundler (buy|sell|sweep)/.test(e.label)) {
        let best = Infinity;
        out.forEach((v, j) => {
          const dt = v.time - e.time;
          if (!used.has(j) && v.chain === "ton" && dt > -30_000 && dt < 300_000 && Math.abs(dt) < best) { best = Math.abs(dt); i = j; }
        });
      }
      if (i >= 0) {
        used.add(i);
        out[i] = { ...out[i], bitpad: e };
      } else {
        extra.push({
          key: `log:${e.id}`, time: e.time, chain: e.chain, title: e.label, detail: [e.amount, e.detail].filter(Boolean).join(" · "),
          status: e.status === "failed" ? "failed" : e.status === "confirmed" ? "ok" : "pending", hash: e.hash, url: e.hash ? EXPLORER[e.chain]?.(e.hash) : undefined, bitpad: e,
        });
      }
    }
    return [...out, ...extra].sort((a, b) => b.time - a.time);
  }, [rows, log]);

  const shown = merged.filter((v) => (filter === "all" ? true : filter === "bitpad" ? !!v.bitpad : v.chain === filter) && (showSpam || !v.spam));
  const spamCount = merged.filter((v) => v.spam).length;
  useEffect(() => setPage(0), [filter, showSpam]);
  const failed = Object.entries(sources).filter(([, ok]) => ok === false).map(([c]) => CHAIN_LABEL[c] ?? c);

  function exportCsv() {
    const csv = toCsv(shown.map((v) => ({
      time: new Date(v.time).toISOString(), chain: CHAIN_LABEL[v.chain] ?? v.chain, action: v.bitpad?.label ?? v.title, details: v.detail, status: v.status,
      made_on_bitpad: v.bitpad ? "yes" : "", wallet: v.bitpad?.wallet ?? "", hash: v.hash ?? "", link: v.url ?? "",
    })));
    downloadText(`bitpad-history-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          Transaction history
          <Hint>Every transaction of your connected wallets, read from each chain: TonAPI for TON, the Solana network, and Blockscout for Ethereum and Base. Anything you sent from Bitpad (buys, sells, launches, staking, chat posts, bundler trades, cross-chain buys) is also recorded by the app and labelled. That log lives in this browser, so export it to CSV to keep a copy.</Hint>
        </h2>
        <div className="seg ml-auto max-w-full overflow-x-auto">
          {FILTERS.map((f) => <button key={f} data-on={filter === f} onClick={() => setFilter(f)}>{f === "all" ? "All" : f === "bitpad" ? "Made on Bitpad" : CHAIN_LABEL[f]}</button>)}
        </div>
        <button onClick={exportCsv} disabled={!shown.length} className="btn btn-ghost h-8 px-3 text-xs"><Download className="size-3.5" /> CSV</button>
      </div>
      {(failed.length > 0 || spamCount > 0) && (
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-2 text-xs text-muted">
          {failed.length > 0 && <span>{failed.join(", ")} history didn&apos;t load right now; retrying every minute.</span>}
          {spamCount > 0 && <label className="ml-auto flex items-center gap-1.5"><input type="checkbox" checked={showSpam} onChange={(e) => setShowSpam(e.target.checked)} /> Show {spamCount} spam</label>}
        </div>
      )}
      <div className="scroll-x">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-left text-xs text-muted">
            <tr className="border-b border-line"><th className="px-4 py-2 font-medium">Action</th><th className="font-medium">Chain</th><th className="font-medium">Details</th><th className="font-medium">Status</th><th className="font-medium">When</th><th className="px-4 text-right font-medium">Tx</th></tr>
          </thead>
          <tbody>
            {shown.slice(page * PAGE, (page + 1) * PAGE).map((v) => (
              <tr key={v.key} className="border-b border-line/60 last:border-0 hover:bg-surface-2/60">
                <td className="px-4 py-2.5">
                  <div className="font-medium">{v.bitpad?.label ?? v.title}</div>
                  {v.bitpad && <span className="chip mt-0.5 !text-[10px]" title="Sent from Bitpad">Bitpad</span>}
                </td>
                <td className="text-xs text-ink-2">{CHAIN_LABEL[v.chain] ?? v.chain}</td>
                <td className="num max-w-[320px] truncate text-xs text-ink-2" title={v.detail}>{v.detail || (v.bitpad?.amount ?? "—")}</td>
                <td className={`text-xs font-medium ${STATUS[v.status]}`}>{v.status === "ok" ? "Done" : v.status === "failed" ? "Failed" : "Pending"}</td>
                <td className="whitespace-nowrap text-xs text-muted" title={new Date(v.time).toLocaleString()}>{v.time ? ago(v.time) : "—"}</td>
                <td className="px-4 text-right">
                  {v.url ? <a href={v.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-xs text-muted hover:text-ink">{v.hash ? shortAddr(v.hash, 4, 4) : "View"}<ExternalLink className="size-3" /></a> : <span className="text-xs text-muted">—</span>}
                </td>
              </tr>
            ))}
            {rows === null && (ton || sol || evm) && Array.from({ length: 4 }, (_, i) => <tr key={i} className="border-b border-line/60"><td colSpan={6} className="px-4 py-3"><div className="h-4 animate-pulse rounded bg-surface-2" /></td></tr>)}
            {rows !== null && !shown.length && <tr><td colSpan={6} className="py-8 text-center text-muted">{filter === "bitpad" ? "Nothing sent from Bitpad in this browser yet." : "No transactions yet."}</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-3 px-4 pb-3">
        <Pager page={page} pageSize={PAGE} total={shown.length} onPage={setPage} />
        {log.length > 0 && <button onClick={() => confirm("Clear Bitpad's log of your transactions in this browser? On-chain history isn't affected.") && clearTxLog()} className="ml-auto text-xs text-muted hover:text-down">Clear Bitpad log ({log.length})</button>}
      </div>
    </section>
  );
}
