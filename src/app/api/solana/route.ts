import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Minimal Solana reads for cross-chain buys (server-side, so the RPC URL/key stays private):
 *   ?op=balance&address=<wallet>   → { lamports }
 *   ?op=status&sig=<signature>     → { status: "pending" | "confirmed" | "failed", err }
 * Uses SOLANA_RPC_URL when set (Helius, QuickNode…), else the public mainnet RPC.
 */
const RPC = () => process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const B58 = /^[1-9A-HJ-NP-Za-km-z]{32,90}$/;

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const res = await fetch(RPC(), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), cache: "no-store" });
  const j = (await res.json()) as { result?: T; error?: { message: string } };
  if (j.error) throw new Error(j.error.message);
  return j.result as T;
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  try {
    if (q.get("op") === "balance") {
      const a = q.get("address") ?? "";
      if (!B58.test(a)) return NextResponse.json({ error: "bad address" }, { status: 400 });
      const r = await rpc<{ value: number }>("getBalance", [a, { commitment: "confirmed" }]);
      return NextResponse.json({ lamports: r.value });
    }
    if (q.get("op") === "status") {
      const sig = q.get("sig") ?? "";
      if (!B58.test(sig)) return NextResponse.json({ error: "bad signature" }, { status: 400 });
      const r = await rpc<{ value: ({ confirmationStatus?: string; err: unknown } | null)[] }>("getSignatureStatuses", [[sig], { searchTransactionHistory: true }]);
      const s = r.value[0];
      if (!s) return NextResponse.json({ status: "pending" });
      if (s.err) return NextResponse.json({ status: "failed", err: s.err });
      return NextResponse.json({ status: s.confirmationStatus === "processed" ? "pending" : "confirmed" });
    }
    return NextResponse.json({ error: "unknown op" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
