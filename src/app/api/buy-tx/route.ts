import { NextResponse, type NextRequest } from "next/server";
import { Address } from "@ton/core";
import { getToken } from "@/lib/market";
import { quoteBuy } from "@/lib/routing";
import { buildBuyTx } from "@/lib/ton/swap";
import { buildDedustBuyTx } from "@/lib/ton/dedust";
import { TON_ASSETS } from "@/lib/config";
import { coin, payKey } from "@/lib/coin";
import { toNano } from "@ton/core";
import { readPool } from "@/lib/bitpad";
import { minOutFor, quoteBuy as quoteBits } from "@/lib/bitpad-math";
import { buildPoolBuyTx } from "@/lib/ton/launch";

export const dynamic = "force-dynamic";

const addr = (s: string | null) => {
  try {
    return s ? Address.parse(s).toString() : null;
  } catch {
    return null;
  }
};

/**
 * Quote + unsigned buy transaction in one server round trip. Building on the
 * server uses the keyed toncenter connection, so the wallet opens in about a
 * second instead of waiting on several rate-limited RPC calls from the browser.
 * Nothing here signs or holds funds: the user's wallet still has to approve.
 */
const fmtAmt = (n: number) => (n >= 100 ? n.toFixed(0) : n >= 1 ? n.toFixed(2) : n.toPrecision(3));

/** Hard cap on TON an Omniston-built transaction may send beyond the amount being swapped (gas). */
const OMNI_GAS_CAP = 1_500_000_000n;

async function buildViaOmniston(candidates: { info: { symbol: string; address: string; decimals: number }; amount: number }[], token: string, wallet: string, slippagePct: number) {
  const { omniBuild, NoQuote } = await import("@/lib/ton/omniston");
  for (const c of candidates) {
    const units = BigInt(Math.floor(c.amount * 10 ** c.info.decimals));
    let r;
    try {
      r = await omniBuild(c.info.address, token, units, wallet, slippagePct);
    } catch (e) {
      if (e instanceof NoQuote) continue; // try the next currency
      throw e; // can't reach Omniston, or it failed to build the swap
    }
    // Never pass on a transaction that would send more TON than the swap plus gas
    const tonOut = r.messages.reduce((s, m) => s + BigInt(m.amount), 0n);
    const allowed = (c.info.address === TON_ASSETS.TON ? units : 0n) + OMNI_GAS_CAP;
    if (tonOut > allowed) throw new Error("The aggregator's transaction asked for more TON than this buy needs, so it was not sent");
    return { messages: r.messages, via: `STON.fi Omniston · ${r.q.resolver}${r.q.feeWaived ? " (no Bitpad fee)" : ""}`, spent: `${c.amount} ${coin(c.info.symbol)}`, switchedFrom: null };
  }
  return null;
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const wallet = addr(q.get("wallet"));
  if (!wallet) return NextResponse.json({ error: "Connect a TON wallet first" }, { status: 400 });
  const amount = Number(q.get("amount") ?? 0);
  if (!(amount > 0) || amount > 1e9) return NextResponse.json({ error: "Enter an amount" }, { status: 400 });
  const slippage = Math.min(Math.max(Number(q.get("slippage") ?? 1), 0.1), 50) / 100;
  const referrer = addr(q.get("ref"));
  const want = q.get("route");

  const token = await getToken(q.get("token") ?? "");
  if (!token) return NextResponse.json({ error: "Unknown token" }, { status: 404 });
  const pay = payKey(q.get("pay") ?? "TON"); // GRAM = native coin
  try {
    // Bitpad creator jettons: buy straight from their pool (GRAM-paired)
    if (token.bitpad?.pool) {
      if (token.bitpad.pairMaster) return NextResponse.json({ error: "This creator jetton is backed by a jetton, not GRAM. Buy it from its page with that jetton." }, { status: 409 });
      if (pay !== "TON") return NextResponse.json({ error: "Creator jetton pools are paid in GRAM." }, { status: 400 });
      const pool = await readPool(token.bitpad.pool);
      if (!pool.tradingOpen) return NextResponse.json({ error: "This pool isn't open for trading yet." }, { status: 409 });
      const inU = toNano(amount.toFixed(9));
      const qb = quoteBits({ reserveToken: BigInt(pool.reserveToken), reservePair: BigInt(pool.reservePair), protocolFeeBps: BigInt(pool.protocolFeeBps), creatorFeeBps: BigInt(pool.creatorFeeBps) }, inU);
      if (qb.out <= 0n) return NextResponse.json({ error: "Amount too small for this pool." }, { status: 400 });
      const msg = buildPoolBuyTx(pool.address, inU, minOutFor(qb.out, slippage * 100), pool.creator, wallet); // pools only accept their own registered links: `ref` here is the general referrer, so the creator's link is used
      return NextResponse.json({ messages: [msg], via: "Bitpad pool", spent: `${amount} GRAM`, expectedOut: qb.out.toString(), switchedFrom: null });
    }
    // Pools first; Omniston is quoted and built in one go below (one connection instead of two)
    const d = await quoteBuy(token, pay, amount, { omniston: false });
    const routes = d.routes.filter((r) => r.kind === "onchain");
    if (!routes.length && d.candidates) {
      const built = await buildViaOmniston(d.candidates, token.address, wallet, slippage * 100);
      if (built) return NextResponse.json(built);
      // Most likely too small: offer the smallest size a market maker will take (the user approves it)
      const { omnistonMinimum } = await import("@/lib/routing");
      const { isStockAsset } = await import("@/lib/routing");
      const minimum = (await isStockAsset(token.address)) ? await omnistonMinimum(token, d.candidates).catch(() => null) : null;
      if (minimum) return NextResponse.json({ error: `Too small for the market makers right now. The smallest buy they'll quote is ${fmtAmt(minimum.amount)} ${coin(minimum.asset)}${minimum.usd ? ` (~$${minimum.usd.toFixed(0)})` : ""}.`, minimum }, { status: 422 });
      return NextResponse.json({ error: `No live route: ${[...d.errors, "Omniston: no route or quote"].join(" · ")}` }, { status: 404 });
    }
    const best = routes.find((r) => r.id === want) ?? routes.find((r) => r.best) ?? routes[0];
    if (!best || !d.pay) return NextResponse.json({ error: d.errors.length ? `No live route: ${d.errors.join(" · ")}` : "No live route for this token" }, { status: 404 });
    const note = d.switchedFrom ? ` (no ${d.switchedFrom} pool for this token)` : "";
    const messages =
      best.id === "dedust"
        ? await buildDedustBuyTx({ wallet, token: token.address, tonAmount: best.payAmount, slippage, referrer })
        : (await buildBuyTx({ wallet, jetton: token.address, amount: best.payAmount, payWith: best.payAsset as "TON" | "USDT" | "GRAM", payAsset: { address: d.pay.address, decimals: d.pay.decimals }, slippage, referrer })).messages;
    return NextResponse.json({ messages, via: best.venue, spent: `${best.payAmount} ${coin(best.payAsset)}${note}`, switchedFrom: d.switchedFrom ?? null });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Couldn't build the swap" }, { status: 502 });
  }
}
