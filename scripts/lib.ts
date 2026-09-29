import { mnemonicToPrivateKey } from "@ton/crypto";
import { TonClient, TonClient4, WalletContractV4, WalletContractV5R1, internal, SendMode, type Cell, type StateInit, type Address } from "@ton/ton";

import { existsSync, readFileSync } from "node:fs";

/**
 * Load settings from .env.deploy (gitignored) so the same commands work in any
 * terminal — PowerShell, cmd, bash, zsh. Real environment variables win.
 */
(function loadDeployEnv() {
  const file = ".env.deploy";
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    const v = m[2].replace(/^(['"])(.*)\1$/, "$2").trim();
    if (v) process.env[m[1]] = v; // empty = unset, so defaults apply
  }
})();

/** Shared deploy helpers: network client + deployer wallet from env. */
export async function deployer() {
  const words = process.env.DEPLOYER_MNEMONIC?.trim().split(/\s+/);
  if (!words || words.length < 12) throw new Error("Set DEPLOYER_MNEMONIC (24 words)");
  const network = process.env.NETWORK === "mainnet" ? "mainnet" : "testnet";
  const client = new TonClient({
    endpoint: network === "mainnet" ? "https://toncenter.com/api/v2/jsonRPC" : "https://testnet.toncenter.com/api/v2/jsonRPC",
    apiKey: process.env.TONCENTER_API_KEY,
  });
  // Getter reads go through the v4 API: @ton/ton's toncenter-v2 parser mangles
  // tuple results (e.g. "Not a cell: -1" from the factory's pair() getter).
  const reader = new TonClient4({ endpoint: network === "mainnet" ? "https://mainnet-v4.tonhubapi.com" : "https://sandbox-v4.tonhubapi.com", timeout: 15_000 });
  const key = await mnemonicToPrivateKey(words);
  const wallet = process.env.WALLET_VERSION === "v4"
    ? WalletContractV4.create({ workchain: 0, publicKey: key.publicKey })
    : WalletContractV5R1.create({ workchain: 0, publicKey: key.publicKey, walletId: { networkGlobalId: network === "mainnet" ? -239 : -3 } });
  const w = client.open(wallet);
  const fmt = (a: Address) => a.toString({ testOnly: network === "testnet" });

  async function send(to: Address, value: bigint, body?: Cell, init?: StateInit) {
    const seqno = await w.getSeqno();
    await w.sendTransfer({ seqno, secretKey: key.secretKey, sendMode: SendMode.PAY_GAS_SEPARATELY | SendMode.IGNORE_ERRORS, messages: [internal({ to, value, bounce: !init, init, body })] });
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 2500));
      if ((await w.getSeqno()) > seqno) return;
    }
    throw new Error("Transaction not confirmed in time");
  }

  async function waitDeployed(addr: Address) {
    for (let i = 0; i < 40; i++) {
      if (await client.isContractDeployed(addr)) return true;
      await new Promise((r) => setTimeout(r, 3000));
    }
    return false;
  }

  return { client, reader, network, wallet, address: wallet.address, balance: () => w.getBalance(), send, waitDeployed, fmt };
}

export const env = (k: string, fallback?: string) => {
  const v = process.env[k] ?? fallback;
  if (v === undefined) throw new Error(`Set ${k}`);
  return v;
};
