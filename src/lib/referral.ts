"use client";
import { Address } from "@ton/core";

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

/** The link remembered for a token (from an earlier visit), without reading the URL. */
export function storedReferral(token: string): string | null {
  try {
    return localStorage.getItem(key(token));
  } catch {
    return null;
  }
}

/**
 * General referral (any page, `?r=<wallet>`): first link wins and is kept in
 * this browser. Returned for every Bitpad-routed buy so the on-chain fee
 * transfer names the referrer. Never the buyer themselves.
 */
const GREF = "bitpad.gref";
export function captureGeneralReferral() {
  try {
    const r = new URLSearchParams(window.location.search).get("r");
    if (r && /^[A-Za-z0-9_\-:]{40,70}$/.test(r) && !localStorage.getItem(GREF)) localStorage.setItem(GREF, r);
  } catch {
    /* storage unavailable */
  }
}
export function generalReferrer(self?: string | null): string | null {
  try {
    const r = localStorage.getItem(GREF);
    if (!r) return null;
    if (self) {
      try {
        if (Address.parse(r).equals(Address.parse(self))) return null;
      } catch {
        return null;
      }
    }
    return r;
  } catch {
    return null;
  }
}
