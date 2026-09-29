"use client";
import { useEffect, useRef, useState } from "react";
import { CandlestickSeries, ColorType, CrosshairMode, HistogramSeries, createChart, type IChartApi, type ISeriesApi, type UTCTimestamp } from "lightweight-charts";
import { LineChart } from "lucide-react";
import type { MarketToken, Candle } from "@/lib/types";
import { TIMEFRAMES, type Timeframe } from "@/lib/timeframes";
import { price, usd, pct } from "@/lib/format";

const UP = "#3fbf8f";
const DOWN = "#f0566f";

export function PriceChart({ token, onPrice }: { token: MarketToken; onPrice?: (p: number) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const candleS = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volS = useRef<ISeriesApi<"Histogram"> | null>(null);
  const data = useRef<Candle[]>([]);
  const [tf, setTf] = useState<Timeframe>("15m");
  const [source, setSource] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [mode, setMode] = useState<"price" | "mcap">("price");
  const [legend, setLegend] = useState<Candle | null>(null);

  const scale = mode === "mcap" && token.totalSupply ? token.totalSupply : 1;
  const fmt = (v: number) => (mode === "mcap" ? usd(v, { compact: true }) : price(v));

  // create chart once
  useEffect(() => {
    if (!box.current) return;
    const c = createChart(box.current, {
      autoSize: true,
      localization: { locale: "en-US" },
      layout: { background: { type: ColorType.Solid, color: "#0f191d" }, textColor: "#6c7f86", fontFamily: "var(--font-geist-sans), system-ui, sans-serif", fontSize: 11, attributionLogo: false },
      grid: { vertLines: { color: "#152227" }, horzLines: { color: "#152227" } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "#1c2a30", scaleMargins: { top: 0.1, bottom: 0.25 } },
      timeScale: { borderColor: "#1c2a30", timeVisible: true, secondsVisible: false },
    });
    candleS.current = c.addSeries(CandlestickSeries, { upColor: UP, downColor: DOWN, borderVisible: false, wickUpColor: UP, wickDownColor: DOWN });
    volS.current = c.addSeries(HistogramSeries, { priceScaleId: "vol", priceFormat: { type: "volume" } });
    c.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    c.subscribeCrosshairMove((p) => {
      const d = p.time ? data.current.find((x) => x.time === p.time) : undefined;
      setLegend(d ?? data.current[data.current.length - 1] ?? null);
    });
    chart.current = c;
    return () => c.remove();
  }, []);

  // price formatter per mode
  useEffect(() => {
    candleS.current?.applyOptions({ priceFormat: { type: "custom", formatter: (v: number) => fmt(v), minMove: mode === "mcap" ? 1 : 1e-10 } });
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // load real candles, then poll for updates
  useEffect(() => {
    let alive = true;
    const push = (fit: boolean) => {
      candleS.current?.setData(data.current.map((d) => ({ time: d.time as UTCTimestamp, open: d.open * scale, high: d.high * scale, low: d.low * scale, close: d.close * scale })));
      volS.current?.setData(data.current.map((d) => ({ time: d.time as UTCTimestamp, value: d.volume, color: d.close >= d.open ? "rgba(63,191,143,.28)" : "rgba(240,86,111,.28)" })));
      if (fit) chart.current?.timeScale().fitContent();
    };
    const load = (fit: boolean) =>
      fetch(`/api/token/${token.address}/candles?tf=${tf}`)
        .then((r) => r.json())
        .then((d: { candles?: Candle[]; source?: string | null }) => {
          if (!alive) return;
          setLoaded(true);
          setSource(d.source ?? null);
          const candles = d.candles ?? [];
          // dedupe by time (lightweight-charts requires strictly ascending)
          data.current = [...new Map(candles.map((c) => [c.time, c])).values()].sort((a, b) => a.time - b.time);
          push(fit);
          const last = data.current[data.current.length - 1];
          setLegend(last ?? null);
          if (last) onPrice?.(last.close);
        })
        .catch(() => alive && setLoaded(true));
    setLoaded(false);
    load(true);
    const timer = setInterval(() => load(false), 15_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [token.address, tf, scale]); // eslint-disable-line react-hooks/exhaustive-deps

  const chg = legend ? ((legend.close - legend.open) / legend.open) * 100 : 0;

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <LineChart className="size-4 text-ink-2" />
        <h3 className="text-sm font-semibold">Live market</h3>
        <span className="ml-auto text-xs text-muted">{source ? `${token.dex ?? "DEX"} · via ${source}` : loaded ? "No chart data" : "Loading…"}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
        <div className="seg">
          {(Object.keys(TIMEFRAMES) as Timeframe[]).map((t) => (
            <button key={t} data-on={tf === t} onClick={() => setTf(t)}>{t}</button>
          ))}
        </div>
        <div className="seg ml-auto">
          <button data-on={mode === "price"} onClick={() => setMode("price")}>Price</button>
          <button data-on={mode === "mcap"} onClick={() => setMode("mcap")} disabled={!token.totalSupply}>Market cap</button>
        </div>
      </div>
      {legend && (
        <div className="num flex flex-wrap gap-x-3 gap-y-1 px-4 pt-2 text-xs">
          <span className="font-bold">{token.symbol} · {tf}</span>
          <span className="text-muted">O <span className="text-ink">{fmt(legend.open * scale)}</span></span>
          <span className="text-muted">H <span className="text-ink">{fmt(legend.high * scale)}</span></span>
          <span className="text-muted">L <span className="text-ink">{fmt(legend.low * scale)}</span></span>
          <span className="text-muted">C <span className="text-ink">{fmt(legend.close * scale)}</span></span>
          <span className={chg >= 0 ? "text-up" : "text-down"}>{pct(chg, 2)}</span>
          <span className="text-muted">Vol <span className="text-ink">{usd(legend.volume, { compact: true })}</span></span>
        </div>
      )}
      <div className="relative">
        <div ref={box} className="h-[360px] w-full sm:h-[440px]" />
        {loaded && !legend && (
          <div className="absolute inset-0 grid place-items-center bg-surface/70 text-sm text-muted">
            No price history yet — the chart fills in once the pool has trades.
          </div>
        )}
      </div>
    </div>
  );
}
