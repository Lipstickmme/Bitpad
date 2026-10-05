import { NextResponse, type NextRequest } from "next/server";
import { safe } from "@/lib/data/http";
import { evmHistory, solHistory, tonHistory, type HistoryRow } from "@/lib/wallet-data";

export const dynamic = "force-dynamic";

const B58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const EVM = /^0x[0-9a-fA-F]{40}$/;
const TON = /^[A-Za-z0-9_\-:]{40,70}$/;

/**
 * GET /api/history?ton=&sol=&evm= → on-chain history of the connected wallets,
 * newest first: { rows, sources: { ton, solana, ethereum, base } } where each
 * source is true (answered), false (failed) or null (no wallet).
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const ton = q.get("ton"), sol = q.get("sol"), evm = q.get("evm");
  const none = Promise.resolve(null);
  const [t, s, e, b] = await Promise.all([
    ton && TON.test(ton) ? safe(tonHistory(ton), [] as HistoryRow[], "ton history") : none,
    sol && B58.test(sol) ? safe(solHistory(sol), [] as HistoryRow[], "solana history") : none,
    evm && EVM.test(evm) ? safe(evmHistory(evm, "ethereum"), [] as HistoryRow[], "eth history") : none,
    evm && EVM.test(evm) ? safe(evmHistory(evm, "base"), [] as HistoryRow[], "base history") : none,
  ]);
  const rows = [t, s, e, b].flatMap((x) => x?.value ?? []).sort((a, b) => b.time - a.time);
  return NextResponse.json({
    rows,
    sources: { ton: t ? t.ok : null, solana: s ? s.ok : null, ethereum: e ? e.ok : null, base: b ? b.ok : null },
  });
}
