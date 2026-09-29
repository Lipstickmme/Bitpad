import { Address } from "@ton/core";

/*
 * Deployed contracts are public on-chain addresses, so they live here rather
 * than in environment variables. Environment variables are only used for
 * secrets / rate-limit keys (all server-only):
 *   TONCENTER_API_KEY, TONAPI_KEY, TELEGRAM_BOT_TOKEN   (all optional)
 */

/** BitpadFactory on mainnet (deployed 2026-09-28). */
export const FACTORY_ADDRESS = "EQCZ9eHWHr6j00Fm3vcFW9kLIyZpPJ9284y7ZzIMQhx3wz1y";
/** BitpadBundler on mainnet. */
export const BUNDLER_ADDRESS = "EQCRv-NxbhlN5A9FRne7HhVpq1weRKumxscL6334xu2-xVTY";

const factoryAddress = FACTORY_ADDRESS;

/** Network follows the factory address: testnet addresses carry the test-only flag. */
export function networkOf(addr: string): "mainnet" | "testnet" {
  try {
    return Address.isFriendly(addr) && Address.parseFriendly(addr).isTestOnly ? "testnet" : "mainnet";
  } catch {
    return "mainnet";
  }
}

/** Public URL: browser origin → Vercel production URL → local dev. */
function appUrl() {
  if (typeof window !== "undefined") return window.location.origin;
  if (process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}

/** Public, build-time configuration. Everything here is safe to ship to the browser. */
export const config = {
  appName: "Bitpad",
  appUrl: appUrl(),
  factoryAddress,
  bundlerAddress: BUNDLER_ADDRESS,
  network: networkOf(factoryAddress),
  /** The factory's fee wallet — read on-chain at startup (see lib/runtime.ts and Providers). */
  feeWallet: "",
  /** Fee on STON.fi / DeDust routes, in basis points (max 100 = 1%, STON.fi's referral cap).
   *  Bitpad pools charge the fees set in the factory contract instead. */
  swapFeeBps: 50,
  /** Referral model enforced by BitpadPool (see contracts/pool.tact) */
  referral: { maxLinksPerToken: 20, referrerShareOfCreatorFee: 50 },
  links: { telegram: "https://t.co/19wnxJaCAc", x: "https://x.com/BelieveinTon1" },
};

/** Well-known TON asset addresses */
export const TON_ASSETS = {
  /** STON.fi / TonAPI convention for native TON */
  TON: "EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c",
  USDT: "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
};
