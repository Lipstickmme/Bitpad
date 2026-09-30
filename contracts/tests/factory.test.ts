import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { Blockchain, type SandboxContract, type TreasuryContract } from "@ton/sandbox";
import { Address, beginCell, toNano, type Cell } from "@ton/core";
import { BitpadFactory, storeLaunchWithJetton } from "../build/BitpadFactory_BitpadFactory";
import { BitpadJetton } from "../build/BitpadFactory_BitpadJetton";
import { BitpadJettonWallet } from "../build/BitpadFactory_BitpadJettonWallet";
import { BitpadPool, storeSwapIntent } from "../build/BitpadFactory_BitpadPool";
import { BitpadBundler } from "../build/BitpadBundler_BitpadBundler";
import { StakeVault } from "../build/BitpadFactory_StakeVault";

const content = beginCell().storeUint(1, 8).storeStringTail("https://bitpad.example/api/jetton/metadata?d=x").endCell();
const SUPPLY = 1_000_000_000n * 10n ** 9n;
const LAUNCH_FEE = toNano("1");

type Chain = Awaited<ReturnType<typeof setup>>;

async function setup() {
  const chain = await Blockchain.create();
  const owner = await chain.treasury("owner");
  const feeWallet = await chain.treasury("fee");
  const creator = await chain.treasury("creator");
  const alice = await chain.treasury("alice");
  const bob = await chain.treasury("bob");
  // 0.5% protocol + 0.5% creator, 1 TON launch fee, 1 TON min liquidity
  const factory = chain.openContract(await BitpadFactory.fromInit(owner.address, feeWallet.address, LAUNCH_FEE, 50n, 50n, toNano("1")));
  await factory.send(owner.getSender(), { value: toNano("0.5") }, null);
  return { chain, owner, feeWallet, creator, alice, bob, factory };
}

async function launchTon(c: Chain, pairTon = "10", creatorBps = 1000n) {
  const r = await c.factory.send(c.creator.getSender(), { value: LAUNCH_FEE + toNano(pairTon) + toNano("0.6") }, {
    $$type: "Launch", queryId: 1n, supply: SUPPLY, creatorBps, pairAmount: toNano(pairTon), content,
  });
  const index = (await c.factory.getLaunchCount()) - 1n;
  const minter = c.chain.openContract(BitpadJetton.fromAddress((await c.factory.getMinter(index))!));
  const pool = c.chain.openContract(BitpadPool.fromAddress((await c.factory.getPool(index))!));
  return { r, minter, pool };
}

const walletOf = async (c: Chain, minter: SandboxContract<BitpadJetton>, owner: Address) =>
  c.chain.openContract(BitpadJettonWallet.fromAddress(await minter.getGetWalletAddress(owner)));
const balanceOf = async (c: Chain, minter: SandboxContract<BitpadJetton>, owner: Address) => {
  try {
    return (await (await walletOf(c, minter, owner)).getGetWalletData()).balance;
  } catch {
    return 0n; // wallet not deployed
  }
};
const intent = (minOut: bigint, referrer: Address | null = null, recipient: Address | null = null) =>
  beginCell().storeBit(1).storeRef(beginCell().store(storeSwapIntent({ $$type: "SwapIntent", minOut, recipient, referrer })).endCell()).endCell().beginParse();
const emptyPayload = () => beginCell().storeBit(0).endCell().beginParse();
const failed = (r: { transactions: { description: { type: string; computePhase?: { type: string; success?: boolean } } }[] }) =>
  r.transactions.some((t) => t.description.type === "generic" && t.description.computePhase?.type === "vm" && !t.description.computePhase.success);

async function sendJetton(c: Chain, minter: SandboxContract<BitpadJetton>, from: SandboxContract<TreasuryContract>, to: Address, amount: bigint, fwdTon: bigint, payload: ReturnType<typeof intent>) {
  const w = await walletOf(c, minter, from.address);
  return w.send(from.getSender(), { value: fwdTon + toNano("0.1") }, {
    $$type: "TokenTransfer", queryId: 7n, amount, destination: to, responseDestination: from.address, customPayload: null, forwardTonAmount: fwdTon, forwardPayload: payload,
  });
}

describe("TON-paired launch", () => {
  test("deploys jetton + pool atomically, locks liquidity, pays fee, returns excess", async () => {
    const c = await setup();
    const feeBefore = await c.feeWallet.getBalance();
    const creatorBefore = await c.creator.getBalance();
    const { minter, pool } = await launchTon(c, "10", 1000n);

    assert.equal(await c.factory.getLaunchCount(), 1n);
    const jd = await minter.getGetJettonData();
    assert.equal(jd.totalSupply, SUPPLY);
    assert.equal(jd.mintable, false);

    const pd = await pool.getPoolData();
    assert.equal(pd.tradingOpen, true);
    assert.equal(pd.reservePair, toNano("10"));
    assert.equal(pd.reserveToken, (SUPPLY * 9000n) / 10000n, "90% in the pool");
    assert.equal(await balanceOf(c, minter, c.creator.address), SUPPLY / 10n, "10% to the creator");
    assert.equal(await balanceOf(c, minter, pool.address), pd.reserveToken, "pool wallet holds its reserve");
    assert.equal(pd.pairMaster, null);

    assert.ok((await c.feeWallet.getBalance()) - feeBefore >= toNano("0.99"), "launch fee forwarded");
    const spent = creatorBefore - (await c.creator.getBalance());
    assert.ok(spent < LAUNCH_FEE + toNano("10") + toNano("0.55"), `excess returned (spent ${spent})`); // LAUNCH_GAS 0.5 incl. vault deploy

    // on-chain price: 10 TON / 900M tokens
    assert.equal(await pool.getPrice(), (toNano("10") * 10n ** 9n) / pd.reserveToken);
  });

  test("rejects underfunded, below-minimum-liquidity and oversized creator shares", async () => {
    const c = await setup();
    const base = { $$type: "Launch" as const, queryId: 1n, supply: SUPPLY, content };
    assert.ok(failed(await c.factory.send(c.creator.getSender(), { value: toNano("2") }, { ...base, creatorBps: 0n, pairAmount: toNano("5") })));
    assert.ok(failed(await c.factory.send(c.creator.getSender(), { value: toNano("5") }, { ...base, creatorBps: 0n, pairAmount: toNano("0.5") })));
    assert.ok(failed(await c.factory.send(c.creator.getSender(), { value: toNano("20") }, { ...base, creatorBps: 2001n, pairAmount: toNano("5") })));
    assert.equal(await c.factory.getLaunchCount(), 0n);
  });

  test("buy with TON: exact quote delivered, fees accrued, reserves updated", async () => {
    const c = await setup();
    const { minter, pool } = await launchTon(c);
    const quote = await pool.getQuoteBuy(toNano("1"));
    await pool.send(c.alice.getSender(), { value: toNano("1.1") }, { $$type: "BuyTon", queryId: 2n, amountIn: toNano("1"), minOut: quote, recipient: null, referrer: c.creator.address });
    assert.equal(await balanceOf(c, minter, c.alice.address), quote);
    const pd = await pool.getPoolData();
    assert.equal(pd.protocolFeesAccrued, toNano("0.005"));
    assert.equal(pd.creatorFeesAccrued, toNano("0.005"));
    assert.equal(pd.reservePair, toNano("10") + toNano("0.99"));
    const tonBal = (await c.chain.getContract(pool.address)).balance;
    assert.ok(tonBal >= pd.reservePair + pd.protocolFeesAccrued + pd.creatorFeesAccrued, "pool holds reserve + fees");
  });

  test("buy that would slip is refunded in full; state untouched", async () => {
    const c = await setup();
    const { minter, pool } = await launchTon(c);
    const before = await pool.getPoolData();
    const aliceBefore = await c.alice.getBalance();
    const quote = await pool.getQuoteBuy(toNano("1"));
    await pool.send(c.alice.getSender(), { value: toNano("1.1") }, { $$type: "BuyTon", queryId: 2n, amountIn: toNano("1"), minOut: quote + 1n, recipient: null, referrer: c.creator.address });
    assert.equal(await balanceOf(c, minter, c.alice.address), 0n);
    assert.deepEqual((await pool.getPoolData()).reservePair, before.reservePair);
    assert.ok(aliceBefore - (await c.alice.getBalance()) < toNano("0.05"), "only gas spent");
  });

  test("sell for TON with SwapIntent; bad payload and slippage are refunded", async () => {
    const c = await setup();
    const { minter, pool } = await launchTon(c);
    await pool.send(c.alice.getSender(), { value: toNano("2.2") }, { $$type: "BuyTon", queryId: 2n, amountIn: toNano("2"), minOut: 0n, recipient: null, referrer: c.creator.address });
    const held = await balanceOf(c, minter, c.alice.address);

    // bad payload → tokens come back
    await sendJetton(c, minter, c.alice, pool.address, held / 2n, toNano("0.15"), emptyPayload());
    assert.equal(await balanceOf(c, minter, c.alice.address), held);
    // slippage → tokens come back
    const q = await pool.getQuoteSell(held / 2n);
    await sendJetton(c, minter, c.alice, pool.address, held / 2n, toNano("0.15"), intent(q + 1n));
    assert.equal(await balanceOf(c, minter, c.alice.address), held);

    // proper sell
    const tonBefore = await c.alice.getBalance();
    await sendJetton(c, minter, c.alice, pool.address, held / 2n, toNano("0.15"), intent(q));
    assert.equal(await balanceOf(c, minter, c.alice.address), held - held / 2n);
    const gained = (await c.alice.getBalance()) - tonBefore;
    assert.ok(gained > q - toNano("0.2"), `received ≈ quote (${gained} vs ${q})`);
    const pd = await pool.getPoolData();
    const tonBal = (await c.chain.getContract(pool.address)).balance;
    assert.ok(tonBal >= pd.reservePair + pd.protocolFeesAccrued + pd.creatorFeesAccrued, "pool stays solvent after sell");
  });

  test("ClaimFees pays protocol → fee wallet and creator → creator (70% each; 30% to stakers)", async () => {
    const c = await setup();
    const { pool } = await launchTon(c);
    await pool.send(c.alice.getSender(), { value: toNano("10.2") }, { $$type: "BuyTon", queryId: 2n, amountIn: toNano("10"), minOut: 0n, recipient: null, referrer: c.creator.address });
    const fee0 = await c.feeWallet.getBalance();
    const cr0 = await c.creator.getBalance();
    await pool.send(c.bob.getSender(), { value: toNano("0.1") }, { $$type: "ClaimFees", queryId: 3n });
    assert.ok((await c.feeWallet.getBalance()) - fee0 >= toNano("0.034"));
    assert.ok((await c.creator.getBalance()) - cr0 >= toNano("0.034"));
    const pd = await pool.getPoolData();
    assert.equal(pd.protocolFeesAccrued + pd.creatorFeesAccrued, 0n);
  });

  test("attackers can't re-init the pool, mint, or fake a reserve seed", async () => {
    const c = await setup();
    const { minter, pool } = await launchTon(c);
    const pd = await pool.getPoolData();
    assert.ok(failed(await pool.send(c.alice.getSender(), { value: toNano("0.2") }, {
      $$type: "PoolInit", queryId: 0n, tokenMaster: minter.address, pairMaster: null, creator: c.alice.address, feeWallet: c.alice.address, protocolFeeBps: 0n, creatorFeeBps: 0n, pairAmount: 0n,
    })));
    assert.ok(failed(await minter.send(c.alice.getSender(), { value: toNano("0.3") }, {
      $$type: "MintLaunch", queryId: 0n, pool: c.alice.address, poolAmount: 1n, creator: c.alice.address, creatorAmount: 0n,
    })));
    // spoofed notification straight from a wallet contract that isn't the pool's
    await pool.send(c.alice.getSender(), { value: toNano("0.2") }, { $$type: "TokenNotification", queryId: 0n, amount: 10n ** 20n, from: minter.address, forwardPayload: emptyPayload() });
    assert.equal((await pool.getPoolData()).reserveToken, pd.reserveToken);
    assert.equal((await minter.getGetJettonData()).totalSupply, SUPPLY);
  });
});

describe("invariants", () => {
  test("40 random trades: pool stays solvent and its token wallet always equals reserveToken", async () => {
    const c = await setup();
    const { minter, pool } = await launchTon(c, "20");
    const traders = await Promise.all([0, 1, 2, 3].map((i) => c.chain.treasury(`t${i}`)));
    const refs = await Promise.all([0, 1].map((i) => c.chain.treasury(`r${i}`)));
    for (const r of refs) await pool.send(c.creator.getSender(), { value: toNano("0.05") }, { $$type: "AddReferrer", queryId: 0n, referrer: r.address });
    const links = [c.creator.address, ...refs.map((r) => r.address)];
    let seed = 42;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    let k0: bigint | null = null;
    for (let i = 0; i < 40; i++) {
      const t = traders[Math.floor(rnd() * traders.length)];
      const held = await balanceOf(c, minter, t.address);
      if (held > 0n && rnd() < 0.45) {
        const amt = (held * BigInt(1 + Math.floor(rnd() * 99))) / 100n;
        await sendJetton(c, minter, t, pool.address, amt, toNano("0.15"), intent(0n, rnd() < 0.3 ? null : links[Math.floor(rnd() * links.length)]));
      } else {
        const amt = toNano((0.1 + rnd() * 5).toFixed(3));
        await pool.send(t.getSender(), { value: amt + toNano("0.12") }, { $$type: "BuyTon", queryId: BigInt(i), amountIn: amt, minOut: 0n, recipient: null, referrer: links[Math.floor(rnd() * links.length)] });
      }
      const pd = await pool.getPoolData();
      const ton = (await c.chain.getContract(pool.address)).balance;
      assert.ok(ton >= pd.reservePair + pd.protocolFeesAccrued + pd.creatorFeesAccrued + pd.referralFeesAccrued, `solvent after trade ${i}`);
      assert.equal(await balanceOf(c, minter, pool.address), pd.reserveToken, `token books match after trade ${i}`);
      const k = pd.reservePair * pd.reserveToken;
      if (k0 !== null) assert.ok(k >= k0, "x·y never decreases (fees can only deepen the pool)");
      k0 = k;
    }
  });
});

describe("referral links", () => {
  test("buys require a valid link; creator fee is split 50/50 with the referrer", async () => {
    const c = await setup();
    const { minter, pool } = await launchTon(c);
    const ref = await c.chain.treasury("ref");
    const buy = (referrer: Address, amount = "1") =>
      pool.send(c.alice.getSender(), { value: toNano(amount) + toNano("0.12") }, { $$type: "BuyTon", queryId: 1n, amountIn: toNano(amount), minOut: 0n, recipient: null, referrer });

    await buy(ref.address); // not registered yet → refunded
    assert.equal(await balanceOf(c, minter, c.alice.address), 0n, "unregistered link is refused");
    assert.equal(await pool.getIsReferrer(ref.address), false);
    assert.equal(await pool.getIsReferrer(c.creator.address), true, "creator's own link always works");

    await pool.send(c.creator.getSender(), { value: toNano("0.05") }, { $$type: "AddReferrer", queryId: 0n, referrer: ref.address });
    assert.equal(await pool.getIsReferrer(ref.address), true);

    await buy(ref.address, "10");
    assert.ok((await balanceOf(c, minter, c.alice.address)) > 0n);
    const pd = await pool.getPoolData();
    // creator fee = 0.5% of 10 TON = 0.05 → 0.025 each
    assert.equal(pd.creatorFeesAccrued, toNano("0.025"));
    assert.equal(pd.referralFeesAccrued, toNano("0.025"));
    assert.equal(pd.protocolFeesAccrued, toNano("0.05"), "protocol fee unaffected");
    const info = await pool.getReferrer(ref.address);
    assert.equal(info?.accrued, toNano("0.025"));
    assert.equal(info?.volume, toNano("10"));

    // creator's own link → creator keeps 100%
    await buy(c.creator.address, "10");
    assert.equal((await pool.getPoolData()).creatorFeesAccrued, toNano("0.075"));

    // referrer claims
    const r0 = await ref.getBalance();
    await pool.send(ref.getSender(), { value: toNano("0.05") }, { $$type: "ClaimReferral", queryId: 1n });
    assert.ok((await ref.getBalance()) - r0 > toNano("0.02"), "referrer paid");
    assert.equal((await pool.getReferrer(ref.address))?.accrued, 0n);
    assert.equal((await pool.getPoolData()).referralFeesAccrued, 0n);
    assert.ok(failed(await pool.send(ref.getSender(), { value: toNano("0.05") }, { $$type: "ClaimReferral", queryId: 2n })), "nothing left to claim");
  });

  test("sells: link optional — split when valid, creator keeps it otherwise", async () => {
    const c = await setup();
    const { minter, pool } = await launchTon(c);
    const ref = await c.chain.treasury("ref");
    await pool.send(c.creator.getSender(), { value: toNano("0.05") }, { $$type: "AddReferrer", queryId: 0n, referrer: ref.address });
    await pool.send(c.alice.getSender(), { value: toNano("5.2") }, { $$type: "BuyTon", queryId: 1n, amountIn: toNano("5"), minOut: 0n, recipient: null, referrer: c.creator.address });
    const held = await balanceOf(c, minter, c.alice.address);

    const cr0 = (await pool.getPoolData()).creatorFeesAccrued;
    await sendJetton(c, minter, c.alice, pool.address, held / 2n, toNano("0.15"), intent(0n)); // no link
    const pd1 = await pool.getPoolData();
    assert.equal(pd1.referralFeesAccrued, 0n);
    assert.ok(pd1.creatorFeesAccrued > cr0, "creator keeps the full creator fee on unlinked sells");

    await sendJetton(c, minter, c.alice, pool.address, held / 4n, toNano("0.15"), intent(0n, ref.address));
    const pd2 = await pool.getPoolData();
    assert.ok(pd2.referralFeesAccrued > 0n, "linked sell pays the referrer");
    const creatorGain = pd2.creatorFeesAccrued - pd1.creatorFeesAccrued;
    assert.ok(creatorGain - pd2.referralFeesAccrued <= 1n && creatorGain >= pd2.referralFeesAccrued, "50/50 split (odd nanoton to the creator)");
  });

  test("only the creator manages links; max 20; removed links stop working but keep earnings", async () => {
    const c = await setup();
    const { minter, pool } = await launchTon(c);
    const refs = await Promise.all(Array.from({ length: 21 }, (_, i) => c.chain.treasury(`ref${i}`)));
    const add = (who: typeof c.creator, a: Address) => pool.send(who.getSender(), { value: toNano("0.05") }, { $$type: "AddReferrer", queryId: 0n, referrer: a });

    assert.ok(failed(await add(c.alice, refs[0].address)), "non-creator can't add");
    assert.ok(failed(await add(c.creator, c.creator.address)), "creator can't add itself");
    for (let i = 0; i < 20; i++) assert.ok(!failed(await add(c.creator, refs[i].address)), `add #${i + 1}`);
    assert.ok(failed(await add(c.creator, refs[20].address)), "21st link refused");
    assert.ok(failed(await add(c.creator, refs[0].address)), "duplicate refused");
    assert.equal((await pool.getPoolData()).activeReferrers, 20n);
    assert.equal((await pool.getReferrers()).size, 20);

    // earn, then get removed
    await pool.send(c.alice.getSender(), { value: toNano("2.2") }, { $$type: "BuyTon", queryId: 1n, amountIn: toNano("2"), minOut: 0n, recipient: null, referrer: refs[0].address });
    const earned = (await pool.getReferrer(refs[0].address))!.accrued;
    assert.ok(earned > 0n);
    assert.ok(failed(await pool.send(c.alice.getSender(), { value: toNano("0.05") }, { $$type: "RemoveReferrer", queryId: 0n, referrer: refs[0].address })), "non-creator can't remove");
    await pool.send(c.creator.getSender(), { value: toNano("0.05") }, { $$type: "RemoveReferrer", queryId: 0n, referrer: refs[0].address });
    assert.equal(await pool.getIsReferrer(refs[0].address), false);
    assert.equal((await pool.getPoolData()).activeReferrers, 19n);

    const bal = await balanceOf(c, minter, c.bob.address);
    await pool.send(c.bob.getSender(), { value: toNano("1.2") }, { $$type: "BuyTon", queryId: 2n, amountIn: toNano("1"), minOut: 0n, recipient: null, referrer: refs[0].address });
    assert.equal(await balanceOf(c, minter, c.bob.address), bal, "removed link refused");

    // freed slot can be reused
    assert.ok(!failed(await add(c.creator, refs[20].address)));
    // removed referrer still claims what it earned
    const r0 = await refs[0].getBalance();
    await pool.send(refs[0].getSender(), { value: toNano("0.05") }, { $$type: "ClaimReferral", queryId: 1n });
    assert.ok((await refs[0].getBalance()) - r0 > earned - toNano("0.02"));
  });
});

describe("jetton-paired launch", () => {
  async function withPairJetton(c: Chain) {
    // A stand-in pair asset ("USDX"): a TEP-74 jetton whose supply sits with the creator.
    const usdx = c.chain.openContract(await BitpadJetton.fromInit(c.owner.address, 999n, content, c.owner.address, null));
    await usdx.send(c.owner.getSender(), { value: toNano("0.5") }, {
      $$type: "MintLaunch", queryId: 0n, pool: c.creator.address, poolAmount: 1_000_000n * 10n ** 6n, creator: c.alice.address, creatorAmount: 100_000n * 10n ** 6n,
    });
    await c.factory.send(c.owner.getSender(), { value: toNano("0.2") }, {
      $$type: "AddPair", master: usdx.address,
      info: { $$type: "PairInfo", symbol: "USDX", decimals: 6n, kind: 1n, pythFeedId: 0n, minLiquidity: 100n * 10n ** 6n, wallet: null, enabled: true },
    });
    return usdx;
  }

  test("registers the pair, discovers the factory wallet, launches and trades both ways", async () => {
    const c = await setup();
    const usdx = await withPairJetton(c);
    const info = await c.factory.getPair(usdx.address);
    assert.ok(info?.wallet, "factory learned its USDX wallet via TEP-89");
    assert.equal(info!.wallet!.toString(), (await usdx.getGetWalletAddress(c.factory.address)).toString());

    const launch = beginCell().storeBit(1).storeRef(beginCell().store(storeLaunchWithJetton({ $$type: "LaunchWithJetton", supply: SUPPLY, creatorBps: 500n, content })).endCell()).endCell().beginParse();
    const fee0 = await c.feeWallet.getBalance();
    await sendJetton(c, usdx, c.creator, c.factory.address, 5_000n * 10n ** 6n, LAUNCH_FEE + toNano("0.7"), launch);

    assert.equal(await c.factory.getLaunchCount(), 1n);
    assert.equal(await c.factory.getPendingLaunch(0n), null, "pending cleared once the pool was funded");
    assert.ok((await c.feeWallet.getBalance()) - fee0 >= toNano("0.99"));
    const pool = c.chain.openContract(BitpadPool.fromAddress((await c.factory.getPool(0n))!));
    const token = c.chain.openContract(BitpadJetton.fromAddress((await c.factory.getMinter(0n))!));
    const pd = await pool.getPoolData();
    assert.equal(pd.pairMaster?.toString(), usdx.address.toString());
    assert.equal(pd.reservePair, 5_000n * 10n ** 6n);
    assert.equal(pd.reserveToken, (SUPPLY * 9500n) / 10000n);
    assert.equal(pd.tradingOpen, true);

    // Buy with USDX
    const q = await pool.getQuoteBuy(100n * 10n ** 6n);
    // no link → refunded
    const before = await balanceOf(c, usdx, c.alice.address);
    await sendJetton(c, usdx, c.alice, pool.address, 100n * 10n ** 6n, toNano("0.15"), intent(q));
    assert.equal(await balanceOf(c, usdx, c.alice.address), before, "buy without a referral link is refunded");
    await sendJetton(c, usdx, c.alice, pool.address, 100n * 10n ** 6n, toNano("0.15"), intent(q, c.creator.address));
    assert.equal(await balanceOf(c, token, c.alice.address), q);

    // Sell back for USDX
    const usdxBefore = await balanceOf(c, usdx, c.alice.address);
    const qs = await pool.getQuoteSell(q);
    await sendJetton(c, token, c.alice, pool.address, q, toNano("0.15"), intent(qs));
    assert.equal(await balanceOf(c, usdx, c.alice.address), usdxBefore + qs);

    // Fees claimable in USDX
    const f0 = await balanceOf(c, usdx, c.feeWallet.address);
    await pool.send(c.bob.getSender(), { value: toNano("0.3") }, { $$type: "ClaimFees", queryId: 1n });
    assert.ok((await balanceOf(c, usdx, c.feeWallet.address)) > f0);
  });

  test("unregistered jettons and invalid launch payloads are returned", async () => {
    const c = await setup();
    const usdx = await withPairJetton(c);
    const held = await balanceOf(c, usdx, c.creator.address);
    await sendJetton(c, usdx, c.creator, c.factory.address, 10n * 10n ** 6n, LAUNCH_FEE + toNano("0.7"), emptyPayload()); // below min & no payload
    assert.equal(await balanceOf(c, usdx, c.creator.address), held);
    assert.equal(await c.factory.getLaunchCount(), 0n);
  });
});

describe("bundler", () => {
  test("buys into many wallets in one transaction; a slipping leg is refunded to its wallet", async () => {
    const c = await setup();
    const { minter, pool } = await launchTon(c, "50");
    const bundler = c.chain.openContract(await BitpadBundler.fromInit(c.owner.address, c.feeWallet.address, 50n));
    await bundler.send(c.owner.getSender(), { value: toNano("0.2") }, null);

    const w = await Promise.all([1, 2, 3].map((i) => c.chain.treasury(`leg${i}`)));
    const legs = new Map<bigint, { $$type: "BundleLeg"; recipient: Address; amount: bigint; minOut: bigint }>();
    legs.set(0n, { $$type: "BundleLeg", recipient: w[0].address, amount: toNano("1"), minOut: 0n });
    legs.set(1n, { $$type: "BundleLeg", recipient: w[1].address, amount: toNano("2"), minOut: 0n });
    legs.set(2n, { $$type: "BundleLeg", recipient: w[2].address, amount: toNano("3"), minOut: 10n ** 30n }); // impossible → refund
    const { Dictionary } = await import("@ton/core");
    const { dictValueParserBundleLeg } = await import("../build/BitpadBundler_BitpadBundler");
    const dict = Dictionary.empty(Dictionary.Keys.Uint(8), dictValueParserBundleLeg());
    for (const [k, v] of legs) dict.set(Number(k), v);

    const w2Before = await w[2].getBalance();
    const r = await bundler.send(c.bob.getSender(), { value: toNano("6") + 3n * toNano("0.12") + toNano("0.1") }, {
      $$type: "BundleBuy", queryId: 9n, pool: pool.address, referrer: c.creator.address, count: 3n, legs: dict as unknown as never,
    });
    assert.ok(!failed(r), "bundle transaction succeeded");
    assert.ok((await balanceOf(c, minter, w[0].address)) > 0n);
    assert.ok((await balanceOf(c, minter, w[1].address)) > (await balanceOf(c, minter, w[0].address)));
    assert.equal(await balanceOf(c, minter, w[2].address), 0n);
    assert.ok((await w[2].getBalance()) - w2Before > toNano("2.9"), "slipping leg refunded to its wallet");
  });

  test("rejects count mismatch and underfunding", async () => {
    const c = await setup();
    const { pool } = await launchTon(c);
    const bundler = c.chain.openContract(await BitpadBundler.fromInit(c.owner.address, c.feeWallet.address, 0n));
    await bundler.send(c.owner.getSender(), { value: toNano("0.2") }, null);
    const { Dictionary } = await import("@ton/core");
    const { dictValueParserBundleLeg } = await import("../build/BitpadBundler_BitpadBundler");
    const dict = Dictionary.empty(Dictionary.Keys.Uint(8), dictValueParserBundleLeg());
    dict.set(0, { $$type: "BundleLeg", recipient: c.alice.address, amount: toNano("5"), minOut: 0n });
    assert.ok(failed(await bundler.send(c.bob.getSender(), { value: toNano("1") }, { $$type: "BundleBuy", queryId: 1n, pool: pool.address, referrer: c.creator.address, count: 1n, legs: dict as unknown as never })));
    assert.ok(failed(await bundler.send(c.bob.getSender(), { value: toNano("10") }, { $$type: "BundleBuy", queryId: 1n, pool: pool.address, referrer: c.creator.address, count: 2n, legs: dict as unknown as never })));
  });
});

describe("admin", () => {
  test("only the owner configures; fee cap enforced; withdraw can't touch reserved gas", async () => {
    const c = await setup();
    const cfg = { $$type: "SetConfig" as const, launchFee: toNano("2"), protocolFeeBps: 100n, creatorFeeBps: 100n, minTonLiquidity: toNano("5"), tonPythFeedId: 0n };
    assert.ok(failed(await c.factory.send(c.alice.getSender(), { value: toNano("0.05") }, cfg)));
    assert.ok(failed(await c.factory.send(c.owner.getSender(), { value: toNano("0.05") }, { ...cfg, protocolFeeBps: 900n, creatorFeeBps: 200n })));
    await c.factory.send(c.owner.getSender(), { value: toNano("0.05") }, cfg);
    assert.equal((await c.factory.getConfig()).launchFee, toNano("2"));
    assert.ok(failed(await c.factory.send(c.owner.getSender(), { value: toNano("0.05") }, { $$type: "Withdraw", amount: toNano("100") })));
  });
});

void (null as unknown as Cell);

describe("holder staking vault", () => {
  const buy = (c: Chain, pool: SandboxContract<BitpadPool>, who: SandboxContract<TreasuryContract>, ton: string) =>
    pool.send(who.getSender(), { value: toNano(ton) + toNano("0.2") }, { $$type: "BuyTon", queryId: 1n, amountIn: toNano(ton), minOut: 0n, recipient: null, referrer: c.creator.address });
  const claim = (c: Chain, pool: SandboxContract<BitpadPool>) => pool.send(c.bob.getSender(), { value: toNano("0.1") }, { $$type: "ClaimFees", queryId: 9n });

  test("deployed at launch; 30% of both fees reach stakers pro-rata; withdraw any time", async () => {
    const c = await setup();
    const { minter, pool } = await launchTon(c);
    const vault = c.chain.openContract(StakeVault.fromAddress(await pool.getVault()));
    const v0 = await vault.getVaultData();
    assert.equal(v0.pool.toString(), pool.address.toString());
    assert.equal(v0.totalStaked, 0n);

    // Alice and Bob buy, then stake 3:1
    await buy(c, pool, c.alice, "10");
    await buy(c, pool, c.bob, "10");
    const a = await balanceOf(c, minter, c.alice.address);
    const b = await balanceOf(c, minter, c.bob.address);
    const aStake = (a / 4n) * 3n;
    const bStake = aStake / 3n;
    assert.ok(b >= bStake);
    await sendJetton(c, minter, c.alice, vault.address, aStake, toNano("0.05"), emptyPayload());
    await sendJetton(c, minter, c.bob, vault.address, bStake, toNano("0.05"), emptyPayload());
    assert.equal((await vault.getVaultData()).totalStaked, aStake + bStake);
    assert.equal((await vault.getVaultData()).stakers, 2n);

    // Fees: 2 buys × 10 TON × (0.5% + 0.5%) = 0.2 TON; stakers get 30% = 0.06 TON (minus vault gas)
    const pd = await pool.getPoolData();
    const expected = ((pd.protocolFeesAccrued * 3000n) / 10000n) + ((pd.creatorFeesAccrued * 3000n) / 10000n) - toNano("0.01");
    await claim(c, pool);
    const va = await vault.getStaker(c.alice.address);
    const vb = await vault.getStaker(c.bob.address);
    const total = va.pending + vb.pending;
    assert.ok(total <= expected && total >= expected - 10n, `distributed ${total} vs ${expected}`);
    // 3:1 split (integer rounding aside)
    assert.ok(va.pending - 3n * vb.pending <= 3n && 3n * vb.pending - va.pending <= 3n);

    // Claim TON without unstaking
    const before = await c.alice.getBalance();
    await vault.send(c.alice.getSender(), { value: toNano("0.05") }, { $$type: "ClaimRewards", queryId: 1n });
    assert.ok((await c.alice.getBalance()) - before >= va.pending - toNano("0.01"));
    assert.equal((await vault.getStaker(c.alice.address)).pending, 0n);

    // Withdraw any time: Bob unstakes everything, gets jettons + pending TON back
    const bJ = await balanceOf(c, minter, c.bob.address);
    await vault.send(c.bob.getSender(), { value: toNano("0.1") }, { $$type: "Unstake", queryId: 2n, amount: bStake });
    assert.equal(await balanceOf(c, minter, c.bob.address), bJ + bStake);
    assert.equal((await vault.getStaker(c.bob.address)).amount, 0n);
    const vd = await vault.getVaultData();
    assert.equal(vd.totalStaked, aStake);
    assert.equal(vd.stakers, 1n);

    // Can't unstake more than staked, or someone else's stake
    assert.ok(failed(await vault.send(c.bob.getSender(), { value: toNano("0.1") }, { $$type: "Unstake", queryId: 3n, amount: 1n })));
    assert.ok(failed(await vault.send(c.alice.getSender(), { value: toNano("0.1") }, { $$type: "Unstake", queryId: 3n, amount: aStake + 1n })));
  });

  test("rewards arriving with nobody staked carry over to the first staker; foreign jettons are returned", async () => {
    const c = await setup();
    const { minter, pool } = await launchTon(c);
    const vault = c.chain.openContract(StakeVault.fromAddress(await pool.getVault()));
    await buy(c, pool, c.alice, "10");
    await claim(c, pool);
    const carry = (await vault.getVaultData()).carry;
    assert.ok(carry > 0n);
    await sendJetton(c, minter, c.alice, vault.address, 1000n * 10n ** 9n, toNano("0.05"), emptyPayload());
    const s = await vault.getStaker(c.alice.address);
    assert.ok(s.pending >= carry - 1n);
    assert.equal((await vault.getVaultData()).carry, 0n);

    // A second launch's jetton sent to this vault is handed back
    const other = await launchTon(c);
    await buy(c, other.pool, c.bob, "5");
    const held = await balanceOf(c, other.minter, c.bob.address);
    await sendJetton(c, other.minter, c.bob, vault.address, held, toNano("0.05"), emptyPayload());
    assert.equal(await balanceOf(c, other.minter, c.bob.address), held);
  });
});
