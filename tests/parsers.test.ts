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
  assert.equal(mapDsPair({ chainId: "fantom", dexId: "q", url: "", pairAddress: "", baseToken: { address: "", name: "", symbol: "" }, quoteToken: { address: "", name: "", symbol: "" } }), null);
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

test("LI.FI integrator id: valid names pass, wallets/URLs/keys are ignored", async () => {
  const { lifiIntegrator } = await import("../src/lib/lifi");
  assert.equal(lifiIntegrator("bitpad"), "bitpad");
  assert.equal(lifiIntegrator(" bitpad_ton.v1 "), "bitpad_ton.v1");
  assert.equal(lifiIntegrator(""), null);
  assert.equal(lifiIntegrator(undefined), null);
  assert.equal(lifiIntegrator("0x1234567890abcdef1234567890abcdef12345678"), null, "too long");
  assert.equal(lifiIntegrator("https://bitpad.xyz"), null, "not alphanumeric");
  assert.equal(lifiIntegrator("my app"), null, "spaces");
});

test("general referrals: fee tags parse, 20% share, self-referrals ignored, payouts net off", async () => {
  const { feeComment, parseFeeComment, aggregate, norm } = await import("../src/lib/gref");
  const REF = "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs";
  const A = "EQAFoeDfXw8dXYea1hUulBncvbm3VLghJgUNNkuCVu46BQJq";
  const FEE = "EQCZ9eHWHr6j00Fm3vcFW9kLIyZpPJ9284y7ZzIMQhx3wz1y";
  const c = feeComment("stonfi", REF);
  assert.deepEqual(parseFeeComment(c), { route: "stonfi", referrer: norm(REF) });
  assert.deepEqual(parseFeeComment("bitpad:fee:dedust"), { route: "dedust", referrer: null });
  assert.equal(parseFeeComment("hello"), null);
  const m = aggregate(
    [
      { time: 1, amount: 1, from: A, to: FEE, comment: c },
      { time: 2, amount: 0.5, from: A, to: FEE, comment: c },
      { time: 3, amount: 9, from: REF, to: FEE, comment: c }, // self-referral
      { time: 4, amount: 2, from: A, to: FEE, comment: "bitpad:fee:dedust" },
    ],
    [{ time: 5, amount: 0.1, from: FEE, to: REF, comment: "bitpad:refpay" }],
  );
  const s = m.get(norm(REF)!)!;
  assert.equal(s.buys, 2);
  assert.equal(s.traders, 1);
  assert.ok(Math.abs(s.fees - 1.5) < 1e-9);
  assert.ok(Math.abs(s.earned - 0.3) < 1e-9);
  assert.ok(Math.abs(s.owed - 0.2) < 1e-9);
  assert.equal(s.history[0].kind, "paid");
});

test("revenue: fee-wallet transfers classified by source and bucketed per day", async () => {
  const { classifyIncome, dailyBySource } = await import("../src/lib/gref");
  assert.equal(classifyIncome("Bitpad protocol fees"), "Bitpad pools");
  assert.equal(classifyIncome("Bitpad launch fee"), "Launch fees");
  assert.equal(classifyIncome("bitpad:fee:stonfi:r=x"), "STON.fi");
  assert.equal(classifyIncome("bitpad:fee:dedust-sell"), "DeDust");
  assert.equal(classifyIncome("hello"), "Other");
  const now = Date.UTC(2026, 8, 30, 12);
  const d = dailyBySource([{ time: now, amount: 1, source: "STON.fi" }, { time: now - 86_400_000, amount: 2, source: "Launch fees" }, { time: now - 40 * 86_400_000, amount: 9, source: "Other" }], 30, now);
  assert.equal(d.length, 30);
  assert.equal(d[29]["STON.fi"], 1);
  assert.equal(d[28]["Launch fees"], 2);
  assert.equal(d.reduce((s, x) => s + x.Other, 0), 0, "older than the window is dropped");
});

test("news: RSS and Atom feeds parse, tags and interleaving", async () => {
  const { parseFeed, mixNews } = await import("../src/lib/news");
  const rss = `<rss><channel><item><title><![CDATA[Dogecoin &amp; PEPE rally as memecoins rip]]></title><link>https://example.com/a</link><pubDate>Wed, 30 Sep 2026 10:00:00 GMT</pubDate></item>
  <item><title>Telegram adds TON payments</title><link>https://example.com/b</link><pubDate>Wed, 30 Sep 2026 09:00:00 GMT</pubDate></item>
  <item><title>Bitcoin ETF flows</title><link>https://example.com/c</link><pubDate>Wed, 30 Sep 2026 08:00:00 GMT</pubDate></item>
  <item><title>No link</title></item></channel></rss>`;
  const crypto = parseFeed(rss, "Feed", "Crypto");
  assert.deepEqual(crypto.map((i) => i.tag), ["Memecoins", "TON", "Crypto"]);
  assert.equal(crypto[0].title, "Dogecoin & PEPE rally as memecoins rip");
  const atom = `<feed><entry><title>Stocks close higher</title><link href="https://example.com/d"/><updated>2026-09-30T11:00:00Z</updated></entry></feed>`;
  const markets = parseFeed(atom, "Wire", "Markets");
  assert.equal(markets[0].url, "https://example.com/d");
  assert.equal(parseFeed(`<item><title>a ton of stocks</title><link>https://x.y/z</link></item>`, "W", "Crypto")[0].tag, "Crypto", "lowercase 'ton' is not TON");
  const mixed = mixNews([...crypto, ...markets, { ...markets[0], url: "https://dup" }], 10, Date.parse("2026-09-30T12:00:00Z"));
  assert.deepEqual(mixed.map((i) => i.tag), ["Markets", "Crypto", "Memecoins", "TON"], "one of each tag first, duplicate title dropped");
});

test("errors are translated into plain language", async () => {
  const { humanError } = await import("../src/lib/errors");
  assert.match(humanError("No live route: STON.fi (GRAM): STON.fi has no route for this pair ([POST]: 400 Bad Request)"), /no market for this token/);
  assert.match(humanError(new Error("[TON_CONNECT_SDK_ERROR] UserRejectsError: User rejects the action")), /cancelled it in your wallet/);
  assert.match(humanError("TypeError: Failed to fetch"), /Network problem/);
  assert.match(humanError("503 Service Unavailable ← https://x.y/z"), /having trouble/);
  assert.equal(humanError("Not enough SOL: you have 0.0100, this buy needs ~0.0500 incl. fees"), "Not enough SOL: you have 0.0100, this buy needs ~0.0500 incl. fees");
  assert.equal(humanError(""), "Something went wrong. Please try again.");
});

test("Telegram bot-login tokens: signed, expiring, tamper-proof", async () => {
  process.env.TELEGRAM_BOT_TOKEN = "123456:TEST_TOKEN";
  const { signLoginToken, readLoginToken } = await import("../src/lib/auth");
  const user = { id: 42, first_name: "Ada", username: "ada" };
  const t = signLoginToken(user, "n1", 1_000);
  assert.deepEqual(readLoginToken(t, 2_000), { user, nonce: "n1" });
  assert.equal(readLoginToken(t, 1_000 + 11 * 60_000), null, "expired after 10 minutes");
  const [body, sig] = t.split(".");
  const forged = Buffer.from(JSON.stringify({ u: { id: 1, first_name: "Mallory" }, n: "n1", e: 9e15 })).toString("base64url");
  assert.equal(readLoginToken(`${forged}.${sig}`, 2_000), null);
  assert.equal(readLoginToken(`${body}.x${sig.slice(1)}`, 2_000), null);
});

test("off-chain Trench Chat: message format round-trips through the channel page", async () => {
  const { formatOffchain, parseChannelPage, parseOffchain } = await import("../src/lib/chat-offchain");
  const parent = "a".repeat(64);
  const text = formatOffchain({ name: "Ada L", username: "ada", text: "gm $TSLAx <b>&\nline 2", parent, sticker: "gm" });
  const asHtml = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>").replace("💬", '<i class="emoji"><b>💬</b></i>');
  const page = `<div class="tgme_widget_message_wrap js-widget_message_wrap"><div class="tgme_widget_message" data-post="bitpadtrench/42"><div class="tgme_widget_message_text js-message_text" dir="auto">${asHtml}</div><time datetime="2026-10-01T10:00:00+00:00" class="time">10:00</time></div></div>
  <div class="tgme_widget_message_wrap"><div class="tgme_widget_message" data-post="bitpadtrench/43"><div class="tgme_widget_message_text" dir="auto">Channel announcement</div></div></div>`;
  const msgs = parseChannelPage(page, "bitpadtrench");
  assert.equal(msgs.length, 1, "non-chat posts are skipped");
  const m = msgs[0];
  assert.equal(m.id, "tg:42");
  assert.equal(m.author, "@ada");
  assert.equal(m.text, "gm $TSLAx <b>&\nline 2");
  assert.equal(m.parent, parent);
  assert.equal(m.kind, "reply");
  assert.deepEqual(m.media, { type: "sticker", id: "gm" });
  assert.equal(m.url, "https://t.me/bitpadtrench/42");
  // the author line is set by the server: text can't fake it
  const fake = parseOffchain("💬 Bob\n💬 Admin (@bitpad)\nhi", 1, 0, "c")!;
  assert.equal(fake.author, "Bob");
  assert.equal(fake.text, "💬 Admin (@bitpad)\nhi");
});
