/**
 * Pay general-referral earnings from the fee wallet.
 *
 *   npm run referrals:pay            → dry run: prints what each referrer is owed
 *   SEND=1 npm run referrals:pay     → sends the payouts
 *
 * Needs, in .env.deploy: FEE_WALLET_MNEMONIC (the fee wallet's 24 words; can be
 * the same as DEPLOYER_MNEMONIC if the deployer is the fee wallet), NETWORK=mainnet.
 * Optional: MIN_PAYOUT (TON, default 0.2), TONAPI_KEY.
 *
 * Earnings are read from the fee wallet's on-chain history exactly as the
 * Revenue page does (lib/gref.ts): tagged fee transfers in, `bitpad:refpay`
 * transfers out. Each payout carries the `bitpad:refpay` comment, so it's
 * counted as paid on the next run — running twice never double-pays.
 */
import { Address, toNano } from "@ton/core";
import { deployer, env } from "./lib";
import { aggregate, commentCell, norm, PAY_TAG } from "../src/lib/gref";
import { accountEventsPaged, tonTransfers } from "../src/lib/data/tonapi";

(async () => {
  const d = await deployer(process.env.FEE_WALLET_MNEMONIC ? "FEE_WALLET_MNEMONIC" : "DEPLOYER_MNEMONIC");
  const fw = norm(d.address.toString())!;
  console.log(`Fee wallet ${d.fmt(d.address)} · balance ${Number(await d.balance()) / 1e9} TON`);
  const all = tonTransfers(await accountEventsPaged(d.address.toString(), 2000));
  const stats = aggregate(all.filter((t) => norm(t.to) === fw), all.filter((t) => norm(t.from) === fw));
  const min = Number(env("MIN_PAYOUT", "0.2"));
  const due = [...stats.values()].filter((s) => s.owed >= min).sort((a, b) => b.owed - a.owed);
  if (!due.length) return console.log(`Nothing to pay (no referrer owed ≥ ${min} TON). ${stats.size} referrers on record.`);
  for (const s of due) console.log(`  ${s.address}  owed ${s.owed.toFixed(4)} TON  (earned ${s.earned.toFixed(4)}, paid ${s.paid.toFixed(4)}, ${s.buys} buys)`);
  const total = due.reduce((a, s) => a + s.owed, 0);
  console.log(`Total ${total.toFixed(4)} TON to ${due.length} referrers.`);
  if (process.env.SEND !== "1") return console.log("Dry run — set SEND=1 to pay.");
  for (const s of due) {
    await d.send(Address.parse(s.address), toNano(s.owed.toFixed(9)), commentCell(`${PAY_TAG}`));
    console.log(`Paid ${s.owed.toFixed(4)} TON → ${s.address} ✓`);
  }
})().catch((e) => { console.error(e.message ?? e); process.exit(1); });
