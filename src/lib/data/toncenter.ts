import { getJson } from "./http";

/** toncenter v3 indexer — free (1 rps without key). */
const BASE = "https://toncenter.com/api/v3";
const headers = () => (process.env.TONCENTER_API_KEY ? { "x-api-key": process.env.TONCENTER_API_KEY } : undefined);

export async function tcJettonHolders(jetton: string, limit = 20) {
  const res = await getJson<{ jetton_wallets: { address: string; balance: string; owner: string }[] }>(
    `${BASE}/jetton/wallets?jetton_address=${encodeURIComponent(jetton)}&limit=${limit}&sort=desc&exclude_zero_balance=true`,
    { revalidate: 120, headers: headers() },
  );
  return res.jetton_wallets.map((w) => ({ owner: w.owner, balance: w.balance }));
}

export async function tcJettonMaster(jetton: string) {
  const res = await getJson<{ jetton_masters: { address: string; total_supply: string; mintable: boolean; jetton_content?: Record<string, string> }[]; metadata?: Record<string, { token_info?: { name?: string; symbol?: string; image?: string; description?: string; extra?: { decimals?: string } }[] }> }>(
    `${BASE}/jetton/masters?address=${encodeURIComponent(jetton)}&limit=1`,
    { revalidate: 600, headers: headers() },
  );
  const m = res.jetton_masters[0];
  if (!m) return null;
  const info = Object.values(res.metadata ?? {})[0]?.token_info?.[0];
  const c = m.jetton_content ?? {};
  return {
    totalSupply: m.total_supply,
    name: info?.name ?? c.name,
    symbol: info?.symbol ?? c.symbol,
    image: info?.image ?? c.image,
    description: info?.description ?? c.description,
    decimals: Number(info?.extra?.decimals ?? c.decimals ?? 9),
  };
}
