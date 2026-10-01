import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { Address } from "@ton/core";
import { botToken, sessionSecret } from "./telegram";
import type { CreatorProfile, MarketToken } from "./types";
import type { Launch } from "./launches";

/**
 * Creator jettons: every Bitpad launch is a creator's own coin, backed by a
 * pool against a stock, commodity or jetton (tagged bitpad_type "creator" in
 * its metadata since the rebrand; older launches count too). When the creator
 * is logged in with Telegram, Bitpad signs their Telegram identity together
 * with the launching wallet and ticker; the signature goes into the metadata,
 * so anyone can later check the coin really belongs to that Telegram account.
 * The proof is bound to the wallet, and the factory records the launching
 * wallet on-chain, so a copied proof is useless from another wallet.
 */
const key = () => createHmac("sha256", sessionSecret()).update("creator-jetton").digest();

const norm = (wallet: string) => Address.parse(wallet).toRawString();
const payload = (tgId: number, username: string, wallet: string, symbol: string) => `${tgId}|${username.toLowerCase()}|${norm(wallet)}|${symbol.toUpperCase()}`;

export function signCreator(tgId: number, username: string, wallet: string, symbol: string): string {
  return createHmac("sha256", key()).update(payload(tgId, username, wallet, symbol)).digest("base64url");
}

export function verifyCreator(meta: Launch["meta"], creatorWallet?: string): boolean {
  if (!botToken() || !meta.creator_sig || !meta.creator_tg_id || !creatorWallet || !meta.symbol) return false;
  try {
    const expect = Buffer.from(signCreator(Number(meta.creator_tg_id), meta.creator_tg ?? "", creatorWallet, meta.symbol));
    const got = Buffer.from(meta.creator_sig);
    return expect.length === got.length && timingSafeEqual(expect, got);
  } catch {
    return false;
  }
}

/** Every Bitpad launch is a creator jetton; `verified` only when the Telegram proof checks out. */
export function creatorProfile(l: Launch): CreatorProfile {
  return { tg: l.meta.creator_tg, tgId: l.meta.creator_tg_id ? Number(l.meta.creator_tg_id) : undefined, name: l.meta.creator_name, verified: verifyCreator(l.meta, l.creator) };
}

/** Creator jettons among Bitpad tokens, with how many launches pair against each. */
export function creatorBoard(tokens: MarketToken[]) {
  const creators = tokens.filter((t) => t.bitpad?.creatorJetton);
  return creators
    .map((c) => ({ token: c, paired: tokens.filter((t) => t.bitpad?.pairMaster && t.bitpad.pairMaster === c.address) }))
    .sort((a, b) => Number(!!b.token.bitpad!.creatorJetton!.verified) - Number(!!a.token.bitpad!.creatorJetton!.verified) || (b.token.marketCap ?? 0) - (a.token.marketCap ?? 0));
}
