import { NextResponse, type NextRequest } from "next/server";
import { jettonWalletOf } from "@/lib/bitpad";

export const dynamic = "force-dynamic";

/** ?master=<jetton master>&owner=<wallet> → the owner's jetton wallet address. */
export async function GET(req: NextRequest) {
  const master = req.nextUrl.searchParams.get("master");
  const owner = req.nextUrl.searchParams.get("owner");
  if (!master || !owner) return NextResponse.json({ error: "master and owner required" }, { status: 400 });
  try {
    return NextResponse.json({ wallet: await jettonWalletOf(master, owner) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
