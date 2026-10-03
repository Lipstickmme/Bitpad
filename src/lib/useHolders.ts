"use client";
import { useEffect, useState } from "react";

const cache = new Map<string, number | null>();

/** Holder counts for the rows on screen, fetched after the table renders (cached for the session). */
export function useHolders(chain: string, addresses: (string | undefined)[]): Record<string, number | null> {
  const list = addresses.filter((a): a is string => !!a);
  const key = `${chain}|${list.join(",")}`;
  const [, bump] = useState(0);
  useEffect(() => {
    const need = list.filter((a) => !cache.has(`${chain}:${a}`));
    if (!need.length) return;
    let live = true;
    fetch(`/api/holders?chain=${chain}&a=${need.join(",")}`)
      .then((r) => r.json())
      .then((d: { counts?: Record<string, number | null> }) => {
        for (const a of need) cache.set(`${chain}:${a}`, d.counts?.[a] ?? null);
        if (live) bump((n) => n + 1);
      })
      .catch(() => {});
    return () => { live = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return Object.fromEntries(list.map((a) => [a, cache.get(`${chain}:${a}`) ?? null]));
}
