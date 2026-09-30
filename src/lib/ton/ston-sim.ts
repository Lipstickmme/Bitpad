import { StonApiClient } from "@ston-fi/api";
import { config } from "../config";

const api = new StonApiClient();
export type StonSim = Awaited<ReturnType<StonApiClient["simulateSwap"]>>;

/**
 * How Bitpad is paid on a STON.fi route:
 *  - "referral": the referral fee is taken inside the swap (v2 routers, up to 1%)
 *  - "transfer": the pool only exists on a router that rejects our referral
 *    parameters, so the swap runs without them and the platform fee is paid as a
 *    separate TON transfer carved out of the same total (like DeDust)
 */
export type FeeMode = "referral" | "transfer" | "none";

/**
 * STON.fi's simulator answers 400 when a referral fee is set but the only pool
 * sits on a v1 router (fixed 0.1% referral) or the fee isn't accepted. Try the
 * fee-paying variants first, then fall back to a plain simulation.
 */
export async function simulateWithFee(q: { offerAddress: string; askAddress: string; offerUnits: string; slippageTolerance: string }): Promise<{ sim: StonSim; fee: FeeMode }> {
  const hasFee = !!config.feeWallet && config.swapFeeBps > 0;
  if (!hasFee) return { sim: await api.simulateSwap(q), fee: "none" };
  const ref = { referralAddress: config.feeWallet, referralFeeBps: String(Math.min(100, config.swapFeeBps)) };
  const errors: string[] = [];
  for (const extra of [{ ...ref, dexVersion: [2] as (2 | "2")[] }, ref]) {
    try {
      return { sim: await api.simulateSwap({ ...q, ...extra }), fee: "referral" };
    } catch (e) {
      errors.push((e as Error).message);
    }
  }
  try {
    return { sim: await api.simulateSwap(q), fee: "transfer" };
  } catch (e) {
    throw new Error(`STON.fi has no route for this pair (${(e as Error).message.replace(/\s*"https?:[^"]+"/, "")})`);
  }
}
