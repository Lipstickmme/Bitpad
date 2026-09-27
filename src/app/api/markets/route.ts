import { NextResponse } from "next/server";
import { getPairAssets, getTokens } from "@/lib/market";

export const revalidate = 30;

export async function GET() {
  const [tokens, { assets, live }] = await Promise.all([getTokens(), getPairAssets()]);
  return NextResponse.json({ tokens, assets, assetsLive: live });
}
