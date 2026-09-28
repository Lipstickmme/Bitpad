import { test } from "node:test";
import assert from "node:assert/strict";
import { Cell, toNano } from "@ton/core";
import { loadLaunch, loadLaunchWithJetton, loadTokenTransfer } from "../contracts/build/BitpadFactory_BitpadFactory";
import { loadBuyTon, loadSwapIntent } from "../contracts/build/BitpadFactory_BitpadPool";

process.env.NEXT_PUBLIC_BITPAD_FACTORY = "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs";
process.env.NEXT_PUBLIC_APP_URL = "https://bitpad.example";
const USER = "EQDtFpEwcFAEcRe5mLVh2N6C0x-_hJEM7W61_JLnSF74p4q2";
const params = { name: "S&P Cat", symbol: "SPYCAT", description: "cat", image: "https://x/y.png", supply: 1_000_000_000n, pairSymbol: "SPYx", creatorBps: 500 };

test("TON launch body decodes with the contract's generated parser", async () => {
  const { buildLaunchTx } = await import("../src/lib/ton/launch");
  const msg = buildLaunchTx({ ...params, pairTon: toNano("10"), launchFee: toNano("1") });
  const d = loadLaunch(Cell.fromBase64(msg.payload!).beginParse());
  assert.equal(d.supply, 1_000_000_000n * 10n ** 9n);
  assert.equal(d.creatorBps, 500n);
  assert.equal(d.pairAmount, toNano("10"));
  assert.equal(BigInt(msg.amount), toNano("11.6"));
  const c = d.content.beginParse();
  assert.equal(c.loadUint(8), 0x01);
  const meta = JSON.parse(Buffer.from(new URL(c.loadStringTail()).searchParams.get("d")!, "base64url").toString());
  assert.equal(meta.bitpad_pair, "SPYx");
});

test("jetton launch, buy and sell bodies decode", async () => {
  const { buildJettonLaunchTx, buildPoolBuyTx, buildPoolSwapTx } = await import("../src/lib/ton/launch");
  const jl = buildJettonLaunchTx({ ...params, creatorPairWallet: USER, creator: USER, pairUnits: 5000n * 10n ** 6n, launchFee: toNano("1") });
  const t = loadTokenTransfer(Cell.fromBase64(jl.payload!).beginParse());
  assert.equal(t.amount, 5000n * 10n ** 6n);
  assert.equal(t.destination.toString(), process.env.NEXT_PUBLIC_BITPAD_FACTORY);
  const fp = t.forwardPayload;
  assert.equal(fp.loadBit(), true);
  assert.equal(loadLaunchWithJetton(fp.loadRef().beginParse()).creatorBps, 500n);

  const REF = "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs";
  const b = loadBuyTon(Cell.fromBase64(buildPoolBuyTx(USER, toNano("1"), 123n, REF, USER).payload!).beginParse());
  assert.equal(b.amountIn, toNano("1"));
  assert.equal(b.minOut, 123n);
  assert.equal(b.recipient?.toString(), USER);
  assert.equal(b.referrer.toString(), REF);

  const s = loadTokenTransfer(Cell.fromBase64(buildPoolSwapTx({ pool: USER, userJettonWallet: USER, user: USER, amount: 99n, minOut: 7n, referrer: REF }).payload!).beginParse());
  assert.equal(s.amount, 99n);
  s.forwardPayload.loadBit();
  const si = loadSwapIntent(s.forwardPayload.loadRef().beginParse());
  assert.equal(si.minOut, 7n);
  assert.equal(si.referrer?.toString(), REF);

  const { buildReferrerTx, buildClaimReferralTx } = await import("../src/lib/ton/launch");
  const { loadAddReferrer, loadRemoveReferrer, loadClaimReferral } = await import("../contracts/build/BitpadFactory_BitpadPool");
  assert.equal(loadAddReferrer(Cell.fromBase64(buildReferrerTx(USER, REF).payload!).beginParse()).referrer.toString(), REF);
  assert.equal(loadRemoveReferrer(Cell.fromBase64(buildReferrerTx(USER, REF, true).payload!).beginParse()).referrer.toString(), REF);
  assert.equal(loadClaimReferral(Cell.fromBase64(buildClaimReferralTx(USER).payload!).beginParse()).queryId, 0n);
});
