"use client";
import { useEffect, useRef, useState } from "react";
import { CandlestickSeries, ColorType, CrosshairMode, HistogramSeries, createChart, type IChartApi, type ISeriesApi, type UTCTimestamp } from "lightweight-charts";
import { LineChart } from "lucide-react";
import type { BitpadToken, Candle } from "@/lib/types";
import { TIMEFRAMES, type Timeframe } from "@/lib/demo";
import { price, usd, pct } from "@/lib/format";

const UP = "#0f9d58";
const DOWN = "#d93a3a";

export function PriceChart({ token, onPrice }: { token: BitpadToken; onPrice?: (p: number) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const candleS = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volS = useRef<ISeriesApi<"Histogram"> | null>(null);
  const data = useRef<Candle[]>([]);
  const [tf, setTf] = useState<Timeframe>("1m");
  const [mode, setMode] = useState<"price" | "mcap">("price");
  const [legend, setLegend] = useState<Candle | null>(null);

  const scale = mode === "mcap" ? token.totalSupply : 1;
  const fmt = (v: number) => (mode === "mcap" ? usd(v, { compact: true }) : price(v));

  // create chart once
  useEffect(() => {
    if (!box.current) return;
    const c = createChart(box.current, {
      autoSize: true,
      localization: { locale: "en-US" },
      layout: { background: { type: ColorType.Solid, color: "#ffffff" }, textColor: "#8492a6", fontFamily: "Inter, system-ui, sans-serif", fontSize: 11, attributionLogo: false },
      grid: { vertLines: { color: "#eef1f5" }, horzLines: { color: "#eef1f5" } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "#e3e8ef", scaleMargins: { top: 0.1, bottom: 0.25 } },
      timeScale: { borderColor: "#e3e8ef", timeVisible: true, secondsVisible: false },
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

  // load + live ticks
  useEffect(() => {
    let alive = true;
    const push = () => {
      candleS.current?.setData(data.current.map((d) => ({ time: d.time as UTCTimestamp, open: d.open * scale, high: d.high * scale, low: d.low * scale, close: d.close * scale })));
      volS.current?.setData(data.current.map((d) => ({ time: d.time as UTCTimestamp, value: d.volume, color: d.close >= d.open ? "rgba(15,157,88,.35)" : "rgba(217,58,58,.35)" })));
    };
    fetch(`/api/token/${token.address}?tf=${tf}`)
      .then((r) => r.json())
      .then((d: { candles: Candle[] }) => {
        if (!alive) return;
        data.current = d.candles;
        push();
        chart.current?.timeScale().fitContent();
        setLegend(d.candles[d.candles.length - 1]);
      });

    // Demo tokens get a simulated tape; live tokens would subscribe to the indexer stream here.
    const step = TIMEFRAMES[tf];
    const timer = setInterval(() => {
      const arr = data.current;
      const last = arr[arr.length - 1];
      if (!last) return;
      const drift = (Math.random() - 0.495) * 0.0025;
      const px = last.close * (1 + drift);
      const now = Math.floor(Date.now() / 1000 / step) * step;
      const vol = Math.random() * (token.volume24h / (86400 / step)) * 0.15;
      if (now > last.time) {
        arr.push({ time: now, open: last.close, high: Math.max(last.close, px), low: Math.min(last.close, px), close: px, volume: vol });
      } else {
        Object.assign(last, { close: px, high: Math.max(last.high, px), low: Math.min(last.low, px), volume: last.volume + vol });
      }
      const c = arr[arr.length - 1];
      candleS.current?.update({ time: c.time as UTCTimestamp, open: c.open * scale, high: c.high * scale, low: c.low * scale, close: c.close * scale });
      volS.current?.update({ time: c.time as UTCTimestamp, value: c.volume, color: c.close >= c.open ? "rgba(15,157,88,.35)" : "rgba(217,58,58,.35)" });
      setLegend({ ...c });
      onPrice?.(c.close);
    }, 2000);
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
        <h3 className="font-bold">Live market</h3>
        <span className="ml-auto text-xs text-muted">STON.fi</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
        <div className="seg">
          {(Object.keys(TIMEFRAMES) as Timeframe[]).map((t) => (
            <button key={t} data-on={tf === t} onClick={() => setTf(t)}>{t}</button>
          ))}
        </div>
        <div className="seg ml-auto">
          <button data-on={mode === "price"} onClick={() => setMode("price")}>Price</button>
          <button data-on={mode === "mcap"} onClick={() => setMode("mcap")}>Market cap</button>
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
      <div ref={box} className="h-[360px] w-full sm:h-[440px]" />
    </div>
  );
}
