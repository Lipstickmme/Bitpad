import "server-only";
import { config } from "./config";
import { ensureRuntimeConfig } from "./runtime";
import { accountEvents, accountTon, friendly } from "./data/tonapi";
import { safe } from "./data/http";

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
