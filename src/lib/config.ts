/** Public, build-time configuration. Everything here is safe to ship to the browser. */
export const config = {
  appName: "Bitpad",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  network: (process.env.NEXT_PUBLIC_TON_NETWORK ?? "mainnet") as "mainnet" | "testnet",
  feeWallet: process.env.NEXT_PUBLIC_FEE_WALLET ?? "",
  swapFeeBps: clamp(Number(process.env.NEXT_PUBLIC_SWAP_FEE_BPS ?? 50), 0, 100),
  launchFeeTon: Number(process.env.NEXT_PUBLIC_LAUNCH_FEE_TON ?? 1),
  telegramBot: process.env.NEXT_PUBLIC_TELEGRAM_BOT ?? "",
  factoryAddress: process.env.NEXT_PUBLIC_BITPAD_FACTORY ?? "",
  toncenterKey: process.env.NEXT_PUBLIC_TONCENTER_API_KEY ?? "",
  gramJetton: process.env.NEXT_PUBLIC_GRAM_JETTON ?? "",
  usdcJetton: process.env.NEXT_PUBLIC_USDC_JETTON ?? "",
  /** $BITL jetton master — shows the $BITL tab when set */
  bitlJetton: process.env.NEXT_PUBLIC_BITL_JETTON ?? "",
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

function clamp(n: number, lo: number, hi: number) {
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo;
}
