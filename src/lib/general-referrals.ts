import "server-only";
import { config } from "./config";
import { ensureRuntimeConfig } from "./runtime";
import { memo, safe } from "./data/http";
import { accountEventsPaged, tonTransfers } from "./data/tonapi";
import { aggregate, norm, SHARE_BPS, type ReferrerStats } from "./gref";

/** Per-referrer stats read from the fee wallet's on-chain history (last ~1000 events). */
export function getGeneralReferrals() {
  return memo("general-referrals", 60_000, async () => {
    await ensureRuntimeConfig();
    if (!config.feeWallet) return { ok: false, feeWallet: null, shareBps: SHARE_BPS, stats: new Map<string, ReferrerStats>() };
    const fw = norm(config.feeWallet);
    const ev = await safe(accountEventsPaged(config.feeWallet, 1000), [], "fee wallet events");
    const all = tonTransfers(ev.value);
    const incoming = all.filter((t) => norm(t.to) === fw);
    const payouts = all.filter((t) => norm(t.from) === fw);
    return { ok: ev.ok, feeWallet: config.feeWallet, shareBps: SHARE_BPS, stats: aggregate(incoming, payouts) };
  });
}
