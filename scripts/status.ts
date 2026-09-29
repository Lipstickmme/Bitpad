/**
 * Read-only status of the deployed contracts (no mnemonic needed, sends nothing).
 *   npm run status
 *   npm run status -- EQ…pairMaster1 EQ…pairMaster2     (also check pair registrations)
 */
import { Address, fromNano } from "@ton/core";
import { TonClient4 } from "@ton/ton";
import { BitpadFactory } from "../contracts/build/BitpadFactory_BitpadFactory";
import { BitpadBundler } from "../contracts/build/BitpadBundler_BitpadBundler";
import { BitpadPool } from "../contracts/build/BitpadFactory_BitpadPool";
import { FACTORY_ADDRESS, BUNDLER_ADDRESS, networkOf } from "../src/lib/config";

(async () => {
  const network = networkOf(FACTORY_ADDRESS);
  const client = new TonClient4({ endpoint: network === "mainnet" ? "https://mainnet-v4.tonhubapi.com" : "https://sandbox-v4.tonhubapi.com", timeout: 15_000 });
  const f = client.open(BitpadFactory.fromAddress(Address.parse(FACTORY_ADDRESS)));
  const c = await f.getConfig();
  console.log(`Network         ${network}`);
  console.log(`Factory         ${FACTORY_ADDRESS}`);
  console.log(`  owner         ${c.owner.toString()}`);
  console.log(`  fee wallet    ${c.feeWallet.toString()}`);
  console.log(`  launch fee    ${fromNano(c.launchFee)} TON · trade fee ${Number(c.protocolFeeBps) / 100}% protocol + ${Number(c.creatorFeeBps) / 100}% creator · min liquidity ${fromNano(c.minTonLiquidity)} TON`);
  console.log(`  launches      ${c.launches}`);
  for (let i = Number(c.launches) - 1; i >= Math.max(0, Number(c.launches) - 5); i--) {
    const pool = await f.getPool(BigInt(i));
    if (!pool) continue;
    const p = await client.open(BitpadPool.fromAddress(pool)).getPoolData();
    console.log(`  #${i} pool ${pool.toString()}  open=${p.tradingOpen}  reserves ${fromNano(p.reserveToken)} tok / ${Number(p.reservePair) / 1e9} pair  links ${p.activeReferrers}`);
  }
  try {
    const b = client.open(BitpadBundler.fromAddress(Address.parse(BUNDLER_ADDRESS)));
    console.log(`Bundler         ${BUNDLER_ADDRESS}  fee ${Number(await b.getFeeBps()) / 100}%`);
  } catch (e) {
    console.log(`Bundler         ${BUNDLER_ADDRESS}  (read failed: ${(e as Error).message})`);
  }
  for (const m of process.argv.slice(2)) {
    const info = await f.getPair(Address.parse(m));
    console.log(info
      ? `Pair ${info.symbol.padEnd(8)} ${m}  enabled=${info.enabled} ready=${!!info.wallet} decimals=${info.decimals} min=${Number(info.minLiquidity) / 10 ** Number(info.decimals)}`
      : `Pair ${m}  not registered`);
  }
})().catch((e) => { console.error(e.message ?? e); process.exit(1); });
