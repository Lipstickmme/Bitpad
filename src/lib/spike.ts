/**
 * Unusual volume: the last hour traded more than 4× the day's hourly average
 * (with real size behind it), or the day's volume turned the pool over 8×.
 * Used to softly pulse rows and cards.
 */
export function volumeSpike(t: { volume1h?: number | null; volume24h?: number | null; liquidityUsd?: number | null }): boolean {
  const v24 = t.volume24h ?? 0;
  const v1 = t.volume1h ?? null;
  if (v1 != null && v1 >= 25_000 && v24 > 0 && v1 > (v24 / 24) * 4) return true;
  const liq = t.liquidityUsd ?? 0;
  return v24 >= 100_000 && liq > 0 && v24 > liq * 8;
}
