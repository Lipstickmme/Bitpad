import { NextResponse } from "next/server";
import { getNews } from "@/lib/news";

export const revalidate = 300;

export async function GET() {
  return NextResponse.json({ items: await getNews() }, { headers: { "cache-control": "public, s-maxage=300, stale-while-revalidate=600" } });
}
