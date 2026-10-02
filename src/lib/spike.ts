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

/** Sudden price jump: +8% in 5 minutes or +20% in the last hour. */
export function priceSpike(t: { changes?: { m5: number; h1: number } | null; change1h?: number | null }): boolean {
  const m5 = t.changes?.m5 ?? 0;
  const h1 = t.changes?.h1 ?? t.change1h ?? 0;
  return m5 >= 8 || h1 >= 20;
}

type Spiky = Parameters<typeof volumeSpike>[0] & Parameters<typeof priceSpike>[0];

/** Hot right now: a sudden price jump or unusual volume. Cards shake and get a flame. */
export function isHot(t: Spiky): boolean {
  return priceSpike(t) || volumeSpike(t);
}

export function hotReason(t: Spiky): string | undefined {
  const p = priceSpike(t), v = volumeSpike(t);
  if (p && v) return "Hot: price and volume spiking";
  if (p) return "Hot: sudden price jump";
  if (v) return "Hot: unusual volume right now";
  return undefined;
}
