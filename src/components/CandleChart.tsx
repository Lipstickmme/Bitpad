"use client";
import { useEffect, useRef, useState } from "react";
import { CandlestickSeries, ColorType, CrosshairMode, HistogramSeries, createChart, type IChartApi, type ISeriesApi, type UTCTimestamp } from "lightweight-charts";
import { LineChart } from "lucide-react";
import type { Candle } from "@/lib/types";
import { pct, price, usd } from "@/lib/format";

const UP = "#3fbf8f";
const DOWN = "#f0566f";

/**
 * Candlestick chart over any candle endpoint: `${url}?tf=<tf>` must return
 * `{ candles: Candle[], source?: string }`. Polls every 20s.
 */
export function CandleChart({ url, symbol, timeframes, initial, title = "Chart", sources, onSource }: {
  url: string;
  symbol: string;
  timeframes: string[];
  initial?: string;
  title?: string;
  /** Optional source toggle (e.g. real market vs on-TON) */
  sources?: { id: string; label: string }[];
  onSource?: (id: string) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const candleS = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volS = useRef<ISeriesApi<"Histogram"> | null>(null);
  const data = useRef<Candle[]>([]);
  const [tf, setTf] = useState(initial ?? timeframes[0]);
  const [src, setSrc] = useState(sources?.[0]?.id);
  const [label, setLabel] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [legend, setLegend] = useState<Candle | null>(null);

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
    candleS.current = c.addSeries(CandlestickSeries, { upColor: UP, downColor: DOWN, borderVisible: false, wickUpColor: UP, wickDownColor: DOWN, priceFormat: { type: "custom", formatter: (v: number) => price(v), minMove: 1e-10 } });
    volS.current = c.addSeries(HistogramSeries, { priceScaleId: "vol", priceFormat: { type: "volume" } });
    c.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    c.subscribeCrosshairMove((p) => setLegend((p.time ? data.current.find((x) => x.time === p.time) : undefined) ?? data.current[data.current.length - 1] ?? null));
    chart.current = c;
    return () => c.remove();
  }, []);

  useEffect(() => {
    let alive = true;
    const load = (fit: boolean) =>
      fetch(`${url}?tf=${tf}${src ? `&src=${src}` : ""}`)
        .then((r) => r.json())
        .then((d: { candles?: Candle[]; source?: string | null }) => {
          if (!alive) return;
          setLoaded(true);
          setLabel(d.source ?? null);
          data.current = [...new Map((d.candles ?? []).map((c) => [c.time, c])).values()].sort((a, b) => a.time - b.time);
          candleS.current?.setData(data.current.map((c) => ({ time: c.time as UTCTimestamp, open: c.open, high: c.high, low: c.low, close: c.close })));
          volS.current?.setData(data.current.map((c) => ({ time: c.time as UTCTimestamp, value: c.volume, color: c.close >= c.open ? "rgba(63,191,143,.28)" : "rgba(240,86,111,.28)" })));
          if (fit) chart.current?.timeScale().fitContent();
          setLegend(data.current[data.current.length - 1] ?? null);
        })
        .catch(() => alive && setLoaded(true));
    setLoaded(false);
    load(true);
    const t = setInterval(() => load(false), 20_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [url, tf, src]);

  const chg = legend ? ((legend.close - legend.open) / legend.open) * 100 : 0;
  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <LineChart className="size-4 text-ink-2" />
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="ml-auto text-xs text-muted">{label ? `via ${label}` : loaded ? "No chart data" : "Loading…"}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
        <div className="seg">
          {timeframes.map((t) => <button key={t} data-on={tf === t} onClick={() => setTf(t)}>{t}</button>)}
        </div>
        {sources && (
          <div className="seg ml-auto">
            {sources.map((s) => <button key={s.id} data-on={src === s.id} onClick={() => { setSrc(s.id); onSource?.(s.id); }}>{s.label}</button>)}
          </div>
        )}
      </div>
      {legend && (
        <div className="num flex flex-wrap gap-x-3 gap-y-1 px-4 pt-2 text-xs">
          <span className="font-bold">{symbol} · {tf}</span>
          <span className="text-muted">O <span className="text-ink">{price(legend.open)}</span></span>
          <span className="text-muted">H <span className="text-ink">{price(legend.high)}</span></span>
          <span className="text-muted">L <span className="text-ink">{price(legend.low)}</span></span>
          <span className="text-muted">C <span className="text-ink">{price(legend.close)}</span></span>
          <span className={chg >= 0 ? "text-up" : "text-down"}>{pct(chg, 2)}</span>
          {legend.volume > 0 && <span className="text-muted">Vol <span className="text-ink">{usd(legend.volume, { compact: true })}</span></span>}
        </div>
      )}
      <div className="relative">
        <div ref={box} className="h-[360px] w-full sm:h-[440px]" />
        {loaded && !legend && <div className="absolute inset-0 grid place-items-center bg-surface/70 text-sm text-muted">No price history from this source right now.</div>}
      </div>
    </div>
  );
}
