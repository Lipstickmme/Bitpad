import { NextResponse, type NextRequest } from "next/server";
import { config } from "@/lib/config";

/**
 * Same-origin TON JSON-RPC proxy for the browser. It adds TONCENTER_API_KEY
 * server-side, so the key is never shipped to clients. Only the methods the
 * TON SDK uses are forwarded.
 */
const ALLOWED = new Set([
  "runGetMethod",
  "getAddressInformation",
  "getMasterchainInfo",
  "getTransactions",
  "getBlockTransactions",
  "shards",
  "estimateFee",
  "sendBoc",
  "sendBocReturnHash",
  "tryLocateResultTx",
  "tryLocateSourceTx",
]);
const MAX_BODY = 64 * 1024;

// Best-effort per-IP limiter (per server instance): 20 req/s burst, refills at 10/s
const buckets = new Map<string, { tokens: number; at: number }>();
function allow(ip: string) {
  const now = Date.now();
  const b = buckets.get(ip) ?? { tokens: 20, at: now };
  b.tokens = Math.min(20, b.tokens + ((now - b.at) / 1000) * 10);
  b.at = now;
  if (b.tokens < 1) return false;
  b.tokens -= 1;
  buckets.set(ip, b);
  if (buckets.size > 10_000) buckets.clear();
  return true;
}

const endpoint = () => (config.network === "testnet" ? "https://testnet.toncenter.com/api/v2/jsonRPC" : "https://toncenter.com/api/v2/jsonRPC");

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!allow(ip)) return NextResponse.json({ ok: false, error: "rate limited" }, { status: 429 });

  const text = await req.text();
  if (text.length > MAX_BODY) return NextResponse.json({ ok: false, error: "payload too large" }, { status: 413 });
  let body: { method?: unknown };
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }
  if (typeof body.method !== "string" || !ALLOWED.has(body.method)) {
    return NextResponse.json({ ok: false, error: "method not allowed" }, { status: 403 });
  }

  const key = process.env.TONCENTER_API_KEY;
  try {
    const res = await fetch(endpoint(), {
      method: "POST",
      headers: { "content-type": "application/json", ...(key ? { "x-api-key": key } : {}) },
      body: text,
      cache: "no-store",
    });
    return new NextResponse(await res.text(), { status: res.status, headers: { "content-type": "application/json" } });
  } catch {
    return NextResponse.json({ ok: false, error: "TON RPC unreachable" }, { status: 502 });
  }
}
