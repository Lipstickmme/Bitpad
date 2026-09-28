"use client";

/**
 * Referral links: https://<site>/token/<token>?ref=<referrer wallet>.
 * The link a visitor arrives through is remembered per token (localStorage)
 * and attached to their buys and sells. Buys without a valid link fall back
 * to the creator's own link, which the pool always accepts.
 */
const key = (token: string) => `bitpad.ref.${token}`;

export function referralLink(origin: string, token: string, referrer: string) {
  return `${origin}/token/${token}?ref=${encodeURIComponent(referrer)}`;
}

/** Call on the token page: store ?ref= if present, return the active referrer (if any). */
export function captureReferral(token: string): string | null {
  try {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) localStorage.setItem(key(token), ref);
    return ref ?? localStorage.getItem(key(token));
  } catch {
    return null;
  }
}

export function forgetReferral(token: string) {
  try {
    localStorage.removeItem(key(token));
  } catch {
    /* storage unavailable */
  }
}
