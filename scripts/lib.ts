import { mnemonicToPrivateKey } from "@ton/crypto";
import { TonClient, TonClient4, WalletContractV4, WalletContractV5R1, internal, SendMode, type Cell, type StateInit, type Address } from "@ton/ton";

import { existsSync, readFileSync } from "node:fs";
import { readOnlyOpener, runGetV3 } from "../src/lib/ton/v3-get";

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
export async function deployer(mnemonicVar = "DEPLOYER_MNEMONIC") {
  const words = process.env[mnemonicVar]?.trim().split(/\s+/);
  if (!words || words.length < 12) throw new Error(`Set ${mnemonicVar} (24 words)`);
  const network = process.env.NETWORK === "mainnet" ? "mainnet" : "testnet";
  const client = new TonClient({
    endpoint: network === "mainnet" ? "https://toncenter.com/api/v2/jsonRPC" : "https://testnet.toncenter.com/api/v2/jsonRPC",
    apiKey: process.env.TONCENTER_API_KEY,
  });
  const reader = makeReader(network);
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

/**
 * Read-only contract opener for getters: toncenter v3 first (typed stacks, uses
 * TONCENTER_API_KEY), then tonhub v4. Not v2: @ton/ton's v2 parser mangles
 * tuples ("Not a cell: -1").
 */
export function makeReader(network: "mainnet" | "testnet") {
  const v4 = new TonClient4({ endpoint: network === "mainnet" ? "https://mainnet-v4.tonhubapi.com" : "https://sandbox-v4.tonhubapi.com", timeout: 15_000 });
  return readOnlyOpener(async (address, method, args) => {
    try {
      return await runGetV3({ network, apiKey: process.env.TONCENTER_API_KEY }, address, method, args);
    } catch (e) {
      if (/exited with/.test((e as Error).message)) throw e;
      try {
        const last = await v4.getLastBlock();
        return (await v4.runMethod(last.last.seqno, address, method, args)).reader;
      } catch (e4) {
        throw new Error(`Couldn't read ${method}: ${(e as Error).message} · tonhub v4: ${(e4 as Error).message}. Set TONCENTER_API_KEY in .env.deploy (free from @tonapibot on Telegram).`);
      }
    }
  });
}
