import { NextResponse, type NextRequest } from "next/server";
import { LIFI_CHAIN, quoteNativeBuy } from "@/lib/lifi";
import { getPairAssets } from "@/lib/prices";
import type { ChainId } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/xquote?chain=solana&token=<mint|0x…>&ton=1&from=<wallet>&slippage=1
 * Prices the quick-buy amount (in TON) in USD, then asks LI.FI for the best
 * native → token route on that chain. Returns a transaction ready to sign.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const chain = q.get("chain") as ChainId;
  const token = q.get("token") ?? "";
  const from = q.get("from") ?? "";
  const ton = Number(q.get("ton"));
  const slippage = Number(q.get("slippage") ?? 1) / 100;
  if (!LIFI_CHAIN[chain]) return NextResponse.json({ error: `Buying on ${chain} isn't supported yet` }, { status: 400 });
  if (!token || !from || !(ton > 0)) return NextResponse.json({ error: "token, from and ton are required" }, { status: 400 });
  const tonUsd = (await getPairAssets()).assets.find((a) => a.symbol === "TON")?.priceUsd;
  if (!tonUsd) return NextResponse.json({ error: "TON price unavailable — can't size the buy" }, { status: 503 });
  try {
    return NextResponse.json(await quoteNativeBuy(chain, token, ton * tonUsd, from, slippage));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
