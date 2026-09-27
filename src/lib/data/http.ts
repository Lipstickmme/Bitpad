/** Server-side JSON fetch with timeout + Next.js data cache revalidation. */
export async function getJson<T>(url: string, opts: { revalidate?: number; timeoutMs?: number; headers?: Record<string, string> } = {}): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 8000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { accept: "application/json", ...opts.headers },
      next: { revalidate: opts.revalidate ?? 120 },
    } as RequestInit);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} ← ${url}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/** Resolve a promise, returning `fallback` (and logging) on any failure. */
export async function safe<T>(p: Promise<T>, fallback: T, label: string): Promise<{ value: T; ok: boolean }> {
  try {
    return { value: await p, ok: true };
  } catch (err) {
    if (process.env.NODE_ENV !== "production") console.warn(`[data] ${label} unavailable:`, (err as Error).message);
    return { value: fallback, ok: false };
  }
}

/** In-process TTL memo for SDK calls that bypass Next's fetch cache. */
const memoStore = new Map<string, { at: number; p: Promise<unknown> }>();
export function memo<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = memoStore.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.p as Promise<T>;
  const p = fn().catch((e) => {
    memoStore.delete(key);
    throw e;
  });
  memoStore.set(key, { at: Date.now(), p });
  return p;
}

/** First source that resolves with a usable value wins. */
export async function firstOf<T>(label: string, sources: [string, () => Promise<T>][], usable: (v: T) => boolean = (v) => v != null): Promise<{ value: T | null; source: string | null }> {
  for (const [name, fn] of sources) {
    try {
      const v = await fn();
      if (usable(v)) return { value: v, source: name };
    } catch (err) {
      if (process.env.NODE_ENV !== "production") console.warn(`[data] ${label} via ${name} failed:`, (err as Error).message);
    }
  }
  return { value: null, source: null };
}
