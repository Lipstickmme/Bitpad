import { getJson } from "./http";

/**
 * Yahoo Finance chart endpoint — free, unofficial, no key. Gives last price,
 * previous close and the last year's dividend events (for trailing yield).
 */
interface YChart {
  chart: {
    result?: {
      meta: { regularMarketPrice?: number; chartPreviousClose?: number; previousClose?: number; currency?: string; longName?: string };
      indicators?: { quote?: { close?: (number | null)[] }[] };
      events?: { dividends?: Record<string, { amount: number; date: number }> };
    }[];
    error?: { description?: string } | null;
  };
}

export interface YahooQuote {
  price: number;
  change24h: number | null;
  dividendYield: number | null; // trailing 12m, %
  lastDividend?: { amount: number; date: number };
  dividendsPerYear: number;
}

export function parseYahoo(res: YChart): YahooQuote | null {
  const r = res.chart.result?.[0];
  const price = r?.meta.regularMarketPrice;
  if (!r || !price) return null;
  const closes = (r.indicators?.quote?.[0]?.close ?? []).filter((c): c is number => c != null);
  const prev = closes.length >= 2 ? closes[closes.length - 2] : r.meta.previousClose ?? null;
  const divs = Object.values(r.events?.dividends ?? {}).sort((a, b) => a.date - b.date);
  const yearAgo = Date.now() / 1000 - 365 * 86400;
  const ttm = divs.filter((d) => d.date >= yearAgo).reduce((s, d) => s + d.amount, 0);
  return {
    price,
    change24h: prev ? ((price - prev) / prev) * 100 : null,
    dividendYield: divs.length ? (ttm / price) * 100 : 0,
    lastDividend: divs[divs.length - 1],
    dividendsPerYear: divs.filter((d) => d.date >= yearAgo).length,
  };
}

export async function yahooQuote(symbol: string): Promise<YahooQuote | null> {
  const res = await getJson<YChart>(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1y&interval=1d&events=div`,
    { revalidate: 300, headers: { "user-agent": "Mozilla/5.0 (compatible; Bitpad/1.0)" } },
  );
  return parseYahoo(res);
}

/** Chart ranges for real-market stock candles. */
export const STOCK_TF = { "15m": ["15m", "5d"], "1h": ["60m", "1mo"], "1D": ["1d", "1y"], "1W": ["1wk", "5y"] } as const;
export type StockTf = keyof typeof STOCK_TF;

interface YOhlc {
  chart: { result?: { timestamp?: number[]; indicators?: { quote?: { open?: (number | null)[]; high?: (number | null)[]; low?: (number | null)[]; close?: (number | null)[]; volume?: (number | null)[] }[] } }[] };
}

export function parseYahooCandles(res: YOhlc) {
  const r = res.chart.result?.[0];
  const q = r?.indicators?.quote?.[0];
  if (!r?.timestamp || !q) return [];
  return r.timestamp
    .map((time, i) => ({ time, open: q.open?.[i], high: q.high?.[i], low: q.low?.[i], close: q.close?.[i], volume: q.volume?.[i] ?? 0 }))
    .filter((c): c is { time: number; open: number; high: number; low: number; close: number; volume: number } => c.open != null && c.high != null && c.low != null && c.close != null)
    .map((c) => ({ ...c, volume: c.volume ?? 0 }));
}

/** Real-market OHLC for a stock / futures symbol (Yahoo chart endpoint). */
export async function yahooCandles(symbol: string, tf: StockTf) {
  const [interval, range] = STOCK_TF[tf];
  const res = await getJson<YOhlc>(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`,
    { revalidate: tf === "15m" ? 60 : 600, headers: { "user-agent": "Mozilla/5.0 (compatible; Bitpad/1.0)" } },
  );
  return parseYahooCandles(res);
}
