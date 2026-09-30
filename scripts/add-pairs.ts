/**
 * Register every starter pair asset in one go.
 *
 *   npm run pairs:add              → dry run: resolves each asset and prints the plan
 *   SEND=1 npm run pairs:add       → registers the ones not registered yet
 *
 * Reads scripts/pairs.starter.json (or PAIRS_FILE=…). Each symbol is resolved
 * from STON.fi's asset list (verified, non-blacklisted, most popular match);
 * pin an exact jetton with "master". Uses FACTORY, DEPLOYER_MNEMONIC and
 * NETWORK from .env.deploy (FACTORY defaults to FACTORY_ADDRESS in config.ts).
 * Already-registered assets are skipped, so it's safe to re-run.
 */
import { readFileSync } from "node:fs";
import { Address, beginCell, toNano } from "@ton/core";
import { StonApiClient } from "@ston-fi/api";
import { BitpadFactory, storeAddPair } from "../contracts/build/BitpadFactory_BitpadFactory";
import { FACTORY_ADDRESS } from "../src/lib/config";
import { deployer, env } from "./lib";

const KINDS: Record<string, bigint> = { native: 0n, stable: 1n, jetton: 2n, stock: 3n, commodity: 4n, crypto: 5n, creator: 6n };
interface Row { symbol: string; kind: string; master?: string; minUsd?: number }

(async () => {
  const file = env("PAIRS_FILE", "scripts/pairs.starter.json");
  const rows: Row[] = JSON.parse(readFileSync(file, "utf8")).pairs;
  const d = await deployer();
  const factory = d.reader.open(BitpadFactory.fromAddress(Address.parse(env("FACTORY", FACTORY_ADDRESS))));
  const assets = await new StonApiClient().getAssets();
  const bad = new Set(["asset:blacklisted", "asset:deprecated", "asset:fake", "asset:honeypot", "asset:suspicious", "asset:dmca_complaint"]);
  const safe = assets.filter((a) => !a.blacklisted && !a.deprecated && !a.tags.some((t) => bad.has(t)));

  const plan: { row: Row; master: Address; decimals: number; name: string; minUnits: bigint; registered: boolean }[] = [];
  for (const row of rows) {
    if (KINDS[row.kind] === undefined) throw new Error(`${row.symbol}: bad kind ${row.kind}`);
    const hit = row.master
      ? assets.find((a) => Address.parse(a.contractAddress).equals(Address.parse(row.master!)))
      : safe.filter((a) => a.symbol.toLowerCase() === row.symbol.toLowerCase()).sort((a, b) => Number(b.defaultSymbol) - Number(a.defaultSymbol) || (b.popularityIndex ?? 0) - (a.popularityIndex ?? 0))[0];
    if (!hit && !row.master) {
      console.log(`  ✗ ${row.symbol.padEnd(7)} not found on STON.fi — pin it with "master" in ${file}`);
      continue;
    }
    const master = Address.parse(row.master ?? hit!.contractAddress);
    const decimals = hit?.decimals ?? 9;
    const px = hit?.dexPriceUsd ? Number(hit.dexPriceUsd) : null;
    const minUnits = px && row.minUsd ? BigInt(Math.ceil((row.minUsd / px) * 10 ** decimals)) : 0n;
    const existing = await factory.getPair(master).catch(() => null);
    plan.push({ row, master, decimals, name: hit?.displayName ?? row.symbol, minUnits, registered: !!existing?.wallet });
  }

  console.log(`\nFactory ${d.fmt(factory.address)} · ${d.network}\n`);
  for (const p of plan) {
    const min = p.minUnits ? `min ${(Number(p.minUnits) / 10 ** p.decimals).toPrecision(3)} ${p.row.symbol}` : "no minimum";
    console.log(`  ${p.registered ? "✓" : "+"} ${p.row.symbol.padEnd(7)} ${p.row.kind.padEnd(9)} ${d.fmt(p.master)}  ${p.decimals} dec · ${min}  ${p.name}`);
  }
  const todo = plan.filter((p) => !p.registered);
  console.log(`\n${plan.length - todo.length} already registered, ${todo.length} to add (≈ ${(todo.length * 0.15).toFixed(2)} TON).`);
  if (!todo.length) return;
  if (process.env.SEND !== "1") return console.log("Dry run. Check the addresses above, then run again with SEND=1.");

  for (const p of todo) {
    const body = beginCell().store(storeAddPair({
      $$type: "AddPair",
      master: p.master,
      info: { $$type: "PairInfo", symbol: p.row.symbol, decimals: BigInt(p.decimals), kind: KINDS[p.row.kind], pythFeedId: 0n, minLiquidity: p.minUnits, wallet: null, enabled: true },
    })).endCell();
    await d.send(factory.address, toNano("0.15"), body);
    console.log(`  sent ${p.row.symbol}`);
  }
  console.log("\nWaiting for wallet discovery…");
  await new Promise((r) => setTimeout(r, 15_000));
  for (const p of todo) {
    const info = await factory.getPair(p.master).catch(() => null);
    console.log(`  ${info?.wallet ? "✓" : "…"} ${p.row.symbol}${info?.wallet ? "" : " (still pending — check with npm run status)"}`);
  }
})().catch((e) => { console.error(e.message ?? e); process.exit(1); });
