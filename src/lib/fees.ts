import "server-only";
import { config } from "./config";
import { ensureRuntimeConfig } from "./runtime";
import { accountEventsPaged, accountTon, friendly, tonTransfers } from "./data/tonapi";
import { classifyIncome, dailyBySource, INCOME_SOURCES } from "./gref";
import { memo, safe } from "./data/http";
import { ston } from "./data/stonfi";

/** Real revenue: TON actually received by the fee wallet, classified by source from each transfer's on-chain comment. */
export async function getFeeRevenue() {
  await ensureRuntimeConfig();
  if (!config.feeWallet) return { configured: false as const };
  const me = friendly(config.feeWallet);
  const [bal, events] = await Promise.all([safe(accountTon(config.feeWallet), null as number | null, "fee balance"), safe(accountEventsPaged(config.feeWallet, 1000), [], "fee events")]);
  const incoming = tonTransfers(events.value)
    .filter((t) => t.to === me)
    .map((t) => ({ time: t.time, amount: t.amount, from: friendly(t.from, false), comment: t.comment, source: classifyIncome(t.comment) }));
  const since = (ms: number) => incoming.filter((i) => i.time >= Date.now() - ms).reduce((s, i) => s + i.amount, 0);
  return {
    configured: true as const,
    live: events.ok,
    balance: bal.value,
    received24h: since(86_400_000),
    received7d: since(7 * 86_400_000),
    received30d: since(30 * 86_400_000),
    daily: dailyBySource(incoming, 30),
    bySource: INCOME_SOURCES.map((k) => ({ source: k, amount: incoming.filter((i) => i.source === k && i.time >= Date.now() - 30 * 86_400_000).reduce((s, i) => s + i.amount, 0) })),
    recent: incoming.slice(0, 20),
  };
}

export interface ReferralVault {
  vault: string;
  asset: string;
  symbol: string;
  decimals: number;
  /** Unwithdrawn balance, in token units */
  balance: number;
  usd: number | null;
}

/**
 * Frontend fees earned through STON.fi's referral program. On v2 routers the
 * referral cut of every swap routed by Bitpad accrues in a per-asset Vault
 * owned by the fee wallet; the owner withdraws it with a `withdraw_fee` message.
 */
export function getReferralFees() {
  return memo("referral-fees", 60_000, async () => {
    await ensureRuntimeConfig();
    if (!config.feeWallet) return { configured: false as const };
    const until = new Date();
    const since = new Date(until.getTime() - 30 * 86_400_000);
    const [stats, vaults] = await Promise.all([
      safe(ston.getAssetsFeeStats({ since, until, referrerAddress: config.feeWallet }), null, "ston fee stats"),
      safe(ston.getWalletVaultsFee({ walletAddress: config.feeWallet }), [], "ston fee vaults"),
    ]);
    const rows: ReferralVault[] = await Promise.all(
      vaults.value.map(async (v) => {
        const a = await ston.getAsset(v.assetAddress).catch(() => null);
        const decimals = a?.decimals ?? 9;
        const balance = Number(v.balance) / 10 ** decimals;
        const px = a?.dexPriceUsd ? Number(a.dexPriceUsd) : null;
        return { vault: v.vaultAddress, asset: v.assetAddress, symbol: a?.symbol ?? "?", decimals, balance, usd: px != null ? balance * px : null };
      }),
    );
    return {
      configured: true as const,
      live: stats.ok || vaults.ok,
      accrued30dUsd: stats.value ? Number(stats.value.totalAccruedUsd) : null,
      vaults: rows.filter((r) => r.balance > 0).sort((a, b) => (b.usd ?? 0) - (a.usd ?? 0)),
    };
  });
}
