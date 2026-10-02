import type { PairAsset } from "./types";

export type DividendScore = 0 | 1 | 2 | 3;
export interface DividendInfo {
  /** 0 none · 1 low (<1%) · 2 medium (1–3%) · 3 high (3%+); null when it doesn't apply or isn't known */
  score: DividendScore | null;
  label: string;
  tip: string;
}

const XSTOCK_TIP = "xStocks don't pay cash. Backed reinvests each dividend (after US withholding tax) by raising the token's multiplier, so every token you hold is worth a little more of the share. Nothing to claim.";

/**
 * Dividend "score" for a pair asset: does holding it earn dividends, and how much.
 * Stocks score by trailing-12-month yield; everything else says why it doesn't pay one.
 */
export function dividendInfo(a: Pick<PairAsset, "kind" | "symbol" | "dividendYield">): DividendInfo {
  if (a.kind === "stock") {
    const y = a.dividendYield;
    if (y == null) return { score: null, label: "Unknown", tip: "Dividend history didn't load right now." };
    if (y <= 0) return { score: 0, label: "No dividend", tip: "This company or fund doesn't pay a dividend, so the token's multiplier never grows from dividends. Returns come from the share price only." };
    const score: DividendScore = y >= 3 ? 3 : y >= 1 ? 2 : 1;
    return { score, label: `${["", "Low", "Medium", "High"][score]} · ${y.toFixed(2)}%`, tip: `Pays about ${y.toFixed(2)}% a year (last 12 months). ${XSTOCK_TIP}` };
  }
  if (a.kind === "commodity") return { score: 0, label: "No dividend", tip: "Gold, silver and oil don't pay dividends. The token tracks the metal or commodity price only." };
  if (a.kind === "creator") return { score: null, label: "Staking", tip: "Creator jettons don't pay dividends. Holders can stake in the token's vault and earn a share of its trading fees instead." };
  if (a.symbol === "TON") return { score: null, label: "Staking", tip: "GRAM pays no dividend. You can earn by staking it with a validator or liquid-staking pool, which is outside Bitpad." };
  if (a.symbol === "USDT" || a.symbol === "USDC" || a.symbol === "USDe") return { score: 0, label: "No dividend", tip: "Stablecoins pay holders nothing by themselves. Any yield comes from lending or staking products, outside Bitpad." };
  return { score: 0, label: "No dividend", tip: "Crypto tokens don't pay dividends. Returns come from price only." };
}
