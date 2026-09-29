import "./stub-server-only";
import { test } from "node:test";
import assert from "node:assert/strict";
import { Blockchain } from "@ton/sandbox";
import { Address, beginCell, toNano } from "@ton/core";
import { BitpadFactory } from "../contracts/build/BitpadFactory_BitpadFactory";
import { BitpadJetton } from "../contracts/build/BitpadFactory_BitpadJetton";
import { BitpadPool } from "../contracts/build/BitpadFactory_BitpadPool";

/**
 * Runs the app's real chain-reading code (lib/launches.ts, lib/bitpad.ts)
 * against contracts deployed in the sandbox, whose get-method results are
 * typed exactly like the TON v4 API the app uses in production.
 */
test("app reads factory config, pairs, launches, pool state and referrers correctly", async () => {
  const chain = await Blockchain.create();
  const [owner, fee, creator, alice, ref] = await Promise.all(["o", "f", "c", "a", "r"].map((n) => chain.treasury(n)));
  const { setRunner } = await import("../src/lib/chain");
  setRunner(async (addr, method, args) => (await chain.runGetMethod(addr, method, args)).stackReader);

  const factory = chain.openContract(await BitpadFactory.fromInit(owner.address, fee.address, toNano("1"), 50n, 50n, toNano("2")));
  await factory.send(owner.getSender(), { value: toNano("0.5") }, null);
  const { config } = await import("../src/lib/config");
  config.factoryAddress = factory.address.toString();

  // a registered jetton pair (wallet discovered) and an unregistered master
  const content = beginCell().storeUint(1, 8).storeStringTail(`https://x.example/api/jetton/metadata?d=${Buffer.from(JSON.stringify({ name: "Cat", symbol: "CAT", bitpad_pair: "TON" })).toString("base64url")}`).endCell();
  const usdx = chain.openContract(await BitpadJetton.fromInit(owner.address, 999n, content, owner.address, null));
  await usdx.send(owner.getSender(), { value: toNano("0.5") }, { $$type: "MintLaunch", queryId: 0n, pool: creator.address, poolAmount: 10n ** 12n, creator: creator.address, creatorAmount: 0n });
  await factory.send(owner.getSender(), { value: toNano("0.15") }, { $$type: "AddPair", master: usdx.address, info: { $$type: "PairInfo", symbol: "USDX", decimals: 6n, kind: 1n, pythFeedId: 0n, minLiquidity: 100n * 10n ** 6n, wallet: null, enabled: true } });

  const { getFactoryConfig, getRegisteredPairs, getLaunches } = await import("../src/lib/launches");
  const cfg = await getFactoryConfig();
  assert.ok(cfg);
  assert.equal(cfg!.launchFee, toNano("1"));
  assert.equal(cfg!.protocolFeeBps, 50);
  assert.equal(cfg!.minTonLiquidity, toNano("2"));
  assert.equal(cfg!.launches, 0);
  assert.ok(Address.parse(cfg!.feeWallet).equals(fee.address), "fee wallet read from the factory");

  const pairs = await getRegisteredPairs([usdx.address.toString(), alice.address.toString()]);
  assert.equal(pairs.length, 1, "unregistered master is ignored");
  assert.equal(pairs[0].symbol, "USDX");
  assert.equal(pairs[0].decimals, 6);
  assert.equal(pairs[0].ready, true);
  assert.equal(pairs[0].enabled, true);

  // launch + trade + referral link
  await factory.send(creator.getSender(), { value: toNano("12") }, { $$type: "Launch", queryId: 1n, supply: 10n ** 18n, creatorBps: 1000n, pairAmount: toNano("10"), content });
  const poolAddr = (await factory.getPool(0n))!;
  const pool = chain.openContract(BitpadPool.fromAddress(poolAddr));
  await pool.send(creator.getSender(), { value: toNano("0.05") }, { $$type: "AddReferrer", queryId: 0n, referrer: ref.address });
  await pool.send(alice.getSender(), { value: toNano("2.2") }, { $$type: "BuyTon", queryId: 1n, amountIn: toNano("2"), minOut: 0n, recipient: null, referrer: ref.address });

  const { launches, count } = await getLaunches();
  assert.equal(count, 1);
  assert.equal(launches[0].meta.symbol, "CAT", "metadata decoded from on-chain content");
  assert.ok(Address.parse(launches[0].pool!).equals(poolAddr));
  assert.ok(Address.parse(launches[0].creator!).equals(creator.address));
  assert.equal(launches[0].supply, (10n ** 18n).toString());

  const { readPool, readReferrers, isReferrer, jettonWalletOf } = await import("../src/lib/bitpad");
  const p = await readPool(poolAddr.toString());
  const onchain = await pool.getPoolData();
  assert.equal(p.reserveToken, onchain.reserveToken.toString());
  assert.equal(p.reservePair, onchain.reservePair.toString());
  assert.equal(p.pairMaster, null);
  assert.equal(p.tradingOpen, true);
  assert.equal(p.activeReferrers, 1);
  assert.equal(p.protocolFeeBps, 50);
  assert.ok(Address.parse(p.creator).equals(creator.address));

  const refs = await readReferrers(poolAddr.toString());
  assert.equal(refs.length, 1);
  assert.ok(Address.parse(refs[0].address).equals(ref.address));
  assert.equal(refs[0].active, true);
  assert.equal(refs[0].volume, toNano("2").toString());
  assert.ok(BigInt(refs[0].accrued) > 0n);

  assert.equal(await isReferrer(poolAddr.toString(), ref.address.toString()), true);
  assert.equal(await isReferrer(poolAddr.toString(), alice.address.toString()), false);
  const minter = (await factory.getMinter(0n))!;
  const jw = await jettonWalletOf(minter.toString(), alice.address.toString());
  assert.ok(Address.parse(jw).equals(await chain.openContract(BitpadJetton.fromAddress(minter)).getGetWalletAddress(alice.address)));
  setRunner(null);
});
