import { NextResponse, type NextRequest } from "next/server";
import { Address } from "@ton/core";
import { getJson } from "@/lib/data/http";

export const dynamic = "force-dynamic";

const raw = (a: string) => {
  try {
    return Address.parse(a).toRawString();
  } catch {
    return null;
  }
};

/**
 * How much of one jetton each wallet holds (raw units), for bundle sells and
 * the bundle portfolio. toncenter v3 answers for all owners in one call;
 * TonAPI per owner is the fallback.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const jetton = raw(q.get("jetton") ?? "");
  const owners = (q.get("owners") ?? "").split(",").map((o) => o.trim()).filter(Boolean).slice(0, 60);
  const ownersRaw = owners.map(raw);
  if (!jetton || !owners.length || ownersRaw.some((o) => !o)) return NextResponse.json({ error: "jetton and owners are required" }, { status: 400 });

  const out: Record<string, string> = Object.fromEntries(owners.map((o) => [o, "0"]));
  const byRaw = new Map(owners.map((o, i) => [ownersRaw[i]!, o]));
  try {
    const qs = new URLSearchParams({ jetton_address: jetton, limit: "100" });
    for (const o of ownersRaw) qs.append("owner_address", o!);
    const key = process.env.TONCENTER_API_KEY;
    const r = await getJson<{ jetton_wallets: { owner: string; balance: string }[] }>(`https://toncenter.com/api/v3/jetton/wallets?${qs}`, { revalidate: 0, headers: key ? { "x-api-key": key } : undefined });
    for (const w of r.jetton_wallets) {
      const o = byRaw.get(raw(w.owner) ?? "");
      if (o) out[o] = w.balance;
    }
    return NextResponse.json({ balances: out, source: "toncenter" }, { headers: { "cache-control": "no-store" } });
  } catch {
    const headers = process.env.TONAPI_KEY ? { authorization: `Bearer ${process.env.TONAPI_KEY}` } : undefined;
    for (const o of owners) {
      const b = await getJson<{ balance: string }>(`https://tonapi.io/v2/accounts/${encodeURIComponent(o)}/jettons/${encodeURIComponent(jetton)}`, { revalidate: 0, headers }).catch(() => null);
      out[o] = b?.balance ?? "0";
    }
    return NextResponse.json({ balances: out, source: "tonapi" }, { headers: { "cache-control": "no-store" } });
  }
}
