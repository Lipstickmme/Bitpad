import { NextResponse, type NextRequest } from "next/server";
import { Address } from "@ton/core";
import { getToken } from "@/lib/market";
import { readPool } from "@/lib/bitpad";
import { minOutFor, quoteSell } from "@/lib/bitpad-math";
import { runGet, addressArg } from "@/lib/chain";
import { buildPoolSwapTx } from "@/lib/ton/launch";
import { buildSellArgs, toTcMessage } from "@/lib/ton/swap";
import { buildDedustSellTx } from "@/lib/ton/dedust";
import { ensureRuntimeConfig } from "@/lib/runtime";
import { TON_ASSETS } from "@/lib/config";
import type { TcMessage } from "@/lib/ton/client";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const addr = (s: string | null) => {
  try {
    return s ? Address.parse(s).toString() : null;
  } catch {
    return null;
  }
};

/** Cap on TON an aggregator-built sell may attach (gas only: the jettons are what's sold). */
const SELL_GAS_CAP = 1_500_000_000n;

/**
 * Unsigned sell (jetton → GRAM) for `wallet`, on the first route that works:
 * the token's Bitpad pool, STON.fi, DeDust, then Omniston (which also reaches
 * TONCO and market makers). Tokens bought through Omniston often have no
 * STON.fi pool, which is why STON.fi alone wasn't enough.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const wallet = addr(q.get("wallet"));
  if (!wallet) return NextResponse.json({ error: "Connect a TON wallet first" }, { status: 400 });
  let units: bigint;
  try {
    units = BigInt(q.get("units") ?? "0");
  } catch {
    return NextResponse.json({ error: "Bad amount" }, { status: 400 });
  }
  if (units <= 0n) return NextResponse.json({ error: "Nothing to sell" }, { status: 400 });
  const slippage = Math.min(Math.max(Number(q.get("slippage") ?? 2), 0.1), 50) / 100;
  const token = await getToken(q.get("token") ?? "");
  if (!token) return NextResponse.json({ error: "Unknown token" }, { status: 404 });
  await ensureRuntimeConfig();
  const errors: string[] = [];

  // 1 · Bitpad creator jetton pool (GRAM-paired)
  if (token.bitpad?.pool && !token.bitpad.pairMaster) {
    try {
      const pool = await readPool(token.bitpad.pool);
      const out = quoteSell({ reserveToken: BigInt(pool.reserveToken), reservePair: BigInt(pool.reservePair), protocolFeeBps: BigInt(pool.protocolFeeBps), creatorFeeBps: BigInt(pool.creatorFeeBps) }, units).out;
      if (out <= 0n) throw new Error("Amount too small for this pool");
      const jw = (await runGet(token.address, "get_wallet_address", [addressArg(wallet)])).readAddress().toString();
      const msg = buildPoolSwapTx({ pool: pool.address, userJettonWallet: jw, user: wallet, amount: units, minOut: minOutFor(out, slippage * 100), referrer: pool.creator });
      return NextResponse.json({ messages: [msg], via: "Bitpad pool" });
    } catch (e) {
      errors.push(`Bitpad pool: ${(e as Error).message}`);
    }
  }
  // 2 · STON.fi
  try {
    const { tx } = await buildSellArgs({ wallet, jetton: token.address, units, slippage });
    return NextResponse.json({ messages: [toTcMessage(tx)], via: "STON.fi" });
  } catch (e) {
    errors.push(`STON.fi: ${(e as Error).message}`);
  }
  // 3 · DeDust
  try {
    const messages = await buildDedustSellTx({ wallet, token: token.address, units, slippage });
    if (messages.length) return NextResponse.json({ messages, via: "DeDust" });
  } catch (e) {
    errors.push(`DeDust: ${(e as Error).message}`);
  }
  // 4 · Omniston (STON.fi + DeDust + TONCO + market makers)
  try {
    const { omniBuild } = await import("@/lib/ton/omniston");
    const r = await omniBuild(token.address, TON_ASSETS.TON, units, wallet, slippage * 100);
    const tonOut = r.messages.reduce((s: bigint, m: TcMessage) => s + BigInt(m.amount), 0n);
    if (tonOut > SELL_GAS_CAP) throw new Error("The aggregator's transaction asked for more GRAM than a sell needs, so it was not sent");
    return NextResponse.json({ messages: r.messages, via: `STON.fi Omniston · ${r.q.resolver}${r.q.feeWaived ? " (no Bitpad fee)" : ""}` });
  } catch (e) {
    errors.push(`Omniston: ${(e as Error).message}`);
  }
  return NextResponse.json({ error: `No live route: ${errors.join(" · ")}` }, { status: 404 });
}
