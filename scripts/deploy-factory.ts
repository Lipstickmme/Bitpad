/**
 * Deploy BitpadFactory.
 *
 *   DEPLOYER_MNEMONIC="word1 … word24" \
 *   NETWORK=testnet FEE_WALLET=<ton address> LAUNCH_FEE_TON=1 \
 *   TONCENTER_API_KEY=<optional> \
 *   npm run deploy:factory
 *
 * The deployer wallet (W5 by default, or WALLET_VERSION=v4) becomes the factory owner.
 * Needs ~0.6 TON on the deployer. Prints the address to put in NEXT_PUBLIC_BITPAD_FACTORY.
 */
import { mnemonicToPrivateKey } from "@ton/crypto";
import { Address, TonClient, WalletContractV4, WalletContractV5R1, internal, toNano, SendMode } from "@ton/ton";
import { BitpadFactory } from "../contracts/build/BitpadFactory_BitpadFactory";

async function main() {
  const words = process.env.DEPLOYER_MNEMONIC?.trim().split(/\s+/);
  if (!words || words.length < 12) throw new Error("Set DEPLOYER_MNEMONIC");
  const network = process.env.NETWORK === "mainnet" ? "mainnet" : "testnet";
  const client = new TonClient({
    endpoint: network === "mainnet" ? "https://toncenter.com/api/v2/jsonRPC" : "https://testnet.toncenter.com/api/v2/jsonRPC",
    apiKey: process.env.TONCENTER_API_KEY,
  });

  const key = await mnemonicToPrivateKey(words);
  const wallet = process.env.WALLET_VERSION === "v4"
    ? WalletContractV4.create({ workchain: 0, publicKey: key.publicKey })
    : WalletContractV5R1.create({ workchain: 0, publicKey: key.publicKey, walletId: { networkGlobalId: network === "mainnet" ? -239 : -3 } });
  const w = client.open(wallet);
  const owner = wallet.address;
  const feeWallet = Address.parse(process.env.FEE_WALLET ?? owner.toString());
  const fee = toNano(process.env.LAUNCH_FEE_TON ?? "1");

  const factory = await BitpadFactory.fromInit(owner, feeWallet, fee);
  const addr = factory.address.toString({ testOnly: network === "testnet" });
  console.log(`Network:     ${network}`);
  console.log(`Deployer:    ${owner.toString({ testOnly: network === "testnet" })}  (${Number(await w.getBalance()) / 1e9} TON)`);
  console.log(`Fee wallet:  ${feeWallet.toString()}`);
  console.log(`Launch fee:  ${Number(fee) / 1e9} TON`);
  console.log(`Factory:     ${addr}`);

  if (await client.isContractDeployed(factory.address)) {
    console.log("Already deployed ✓");
    return;
  }
  const seqno = await w.getSeqno();
  await w.sendTransfer({
    seqno,
    secretKey: key.secretKey,
    sendMode: SendMode.PAY_GAS_SEPARATELY | SendMode.IGNORE_ERRORS,
    messages: [internal({ to: factory.address, value: toNano("0.5"), bounce: false, init: factory.init!, body: undefined })],
  });
  process.stdout.write("Waiting for deployment");
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    process.stdout.write(".");
    if (await client.isContractDeployed(factory.address)) {
      console.log(`\nDeployed ✓\n\nNEXT_PUBLIC_BITPAD_FACTORY=${addr}`);
      return;
    }
  }
  console.log("\nNot visible yet — check the address in an explorer.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
