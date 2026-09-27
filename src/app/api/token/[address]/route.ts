import { NextResponse } from "next/server";
import { getToken } from "@/lib/market";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ address: string }> }) {
  const token = await getToken((await ctx.params).address);
  if (!token) return NextResponse.json({ error: "Token not found on TON" }, { status: 404 });
  return NextResponse.json({ token }, { headers: { "cache-control": "s-maxage=20, stale-while-revalidate=40" } });
}
