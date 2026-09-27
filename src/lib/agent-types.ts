export interface TradeProposal {
  symbol: string;
  address: string;
  side: "buy" | "sell";
  payAsset: string;
  amount: number;
  rationale: string;
}
