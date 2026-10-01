/**
 * The TON network's native coin was renamed from Toncoin (TON) to Gram (GRAM)
 * on 15 June 2026. Same coin, new ticker; the network is still TON. Internally
 * the native asset keeps the key "TON" (price feeds, DEX pools and addresses
 * use it); everything shown to people says GRAM.
 */
export const COIN = "GRAM";
export const COIN_NAME = "Gram";
/** Display label for an asset symbol: the native coin shows as GRAM. */
export const coin = (symbol: string) => (symbol === "TON" ? COIN : symbol);
/** Normalise a pay currency from the UI/API to the internal key ("GRAM" → native "TON"). */
export const payKey = (symbol: string) => (symbol === "GRAM" ? "TON" : symbol);
