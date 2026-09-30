import type { ChainId } from "./types";

/**
 * Series palette for the dark theme: the brand accent first, then greys
 * stepping in lightness so neighbouring slices stay distinguishable.
 */
export const SERIES = ["#8cbfd1", "#c9d6da", "#5f8794", "#8a9ca2", "#3f5a63", "#6c7f86", "#b3d6e2", "#4b6069"];

export interface Venue {
  id: string;
  name: string;
  chain: ChainId;
  kind: "launchpad" | "dex";
  mechanism: string;
  /** Substrings matched against GeckoTerminal dex ids to attribute sampled pools */
  geckoMatch: string[];
  /** Substrings matched against DefiLlama protocol names for volume / fees */
  llamaMatch: string[];
  /** DefiLlama slug for historical volume, when one exists */
  llamaSlug?: string;
  color: string;
  url: string;
}

export const LAUNCHPADS: Venue[] = [
  { id: "bitpad", name: "Bitpad", chain: "ton", kind: "launchpad", mechanism: "Direct LP · paired", geckoMatch: ["bitpad"], llamaMatch: ["bitpad"], color: SERIES[0], url: "/" },
  { id: "pumpfun", name: "pump.fun", chain: "solana", kind: "launchpad", mechanism: "Bonding curve", geckoMatch: ["pump-fun", "pumpfun"], llamaMatch: ["pump.fun", "pump launchpad"], llamaSlug: "pump.fun", color: SERIES[1], url: "https://pump.fun" },
  { id: "bonk", name: "letsBONK.fun", chain: "solana", kind: "launchpad", mechanism: "Bonding curve", geckoMatch: ["launchlab", "bonk"], llamaMatch: ["letsbonk", "raydium launchlab"], color: SERIES[2], url: "https://letsbonk.fun" },
  { id: "stonkfun", name: "StonkFun", chain: "solana", kind: "launchpad", mechanism: "Stock-paired curve", geckoMatch: ["stonk"], llamaMatch: ["stonkfun", "stonk.fun"], color: SERIES[3], url: "https://www.stonkfun.xyz" },
  { id: "pons", name: "Pons Family", chain: "robinhood", kind: "launchpad", mechanism: "Direct LP · stock pairs", geckoMatch: ["pons"], llamaMatch: ["pons"], color: SERIES[4], url: "https://ponsfamily.com" },
  { id: "fourmeme", name: "Four.meme", chain: "bsc", kind: "launchpad", mechanism: "Bonding curve", geckoMatch: ["four"], llamaMatch: ["four.meme", "fourmeme"], color: SERIES[5], url: "https://four.meme" },
  { id: "clanker", name: "Clanker / Zora", chain: "base", kind: "launchpad", mechanism: "Direct LP (Uni v4)", geckoMatch: ["clanker", "zora"], llamaMatch: ["clanker", "zora"], color: SERIES[6], url: "https://clanker.world" },
  { id: "blum", name: "Blum Memepad", chain: "ton", kind: "launchpad", mechanism: "Bonding curve", geckoMatch: ["blum"], llamaMatch: ["blum"], color: SERIES[7], url: "https://blum.io" },
];

export const DEXES: Venue[] = [
  { id: "stonfi", name: "STON.fi", chain: "ton", kind: "dex", mechanism: "AMM v2", geckoMatch: ["stonfi", "ston"], llamaMatch: ["ston.fi"], llamaSlug: "ston.fi", color: SERIES[0], url: "https://app.ston.fi" },
  { id: "dedust", name: "DeDust", chain: "ton", kind: "dex", mechanism: "AMM", geckoMatch: ["dedust"], llamaMatch: ["dedust"], llamaSlug: "dedust", color: SERIES[1], url: "https://dedust.io" },
  { id: "uniswap", name: "Uniswap", chain: "ethereum", kind: "dex", mechanism: "CLMM v3/v4", geckoMatch: ["uniswap"], llamaMatch: ["uniswap"], llamaSlug: "uniswap", color: SERIES[2], url: "https://app.uniswap.org" },
  { id: "pumpswap", name: "PumpSwap", chain: "solana", kind: "dex", mechanism: "AMM", geckoMatch: ["pumpswap"], llamaMatch: ["pumpswap"], llamaSlug: "pumpswap", color: SERIES[3], url: "https://swap.pump.fun" },
  { id: "raydium", name: "Raydium", chain: "solana", kind: "dex", mechanism: "AMM/CLMM", geckoMatch: ["raydium"], llamaMatch: ["raydium"], llamaSlug: "raydium", color: SERIES[4], url: "https://raydium.io" },
  { id: "aerodrome", name: "Aerodrome", chain: "base", kind: "dex", mechanism: "ve(3,3)", geckoMatch: ["aerodrome"], llamaMatch: ["aerodrome"], llamaSlug: "aerodrome", color: SERIES[5], url: "https://aerodrome.finance" },
  { id: "pancake", name: "PancakeSwap", chain: "bsc", kind: "dex", mechanism: "AMM/CLMM", geckoMatch: ["pancakeswap"], llamaMatch: ["pancakeswap"], llamaSlug: "pancakeswap", color: SERIES[6], url: "https://pancakeswap.finance" },
];
