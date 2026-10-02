"use client";
import { ExternalLink, History, Trash2 } from "lucide-react";
import { ago } from "@/lib/format";
import { humanError } from "@/lib/errors";

export interface ActivityEntry {
  id: string;
  time: number;
  kind: "buy" | "sell" | "fund" | "gas" | "sweep";
  wallet?: string; // label
  address?: string;
  amount?: string; // human readable, e.g. "0.5 GRAM" / "6,172 $PEPE"
  token?: string; // symbol
  status: "sent" | "error";
  detail?: string; // route used, or the error
}

const KEY = "bitpad.bundle.activity";
const MAX = 300;

export function loadActivity(): ActivityEntry[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}
export function saveActivity(list: ActivityEntry[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX))); } catch { /* private mode */ }
}
export const newEntry = (e: Omit<ActivityEntry, "id" | "time">): ActivityEntry => ({ id: crypto.randomUUID(), time: Date.now(), ...e });

const LABEL: Record<ActivityEntry["kind"], string> = { buy: "Buy", sell: "Sell", fund: "Fund", gas: "Gas top-up", sweep: "Sweep" };
const TONE: Record<ActivityEntry["kind"], string> = { buy: "text-up", sell: "text-down", fund: "text-ink-2", gas: "text-ink-2", sweep: "text-ink-2" };

/** Bundler activity log: every leg, funding, gas top-up and sweep, newest first. Kept in this browser. */
export function BundleActivity({ list, onClear }: { list: ActivityEntry[]; onClear: () => void }) {
  return (
    <section className="card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-line p-3">
        <History className="size-4 text-ink-2" />
        <h2 className="text-sm font-semibold">Activity</h2>
        <span className="text-xs text-muted">{list.length ? `${list.length} event${list.length === 1 ? "" : "s"} · stored in this browser` : ""}</span>
        {!!list.length && <button onClick={() => confirm("Clear the activity log?") && onClear()} className="ml-auto inline-flex items-center gap-1 text-xs text-muted hover:text-down"><Trash2 className="size-3.5" /> Clear</button>}
      </div>
      <div className="max-h-[360px] overflow-y-auto">
        <table className="w-full text-sm">
          <tbody className="num">
            {list.map((e) => (
              <tr key={e.id} className="border-b border-line/60 align-top last:border-0">
                <td className="whitespace-nowrap px-3 py-2 text-xs text-muted" title={new Date(e.time).toLocaleString()}>{ago(e.time)} ago</td>
                <td className={`py-2 text-xs font-semibold ${TONE[e.kind]}`}>{LABEL[e.kind]}{e.token ? ` $${e.token}` : ""}</td>
                <td className="py-2 text-xs">{e.wallet ?? "—"}</td>
                <td className="py-2 text-right text-xs">{e.amount ?? ""}</td>
                <td className="px-3 py-2 text-xs">
                  <span className={`chip ${e.status === "sent" ? "border-up/25 bg-up-soft text-up" : "border-down/25 bg-down-soft text-down"}`}>{e.status}</span>
                  {e.detail && <div className={`mt-0.5 max-w-[260px] whitespace-normal ${e.status === "error" ? "text-down" : "text-muted"}`} title={e.detail}>{e.status === "error" ? humanError(e.detail) : e.detail}</div>}
                </td>
                <td className="pr-3 py-2 text-right">{e.address && <a href={`https://tonviewer.com/${e.address}`} target="_blank" rel="noreferrer" className="text-muted hover:text-ink" aria-label="Open wallet on Tonviewer"><ExternalLink className="size-3.5" /></a>}</td>
              </tr>
            ))}
            {!list.length && <tr><td className="py-8 text-center text-xs text-muted">No bundle activity yet. Buys, sells, funding and sweeps show up here.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
