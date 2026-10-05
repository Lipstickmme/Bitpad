import "server-only";
import { accountEvents } from "./data/tonapi";
import { jupByMints } from "./data/jupiter";
import { getJson, safe } from "./data/http";

/**
 * Token balances and transaction history for connected wallets on every chain:
 *   TON      TonAPI events (with its own human-readable summaries)
 *   Solana   RPC token accounts (SPL + Token-2022) priced by Jupiter; signatures +
 *            parsed transactions for balance changes
 *   EVM      Blockscout (free, no key) for Ethereum and Base: ERC-20 balances,
 *            transactions and token transfers
 * Uses SOLANA_RPC_URL when set (the public RPC is rate-limited).
 */

export type HistoryChain = "ton" | "solana" | "ethereum" | "base";

export interface HistoryRow {
  chain: HistoryChain;
  hash: string;
  time: number;
  title: string;
  detail: string;
  status: "ok" | "failed" | "pending";
  url: string;
  /** Flagged as a scam / spam interaction by the indexer */
  spam?: boolean;
}

export interface TokenHolding {
  chain: "solana" | "ethereum" | "base";
  address: string;
  symbol: string;
  name: string;
  image?: string;
  amount: number;
  priceUsd: number | null;
  valueUsd: number | null;
  change24h: number | null;
  verified?: boolean;
}

// ── TON ────────────────────────────────────────────────────────────────────
export async function tonHistory(address: string, limit = 50): Promise<HistoryRow[]> {
  const events = await accountEvents(address, limit);
  return events.map((e) => {
    const previews = e.actions.map((a) => a.simple_preview).filter((p): p is NonNullable<typeof p> => !!p);
    const failed = e.actions.some((a) => a.status !== "ok");
    return {
      chain: "ton" as const,
      hash: e.event_id,
      time: e.timestamp * 1000,
      title: previews[0]?.name ?? e.actions[0]?.type ?? "Transaction",
      detail: previews.map((p) => p.description).filter(Boolean).join(" · "),
      status: e.in_progress ? "pending" : failed ? "failed" : "ok",
      url: `https://tonviewer.com/transaction/${e.event_id}`,
      spam: !!e.is_scam,
    };
  });
}

// ── Solana ─────────────────────────────────────────────────────────────────
const SOL_RPC = () => process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const TOKEN_PROGRAMS = ["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"];
const SOL_MINT = "So11111111111111111111111111111111111111112";

async function solRpc<T>(method: string, params: unknown[]): Promise<T> {
  const res = await fetch(SOL_RPC(), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), cache: "no-store", signal: AbortSignal.timeout(10_000) });
  const j = (await res.json()) as { result?: T; error?: { message: string } };
  if (j.error) throw new Error(j.error.message);
  return j.result as T;
}

type ParsedTokenAccount = { account: { data: { parsed: { info: { mint: string; tokenAmount: { uiAmount: number | null; uiAmountString?: string; decimals: number } } } } } };

export async function solTokens(owner: string): Promise<TokenHolding[]> {
  const lists = await Promise.all(TOKEN_PROGRAMS.map((programId) =>
    solRpc<{ value: ParsedTokenAccount[] }>("getTokenAccountsByOwner", [owner, { programId }, { encoding: "jsonParsed", commitment: "confirmed" }]).catch(() => ({ value: [] as ParsedTokenAccount[] })),
  ));
  const byMint = new Map<string, number>();
  for (const acc of lists.flatMap((l) => l.value)) {
    const info = acc.account.data.parsed.info;
    const amt = info.tokenAmount.uiAmount ?? Number(info.tokenAmount.uiAmountString ?? 0);
    if (amt > 0) byMint.set(info.mint, (byMint.get(info.mint) ?? 0) + amt);
  }
  if (!byMint.size) return [];
  const meta = (await safe(jupByMints([...byMint.keys()]), new Map(), "jupiter mints")).value;
  return [...byMint.entries()].map(([mint, amount]) => {
    const m = meta.get(mint);
    const priceUsd = m?.usdPrice ?? null;
    return {
      chain: "solana" as const, address: mint, symbol: m?.symbol ?? `${mint.slice(0, 4)}…`, name: m?.name ?? "Unknown token", image: m?.icon,
      amount, priceUsd, valueUsd: priceUsd != null ? amount * priceUsd : null, change24h: m?.stats24h?.priceChange ?? null, verified: !!m?.isVerified,
    };
  }).sort((a, b) => (b.valueUsd ?? -1) - (a.valueUsd ?? -1));
}

interface SolTx {
  meta: { err: unknown; fee: number; preBalances: number[]; postBalances: number[]; preTokenBalances?: SolTokBal[]; postTokenBalances?: SolTokBal[] } | null;
  transaction: { message: { accountKeys: ({ pubkey: string } | string)[] } };
}
interface SolTokBal { mint: string; owner?: string; uiTokenAmount: { uiAmount: number | null } }

export async function solHistory(owner: string, limit = 25): Promise<HistoryRow[]> {
  const sigs = await solRpc<{ signature: string; blockTime: number | null; err: unknown; confirmationStatus?: string }[]>("getSignaturesForAddress", [owner, { limit }]);
  // Balance changes for the most recent ones, in one batched RPC call
  const parsed = new Map<string, SolTx | null>();
  try {
    const res = await fetch(SOL_RPC(), {
      method: "POST", headers: { "content-type": "application/json" }, cache: "no-store", signal: AbortSignal.timeout(12_000),
      body: JSON.stringify(sigs.slice(0, 20).map((s, i) => ({ jsonrpc: "2.0", id: i, method: "getTransaction", params: [s.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "confirmed" }] }))),
    });
    const arr = (await res.json()) as { id: number; result?: SolTx | null }[];
    if (Array.isArray(arr)) for (const r of arr) parsed.set(sigs[r.id]?.signature, r.result ?? null);
  } catch { /* history still lists signatures */ }

  const mints = new Set<string>();
  for (const tx of parsed.values()) for (const b of [...(tx?.meta?.preTokenBalances ?? []), ...(tx?.meta?.postTokenBalances ?? [])]) if (b.owner === owner) mints.add(b.mint);
  const meta = mints.size ? (await safe(jupByMints([...mints]), new Map(), "jupiter mints")).value : new Map();
  const sym = (mint: string) => (mint === SOL_MINT ? "SOL" : meta.get(mint)?.symbol ?? `${mint.slice(0, 4)}…`);

  return sigs.map((s) => {
    const tx = parsed.get(s.signature);
    const changes: string[] = [];
    let title = s.err ? "Failed transaction" : "Transaction";
    if (tx?.meta) {
      const keys = tx.transaction.message.accountKeys.map((k) => (typeof k === "string" ? k : k.pubkey));
      const i = keys.indexOf(owner);
      if (i >= 0) {
        const d = (tx.meta.postBalances[i] - tx.meta.preBalances[i] + (i === 0 ? tx.meta.fee : 0)) / 1e9;
        if (Math.abs(d) >= 0.000_01) changes.push(`${d > 0 ? "+" : "−"}${fmt(Math.abs(d))} SOL`);
      }
      const delta = new Map<string, number>();
      for (const b of tx.meta.preTokenBalances ?? []) if (b.owner === owner) delta.set(b.mint, (delta.get(b.mint) ?? 0) - (b.uiTokenAmount.uiAmount ?? 0));
      for (const b of tx.meta.postTokenBalances ?? []) if (b.owner === owner) delta.set(b.mint, (delta.get(b.mint) ?? 0) + (b.uiTokenAmount.uiAmount ?? 0));
      for (const [mint, d] of delta) if (Math.abs(d) > 1e-9) changes.push(`${d > 0 ? "+" : "−"}${fmt(Math.abs(d))} ${sym(mint)}`);
      const ins = changes.filter((c) => c.startsWith("+")).length, outs = changes.filter((c) => c.startsWith("−")).length;
      if (!s.err) title = ins && outs ? "Swap" : ins ? "Received" : outs ? "Sent" : "Transaction";
    }
    return {
      chain: "solana" as const, hash: s.signature, time: (s.blockTime ?? 0) * 1000, title, detail: changes.join(" · "),
      status: s.err ? "failed" : s.confirmationStatus === "processed" ? "pending" : "ok", url: `https://solscan.io/tx/${s.signature}`,
    };
  });
}

// ── EVM (Blockscout) ───────────────────────────────────────────────────────
const BLOCKSCOUT: Record<"ethereum" | "base", { api: string; site: string; native: string }> = {
  ethereum: { api: "https://eth.blockscout.com/api/v2", site: "https://etherscan.io/tx/", native: "ETH" },
  base: { api: "https://base.blockscout.com/api/v2", site: "https://basescan.org/tx/", native: "ETH" },
};
interface BsToken { address?: string; address_hash?: string; symbol?: string; name?: string; decimals?: string; exchange_rate?: string | null; icon_url?: string | null; type?: string }

export async function evmTokens(address: string, chain: "ethereum" | "base"): Promise<TokenHolding[]> {
  const rows = await getJson<{ token: BsToken; value: string }[]>(`${BLOCKSCOUT[chain].api}/addresses/${address}/token-balances`, { revalidate: 60 });
  return rows
    .filter((r) => r.token.type === "ERC-20")
    .map((r) => {
      const amount = Number(r.value) / 10 ** Number(r.token.decimals ?? 18);
      const priceUsd = r.token.exchange_rate ? Number(r.token.exchange_rate) : null;
      return {
        chain, address: r.token.address_hash ?? r.token.address ?? "", symbol: r.token.symbol ?? "?", name: r.token.name ?? "", image: r.token.icon_url ?? undefined,
        amount, priceUsd, valueUsd: priceUsd != null ? amount * priceUsd : null, change24h: null,
        // Blockscout only prices tokens it tracks on market data; unpriced ERC-20s are mostly airdropped spam
        verified: priceUsd != null,
      };
    })
    .filter((t) => t.amount > 0)
    .sort((a, b) => (b.valueUsd ?? -1) - (a.valueUsd ?? -1));
}

interface BsTx { hash: string; timestamp: string; method?: string | null; value: string; status?: string | null; result?: string; from: { hash: string }; to: { hash: string } | null; fee?: { value: string } }
interface BsTransfer { transaction_hash?: string; tx_hash?: string; timestamp: string; from: { hash: string }; to: { hash: string }; token: BsToken; total: { value?: string; decimals?: string } }

export async function evmHistory(address: string, chain: "ethereum" | "base"): Promise<HistoryRow[]> {
  const bs = BLOCKSCOUT[chain];
  const me = address.toLowerCase();
  const [txs, transfers] = await Promise.all([
    getJson<{ items: BsTx[] }>(`${bs.api}/addresses/${address}/transactions`, { revalidate: 30 }).then((r) => r.items).catch(() => [] as BsTx[]),
    getJson<{ items: BsTransfer[] }>(`${bs.api}/addresses/${address}/token-transfers?type=ERC-20`, { revalidate: 30 }).then((r) => r.items).catch(() => [] as BsTransfer[]),
  ]);
  const moves = new Map<string, string[]>();
  for (const t of transfers) {
    const h = t.transaction_hash ?? t.tx_hash ?? "";
    const amt = Number(t.total.value ?? 0) / 10 ** Number(t.total.decimals ?? t.token.decimals ?? 18);
    const sign = t.to.hash.toLowerCase() === me ? "+" : t.from.hash.toLowerCase() === me ? "−" : "";
    if (!sign || !amt) continue;
    moves.set(h, [...(moves.get(h) ?? []), `${sign}${fmt(amt)} ${t.token.symbol ?? "?"}`]);
  }
  const rows: HistoryRow[] = txs.map((t) => {
    const v = Number(t.value) / 1e18;
    const parts = [...(v ? [`${t.from.hash.toLowerCase() === me ? "−" : "+"}${fmt(v)} ${bs.native}`] : []), ...(moves.get(t.hash) ?? [])];
    moves.delete(t.hash);
    const ins = parts.some((p) => p.startsWith("+")), outs = parts.some((p) => p.startsWith("−"));
    return {
      chain, hash: t.hash, time: Date.parse(t.timestamp), title: t.method ? humanMethod(t.method) : ins && outs ? "Swap" : ins ? "Received" : outs ? "Sent" : "Contract call",
      detail: parts.join(" · "), status: t.status === "error" || (t.result && t.result !== "success") ? "failed" : t.status == null ? "pending" : "ok", url: bs.site + t.hash,
    };
  });
  // incoming token transfers that weren't sent by this wallet (airdrops, payments)
  for (const [h, parts] of moves) {
    const t = transfers.find((x) => (x.transaction_hash ?? x.tx_hash) === h);
    rows.push({ chain, hash: h, time: t ? Date.parse(t.timestamp) : 0, title: "Received", detail: parts.join(" · "), status: "ok", url: bs.site + h });
  }
  return rows;
}

const humanMethod = (m: string) => {
  const s = m.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ").trim();
  return /^0x[0-9a-f]+$/i.test(m) ? "Contract call" : s.charAt(0).toUpperCase() + s.slice(1);
};
const fmt = (n: number) => (n >= 1000 ? n.toLocaleString("en-US", { maximumFractionDigits: 0 }) : n >= 1 ? n.toLocaleString("en-US", { maximumFractionDigits: 3 }) : n.toPrecision(3));
