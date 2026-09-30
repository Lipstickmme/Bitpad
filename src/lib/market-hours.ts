/**
 * US equity session (NYSE/Nasdaq regular hours, 9:30–16:00 New York time,
 * Mon–Fri). Exchange holidays aren't modelled, so it's labelled approximate.
 */
export function usMarket(now = new Date()): { open: boolean; label: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric", minute: "numeric", hour12: false })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const mins = (Number(parts.hour) % 24) * 60 + Number(parts.minute);
  const weekday = !["Sat", "Sun"].includes(parts.weekday);
  const open = weekday && mins >= 570 && mins < 960;
  return { open, label: open ? "US market open" : weekday && mins < 570 ? "Pre-market" : weekday && mins >= 960 ? "After hours" : "Weekend" };
}

/** Gap between the on-chain price and the real-market price, in %. */
export function priceGap(onchain: number | null | undefined, oracle: number | null | undefined) {
  return onchain && oracle ? ((onchain - oracle) / oracle) * 100 : null;
}
