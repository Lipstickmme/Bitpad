import { NextResponse } from "next/server";
import { getAnalytics } from "@/lib/analytics";

export const revalidate = 120;

export async function GET() {
  return NextResponse.json(await getAnalytics());
}
