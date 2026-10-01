import "server-only";
import { memo } from "./data/http";

/**
 * Headlines for the news strip, from public RSS feeds (no keys): markets and
 * stocks (CNBC, MarketWatch, Yahoo Finance), crypto (CoinDesk, Cointelegraph,
 * Decrypt) and memecoins (Cointelegraph's memecoin tag). Crypto headlines that
 * mention memecoins or TON are tagged as such. Feeds that fail are skipped.
 */
export type NewsTag = "Markets" | "Crypto" | "Memecoins" | "TON";
export interface NewsItem {
  title: string;
  url: string;
  source: string;
  tag: NewsTag;
  time: number;
}

const FEEDS: { url: string; source: string; tag: NewsTag }[] = [
  { url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114", source: "CNBC", tag: "Markets" },
  { url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664", source: "CNBC", tag: "Markets" },
  { url: "https://feeds.content.dowjones.io/public/rss/mw_topstories", source: "MarketWatch", tag: "Markets" },
  { url: "https://finance.yahoo.com/news/rssindex", source: "Yahoo Finance", tag: "Markets" },
  { url: "https://www.coindesk.com/arc/outboundfeeds/rss/", source: "CoinDesk", tag: "Crypto" },
  { url: "https://cointelegraph.com/rss", source: "Cointelegraph", tag: "Crypto" },
  { url: "https://decrypt.co/feed", source: "Decrypt", tag: "Crypto" },
  { url: "https://cointelegraph.com/rss/tag/memecoin", source: "Cointelegraph", tag: "Memecoins" },
];

const MEME = /\bmeme ?coins?\b|\bmemes?\b|\bdoge(coin)?\b|\bshib(a)?\b|\bpepe\b|\bbonk\b|\bwif\b|pump\.?fun|\bfloki\b|\bfartcoin\b|\btrump coin\b|\$trump\b/i;
const isTon = (t: string) => /\bTON\b/.test(t) || /toncoin|\btelegram\b|\bdurov\b|\bnotcoin\b|\bston\.fi\b/i.test(t);

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
export function decode(s: string) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}

const pick = (block: string, tag: string) => block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i"))?.[1];

/** RSS 2.0 <item> and Atom <entry> → title, link, date. */
export function parseFeed(xml: string, source: string, tag: NewsTag): NewsItem[] {
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>|<entry[\s>][\s\S]*?<\/entry>/gi) ?? [];
  const out: NewsItem[] = [];
  for (const b of blocks) {
    const title = decode(pick(b, "title") ?? "");
    const link = decode(pick(b, "link") ?? "") || b.match(/<link[^>]*href="([^"]+)"/i)?.[1] || decode(pick(b, "guid") ?? "");
    const date = decode(pick(b, "pubDate") ?? pick(b, "published") ?? pick(b, "updated") ?? pick(b, "dc:date") ?? "");
    const time = Date.parse(date);
    if (!title || !/^https?:\/\//.test(link)) continue;
    const t: NewsTag = tag === "Markets" ? "Markets" : MEME.test(title) ? "Memecoins" : isTon(title) ? "TON" : tag;
    out.push({ title: title.slice(0, 160), url: link, source, tag: t, time: Number.isFinite(time) ? time : 0 });
  }
  return out;
}

async function fetchFeed(f: (typeof FEEDS)[number]): Promise<NewsItem[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(f.url, { signal: ctrl.signal, headers: { accept: "application/rss+xml, application/xml, text/xml", "user-agent": "Mozilla/5.0 (compatible; BitpadNews/1.0)" }, next: { revalidate: 600 } } as RequestInit);
    if (!res.ok) return [];
    return parseFeed(await res.text(), f.source, f.tag);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/** Newest headlines, interleaved so every tag shows up early in the strip. */
export function mixNews(items: NewsItem[], limit = 40, now = Date.now()): NewsItem[] {
  const seen = new Set<string>();
  const fresh = items
    .filter((i) => !i.time || now - i.time < 3 * 86_400_000)
    .sort((a, b) => b.time - a.time)
    .filter((i) => {
      const k = i.title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 60);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  const byTag = new Map<NewsTag, NewsItem[]>();
  for (const i of fresh) byTag.set(i.tag, [...(byTag.get(i.tag) ?? []), i]);
  const order: NewsTag[] = ["Markets", "Crypto", "Memecoins", "TON"];
  const out: NewsItem[] = [];
  while (out.length < limit && [...byTag.values()].some((l) => l.length)) {
    for (const t of order) {
      const next = byTag.get(t)?.shift();
      if (next && out.length < limit) out.push(next);
    }
  }
  return out;
}

export function getNews(): Promise<NewsItem[]> {
  return memo("news", 300_000, async () => mixNews((await Promise.all(FEEDS.map(fetchFeed))).flat())).catch(() => []);
}
