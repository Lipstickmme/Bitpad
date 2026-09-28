/**
 * Deploy BitpadBundler.
 *   DEPLOYER_MNEMONIC="…" NETWORK=mainnet FEE_WALLET=<addr> BUNDLE_FEE_BPS=0 npm run deploy:bundler
 */
import { Address, fromNano, toNano } from "@ton/core";
import { BitpadBundler } from "../contracts/build/BitpadBundler_BitpadBundler";
import { deployer, env } from "./lib";

(async () => {
  const d = await deployer();
  const feeWallet = Address.parse(env("FEE_WALLET", d.address.toString()));
  const feeBps = BigInt(env("BUNDLE_FEE_BPS", "0"));
  const bundler = await BitpadBundler.fromInit(d.address, feeWallet, feeBps);
  console.log(`Network   ${d.network}   deployer ${d.fmt(d.address)} (${fromNano(await d.balance())} TON)`);
  console.log(`Bundler   ${d.fmt(bundler.address)}   fee ${Number(feeBps) / 100}%`);
  if (await d.client.isContractDeployed(bundler.address)) return console.log("Already deployed ✓");
  await d.send(bundler.address, toNano("0.1"), undefined, bundler.init!);
  if (await d.waitDeployed(bundler.address)) console.log(`Deployed ✓  ${d.fmt(bundler.address)}`);
})().catch((e) => { console.error(e.message ?? e); process.exit(1); });
