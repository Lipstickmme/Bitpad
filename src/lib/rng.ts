/** Deterministic PRNG helpers so demo data is stable across server & client renders. */
export function hashSeed(s: string): number {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return (h >>> 0) || 1;
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rngFor(key: string) {
  const r = mulberry32(hashSeed(key));
  return {
    next: r,
    range: (lo: number, hi: number) => lo + (hi - lo) * r(),
    int: (lo: number, hi: number) => Math.floor(lo + (hi - lo + 1) * r()),
    pick: <T,>(arr: readonly T[]) => arr[Math.floor(r() * arr.length)],
    normal: () => {
      const u = Math.max(1e-9, r());
      const v = r();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
  };
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
export function fakeTonAddress(key: string): string {
  const r = rngFor(`addr:${key}`);
  let s = "EQ";
  for (let i = 0; i < 46; i++) s += B64[r.int(0, 63)];
  return s;
}
export function fakeTxHash(key: string): string {
  const r = rngFor(`tx:${key}`);
  let s = "";
  for (let i = 0; i < 64; i++) s += "0123456789abcdef"[r.int(0, 15)];
  return s;
}
