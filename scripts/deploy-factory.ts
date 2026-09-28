/**
 * Deploy BitpadFactory.
 *
 *   DEPLOYER_MNEMONIC="…" NETWORK=mainnet FEE_WALLET=<addr> \
 *   LAUNCH_FEE_TON=1 PROTOCOL_FEE_BPS=50 CREATOR_FEE_BPS=50 MIN_TON_LIQUIDITY=1 \
 *   npm run deploy:factory
 *
 * The deployer wallet becomes the owner (can change fees / fee wallet / pairs).
 */
import { Address, fromNano, toNano } from "@ton/core";
import { BitpadFactory } from "../contracts/build/BitpadFactory_BitpadFactory";
import { deployer, env } from "./lib";

(async () => {
  const d = await deployer();
  const feeWallet = Address.parse(env("FEE_WALLET", d.address.toString()));
  const launchFee = toNano(env("LAUNCH_FEE_TON", "1"));
  const pBps = BigInt(env("PROTOCOL_FEE_BPS", "50"));
  const cBps = BigInt(env("CREATOR_FEE_BPS", "50"));
  const minTon = toNano(env("MIN_TON_LIQUIDITY", "1"));
  if (pBps + cBps > 1000n) throw new Error("PROTOCOL_FEE_BPS + CREATOR_FEE_BPS must be ≤ 1000");

  const factory = await BitpadFactory.fromInit(d.address, feeWallet, launchFee, pBps, cBps, minTon);
  console.log(`Network         ${d.network}`);
  console.log(`Owner/deployer  ${d.fmt(d.address)}  (${fromNano(await d.balance())} TON)`);
  console.log(`Fee wallet      ${d.fmt(feeWallet)}`);
  console.log(`Launch fee      ${fromNano(launchFee)} TON · trade fee ${Number(pBps) / 100}% protocol + ${Number(cBps) / 100}% creator · min liquidity ${fromNano(minTon)} TON`);
  console.log(`Factory         ${d.fmt(factory.address)}`);

  if (await d.client.isContractDeployed(factory.address)) return console.log("Already deployed ✓");
  await d.send(factory.address, toNano("0.3"), undefined, factory.init!);
  if (await d.waitDeployed(factory.address)) console.log(`Deployed ✓\n\nNEXT_PUBLIC_BITPAD_FACTORY=${d.fmt(factory.address)}`);
  else console.log("Not visible yet — check the address in an explorer.");
})().catch((e) => { console.error(e.message ?? e); process.exit(1); });
