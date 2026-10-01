import { mnemonicNew, mnemonicToPrivateKey, mnemonicValidate } from "@ton/crypto";
import { WalletContractV5R1, internal, SendMode, fromNano, toNano, Address } from "@ton/ton";
import { Cell, loadStateInit, type SenderArguments } from "@ton/core";
import { tonClient, type TcMessage } from "./client";
import { buildSellArgs } from "./swap";

/**
 * Multi-wallet trading ("bundles"). Burner W5 wallets are generated in the
 * browser, their mnemonics encrypted with a user password (PBKDF2 → AES-GCM)
 * and kept in localStorage. Nothing ever leaves the device.
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

// ── crypto ────────────────────────────────────────────────────────────────
async function deriveKey(password: string): Promise<CryptoKey> {
  let salt = localStorage.getItem(SALT_KEY);
  if (!salt) {
    salt = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
    localStorage.setItem(SALT_KEY, salt);
  }
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: Uint8Array.from(atob(salt), (c) => c.charCodeAt(0)), iterations: 210_000, hash: "SHA-256" },
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

async function decrypt(blob: string, password: string) {
  const raw = Uint8Array.from(atob(blob), (c) => c.charCodeAt(0));
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: raw.slice(0, 12) }, await deriveKey(password), raw.slice(12));
  return new TextDecoder().decode(pt);
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
export function fundingMessages(wallets: BundleWallet[], amounts: number[]): TcMessage[] {
  return wallets.map((w, i) => ({ address: w.address, amount: toNano(amounts[i].toFixed(9)).toString() }));
}

const GAS_RESERVE = toNano("0.05"); // wallet's own fees for the external message

async function sendSigned(w: BundleWallet, password: string, tx: SenderArguments, extra: SenderArguments[] = []) {
  const words = (await decrypt(w.secret, password)).split(" ");
  const { key, contract } = await walletFromMnemonic(words);
  const opened = tonClient().open(contract);
  // Refuse up front instead of letting the chain drop it
  const need = [tx, ...extra].reduce((s, m) => s + m.value, 0n) + GAS_RESERVE;
  const bal = await tonClient().getBalance(contract.address);
  if (bal < need) throw new Error(`Not enough TON in ${w.label}: has ${Number(fromNano(bal)).toFixed(3)}, this trade needs ~${Number(fromNano(need)).toFixed(3)} incl. gas`);
  const seqno = await opened.getSeqno();
  await opened.sendTransfer({
    seqno,
    secretKey: key.secretKey,
    sendMode: SendMode.PAY_GAS_SEPARATELY | SendMode.IGNORE_ERRORS,
    messages: [tx, ...extra].map((m) => internal({ to: m.to, value: m.value, body: m.body ?? undefined, init: m.init ?? undefined, bounce: m === tx })),
  });
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
  amounts: number[]; // TON per wallet for buys, jetton units (whole tokens) for sells
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
        const built = await buildSellArgs({ wallet: w.address, jetton: opts.jetton, units: BigInt(Math.floor(opts.amounts[i] * 1e9)), slippage: opts.slippage });
        await sendSigned(w, opts.password, built.tx);
        opts.onProgress({ walletId: w.id, status: "sent", via: "STON.fi" });
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
