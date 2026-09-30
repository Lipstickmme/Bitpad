"use client";
import type { ChainId } from "@/lib/types";
import { CandleChart } from "./CandleChart";

export function PoolChart({ chain, pool, symbol }: { chain: ChainId; pool: string; symbol: string }) {
  return <CandleChart url={`/api/pool/${chain}/${pool}/candles`} symbol={symbol} timeframes={["1m", "5m", "15m", "1h", "4h", "1D"]} initial="15m" title="Live market" />;
}
