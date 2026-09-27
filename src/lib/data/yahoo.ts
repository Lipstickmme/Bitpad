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
