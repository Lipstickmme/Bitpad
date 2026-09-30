import { NextResponse, type NextRequest } from "next/server";

/** Stateless TEP-64 metadata: the JSON is embedded (base64url) in the `d` param at launch time. */
export async function GET(req: NextRequest) {
  const d = req.nextUrl.searchParams.get("d");
  if (!d || d.length > 4000) return NextResponse.json({ error: "bad metadata" }, { status: 400 });
  try {
    const meta = JSON.parse(Buffer.from(d, "base64url").toString("utf8"));
    const pick = (k: string) => (typeof meta[k] === "string" ? meta[k].slice(0, 500) : undefined);
    return NextResponse.json(
      { name: pick("name"), symbol: pick("symbol"), description: pick("description"), image: pick("image"), decimals: pick("decimals") ?? "9", bitpad_pair: pick("bitpad_pair"), bitpad_type: pick("bitpad_type"), creator_tg: pick("creator_tg"), creator_tg_id: pick("creator_tg_id"), creator_name: pick("creator_name"), creator_sig: pick("creator_sig"), telegram: pick("telegram"), x: pick("x") },
      { headers: { "cache-control": "public, max-age=31536000, immutable" } },
    );
  } catch {
    return NextResponse.json({ error: "bad metadata" }, { status: 400 });
  }
}
