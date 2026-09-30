import { NextResponse, type NextRequest } from "next/server";
import { Address } from "@ton/core";
import { getToken } from "@/lib/market";
import { quoteBuy } from "@/lib/routing";
import { buildBuyTx } from "@/lib/ton/swap";
import { buildDedustBuyTx } from "@/lib/ton/dedust";

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
    const d = await quoteBuy(token, q.get("pay") ?? "TON", amount);
    const routes = d.routes.filter((r) => r.kind === "onchain");
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
