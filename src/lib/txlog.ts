"use client";

/**
 * Bitpad's own record of every transaction sent from the app, on every chain:
 * buys, sells, launches, staking, referral claims, chat posts, bundler legs and
 * cross-chain buys. Kept in this browser (localStorage), shown in Portfolio →
 * History next to the on-chain history, and exportable as CSV.
 */
export type TxChain = "ton" | "solana" | "ethereum" | "base" | "bsc" | "arbitrum" | "polygon" | "avalanche" | string;
export type TxKind = "buy" | "sell" | "launch" | "stake" | "unstake" | "claim" | "referral" | "chat" | "fund" | "gas" | "sweep" | "admin" | "withdraw" | "tx";

export interface TxEntry {
  id: string;
  time: number;
  chain: TxChain;
  kind: TxKind;
  /** One line, e.g. "Buy $TSLAx" */
  label: string;
  token?: string;
  /** Human amount, e.g. "1 GRAM" or "25% of holdings" */
  amount?: string;
  /** Signature / tx hash / TON external-message hash */
  hash?: string;
  /** Which wallet sent it (connected wallet or a bundler burner) */
  wallet?: string;
  status: "sent" | "confirmed" | "failed";
  detail?: string;
}

export interface TxMeta { kind: TxKind; label: string; token?: string; amount?: string; wallet?: string; detail?: string }

const KEY = "bitpad.txlog";
const MAX = 2000;
const EVT = "bitpad:txlog";

export function loadTxLog(): TxEntry[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function save(list: TxEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch { /* storage full or blocked */ }
  window.dispatchEvent(new Event(EVT));
}

/** Add a transaction to the log; returns its id so its status can be updated later. */
export function recordTx(e: Omit<TxEntry, "id" | "time"> & { time?: number }): string {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  save([{ id, time: e.time ?? Date.now(), ...e }, ...loadTxLog()]);
  return id;
}

export function updateTx(id: string, patch: Partial<TxEntry>) {
  save(loadTxLog().map((x) => (x.id === id ? { ...x, ...patch } : x)));
}

export function clearTxLog() {
  save([]);
}

export function onTxLog(cb: () => void) {
  window.addEventListener(EVT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** CSV of the given rows (Excel / Sheets friendly). */
export function toCsv(rows: Record<string, string | number | undefined>[]): string {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

export function downloadText(name: string, text: string, type = "text/csv") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
