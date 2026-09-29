"use client";
import { useCallback, useEffect, useState } from "react";

export interface PoolInfo {
  address: string;
  index: number;
  tokenMaster: string;
  pairMaster: string | null;
  creator: string;
  reserveToken: string;
  reservePair: string;
  protocolFeesAccrued: string;
  creatorFeesAccrued: string;
  referralFeesAccrued: string;
  activeReferrers: number;
  protocolFeeBps: number;
  creatorFeeBps: number;
  tradingOpen: boolean;
  pairDecimals: number;
}
export interface ReferrerRow { address: string; active: boolean; accrued: string; earned: string; volume: string }
export interface PoolResponse {
  pool: PoolInfo;
  referrers: ReferrerRow[];
  refValid: boolean;
  bundlerFeeBps: number;
  me: { isCreator: boolean; referrer: ReferrerRow | null } | null;
}

/** Live BitpadPool state, refreshed every 10s (and on demand after a transaction). */
export function usePool(pool: string | undefined, me: string, ref: string | null) {
  const [data, setData] = useState<PoolResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    if (!pool) return;
    const qs = new URLSearchParams({ address: pool, ...(me && { me }), ...(ref && { ref }) });
    fetch(`/api/bitpad/pool?${qs}`)
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : (setData(d), setError(null))))
      .catch(() => setError("Pool unavailable"));
  }, [pool, me, ref]);
  useEffect(() => {
    load();
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, [load]);
  return { data, error, reload: load };
}

export const bigState = (p: PoolInfo) => ({
  reserveToken: BigInt(p.reserveToken),
  reservePair: BigInt(p.reservePair),
  protocolFeeBps: BigInt(p.protocolFeeBps),
  creatorFeeBps: BigInt(p.creatorFeeBps),
});

export async function jettonWallet(master: string, owner: string): Promise<string> {
  const d = await fetch(`/api/bitpad/jetton-wallet?master=${encodeURIComponent(master)}&owner=${encodeURIComponent(owner)}`).then((r) => r.json());
  if (!d.wallet) throw new Error(d.error ?? "Couldn't resolve your jetton wallet");
  return d.wallet;
}

/** Waits a few seconds after a transaction, then refreshes. */
export const refreshSoon = (fn: () => void) => [6000, 15000].forEach((ms) => setTimeout(fn, ms));
