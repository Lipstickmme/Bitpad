import { Address } from "@ton/core";
import { getJson } from "./http";

/** TonAPI — free tier works without a key (≈1 rps); TONAPI_KEY raises limits. */
const BASE = "https://tonapi.io/v2";
const headers = () => (process.env.TONAPI_KEY ? { authorization: `Bearer ${process.env.TONAPI_KEY}` } : undefined);
const get = <T,>(path: string, revalidate = 60) => getJson<T>(`${BASE}${path}`, { revalidate, headers: headers() });

/** TonAPI returns raw "0:…" addresses; normalise to user-friendly form. */
export const friendly = (raw: string, bounceable = true) => {
  try {
    return Address.parse(raw).toString({ bounceable });
  } catch {
    return raw;
  }
};

export interface TonJettonBalance {
  balance: string;
  jetton: { address: string; name: string; symbol: string; decimals: number; image?: string };
  price?: { prices?: { USD?: number }; diff_24h?: { USD?: string } };
}

export async function accountJettons(address: string) {
  const res = await get<{ balances: TonJettonBalance[] }>(`/accounts/${encodeURIComponent(address)}/jettons?currencies=usd`, 30);
  return res.balances.map((b) => ({ ...b, jetton: { ...b.jetton, address: friendly(b.jetton.address) } }));
}

export async function accountTon(address: string) {
  const res = await get<{ balance: number }>(`/accounts/${encodeURIComponent(address)}`, 15);
  return res.balance / 1e9;
}

export async function tonUsd() {
  const res = await get<{ rates: { TON: { prices: { USD: number } } } }>(`/rates?tokens=ton&currencies=usd`, 60);
  return res.rates.TON.prices.USD;
}

export interface TonApiJetton {
  mintable: boolean;
  total_supply: string;
  holders_count: number;
  verification?: string;
  metadata: { address: string; name: string; symbol: string; decimals: string; image?: string; description?: string; social?: string[]; websites?: string[] };
  preview?: string;
}

export async function jettonInfo(address: string) {
  return get<TonApiJetton>(`/jettons/${encodeURIComponent(address)}`, 300);
}

export async function jettonHolders(address: string, limit = 20) {
  const res = await get<{ addresses: { address: string; owner: { address: string; name?: string; is_wallet?: boolean }; balance: string }[]; total: number }>(
    `/jettons/${encodeURIComponent(address)}/holders?limit=${limit}`,
    120,
  );
  return { total: res.total, rows: res.addresses.map((h) => ({ owner: friendly(h.owner.address, !h.owner.is_wallet), name: h.owner.name, balance: h.balance })) };
}

/** Price history points [unixSeconds, usd] — a free charting fallback. */
export async function rateChart(token: string, startSec: number, endSec: number, points = 200) {
  const res = await get<{ points: [number, number][] }>(
    `/rates/chart?token=${encodeURIComponent(token)}&currency=usd&start_date=${startSec}&end_date=${endSec}&points_count=${points}`,
    60,
  );
  return [...res.points].sort((a, b) => a[0] - b[0]);
}

export async function tokenRates(tokens: string[]) {
  if (!tokens.length) return {};
  const res = await get<{ rates: Record<string, { prices?: { USD?: number }; diff_24h?: { USD?: string } }> }>(
    `/rates?tokens=${tokens.map(encodeURIComponent).join(",")}&currencies=usd`,
    60,
  );
  return res.rates;
}

export interface TonApiEvent {
  event_id: string;
  timestamp: number;
  actions: { type: string; status: string; TonTransfer?: { sender: { address: string }; recipient: { address: string }; amount: number; comment?: string } }[];
}

export async function accountEvents(address: string, limit = 100) {
  const res = await get<{ events: TonApiEvent[] }>(`/accounts/${encodeURIComponent(address)}/events?limit=${limit}`, 60);
  return res.events;
}
