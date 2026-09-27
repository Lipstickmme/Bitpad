import { NextResponse, type NextRequest } from "next/server";
import { accountJettons, accountTon } from "@/lib/data/tonapi";
import { solBalance, evmBalances } from "@/lib/data/rpc";
import { safe } from "@/lib/data/http";
import { getPairAssets } from "@/lib/prices";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const address = q.get("address");
  const sol = q.get("sol");
  const evm = q.get("evm");
  const { assets } = await getPairAssets();
  const px = (s: string) => assets.find((a) => a.symbol === s)?.priceUsd ?? null;

  const [jettons, ton, solBal, evmBal] = await Promise.all([
    address ? safe(accountJettons(address), [], "tonapi jettons") : null,
    address ? safe(accountTon(address), null as number | null, "tonapi account") : null,
    sol ? safe(solBalance(sol), null as number | null, "solana rpc") : null,
    evm ? safe(evmBalances(evm), {} as Record<string, number>, "evm rpc") : null,
  ]);
  const holdings = (jettons?.value ?? [])
    .map((b) => {
      const amount = Number(b.balance) / 10 ** b.jetton.decimals;
      const p = b.price?.prices?.USD ?? null;
      return { address: b.jetton.address, symbol: b.jetton.symbol, name: b.jetton.name, image: b.jetton.image, amount, priceUsd: p, valueUsd: p != null ? amount * p : null, change24h: b.price?.diff_24h?.USD ? parseFloat(b.price.diff_24h.USD) : null };
    })
    .filter((h) => h.amount > 0)
    .sort((a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0));
  return NextResponse.json({
    ton: ton?.value ?? null,
    tonUsd: px("TON"),
    holdings,
    tonLive: !!jettons?.ok,
    solana: sol ? { address: sol, sol: solBal?.value ?? null, usd: solBal?.value != null && px("SOL") ? solBal.value * px("SOL")! : null } : null,
    evm: evm ? { address: evm, balances: evmBal?.value ?? {}, ethUsd: px("ETH") } : null,
  });
}
