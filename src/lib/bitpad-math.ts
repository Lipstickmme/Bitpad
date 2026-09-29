/**
 * Exact mirror of BitpadPool's integer math (contracts/pool.tact) so the UI
 * can quote trades and simulate bundles without extra RPC calls.
 * tests/bitpad-math.test.ts checks it against the contract's own getters.
 */
const BPS = 10_000n;

export interface PoolState {
  reserveToken: bigint;
  reservePair: bigint;
  protocolFeeBps: bigint;
  creatorFeeBps: bigint;
}

/** Pair in → tokens out (fees on input). */
export function quoteBuy(p: PoolState, amountIn: bigint) {
  const pf = (amountIn * p.protocolFeeBps) / BPS;
  const cf = (amountIn * p.creatorFeeBps) / BPS;
  const net = amountIn - pf - cf;
  if (p.reserveToken === 0n || p.reservePair + net === 0n) return { out: 0n, net };
  return { out: (net * p.reserveToken) / (p.reservePair + net), net };
}

/** Tokens in → pair out (fees on output). */
export function quoteSell(p: PoolState, amountIn: bigint) {
  if (p.reservePair === 0n || p.reserveToken + amountIn === 0n) return { out: 0n, gross: 0n };
  const gross = (amountIn * p.reservePair) / (p.reserveToken + amountIn);
  const out = gross - (gross * p.protocolFeeBps) / BPS - (gross * p.creatorFeeBps) / BPS;
  return { out, gross };
}

/** Pool state after a buy (for sequential simulation, e.g. bundle legs). */
export function afterBuy(p: PoolState, amountIn: bigint): { state: PoolState; out: bigint } {
  const q = quoteBuy(p, amountIn);
  return { out: q.out, state: { ...p, reservePair: p.reservePair + q.net, reserveToken: p.reserveToken - q.out } };
}

/** Price impact of a buy, in % (spot vs execution, before fees). */
export function buyImpact(p: PoolState, amountIn: bigint) {
  if (p.reserveToken === 0n || p.reservePair === 0n || amountIn === 0n) return 0;
  const spotOut = Number((amountIn * p.reserveToken) / p.reservePair);
  const { out } = quoteBuy({ ...p, protocolFeeBps: 0n, creatorFeeBps: 0n }, amountIn);
  return spotOut ? Math.max(0, (1 - Number(out) / spotOut) * 100) : 0;
}

/** Spot price: pair units per whole token, as a float (decimals-adjusted). */
export function spotPrice(p: Pick<PoolState, "reserveToken" | "reservePair">, pairDecimals: number, tokenDecimals = 9) {
  if (p.reserveToken === 0n) return 0;
  return (Number(p.reservePair) / 10 ** pairDecimals) / (Number(p.reserveToken) / 10 ** tokenDecimals);
}

export const minOutFor = (out: bigint, slippagePct: number) => (out * BigInt(Math.floor((100 - slippagePct) * 100))) / 10_000n;
