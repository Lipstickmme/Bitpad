import { test } from "node:test";
import assert from "node:assert/strict";
import { StonApiClient } from "@ston-fi/api";
import { config } from "../src/lib/config";
import { simulateWithFee } from "../src/lib/ton/ston-sim";

const q = { offerAddress: "TON", askAddress: "JETTON", offerUnits: "1000000000", slippageTolerance: "0.01" };
type Args = Parameters<StonApiClient["simulateSwap"]>[0];

function stub(accept: (a: Args) => boolean) {
  const calls: Args[] = [];
  StonApiClient.prototype.simulateSwap = (async (a: Args) => {
    calls.push(a);
    if (!accept(a)) throw new Error('[POST] "https://api.ston.fi/v1/swap/simulate?x=1": 400 Bad Request');
    return { askUnits: "1", router: { majorVersion: 2 } };
  }) as StonApiClient["simulateSwap"];
  return calls;
}

test("STON.fi simulate: referral on v2 first, then plain swap with a fee transfer", async () => {
  config.feeWallet = "EQD4cfQmDifUabUV1HjpEseGzn28zamQzeFXTTyu8N8V_c8F";

  let calls = stub(() => true);
  assert.equal((await simulateWithFee(q)).fee, "referral");
  assert.deepEqual(calls[0].dexVersion, [2]);
  assert.equal(calls[0].referralFeeBps, String(config.swapFeeBps));

  // The case from mainnet: any referral params → 400. Must still find a route.
  calls = stub((a) => !a.referralAddress);
  const r = await simulateWithFee(q);
  assert.equal(r.fee, "transfer");
  assert.equal(calls.length, 3);

  stub(() => false);
  await assert.rejects(simulateWithFee(q), /no route/);

  config.feeWallet = "";
  calls = stub(() => true);
  assert.equal((await simulateWithFee(q)).fee, "none");
  assert.equal(calls[0].referralAddress, undefined);
});
