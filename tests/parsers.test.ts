import "./stub-server-only";
import { test } from "node:test";
import assert from "node:assert/strict";
import { beginCell } from "@ton/core";
import { mapPools, quoteKind } from "../src/lib/data/gecko";
import { mapDsPair } from "../src/lib/data/dexscreener";
import { parseYahoo } from "../src/lib/data/yahoo";

test("GeckoTerminal pools map with included token metadata", () => {
  const rows = mapPools({
    data: [{
      id: "ton_EQpool", type: "pool",
      attributes: {
        name: "GRAM / TON", address: "EQpool", base_token_price_usd: "0.0031", quote_token_price_usd: "2.9", fdv_usd: "15500000", market_cap_usd: null,
        reserve_in_usd: "820000", pool_created_at: "2025-01-02T00:00:00Z",
        price_change_percentage: { m5: "0.1", h1: "-1.2", h6: "3", h24: "12.5" },
        transactions: { h24: { buys: 900, sells: 700 } }, volume_usd: { h24: "1200000" },
      },
      relationships: { dex: { data: { id: "stonfi_v2" } }, base_token: { data: { id: "ton_EQgram" } }, quote_token: { data: { id: "ton_EQton" } } },
    }],
    included: [
      { id: "ton_EQgram", type: "token", attributes: { address: "EQgram", name: "Gram", symbol: "GRAM", image_url: "https://img/gram.png" } },
      { id: "ton_EQton", type: "token", attributes: { address: "EQton", name: "TON", symbol: "TON", image_url: "missing.png" } },
    ],
  }, "ton");
  assert.equal(rows.length, 1);
  const r = rows[0];
  assert.equal(r.base, "GRAM");
  assert.equal(r.baseAddress, "EQgram");
  assert.equal(r.baseImage, "https://img/gram.png");
  assert.equal(r.quoteAddress, "EQton");
  assert.equal(r.quoteKind, "ton");
  assert.equal(r.change24h, 12.5);
  assert.equal(r.buys24h, 900);
  assert.equal(r.marketCap, null);
  assert.equal(r.dexId, "stonfi_v2");
});

test("quote kinds", () => {
  assert.equal(quoteKind("USD₮"), "stable");
  assert.equal(quoteKind("WETH"), "eth");
  assert.equal(quoteKind("SPYx"), "stock");
  assert.equal(quoteKind("NOT"), "other");
});

test("DexScreener pairs map to pool rows and ignore unknown chains", () => {
  const row = mapDsPair({
    chainId: "ton", dexId: "dedust", url: "https://dexscreener.com/ton/x", pairAddress: "EQpair",
    baseToken: { address: "EQa", name: "Alpha", symbol: "ALP" }, quoteToken: { address: "EQt", name: "TON", symbol: "TON" },
    priceUsd: "0.5", priceChange: { h1: 2, h24: -4 }, txns: { h24: { buys: 10, sells: 5 } }, volume: { h24: 1000 }, liquidity: { usd: 5000 }, fdv: 50000, pairCreatedAt: Date.now() - 3_600_000,
  });
  assert.ok(row);
  assert.equal(row!.chain, "ton");
  assert.equal(row!.priceUsd, 0.5);
  assert.equal(row!.change24h, -4);
  assert.equal(Math.round(row!.ageHours), 1);
  assert.equal(mapDsPair({ chainId: "polygon", dexId: "q", url: "", pairAddress: "", baseToken: { address: "", name: "", symbol: "" }, quoteToken: { address: "", name: "", symbol: "" } }), null);
});

test("Yahoo chart parsing yields price, 24h change and trailing dividend yield", () => {
  const now = Math.floor(Date.now() / 1000);
  const q = parseYahoo({
    chart: {
      result: [{
        meta: { regularMarketPrice: 100 },
        indicators: { quote: [{ close: [95, null, 98, 100] }] },
        events: { dividends: {
          a: { amount: 0.5, date: now - 300 * 86400 },
          b: { amount: 0.5, date: now - 200 * 86400 },
          c: { amount: 0.5, date: now - 100 * 86400 },
          d: { amount: 0.5, date: now - 10 * 86400 },
          old: { amount: 9, date: now - 400 * 86400 },
        } },
      }],
    },
  });
  assert.ok(q);
  assert.equal(q!.price, 100);
  assert.ok(Math.abs(q!.change24h! - ((100 - 98) / 98) * 100) < 1e-9);
  assert.equal(q!.dividendYield, 2); // 4 × 0.5 over the last 12 months / 100
  assert.equal(q!.dividendsPerYear, 4);
  assert.equal(q!.lastDividend?.amount, 0.5);
  assert.equal(parseYahoo({ chart: { result: [] } }), null);
});

test("Bitpad on-chain content decodes the embedded metadata", async () => {
  const { decodeContent } = await import("../src/lib/launches");
  const meta = { name: "S&P Cat", symbol: "SPYCAT", bitpad_pair: "SPYx" };
  const uri = `https://bitpad.example/api/jetton/metadata?d=${Buffer.from(JSON.stringify(meta)).toString("base64url")}`;
  const cell = beginCell().storeUint(1, 8).storeStringTail(uri).endCell();
  assert.deepEqual(await decodeContent(cell), meta);
  assert.deepEqual(await decodeContent(beginCell().storeUint(0, 8).endCell()), {});
});

test("dividend estimate rolls forward by the usual interval; gap is TON vs oracle", async () => {
  const { nextDividend } = await import("../src/lib/prices");
  const { priceGap, usMarket } = await import("../src/lib/market-hours");
  const day = 86_400_000;
  const now = Date.UTC(2026, 8, 30);
  const next = nextDividend(now - 200 * day, 4, now); // quarterly, last paid 200 days ago
  assert.ok(next >= now - day && next < now + 92 * day);
  assert.equal(priceGap(101, 100), 1);
  assert.equal(priceGap(null, 100), null);
  assert.equal(usMarket(new Date("2026-09-30T15:00:00Z")).open, true); // Wed 11:00 New York
  assert.equal(usMarket(new Date("2026-10-03T15:00:00Z")).label, "Weekend");
});
