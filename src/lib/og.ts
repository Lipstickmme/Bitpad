/**
 * OG grade by age: tokens that have survived years of markets.
 *   ★★★  3+ years   ★★  2+ years   ★  1+ year   (younger: no badge)
 * Age is the token's oldest known pool, which tracks when it started trading.
 */
export function ogGrade(createdAtMs: number | null | undefined, now = Date.now()): 0 | 1 | 2 | 3 {
  if (!createdAtMs || !Number.isFinite(createdAtMs) || createdAtMs > now) return 0;
  const years = (now - createdAtMs) / (365.25 * 86_400_000);
  return years >= 3 ? 3 : years >= 2 ? 2 : years >= 1 ? 1 : 0;
}
