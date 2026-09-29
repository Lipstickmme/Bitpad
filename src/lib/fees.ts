import "server-only";
import { config } from "./config";
import { ensureRuntimeConfig } from "./runtime";
import { accountEvents, accountTon, friendly } from "./data/tonapi";
import { memo, safe } from "./data/http";
import { ston } from "./data/stonfi";

/** Real revenue: TON actually received by the fee wallet (TonAPI events). */
export async function getFeeRevenue() {
  await ensureRuntimeConfig();
  if (!config.feeWallet) return { configured: false as const };
  const me = friendly(config.feeWallet);
  const [bal, events] = await Promise.all([safe(accountTon(config.feeWallet), null as number | null, "fee balance"), safe(accountEvents(config.feeWallet, 100), [], "fee events")]);
  const incoming = events.value.flatMap((e) =>
    e.actions
      .filter((a) => a.type === "TonTransfer" && a.status === "ok" && a.TonTransfer && friendly(a.TonTransfer.recipient.address) === me)
      .map((a) => ({ time: e.timestamp * 1000, amount: a.TonTransfer!.amount / 1e9, from: friendly(a.TonTransfer!.sender.address, false), comment: a.TonTransfer!.comment })),
  );
  const since = (ms: number) => incoming.filter((i) => i.time >= Date.now() - ms).reduce((s, i) => s + i.amount, 0);
  return {
    configured: true as const,
    live: events.ok,
    balance: bal.value,
    received24h: since(86_400_000),
    received7d: since(7 * 86_400_000),
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
