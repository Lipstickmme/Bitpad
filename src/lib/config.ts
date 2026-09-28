import { Address } from "@ton/core";

/*
 * Environment variables (see .env.example):
 *   required  NEXT_PUBLIC_BITPAD_FACTORY   deployed BitpadFactory address
 *   required  NEXT_PUBLIC_FEE_WALLET       receives trading fees on STON.fi / DeDust routes
 *   optional  TONCENTER_API_KEY, TONAPI_KEY, TELEGRAM_BOT_TOKEN, NEXT_PUBLIC_APP_URL
 * Everything else is a constant below or read from the chain.
 */

const factoryAddress = process.env.NEXT_PUBLIC_BITPAD_FACTORY ?? "";

/** Network follows the factory address: testnet addresses carry the test-only flag. */
export function networkOf(addr: string): "mainnet" | "testnet" {
  try {
    return Address.isFriendly(addr) && Address.parseFriendly(addr).isTestOnly ? "testnet" : "mainnet";
  } catch {
    return "mainnet";
  }
}

/** Public URL: explicit override → Vercel production URL → browser origin → local dev. */
function appUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  if (process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}

/** Public, build-time configuration. Everything here is safe to ship to the browser. */
export const config = {
  appName: "Bitpad",
  appUrl: appUrl(),
  factoryAddress,
  network: networkOf(factoryAddress),
  feeWallet: process.env.NEXT_PUBLIC_FEE_WALLET ?? "",
  /** Fee on STON.fi / DeDust routes, in basis points (max 100 = 1%, STON.fi's referral cap).
   *  Bitpad pools charge the fees set in the factory contract instead. */
  swapFeeBps: 50,
  /** $BITL jetton master — shows the $BITL tab when set */
  bitlJetton: "",
  /**
   * How platform fees are distributed. Business decision — adjust freely.
   * Shares must sum to 100.
   */
  feeSplit: [
    { label: "$BITL buyback & holder rewards", share: 40 },
    { label: "Token creators", share: 30 },
    { label: "Treasury & development", share: 20 },
    { label: "Referrers", share: 10 },
  ],
  links: {
    telegram: "https://t.me/bitlievers",
    x: "https://x.com/bitlievers",
  },
};

/** Well-known TON asset addresses */
export const TON_ASSETS = {
  /** STON.fi / TonAPI convention for native TON */
  TON: "EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c",
  USDT: "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
};
