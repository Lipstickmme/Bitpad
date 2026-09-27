export function usd(n: number, opts: { compact?: boolean; digits?: number } = {}): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (opts.compact && abs >= 1000) {
    return (
      (n < 0 ? "-$" : "$") +
      new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(abs)
    );
  }
  if (abs > 0 && abs < 0.01) return `$${significant(n)}`;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: opts.digits ?? (abs >= 1000 ? 0 : abs >= 1 ? 2 : 4),
    minimumFractionDigits: opts.digits ?? (abs >= 1000 ? 0 : 2),
  }).format(n);
}

export function price(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n === 0) return "$0";
  if (Math.abs(n) < 0.0001) return `$${significant(n)}`;
  if (Math.abs(n) < 1) return `$${n.toFixed(5)}`;
  return usd(n, { digits: n >= 1000 ? 2 : 4 });
}

/** 0.00000123 → "0.0₅123" — the subscript-zero notation traders expect */
export function significant(n: number): string {
  const s = Math.abs(n).toFixed(20);
  const m = s.match(/^0\.(0+)(\d{1,4})/);
  if (!m) return Math.abs(n).toPrecision(4);
  const zeros = m[1].length;
  const sub = String(zeros)
    .split("")
    .map((d) => "₀₁₂₃₄₅₆₇₈₉"[Number(d)])
    .join("");
  return `${n < 0 ? "-" : ""}0.0${sub}${m[2]}`;
}

export function num(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    notation: Math.abs(n) >= 100_000 ? "compact" : "standard",
    maximumFractionDigits: digits,
  }).format(n);
}

export function pct(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return "—";
  return `${n > 0 ? "+" : ""}${n.toFixed(digits)}%`;
}

export function shortAddr(a: string, head = 4, tail = 4): string {
  if (!a) return "";
  return a.length <= head + tail + 1 ? a : `${a.slice(0, head)}…${a.slice(-tail)}`;
}

export function ago(ts: number): string {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
