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
