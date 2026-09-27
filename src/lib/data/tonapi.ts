import { getJson } from "./http";

export interface TonJettonBalance {
  balance: string;
  jetton: { address: string; name: string; symbol: string; decimals: number; image?: string };
  price?: { prices?: { USD?: number }; diff_24h?: { USD?: string } };
}

export async function accountJettons(address: string) {
  const res = await getJson<{ balances: TonJettonBalance[] }>(
    `https://tonapi.io/v2/accounts/${encodeURIComponent(address)}/jettons?currencies=usd`,
    { revalidate: 30, headers: process.env.TONAPI_KEY ? { authorization: `Bearer ${process.env.TONAPI_KEY}` } : undefined },
  );
  return res.balances;
}

export async function accountTon(address: string) {
  const res = await getJson<{ balance: number }>(`https://tonapi.io/v2/accounts/${encodeURIComponent(address)}`, { revalidate: 15 });
  return res.balance / 1e9;
}

export async function tonUsd() {
  const res = await getJson<{ rates: { TON: { prices: { USD: number } } } }>(`https://tonapi.io/v2/rates?tokens=ton&currencies=usd`, { revalidate: 60 });
  return res.rates.TON.prices.USD;
}
