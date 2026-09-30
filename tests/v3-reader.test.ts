import { test } from "node:test";
import assert from "node:assert/strict";
import { Blockchain } from "@ton/sandbox";
import { Address, Cell, beginCell, toNano, type TupleItem } from "@ton/core";
import { BitpadFactory } from "../contracts/build/BitpadFactory_BitpadFactory";
import { BitpadJetton } from "../contracts/build/BitpadFactory_BitpadJetton";
import { fromV3, readOnlyOpener, runGetV3, toV3 } from "../src/lib/ton/v3-get";

/** Encode a sandbox stack the way toncenter's /api/v3/runGetMethod does. */
function asV3(i: TupleItem): { type: string; value?: unknown } {
  switch (i.type) {
    case "int": return { type: "num", value: (i.value < 0n ? "-0x" : "0x") + (i.value < 0n ? -i.value : i.value).toString(16) };
    case "cell": return { type: "cell", value: i.cell.toBoc().toString("base64") };
    case "slice": return { type: "slice", value: i.cell.toBoc().toString("base64") };
    case "tuple": return { type: "tuple", value: i.items.map(asV3) };
    case "null": return { type: "null" };
    default: throw new Error(i.type);
  }
}

test("toncenter v3 reads: stack conversion, struct/optional-tuple getters, errors", async () => {
  // round trips
  assert.deepEqual(fromV3(toV3({ type: "int", value: 12345n })), { type: "int", value: 12345n });
  assert.deepEqual(fromV3({ type: "num", value: "-0x10" }), { type: "int", value: -16n });
  const c = beginCell().storeUint(7, 8).endCell();
  assert.ok((fromV3({ type: "cell", value: c.toBoc().toString("base64") }) as { cell: Cell }).cell.equals(c));

  const chain = await Blockchain.create();
  const [owner, fee] = await Promise.all([chain.treasury("o"), chain.treasury("f")]);
  const factory = chain.openContract(await BitpadFactory.fromInit(owner.address, fee.address, toNano("1"), 50n, 50n, toNano("2")));
  await factory.send(owner.getSender(), { value: toNano("0.5") }, null);
  const content = beginCell().storeUint(1, 8).storeStringTail("x").endCell();
  const usdx = chain.openContract(await BitpadJetton.fromInit(owner.address, 1n, content, owner.address, null));
  await usdx.send(owner.getSender(), { value: toNano("0.5") }, { $$type: "MintLaunch", queryId: 0n, pool: owner.address, poolAmount: 10n ** 12n, creator: owner.address, creatorAmount: 0n });
  await factory.send(owner.getSender(), { value: toNano("0.15") }, { $$type: "AddPair", master: usdx.address, info: { $$type: "PairInfo", symbol: "USDX", decimals: 6n, kind: 1n, pythFeedId: 0n, minLiquidity: 1n, wallet: null, enabled: true } });

  // Fake toncenter v3 backed by the sandbox
  const seen: string[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    seen.push(`${url} ${(init.headers as Record<string, string>)["x-api-key"] ?? ""}`);
    const b = JSON.parse(String(init.body));
    const r = await chain.runGetMethod(Address.parse(b.address), b.method, b.stack.map(fromV3));
    return new Response(JSON.stringify({ exit_code: r.exitCode, stack: r.stack.map(asV3) }), { status: 200 });
  }) as typeof fetch;
  try {
    const reader = readOnlyOpener((a, m, args) => runGetV3({ network: "mainnet", apiKey: "k" }, a, m, args));
    const f = reader.open(BitpadFactory.fromAddress(factory.address));
    const cfg = await f.getConfig(); // flat struct
    assert.equal(cfg.launchFee, toNano("1"));
    assert.ok(cfg.feeWallet.equals(fee.address));
    const pair = await f.getPair(usdx.address); // optional struct → tuple ("Not a cell: -1" before)
    assert.equal(pair?.symbol, "USDX");
    assert.equal(pair?.decimals, 6n);
    assert.ok(pair?.wallet, "factory wallet discovered");
    assert.equal(await f.getPair(owner.address), null, "unregistered → null");
    assert.ok(seen[0].startsWith("https://toncenter.com/api/v3/runGetMethod k"));

    globalThis.fetch = (async () => new Response(JSON.stringify({ error: "forbidden" }), { status: 403 })) as unknown as typeof fetch;
    await assert.rejects(runGetV3({ network: "mainnet" }, factory.address, "config"), /toncenter v3 403: forbidden/);
  } finally {
    globalThis.fetch = realFetch;
  }
});
