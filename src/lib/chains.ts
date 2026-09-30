import type { ChainId } from "./types";

export const CHAINS: Record<ChainId, { name: string; short: string; gecko?: string; color: string; explorer: string }> = {
  ton: { name: "TON", short: "TON", gecko: "ton", color: "#0098ea", explorer: "https://tonviewer.com/" },
  solana: { name: "Solana", short: "SOL", gecko: "solana", color: "#9945ff", explorer: "https://solscan.io/token/" },
  ethereum: { name: "Ethereum", short: "ETH", gecko: "eth", color: "#627eea", explorer: "https://etherscan.io/token/" },
  base: { name: "Base", short: "BASE", gecko: "base", color: "#0052ff", explorer: "https://basescan.org/token/" },
  bsc: { name: "BNB Chain", short: "BSC", gecko: "bsc", color: "#f0b90b", explorer: "https://bscscan.com/token/" },
  arbitrum: { name: "Arbitrum", short: "ARB", gecko: "arbitrum", color: "#28a0f0", explorer: "https://arbiscan.io/token/" },
  robinhood: { name: "Robinhood Chain", short: "RH", color: "#00c805", explorer: "https://explorer.robinhood.com/token/" },
};
