import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "@/lib/market";
import { quoteBuy } from "@/lib/routing";
import { safe } from "@/lib/data/http";
import { tonUsd } from "@/lib/data/tonapi";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const token = await getToken(q.get("token") ?? "");
  if (!token) return NextResponse.json({ error: "unknown token" }, { status: 404 });
  const amount = Number(q.get("amount") ?? 0);
  if (!(amount > 0)) return NextResponse.json({ routes: [] });
  const ton = await safe(tonUsd(), 2.86, "ton price");
  const routes = await quoteBuy(token, q.get("pay") ?? "TON", amount, ton.value);
  return NextResponse.json({ routes, tonUsd: ton.value });
}
