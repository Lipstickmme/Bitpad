/** Prints total network fees per operation (sandbox, mainnet config). Run: npx tsx contracts/tests/gas-report.ts */
import { Blockchain } from "@ton/sandbox";
import { beginCell, Dictionary, fromNano, toNano, type Address } from "@ton/core";
import { BitpadFactory, storeLaunchWithJetton } from "../build/BitpadFactory_BitpadFactory";
import { BitpadJetton } from "../build/BitpadFactory_BitpadJetton";
import { BitpadJettonWallet } from "../build/BitpadFactory_BitpadJettonWallet";
import { BitpadPool, storeSwapIntent } from "../build/BitpadFactory_BitpadPool";
import { BitpadBundler, dictValueParserBundleLeg } from "../build/BitpadBundler_BitpadBundler";

type Tx = { totalFees: { coins: bigint }; outMessages: { values(): { info: { type: string; forwardFee?: bigint } }[] } };
const fees = (r: { transactions: Tx[] }) =>
  r.transactions.reduce((s, t) => s + t.totalFees.coins + t.outMessages.values().reduce((a, m) => a + (m.info.type === "internal" ? m.info.forwardFee ?? 0n : 0n), 0n), 0n);

(async () => {
  const chain = await Blockchain.create();
  const [owner, fee, creator, alice] = await Promise.all(["o", "f", "c", "a"].map((n) => chain.treasury(n)));
  const content = beginCell().storeUint(1, 8).storeStringTail("https://bitpad.xyz/api/jetton/metadata?d=eyJuYW1lIjoiUyZQIENhdCJ9").endCell();
  const factory = chain.openContract(await BitpadFactory.fromInit(owner.address, fee.address, toNano("1"), 50n, 50n, toNano("1")));
  const row = (k: string, v: bigint) => console.log(`${k.padEnd(34)} ${fromNano(v).padStart(8)} TON`);
  row("Deploy factory", fees(await factory.send(owner.getSender(), { value: toNano("0.5") }, null)));
  row("Launch (TON pair)", fees(await factory.send(creator.getSender(), { value: toNano("12") }, { $$type: "Launch", queryId: 1n, supply: 10n ** 18n, creatorBps: 1000n, pairAmount: toNano("10"), content })));
  const pool = chain.openContract(BitpadPool.fromAddress((await factory.getPool(0n))!));
  const minter = chain.openContract(BitpadJetton.fromAddress((await factory.getMinter(0n))!));
  row("Buy with TON", fees(await pool.send(alice.getSender(), { value: toNano("1.12") }, { $$type: "BuyTon", queryId: 1n, amountIn: toNano("1"), minOut: 0n, recipient: null })));
  const w = chain.openContract(BitpadJettonWallet.fromAddress(await minter.getGetWalletAddress(alice.address)));
  const bal = (await w.getGetWalletData()).balance;
  const payload = beginCell().storeBit(1).storeRef(beginCell().store(storeSwapIntent({ $$type: "SwapIntent", minOut: 0n, recipient: null })).endCell()).endCell().beginParse();
  row("Sell for TON", fees(await w.send(alice.getSender(), { value: toNano("0.25") }, { $$type: "TokenTransfer", queryId: 1n, amount: bal / 2n, destination: pool.address, responseDestination: alice.address, customPayload: null, forwardTonAmount: toNano("0.15"), forwardPayload: payload })));
  row("Claim fees", fees(await pool.send(alice.getSender(), { value: toNano("0.1") }, { $$type: "ClaimFees", queryId: 1n })));
  // Jetton-paired launch: stand-in pair jetton, registered, then launched
  const usdx = chain.openContract(await BitpadJetton.fromInit(owner.address, 999n, content, owner.address, null));
  await usdx.send(owner.getSender(), { value: toNano("0.5") }, { $$type: "MintLaunch", queryId: 0n, pool: creator.address, poolAmount: 10n ** 12n, creator: creator.address, creatorAmount: 0n });
  row("Register pair (AddPair)", fees(await factory.send(owner.getSender(), { value: toNano("0.15") }, { $$type: "AddPair", master: usdx.address, info: { $$type: "PairInfo", symbol: "USDX", decimals: 6n, kind: 1n, pythFeedId: 0n, minLiquidity: 0n, wallet: null, enabled: true } })));
  const cw = chain.openContract(BitpadJettonWallet.fromAddress(await usdx.getGetWalletAddress(creator.address)));
  const lp = beginCell().storeBit(1).storeRef(beginCell().store(storeLaunchWithJetton({ $$type: "LaunchWithJetton", supply: 10n ** 18n, creatorBps: 0n, content })).endCell()).endCell().beginParse();
  row("Launch (jetton pair)", fees(await cw.send(creator.getSender(), { value: toNano("1.85") }, { $$type: "TokenTransfer", queryId: 1n, amount: 10n ** 10n, destination: factory.address, responseDestination: creator.address, customPayload: null, forwardTonAmount: toNano("1.75"), forwardPayload: lp })));

  const bundler = chain.openContract(await BitpadBundler.fromInit(owner.address, fee.address, 0n));
  await bundler.send(owner.getSender(), { value: toNano("0.2") }, null);
  for (const n of [5, 20]) {
    const dict = Dictionary.empty(Dictionary.Keys.Uint(8), dictValueParserBundleLeg());
    const legs: Address[] = await Promise.all(Array.from({ length: n }, (_, i) => chain.treasury(`l${n}_${i}`).then((t) => t.address)));
    legs.forEach((a, i) => dict.set(i, { $$type: "BundleLeg", recipient: a, amount: toNano("0.5"), minOut: 0n }));
    const r = await bundler.send(alice.getSender(), { value: toNano(0.5 * n) + BigInt(n) * toNano("0.12") + toNano("0.1") }, { $$type: "BundleBuy", queryId: 1n, pool: pool.address, count: BigInt(n), legs: dict as never });
    row(`Bundle buy, ${n} wallets`, fees(r));
  }
})();
