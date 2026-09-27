import { test } from "node:test";
import assert from "node:assert/strict";
import { Cell } from "@ton/core";
import { loadLaunch } from "../contracts/build/BitpadFactory_BitpadFactory";

test("frontend Launch body decodes with the contract's generated parser", async () => {
  process.env.NEXT_PUBLIC_BITPAD_FACTORY = "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs";
  process.env.NEXT_PUBLIC_APP_URL = "https://bitpad.example";
  const { buildLaunchTx } = await import("../src/lib/ton/launch");
  const msg = buildLaunchTx({ name: "S&P Cat", symbol: "SPYCAT", description: "cat", image: "https://x/y.png", supply: 1_000_000_000n, pairSymbol: "SPYx" });
  const decoded = loadLaunch(Cell.fromBase64(msg.payload!).beginParse());
  assert.equal(decoded.supply, 1_000_000_000n * 10n ** 9n);
  assert.equal(decoded.pair, null);
  const content = decoded.content.beginParse();
  assert.equal(content.loadUint(8), 0x01);
  const uri = content.loadStringTail();
  assert.ok(uri.startsWith("https://bitpad.example/api/jetton/metadata?d="));
  const meta = JSON.parse(Buffer.from(new URL(uri).searchParams.get("d")!, "base64url").toString());
  assert.equal(meta.symbol, "SPYCAT");
  assert.equal(meta.bitpad_pair, "SPYx");
});
