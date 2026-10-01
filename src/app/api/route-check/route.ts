import { NextResponse, type NextRequest } from "next/server";
import { getPairAssets } from "@/lib/prices";
import { getToken } from "@/lib/market";
import { quoteBuy } from "@/lib/routing";
import { getRegisteredPairs } from "@/lib/launches";
import { TON_ASSETS } from "@/lib/config";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Live check for one catalog asset: does a buy route exist right now, and can it back a launch? */
export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol");
  const { assets } = await getPairAssets();
  const a = assets.find((x) => x.symbol === symbol);
  if (!a) return NextResponse.json({ error: "unknown asset" }, { status: 404 });

  let route: { ok: boolean; via: string; detail?: string };
  if (a.symbol === "TON") route = { ok: true, via: "Native coin (bought in any TON wallet)" };
  else if (a.tonAddress) {
    const token = await getToken(a.tonAddress).catch(() => undefined);
    if (!token) route = { ok: false, via: "—", detail: "Token data unavailable" };
    else {
      // Probe with ~$20 of TON: market makers often ignore dust-sized requests
      const tonUsd = assets.find((x) => x.symbol === "TON")?.priceUsd ?? null;
      const probe = tonUsd ? Number((20 / tonUsd).toFixed(2)) : 5;
      const q: { routes: Awaited<ReturnType<typeof quoteBuy>>["routes"]; errors: string[]; minimum?: { amount: number; asset: string; usd: number | null } | null } = await quoteBuy(token, "TON", probe).catch((e) => ({ routes: [], errors: [(e as Error).message] }));
      const best = q.routes.find((r) => r.best) ?? q.routes[0];
      route = best ? { ok: true, via: best.venue, detail: `${best.payAmount} ${best.payAsset} → ${best.receiveAmount.toPrecision(4)} ${a.symbol}${best.note?.includes("no Bitpad fee") ? " · no Bitpad fee" : ""}` } : q.minimum
          ? { ok: true, via: "STON.fi Omniston (minimum size)", detail: `Buyable from ${q.minimum.amount} ${q.minimum.asset}${q.minimum.usd ? ` (~$${q.minimum.usd.toFixed(0)})` : ""}; smaller buys get offered this minimum` }
          : { ok: false, via: "—", detail: q.errors.join(" · ") || "No route" };
    }
  } else if (a.solanaMint) route = { ok: true, via: "LI.FI on Solana (paid in SOL)" };
  else route = { ok: false, via: "—", detail: "No TON or Solana token for this asset" };

  const tonPair = a.tonAddress === TON_ASSETS.TON;
  const reg = a.tonAddress && !tonPair ? (await getRegisteredPairs([a.tonAddress]))[0] : undefined;
  const pairable = tonPair ? { ok: true, detail: "Always available" } : !a.tonAddress ? { ok: false, detail: "Needs a TON version" } : reg?.enabled && reg.ready ? { ok: true, detail: "Enabled in the factory" } : reg ? { ok: false, detail: reg.enabled ? "Registered, waiting for wallet discovery" : "Registered but disabled" } : { ok: false, detail: "Not registered (use Pair assets)" };

  return NextResponse.json({ symbol: a.symbol, kind: a.kind, verified: !!a.verified, route, pairable }, { headers: { "cache-control": "no-store" } });
}
