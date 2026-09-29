import "./stub-server-only";
import { test } from "node:test";
import assert from "node:assert/strict";
import { Blockchain } from "@ton/sandbox";
import { beginCell, Cell, toNano } from "@ton/core";
import { BitpadFactory } from "../contracts/build/BitpadFactory_BitpadFactory";
import { BitpadPool, storeSwapped, loadClaimFees } from "../contracts/build/BitpadFactory_BitpadPool";
import { loadBundleBuy } from "../contracts/build/BitpadBundler_BitpadBundler";
import { quoteBuy, quoteSell, afterBuy } from "../src/lib/bitpad-math";

test("frontend pool math equals the contract's getters (random states & amounts)", async () => {
  const chain = await Blockchain.create();
  const [owner, creator, alice] = await Promise.all(["o", "c", "a"].map((n) => chain.treasury(n)));
  const factory = chain.openContract(await BitpadFactory.fromInit(owner.address, owner.address, toNano("1"), 37n, 63n, toNano("1")));
  await factory.send(owner.getSender(), { value: toNano("0.5") }, null);
  const content = beginCell().storeUint(1, 8).storeStringTail("x").endCell();
  await factory.send(creator.getSender(), { value: toNano("15") }, { $$type: "Launch", queryId: 1n, supply: 777_777_777n * 10n ** 9n, creatorBps: 1234n, pairAmount: toNano("13.37"), content });
  const pool = chain.openContract(BitpadPool.fromAddress((await factory.getPool(0n))!));
  let seed = 7;
  const rnd = () => ((seed = (seed * 48271) % 2147483647) / 2147483647);
  for (let i = 0; i < 12; i++) {
    const pd = await pool.getPoolData();
    const st = { reserveToken: pd.reserveToken, reservePair: pd.reservePair, protocolFeeBps: pd.protocolFeeBps, creatorFeeBps: pd.creatorFeeBps };
    for (const a of [1n, 999n, toNano("0.001"), toNano((rnd() * 50).toFixed(6))]) {
      assert.equal(quoteBuy(st, a).out, await pool.getQuoteBuy(a), `buy ${a}`);
      const t = BigInt(Math.floor(Number(pd.reserveToken) * rnd() * 0.1));
      assert.equal(quoteSell(st, t).out, await pool.getQuoteSell(t), `sell ${t}`);
    }
    // move the pool and check the simulated next state matches the chain
    const amt = toNano((0.5 + rnd() * 3).toFixed(4));
    const sim = afterBuy(st, amt);
    await pool.send(alice.getSender(), { value: amt + toNano("0.12") }, { $$type: "BuyTon", queryId: 1n, amountIn: amt, minOut: 0n, recipient: null, referrer: creator.address });
    const after = await pool.getPoolData();
    assert.equal(after.reserveToken, sim.state.reserveToken);
    assert.equal(after.reservePair, sim.state.reservePair);
  }
});

test("bundle and claim-fees bodies decode with the contracts' parsers", async () => {
  const { buildBundleBuyTx, buildClaimFeesTx } = await import("../src/lib/ton/launch");
  const A = "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs";
  const B = "EQDtFpEwcFAEcRe5mLVh2N6C0x-_hJEM7W61_JLnSF74p4q2";
  const msg = buildBundleBuyTx({ pool: A, referrer: B, legs: [{ recipient: A, amount: toNano("1"), minOut: 5n }, { recipient: B, amount: toNano("2"), minOut: 7n }] });
  const d = loadBundleBuy(Cell.fromBase64(msg.payload!).beginParse());
  assert.equal(d.count, 2n);
  assert.equal(d.pool.toString(), A);
  assert.equal(d.referrer.toString(), B);
  assert.equal(d.legs.get(1 as never)?.amount, toNano("2"));
  assert.equal(d.legs.get(1 as never)?.minOut, 7n);
  assert.equal(d.legs.get(0 as never)?.recipient.toString(), A);
  assert.equal(BigInt(msg.amount), toNano("3") + 2n * toNano("0.12") + toNano("0.05"));
  assert.equal(loadClaimFees(Cell.fromBase64(buildClaimFeesTx(A).payload!).beginParse()).queryId, 0n);
});

test("Swapped event parser reads what the pool emits", async () => {
  const { parseSwapped } = await import("../src/lib/bitpad");
  const { Address } = await import("@ton/core");
  const trader = Address.parse("EQDtFpEwcFAEcRe5mLVh2N6C0x-_hJEM7W61_JLnSF74p4q2");
  const body = beginCell().store(storeSwapped({ $$type: "Swapped", buy: true, trader, amountIn: 123n, amountOut: 456n, reserveToken: 789n, reservePair: 1011n })).endCell();
  const e = parseSwapped(body)!;
  assert.equal(e.buy, true);
  assert.ok(Address.parse(e.trader).equals(trader));
  assert.equal(e.amountIn, 123n);
  assert.equal(e.reservePair, 1011n);
  assert.equal(parseSwapped(beginCell().storeUint(1, 32).endCell()), null);
});
