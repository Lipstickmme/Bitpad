import { test } from "node:test";
import assert from "node:assert/strict";
import { Address } from "@ton/core";
import { networkOf } from "../src/lib/config";

test("network follows the factory address (testnet flag)", () => {
  const a = Address.parse("EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs");
  assert.equal(networkOf(a.toString({ testOnly: true })), "testnet");
  assert.equal(networkOf(a.toString({ testOnly: true, bounceable: false })), "testnet");
  assert.equal(networkOf(a.toString()), "mainnet");
  assert.equal(networkOf(""), "mainnet");
  assert.equal(networkOf("not-an-address"), "mainnet");
});
