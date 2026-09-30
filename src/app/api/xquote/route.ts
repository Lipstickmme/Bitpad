import { NextResponse, type NextRequest } from "next/server";
import { LIFI_CHAIN, quoteNativeBuy } from "@/lib/lifi";
import { getPairAssets } from "@/lib/prices";
import type { ChainId } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/xquote?chain=solana&token=<mint|0x…>&amount=1000&asset=GRAM&from=<wallet>&slippage=1
 * Prices the quick-buy amount (GRAM or TON) in USD, then asks LI.FI for the best
 * native → token route on that chain. Returns a transaction ready to sign.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const chain = q.get("chain") as ChainId;
  const token = q.get("token") ?? "";
  const from = q.get("from") ?? "";
  const asset = q.get("asset") === "TON" || q.get("ton") ? "TON" : "GRAM";
  const amount = Number(q.get("amount") ?? q.get("ton"));
  const slippage = Number(q.get("slippage") ?? 1) / 100;
  if (!LIFI_CHAIN[chain]) return NextResponse.json({ error: `Buying on ${chain} isn't supported yet` }, { status: 400 });
  if (!token || !from || !(amount > 0)) return NextResponse.json({ error: "token, from and amount are required" }, { status: 400 });
  const px = (await getPairAssets()).assets.find((a) => a.symbol === asset)?.priceUsd;
  if (!px) return NextResponse.json({ error: `${asset} price unavailable, so the buy can't be sized` }, { status: 503 });
  try {
    return NextResponse.json(await quoteNativeBuy(chain, token, amount * px, from, slippage));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
