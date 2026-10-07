import { mnemonicNew, mnemonicToPrivateKey, mnemonicValidate } from "@ton/crypto";
import { WalletContractV5R1, internal, SendMode, fromNano, toNano, Address } from "@ton/ton";
import { Cell, beginCell, loadStateInit, type SenderArguments } from "@ton/core";
import { tonClient, type TcMessage } from "./client";

/**
 * Multi-wallet trading ("bundles"). Burner W5 wallets are generated in the
 * browser, their mnemonics encrypted with a user password (PBKDF2 → AES-GCM)
 * and kept in localStorage. Nothing ever leaves the device, which also means
 * browser storage is the only copy: it's per browser and per site address, and
 * clearing site data (or Safari's 7-day cleanup) deletes it. So every wallet must
 * be backed up: an encrypted backup file (restorable on any device with the
 * vault password) or the plain 24-word phrases. Backups are tracked per address.
 */

export interface BundleWallet {
  id: string;
  label: string;
  address: string;
  /** encrypted mnemonic (base64 iv|ciphertext) */
  secret: string;
  enabled: boolean;
  balance?: number;
}

const STORE_KEY = "bitpad.bundle.v1";
const SALT_KEY = "bitpad.bundle.salt";
const BACKED_KEY = "bitpad.bundle.backedUp";
const KDF_ITER = 210_000;

// ── crypto ────────────────────────────────────────────────────────────────
function localSalt(): string {
  let salt = localStorage.getItem(SALT_KEY);
  if (!salt) {
    salt = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
    localStorage.setItem(SALT_KEY, salt);
  }
  return salt;
}

async function deriveKey(password: string, saltB64?: string): Promise<CryptoKey> {
  const salt = saltB64 ?? localSalt();
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: Uint8Array.from(atob(salt), (c) => c.charCodeAt(0)), iterations: KDF_ITER, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encrypt(text: string, password: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await deriveKey(password), new TextEncoder().encode(text)));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv);
  out.set(ct, iv.length);
  return btoa(String.fromCharCode(...out));
}

async function decrypt(blob: string, password: string, saltB64?: string) {
  const raw = Uint8Array.from(atob(blob), (c) => c.charCodeAt(0));
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: raw.slice(0, 12) }, await deriveKey(password, saltB64), raw.slice(12));
  return new TextDecoder().decode(pt);
}

// ── backup & restore ──────────────────────────────────────────────────────
export interface BundleBackup {
  format: "bitpad-bundle-backup";
  version: 1;
  createdAt: string;
  /** Site the wallets were created on (where their browser copy lives) */
  origin: string;
  kdf: { name: "PBKDF2"; hash: "SHA-256"; iterations: number; salt: string };
  cipher: "AES-GCM-256";
  wallets: { label: string; address: string; secret: string }[];
}

/** Encrypted backup of every wallet: restorable anywhere with the vault password. Checks the password first. */
export async function exportBackup(wallets: BundleWallet[], password: string): Promise<BundleBackup> {
  if (wallets[0]) await decrypt(wallets[0].secret, password); // throws on a wrong password
  return {
    format: "bitpad-bundle-backup", version: 1, createdAt: new Date().toISOString(), origin: location.origin,
    kdf: { name: "PBKDF2", hash: "SHA-256", iterations: KDF_ITER, salt: localSalt() }, cipher: "AES-GCM-256",
    wallets: wallets.map((w) => ({ label: w.label, address: w.address, secret: w.secret })),
  };
}

/** Plain-text export: label, address and 24 words per wallet. Anyone with this file controls the wallets. */
export async function exportPhrases(wallets: BundleWallet[], password: string): Promise<string> {
  const lines = [
    "BITPAD BUNDLER WALLETS: RECOVERY PHRASES",
    "Anyone with these words controls the wallets. Keep this offline and private.",
    "Each phrase also works in Tonkeeper / MyTonWallet (import, wallet version W5).",
    `Exported ${new Date().toISOString()} from ${location.origin}`,
    "",
  ];
  for (const w of wallets) lines.push(`${w.label}`, `Address: ${w.address}`, `Phrase: ${await decrypt(w.secret, password)}`, "");
  return lines.join("\n");
}

/**
 * Restore wallets from a backup file. Each one is decrypted with the backup's
 * own salt and password, checked against its address, then re-encrypted for
 * this browser's vault. Wallets already present are skipped.
 */
export async function restoreBackup(backup: BundleBackup, backupPassword: string, vaultPassword: string, existing: BundleWallet[]): Promise<BundleWallet[]> {
  if (backup?.format !== "bitpad-bundle-backup" || !Array.isArray(backup.wallets) || !backup.kdf?.salt) throw new Error("This isn't a Bitpad bundler backup file");
  const have = new Set(existing.map((w) => w.address));
  const out: BundleWallet[] = [];
  for (const b of backup.wallets) {
    if (have.has(b.address)) continue;
    let words: string;
    try {
      words = await decrypt(b.secret, backupPassword, backup.kdf.salt);
    } catch {
      throw new Error("Wrong password for this backup (use the vault password you had when it was made)");
    }
    const { contract } = await walletFromMnemonic(words.split(" "));
    const address = contract.address.toString({ bounceable: false });
    if (address !== b.address) throw new Error(`Backup entry ${b.label} doesn't match its address`);
    out.push({ id: crypto.randomUUID(), label: b.label, address, secret: await encrypt(words, vaultPassword), enabled: true });
    have.add(address);
  }
  return out;
}

/** Addresses included in a backup or phrase export the user downloaded from this browser. */
export function backedUp(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(BACKED_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}
export function markBackedUp(addresses: string[]) {
  const s = backedUp();
  for (const a of addresses) s.add(a);
  try { localStorage.setItem(BACKED_KEY, JSON.stringify([...s])); } catch { /* storage blocked */ }
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") window.dispatchEvent(new Event(BACKUP_EVENT));
}
export const BACKUP_EVENT = "bitpad:bundle-backup";

/** Ask the browser not to evict this site's storage under pressure (and exempt it from some automatic cleanup). */
export async function keepStorage(): Promise<boolean> {
  try {
    return (await navigator.storage?.persisted?.()) || (await navigator.storage?.persist?.()) || false;
  } catch {
    return false;
  }
}

// ── storage ───────────────────────────────────────────────────────────────
export function loadWallets(): BundleWallet[] {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) ?? "[]");
  } catch {
    return [];
  }
}
export function saveWallets(w: BundleWallet[]) {
  localStorage.setItem(STORE_KEY, JSON.stringify(w.map(({ balance: _b, ...rest }) => rest)));
}

async function walletFromMnemonic(words: string[]) {
  const key = await mnemonicToPrivateKey(words);
  const contract = WalletContractV5R1.create({ workchain: 0, publicKey: key.publicKey });
  return { key, contract };
}

export async function createWallets(count: number, password: string, startIndex = 0): Promise<BundleWallet[]> {
  const out: BundleWallet[] = [];
  for (let i = 0; i < count; i++) {
    const words = await mnemonicNew(24);
    const { contract } = await walletFromMnemonic(words);
    out.push({
      id: crypto.randomUUID(),
      label: `Wallet ${startIndex + i + 1}`,
      address: contract.address.toString({ bounceable: false }),
      secret: await encrypt(words.join(" "), password),
      enabled: true,
    });
  }
  return out;
}

export async function importWallet(mnemonic: string, password: string, label: string): Promise<BundleWallet> {
  const words = mnemonic.trim().split(/\s+/);
  if (!(await mnemonicValidate(words))) throw new Error("Invalid mnemonic");
  const { contract } = await walletFromMnemonic(words);
  return { id: crypto.randomUUID(), label, address: contract.address.toString({ bounceable: false }), secret: await encrypt(words.join(" "), password), enabled: true };
}

export async function revealMnemonic(w: BundleWallet, password: string) {
  return decrypt(w.secret, password);
}

export async function fetchBalances(wallets: BundleWallet[]): Promise<Record<string, number>> {
  const client = tonClient();
  const out: Record<string, number> = {};
  // toncenter free tier ≈ 1 rps without a key — go sequentially
  for (const w of wallets) {
    try {
      out[w.id] = Number(fromNano(await client.getBalance(Address.parse(w.address))));
    } catch {
      out[w.id] = NaN;
    }
  }
  return out;
}

// ── distribution ──────────────────────────────────────────────────────────
export type SplitMode = "equal" | "random" | "weighted";

export function splitAmount(total: number, n: number, mode: SplitMode, variance = 0.25): number[] {
  if (n <= 0) return [];
  if (mode === "equal") return Array(n).fill(total / n);
  const w = Array.from({ length: n }, (_, i) => (mode === "random" ? 1 + (Math.random() * 2 - 1) * variance : n - i));
  const sum = w.reduce((a, b) => a + b, 0);
  return w.map((x) => (x / sum) * total);
}

/** Messages for the main (TON Connect) wallet to fund every bundle wallet. */
/** Comment on funding transfers, so burner wallets can be found again from the main wallet's history. */
export const FUND_COMMENT = "Bitpad bundle";
const fundPayload = () => beginCell().storeUint(0, 32).storeStringTail(FUND_COMMENT).endCell().toBoc().toString("base64");

export function fundingMessages(wallets: BundleWallet[], amounts: number[]): TcMessage[] {
  return wallets.map((w, i) => ({ address: w.address, amount: toNano(amounts[i].toFixed(9)).toString(), payload: fundPayload() }));
}

// The wallet's own fee for sending its message (a W5 external message costs ~0.003-0.006 GRAM).
// Everything else is the gas the DEX attaches to the swap message; the unused part is refunded.
const GAS_RESERVE = toNano("0.012");

async function sendSigned(w: BundleWallet, password: string, tx: SenderArguments, extra: SenderArguments[] = []) {
  const words = (await decrypt(w.secret, password)).split(" ");
  const { key, contract } = await walletFromMnemonic(words);
  const opened = tonClient().open(contract);
  // Refuse up front instead of letting the chain drop it
  const need = [tx, ...extra].reduce((s, m) => s + m.value, 0n) + GAS_RESERVE;
  const bal = await tonClient().getBalance(contract.address);
  if (bal < need) {
    const short = Number(fromNano(need - bal));
    throw new Error(`Not enough GRAM for gas in ${w.label}: has ${Number(fromNano(bal)).toFixed(3)}, this trade attaches ~${Number(fromNano(need)).toFixed(3)} (mostly refunded after the swap). Top it up by ${Math.max(0.01, short).toFixed(3)} GRAM or more.`);
  }
  const seqno = await opened.getSeqno();
  await opened.sendTransfer({
    seqno,
    secretKey: key.secretKey,
    sendMode: SendMode.PAY_GAS_SEPARATELY | SendMode.IGNORE_ERRORS,
    messages: [tx, ...extra].map((m) => internal({ to: m.to, value: m.value, body: m.body ?? undefined, init: m.init ?? undefined, bounce: m === tx })),
  });
}

/** Sell legs: server-built on the first working route (Bitpad pool, STON.fi, DeDust, Omniston). */
async function buildSellLeg(wallet: string, jetton: string, units: bigint, slippagePct: number) {
  const qs = new URLSearchParams({ token: jetton, wallet, units: units.toString(), slippage: String(slippagePct) });
  const d = await fetch(`/api/sell-tx?${qs}`).then((r) => r.json());
  if (d.error) throw new Error(d.error);
  return { msgs: toSenderArgs(d.messages as TcMessage[]), via: d.via as string };
}

const toSenderArgs = (messages: TcMessage[]): SenderArguments[] =>
  messages.map((m) => ({
    to: Address.parse(m.address),
    value: BigInt(m.amount),
    body: m.payload ? Cell.fromBase64(m.payload) : undefined,
    init: m.stateInit ? loadStateInit(Cell.fromBase64(m.stateInit).beginParse()) : undefined,
  }));

/** Each wallet's balance of `jetton` (raw units). */
export async function fetchJettonBalances(jetton: string, wallets: BundleWallet[]): Promise<Record<string, bigint>> {
  if (!wallets.length) return {};
  const d = await fetch(`/api/jetton-balances?${new URLSearchParams({ jetton, owners: wallets.map((w) => w.address).join(",") })}`).then((r) => r.json());
  const out: Record<string, bigint> = {};
  for (const w of wallets) out[w.id] = BigInt(d.balances?.[w.address] ?? "0");
  return out;
}

/**
 * Buy legs are built server-side (/api/buy-tx): the same route as ⚡ quick
 * buy, i.e. Bitpad pools, STON.fi, DeDust or Omniston for stocks, with the
 * keyed RPC. Returns sender arguments for the burner wallet to sign.
 */
async function buildBuyLeg(wallet: string, jetton: string, tonAmount: number, slippagePct: number): Promise<{ msgs: SenderArguments[]; via: string; expectedOut?: string }> {
  const qs = new URLSearchParams({ token: jetton, pay: "TON", amount: String(tonAmount), wallet, slippage: String(slippagePct) });
  const d = await fetch(`/api/buy-tx?${qs}`).then((r) => r.json());
  if (d.error) throw new Error(d.error);
  const msgs = (d.messages as TcMessage[]).map((m): SenderArguments => ({
    to: Address.parse(m.address),
    value: BigInt(m.amount),
    body: m.payload ? Cell.fromBase64(m.payload) : undefined,
    init: m.stateInit ? loadStateInit(Cell.fromBase64(m.stateInit).beginParse()) : undefined,
  }));
  if (!msgs.length) throw new Error("No transaction was built for this buy");
  return { msgs, via: d.via, expectedOut: d.expectedOut };
}

export interface BundleProgress {
  walletId: string;
  status: "pending" | "sent" | "error";
  error?: string;
  /** buys: route used */
  via?: string;
}

/**
 * Execute a buy (or sell) from every enabled wallet. Each wallet signs its own
 * STON.fi swap locally. `staggerMs` spaces submissions to look organic and to
 * respect RPC limits.
 */
export async function runBundle(opts: {
  side: "buy" | "sell";
  wallets: BundleWallet[];
  amounts: number[]; // GRAM per wallet (buys)
  sellUnits?: bigint[]; // raw jetton units per wallet (sells)
  jetton: string;
  password: string;
  slippage: number;
  staggerMs: number;
  onProgress: (p: BundleProgress) => void;
}) {
  for (let i = 0; i < opts.wallets.length; i++) {
    const w = opts.wallets[i];
    opts.onProgress({ walletId: w.id, status: "pending" });
    try {
      if (opts.side === "buy") {
        const leg = await buildBuyLeg(w.address, opts.jetton, opts.amounts[i], opts.slippage * 100);
        await sendSigned(w, opts.password, leg.msgs[0], leg.msgs.slice(1));
        opts.onProgress({ walletId: w.id, status: "sent", via: leg.via });
      } else {
        const units = opts.sellUnits?.[i] ?? 0n;
        if (units <= 0n) throw new Error(`${w.label} holds none of this token`);
        const leg = await buildSellLeg(w.address, opts.jetton, units, opts.slippage * 100);
        await sendSigned(w, opts.password, leg.msgs[0], leg.msgs.slice(1));
        opts.onProgress({ walletId: w.id, status: "sent", via: leg.via });
      }
    } catch (e) {
      opts.onProgress({ walletId: w.id, status: "error", error: (e as Error).message });
    }
    if (opts.staggerMs && i < opts.wallets.length - 1) await new Promise((r) => setTimeout(r, opts.staggerMs * (0.6 + Math.random() * 0.8)));
  }
}

/** Sweep all TON from bundle wallets back to the main wallet. */
export async function sweepAll(wallets: BundleWallet[], to: string, password: string, onProgress: (p: BundleProgress) => void) {
  for (const w of wallets) {
    onProgress({ walletId: w.id, status: "pending" });
    try {
      const words = (await decrypt(w.secret, password)).split(" ");
      const { key, contract } = await walletFromMnemonic(words);
      const opened = tonClient().open(contract);
      await opened.sendTransfer({
        seqno: await opened.getSeqno(),
        secretKey: key.secretKey,
        sendMode: SendMode.CARRY_ALL_REMAINING_BALANCE,
        messages: [internal({ to, value: 0n, bounce: false })],
      });
      onProgress({ walletId: w.id, status: "sent" });
    } catch (e) {
      onProgress({ walletId: w.id, status: "error", error: (e as Error).message });
    }
  }
}
