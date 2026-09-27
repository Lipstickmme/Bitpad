import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "@/lib/market";
import { quoteBuy } from "@/lib/routing";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const token = await getToken(q.get("token") ?? "");
  if (!token) return NextResponse.json({ error: "unknown token" }, { status: 404 });
  const amount = Number(q.get("amount") ?? 0);
  if (!(amount > 0)) return NextResponse.json({ routes: [], errors: [] });
  return NextResponse.json(await quoteBuy(token, q.get("pay") ?? "TON", amount));
}
