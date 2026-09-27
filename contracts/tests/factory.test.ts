import { test } from "node:test";
import assert from "node:assert/strict";
import { Blockchain } from "@ton/sandbox";
import { beginCell, toNano } from "@ton/core";
import { BitpadFactory } from "../build/BitpadFactory_BitpadFactory";
import { BitpadJetton } from "../build/BitpadFactory_BitpadJetton";
import { BitpadJettonWallet } from "../build/BitpadFactory_BitpadJettonWallet";

const content = beginCell().storeUint(1, 8).storeStringTail("https://bitpad.example/api/jetton/metadata?d=x").endCell();

test("launch deploys a jetton, mints full supply to creator and pays the fee", async () => {
  const chain = await Blockchain.create();
  const owner = await chain.treasury("owner");
  const feeWallet = await chain.treasury("fee");
  const creator = await chain.treasury("creator");
  const alice = await chain.treasury("alice");

  const factory = chain.openContract(await BitpadFactory.fromInit(owner.address, feeWallet.address, toNano("1")));
  const dep = await factory.send(owner.getSender(), { value: toNano("0.5") }, null);
  assert.ok(dep.transactions.some((t) => t.inMessage?.info.dest?.toString() === factory.address.toString()));

  const feeBefore = await feeWallet.getBalance();
  const supply = 1_000_000_000n * 10n ** 9n;
  await factory.send(creator.getSender(), { value: toNano("1.5") }, { $$type: "Launch", queryId: 1n, supply, content, pair: null });

  assert.equal(await factory.getLaunchCount(), 1n);
  assert.ok((await feeWallet.getBalance()) - feeBefore >= toNano("0.99"), "launch fee forwarded");

  const minterAddr = await factory.getMinterAddress(0n, content, creator.address, null);
  const minter = chain.openContract(BitpadJetton.fromAddress(minterAddr));
  const data = await minter.getGetJettonData();
  assert.equal(data.totalSupply, supply);
  assert.equal(data.mintable, false);

  const cw = chain.openContract(BitpadJettonWallet.fromAddress(await minter.getGetWalletAddress(creator.address)));
  assert.equal((await cw.getGetWalletData()).balance, supply);

  // transfer works (needed for STON.fi liquidity provision)
  await cw.send(creator.getSender(), { value: toNano("0.2") }, {
    $$type: "TokenTransfer", queryId: 2n, amount: 1000n, destination: alice.address, responseDestination: creator.address,
    customPayload: null, forwardTonAmount: toNano("0.01"), forwardPayload: beginCell().storeUint(0, 1).endCell().beginParse(),
  });
  const aw = chain.openContract(BitpadJettonWallet.fromAddress(await minter.getGetWalletAddress(alice.address)));
  assert.equal((await aw.getGetWalletData()).balance, 1000n);
  assert.equal((await cw.getGetWalletData()).balance, supply - 1000n);
});

test("launch rejects underpaid requests and cannot be re-minted", async () => {
  const chain = await Blockchain.create();
  const owner = await chain.treasury("owner");
  const creator = await chain.treasury("creator");
  const factory = chain.openContract(await BitpadFactory.fromInit(owner.address, owner.address, toNano("1")));
  await factory.send(owner.getSender(), { value: toNano("0.5") }, null);

  const r = await factory.send(creator.getSender(), { value: toNano("0.5") }, { $$type: "Launch", queryId: 1n, supply: 1n, content, pair: null });
  assert.ok(r.transactions.some((t) => t.description.type === "generic" && t.description.computePhase.type === "vm" && !t.description.computePhase.success));
  assert.equal(await factory.getLaunchCount(), 0n);

  await factory.send(creator.getSender(), { value: toNano("1.5") }, { $$type: "Launch", queryId: 2n, supply: 10n, content, pair: null });
  const minter = chain.openContract(BitpadJetton.fromAddress(await factory.getMinterAddress(0n, content, creator.address, null)));
  // A second MintAll from anyone other than the factory must fail
  const again = await minter.send(creator.getSender(), { value: toNano("0.2") }, { $$type: "MintAll", queryId: 3n, amount: 10n, receiver: creator.address });
  assert.ok(again.transactions.some((t) => t.description.type === "generic" && t.description.computePhase.type === "vm" && !t.description.computePhase.success));
  assert.equal((await minter.getGetJettonData()).totalSupply, 10n);
});
