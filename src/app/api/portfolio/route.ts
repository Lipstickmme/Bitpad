import { NextResponse, type NextRequest } from "next/server";
import { accountJettons, accountTon, tonUsd } from "@/lib/data/tonapi";
import { safe } from "@/lib/data/http";

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  if (!address) return NextResponse.json({ error: "address required" }, { status: 400 });
  const [jettons, ton, price] = await Promise.all([
    safe(accountJettons(address), [], "tonapi jettons"),
    safe(accountTon(address), 0, "tonapi account"),
    safe(tonUsd(), 2.86, "tonapi rates"),
  ]);
  const holdings = jettons.value
    .map((b) => {
      const amount = Number(b.balance) / 10 ** b.jetton.decimals;
      const px = b.price?.prices?.USD ?? 0;
      return { address: b.jetton.address, symbol: b.jetton.symbol, name: b.jetton.name, image: b.jetton.image, amount, priceUsd: px, valueUsd: amount * px, change24h: parseFloat(b.price?.diff_24h?.USD ?? "0") };
    })
    .filter((h) => h.amount > 0)
    .sort((a, b) => b.valueUsd - a.valueUsd);
  return NextResponse.json({ ton: ton.value, tonUsd: price.value, holdings, live: jettons.ok });
}
