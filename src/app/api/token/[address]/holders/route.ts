import { NextResponse } from "next/server";
import { getHolders, getToken } from "@/lib/market";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ address: string }> }) {
  const token = await getToken((await ctx.params).address);
  if (!token) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(await getHolders(token), { headers: { "cache-control": "s-maxage=120" } });
}
