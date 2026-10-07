"use client";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Download, FileKey2, Search, ShieldCheck, Upload } from "lucide-react";
import type { BundleBackup as Backup, BundleWallet } from "@/lib/ton/bundler";
import { downloadText } from "@/lib/txlog";
import { num, shortAddr, ago } from "@/lib/format";
import { toast } from "./Toast";
import { CopyButton } from "./CopyButton";

type Lib = typeof import("@/lib/ton/bundler");

const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");

/** Download an encrypted backup of every wallet and mark them backed up. Used right after creating wallets too. */
export async function downloadBackup(lib: Lib, wallets: BundleWallet[], password: string) {
  const b = await lib.exportBackup(wallets, password);
  downloadText(`bitpad-bundler-backup-${stamp()}.json`, JSON.stringify(b, null, 2), "application/json");
  lib.markBackedUp(wallets.map((w) => w.address));
}

/**
 * Keeps bundler keys from being lost: browser storage is their only copy, so a
 * red banner stays up until every wallet is in a downloaded backup. Encrypted
 * backup, plain 24-word export, and restore from a backup file.
 */
export function BundleBackupBar({ lib, wallets, password, onRestore }: { lib: Lib; wallets: BundleWallet[]; password: string; onRestore: (w: BundleWallet[]) => void }) {
  const [backed, setBacked] = useState<Set<string>>(new Set());
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const read = () => setBacked(lib.backedUp());
    read();
    window.addEventListener(lib.BACKUP_EVENT, read);
    return () => window.removeEventListener(lib.BACKUP_EVENT, read);
  }, [lib, wallets.length]);
  useEffect(() => { lib.keepStorage().then(setPersisted); }, [lib]);
  const missing = wallets.filter((w) => !backed.has(w.address));
  const preview = typeof location !== "undefined" && /\.vercel\.app$/.test(location.hostname);
  const tg = typeof window !== "undefined" && !!window.Telegram?.WebApp?.initData;

  async function backup() {
    try {
      await downloadBackup(lib, wallets, password);
      setBacked(lib.backedUp());
      toast.success("Backup downloaded", "Keep the file somewhere safe (cloud drive, USB). You'll need it and your vault password to restore.");
    } catch {
      toast.error("Couldn't make the backup", "Unlock with the right vault password and try again.");
    }
  }
  async function phrases() {
    if (!confirm("This downloads every wallet's 24-word phrase in plain text. Anyone who gets the file controls these wallets. Continue?")) return;
    try {
      downloadText(`bitpad-bundler-phrases-${stamp()}.txt`, await lib.exportPhrases(wallets, password), "text/plain");
      lib.markBackedUp(wallets.map((w) => w.address));
      setBacked(lib.backedUp());
    } catch {
      toast.error("Couldn't export", "Unlock with the right vault password and try again.");
    }
  }
  async function restore(f: File) {
    try {
      const data = JSON.parse(await f.text()) as Backup;
      const pw = prompt("Vault password used when this backup was made (leave empty if it's the same as now):") ?? null;
      if (pw === null) return;
      const added = await lib.restoreBackup(data, pw || password, password, wallets);
      onRestore(added);
      lib.markBackedUp(added.map((w) => w.address));
      setBacked(lib.backedUp());
      toast.success(added.length ? `${added.length} wallet${added.length === 1 ? "" : "s"} restored` : "Nothing new to restore", added.length ? "They're back in this browser's vault." : "Every wallet in that backup is already here.");
    } catch (e) {
      toast.error("Restore failed", (e as Error).message);
    } finally {
      if (file.current) file.current.value = "";
    }
  }

  return (
    <section className={`card p-4 ${missing.length ? "border-down/40 bg-down-soft/40" : ""}`}>
      <div className="flex flex-wrap items-start gap-3">
        <div className={`grid size-9 shrink-0 place-items-center rounded-lg ${missing.length ? "bg-down-soft text-down" : "bg-up-soft text-up"}`}>
          {missing.length ? <AlertTriangle className="size-4" /> : <ShieldCheck className="size-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">
            {!wallets.length ? "Your wallets' keys live only in this browser" : missing.length ? `${missing.length} of ${wallets.length} wallets aren't backed up` : "All wallets backed up"}
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-2">
            Keys are stored only in this browser, for <b className="font-mono">{typeof location !== "undefined" ? location.host : ""}</b>{tg ? " inside Telegram" : ""}. Bitpad has no copy and can&apos;t recover them. They disappear if site data is cleared, and they don&apos;t show up in another browser, another device, the Telegram app vs the website, or a different Bitpad link. Download a backup and keep it safe.
            {preview && <b className="text-down"> You&apos;re on a preview link: wallets made here won&apos;t appear on the main site. Back them up and restore them there.</b>}
            {persisted === false && " Your browser didn't grant persistent storage, so backing up matters even more."}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={backup} disabled={!wallets.length} className={`btn h-9 px-3 text-xs ${missing.length ? "btn-primary" : "btn-ghost"}`}><Download className="size-3.5" /> Download encrypted backup</button>
        <button onClick={phrases} disabled={!wallets.length} className="btn btn-ghost h-9 px-3 text-xs"><FileKey2 className="size-3.5" /> Export 24-word phrases</button>
        <button onClick={() => file.current?.click()} className="btn btn-ghost h-9 px-3 text-xs"><Upload className="size-3.5" /> Restore from backup</button>
        <input ref={file} type="file" accept="application/json,.json" className="hidden" onChange={(e) => e.target.files?.[0] && restore(e.target.files[0])} />
      </div>
    </section>
  );
}

/** "Lost your bundler wallets?": the W5 wallets your main wallet funded, with what they hold now. */
export function LostWallets({ owner, known }: { owner?: string; known: string[] }) {
  const [rows, setRows] = useState<{ address: string; sent: number; count: number; last: number; tagged: boolean; balance: number | null }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function scan() {
    if (!owner) return;
    setBusy(true);
    setErr(null);
    try {
      const d = await fetch(`/api/bundle-find?owner=${encodeURIComponent(owner)}`).then((r) => r.json());
      if (d.error) throw new Error(d.error);
      setRows(d.wallets);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const lost = (rows ?? []).filter((r) => !known.includes(r.address));
  return (
    <section className="card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-sm font-semibold">Lost bundler wallets?</div>
        <button onClick={scan} disabled={!owner || busy} className="btn btn-ghost ml-auto h-8 px-3 text-xs"><Search className="size-3.5" /> {busy ? "Scanning…" : owner ? "Find wallets I funded" : "Connect your TON wallet"}</button>
      </div>
      <p className="mt-1 text-xs text-ink-2">
        Lists the W5 wallets your connected wallet sent GRAM to (how bundler wallets get funded), with what they hold now. Funds in them can only be moved with their keys, so if you find them here, open Bitpad in the browser and link where you made them, back them up, then restore here.
      </p>
      {err && <p className="mt-2 text-xs text-down">{err}</p>}
      {rows && (
        <div className="scroll-x mt-3">
          <table className="w-full min-w-[560px] text-xs">
            <thead className="text-left text-muted"><tr className="border-b border-line"><th className="py-1.5 font-medium">Wallet</th><th className="text-right font-medium">You sent</th><th className="text-right font-medium">Holds now</th><th className="text-right font-medium">Last funded</th></tr></thead>
            <tbody className="num">
              {lost.map((r) => (
                <tr key={r.address} className="border-b border-line/60 last:border-0">
                  <td className="py-1.5"><a href={`https://tonviewer.com/${r.address}`} target="_blank" rel="noreferrer" className="font-mono hover:underline">{shortAddr(r.address, 6, 6)}</a><CopyButton value={r.address} className="ml-1 px-1 py-0" />{r.tagged && <span className="chip ml-1 !text-[9px]">Bitpad bundle</span>}</td>
                  <td className="text-right">{num(r.sent, 3)} GRAM <span className="text-muted">· {r.count}×</span></td>
                  <td className="text-right font-medium">{r.balance != null ? `${num(r.balance, 3)} GRAM` : "—"}</td>
                  <td className="text-right text-muted">{ago(r.last)}</td>
                </tr>
              ))}
              {!lost.length && <tr><td colSpan={4} className="py-4 text-center text-muted">No funded W5 wallets missing from this vault.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
