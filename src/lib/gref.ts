import { Address, beginCell } from "@ton/core";

/**
 * General referral program — recorded on-chain, no extra contract.
 *
 * Every platform fee Bitpad routes on TON is a separate transfer to the fee
 * wallet whose text comment names the route and (optionally) the referrer:
 *     bitpad:fee:<route>[:r=<referrer address>]
 * Referrers earn SHARE_BPS of the fees tagged with their address. Payouts are
 * transfers from the fee wallet commented `bitpad:refpay`. Anyone can audit
 * both on a block explorer; the app and the payout script read them the same way.
 */
export const FEE_TAG = "bitpad:fee";
export const PAY_TAG = "bitpad:refpay";
export const SHARE_BPS = 2000; // referrers get 20% of the platform fee they bring in

export const norm = (a: string) => {
  try {
    return Address.parse(a).toString({ bounceable: false });
  } catch {
    return null;
  }
};

export function feeComment(route: string, referrer?: string | null) {
  const r = referrer ? norm(referrer) : null;
  return `${FEE_TAG}:${route}${r ? `:r=${r}` : ""}`;
}

/** Text-comment cell (op 0) for a fee transfer. */
export const commentCell = (text: string) => beginCell().storeUint(0, 32).storeStringTail(text).endCell();

export function parseFeeComment(c?: string | null): { route: string; referrer: string | null } | null {
  if (!c || !c.startsWith(`${FEE_TAG}:`)) return null;
  const [route, ...rest] = c.slice(FEE_TAG.length + 1).split(":");
  const r = rest.find((x) => x.startsWith("r="));
  return { route: route || "unknown", referrer: r ? norm(r.slice(2)) : null };
}

export interface Transfer {
  time: number; // ms
  amount: number; // TON
  from: string;
  to: string;
  comment?: string;
  hash?: string;
}

export interface ReferrerStats {
  address: string;
  buys: number;
  traders: number;
  fees: number; // TON of platform fee tagged with this referrer
  earned: number; // fees × share
  paid: number;
  owed: number;
  history: { time: number; kind: "earned" | "paid"; amount: number; route?: string; trader?: string; hash?: string }[];
}

/**
 * Fold fee-wallet transfers into per-referrer stats. Self-referrals (the
 * payer is the referrer) earn nothing.
 */
export function aggregate(incoming: Transfer[], payouts: Transfer[], shareBps = SHARE_BPS): Map<string, ReferrerStats> {
  const out = new Map<string, ReferrerStats & { _traders: Set<string> }>();
  const get = (a: string) => {
    let s = out.get(a);
    if (!s) out.set(a, (s = { address: a, buys: 0, traders: 0, fees: 0, earned: 0, paid: 0, owed: 0, history: [], _traders: new Set() }));
    return s;
  };
  for (const t of incoming) {
    const tag = parseFeeComment(t.comment);
    if (!tag?.referrer) continue;
    const payer = norm(t.from);
    if (payer && payer === tag.referrer) continue;
    const s = get(tag.referrer);
    const earned = (t.amount * shareBps) / 10_000;
    s.buys += 1;
    s.fees += t.amount;
    s.earned += earned;
    if (payer) s._traders.add(payer);
    s.history.push({ time: t.time, kind: "earned", amount: earned, route: tag.route, trader: payer ?? undefined, hash: t.hash });
  }
  for (const t of payouts) {
    if (!t.comment?.startsWith(PAY_TAG)) continue;
    const to = norm(t.to);
    if (!to) continue;
    const s = get(to);
    s.paid += t.amount;
    s.history.push({ time: t.time, kind: "paid", amount: t.amount, hash: t.hash });
  }
  for (const s of out.values()) {
    s.traders = s._traders.size;
    s.owed = Math.max(0, s.earned - s.paid);
    s.history.sort((a, b) => b.time - a.time);
  }
  return new Map([...out].map(([k, { _traders: _t, ...v }]) => [k, v]));
}

/** Where a fee-wallet transfer came from, from its on-chain comment. */
export const INCOME_SOURCES = ["Bitpad pools", "Launch fees", "STON.fi", "DeDust", "Other"] as const;
export type IncomeSource = (typeof INCOME_SOURCES)[number];
export function classifyIncome(comment?: string | null): IncomeSource {
  if (!comment) return "Other";
  if (comment.startsWith("Bitpad protocol fees")) return "Bitpad pools";
  if (comment.startsWith("Bitpad launch fee")) return "Launch fees";
  const tag = parseFeeComment(comment);
  if (tag?.route === "stonfi") return "STON.fi";
  if (tag?.route.startsWith("dedust")) return "DeDust";
  return "Other";
}

/** Last `days` UTC days (oldest first) with TON received per source. */
export function dailyBySource(rows: { time: number; amount: number; source: IncomeSource }[], days: number, now = Date.now()) {
  const DAY = 86_400_000;
  const start = Math.floor(now / DAY) * DAY - (days - 1) * DAY;
  const out = Array.from({ length: days }, (_, i) => ({ date: new Date(start + i * DAY).toISOString().slice(5, 10), ...Object.fromEntries(INCOME_SOURCES.map((k) => [k, 0])) }) as { date: string } & Record<IncomeSource, number>);
  for (const r of rows) {
    const i = Math.floor((r.time - start) / DAY);
    if (i >= 0 && i < days) out[i][r.source] += r.amount;
  }
  return out;
}
