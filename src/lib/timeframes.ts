/** [GeckoTerminal unit, aggregate, seconds per candle] */
export const TIMEFRAMES = { "1m": ["minute", 1, 60], "5m": ["minute", 5, 300], "15m": ["minute", 15, 900], "1h": ["hour", 1, 3600], "4h": ["hour", 4, 14_400], "1D": ["day", 1, 86_400] } as const;
export type Timeframe = keyof typeof TIMEFRAMES;
