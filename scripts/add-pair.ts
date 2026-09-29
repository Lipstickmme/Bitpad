/**
 * Register a jetton that tokens can be paired with.
 *
 *   DEPLOYER_MNEMONIC="…" NETWORK=mainnet FACTORY=<factory addr> \
 *   MASTER=<jetton master> SYMBOL=USDT DECIMALS=6 KIND=stable MIN_LIQUIDITY=100 \
 *   PYTH_FEED=<feed id from https://www.pyth.network/developers/price-feed-ids> \
 *   npm run pair:add
 *
 * KIND: stable | jetton | stock | commodity | crypto. MIN_LIQUIDITY is in whole units.
 * PYTH_FEED (optional) is the Pyth price-feed id for the asset's USD price.
 */
import { Address, toNano } from "@ton/core";
import { BitpadFactory, storeAddPair } from "../contracts/build/BitpadFactory_BitpadFactory";
import { beginCell } from "@ton/core";
import { deployer, env } from "./lib";

const KINDS: Record<string, bigint> = { native: 0n, stable: 1n, jetton: 2n, stock: 3n, commodity: 4n, crypto: 5n };

(async () => {
  const d = await deployer();
  const factory = d.reader.open(BitpadFactory.fromAddress(Address.parse(env("FACTORY"))));
  const master = Address.parse(env("MASTER"));
  const existing = await factory.getPair(master);
  if (existing?.wallet) {
    console.log(`${existing.symbol} is already registered ✓  (enabled: ${existing.enabled}, decimals: ${existing.decimals}, factory wallet ${d.fmt(existing.wallet)})`);
    return;
  }
  const decimals = BigInt(env("DECIMALS", "9"));
  const kind = KINDS[env("KIND", "jetton")];
  if (kind === undefined) throw new Error("KIND must be one of " + Object.keys(KINDS).join(", "));
  const body = beginCell().store(storeAddPair({
    $$type: "AddPair",
    master,
    info: {
      $$type: "PairInfo",
      symbol: env("SYMBOL"),
      decimals,
      kind,
      pythFeedId: BigInt(env("PYTH_FEED", "0")),
      minLiquidity: BigInt(Math.round(Number(env("MIN_LIQUIDITY", "0")) * 10 ** Number(decimals))),
      wallet: null,
      enabled: true,
    },
  })).endCell();
  await d.send(factory.address, toNano("0.15"), body);
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const info = await factory.getPair(master);
    if (info?.wallet) return console.log(`Registered ${info.symbol} ✓  factory wallet ${d.fmt(info.wallet)}`);
  }
  console.log("Sent — wallet discovery still pending; re-check with the factory's pair() getter.");
})().catch((e) => { console.error(e.message ?? e); process.exit(1); });
