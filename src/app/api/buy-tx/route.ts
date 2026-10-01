import { NextResponse, type NextRequest } from "next/server";
import { Address } from "@ton/core";
import { getToken } from "@/lib/market";
import { quoteBuy } from "@/lib/routing";
import { buildBuyTx } from "@/lib/ton/swap";
import { buildDedustBuyTx } from "@/lib/ton/dedust";
import { TON_ASSETS } from "@/lib/config";

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
    return { messages: r.messages, via: `STON.fi Omniston · ${r.q.resolver}${r.q.feeWaived ? " (no Bitpad fee)" : ""}`, spent: `${c.amount} ${c.info.symbol}`, switchedFrom: null };
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
  try {
    // Pools first; Omniston is quoted and built in one go below (one connection instead of two)
    const d = await quoteBuy(token, q.get("pay") ?? "TON", amount, { omniston: false });
    const routes = d.routes.filter((r) => r.kind === "onchain");
    if (!routes.length && d.candidates) {
      const built = await buildViaOmniston(d.candidates, token.address, wallet, slippage * 100);
      if (built) return NextResponse.json(built);
      // Most likely too small: offer the smallest size a market maker will take (the user approves it)
      const { omnistonMinimum } = await import("@/lib/routing");
      const minimum = await omnistonMinimum(token, d.candidates).catch(() => null);
      if (minimum) return NextResponse.json({ error: `Too small for the market makers right now. The smallest buy they'll quote is ${fmtAmt(minimum.amount)} ${minimum.asset}${minimum.usd ? ` (~$${minimum.usd.toFixed(0)})` : ""}.`, minimum }, { status: 422 });
      return NextResponse.json({ error: "No market maker is quoting this stock right now, at any size. Try again in a minute." }, { status: 404 });
    }
    const best = routes.find((r) => r.id === want) ?? routes.find((r) => r.best) ?? routes[0];
    if (!best || !d.pay) return NextResponse.json({ error: d.errors.length ? `No live route: ${d.errors.join(" · ")}` : "No live route for this token" }, { status: 404 });
    const note = d.switchedFrom ? ` (no ${d.switchedFrom} pool for this token)` : "";
    const messages =
      best.id === "dedust"
        ? await buildDedustBuyTx({ wallet, token: token.address, tonAmount: best.payAmount, slippage, referrer })
        : (await buildBuyTx({ wallet, jetton: token.address, amount: best.payAmount, payWith: best.payAsset as "TON" | "USDT" | "GRAM", payAsset: { address: d.pay.address, decimals: d.pay.decimals }, slippage, referrer })).messages;
    return NextResponse.json({ messages, via: best.venue, spent: `${best.payAmount} ${best.payAsset}${note}`, switchedFrom: d.switchedFrom ?? null });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Couldn't build the swap" }, { status: 502 });
  }
}
