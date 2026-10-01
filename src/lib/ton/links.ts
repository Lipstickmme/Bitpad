/** The same swap in the STON.fi app (its aggregator also reaches market-maker-only assets like xStocks). */
export const stonAppSwapUrl = (jetton: string, from = "TON") => `https://app.ston.fi/swap?ft=${encodeURIComponent(from)}&tt=${encodeURIComponent(jetton)}`;
