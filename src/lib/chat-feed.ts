import "server-only";
import { Address, Cell } from "@ton/core";
import { config } from "./config";
import { ensureRuntimeConfig } from "./runtime";
import { getJson, memo, safe } from "./data/http";
import { accountJettons, friendly } from "./data/tonapi";
import { chatAddress, decodePost, hashHex, type DecodedPost } from "./chat";

export interface ChatMessage extends DecodedPost {
  id: string; // tx hash (hex)
  time: number;
  author: string;
  likes: number;
  replies: number;
  /** Calls only: the author held the token when we last checked */
  holder?: boolean;
}

const tc = () => (process.env.TONCENTER_API_KEY ? { "x-api-key": process.env.TONCENTER_API_KEY } : undefined);

interface RawTx { hash: string; time: number; from: string; body: Cell; aborted: boolean }

async function txsToncenter(room: string): Promise<RawTx[]> {
  const res = await getJson<{ transactions: { hash: string; now: number; description?: { aborted?: boolean }; in_msg?: { source?: string | null; message_content?: { body?: string } } }[] }>(
    `https://toncenter.com/api/v3/transactions?account=${encodeURIComponent(room)}&limit=200&sort=desc`,
    { revalidate: 4, headers: tc() },
  );
  return res.transactions
    .filter((t) => t.in_msg?.source && t.in_msg.message_content?.body)
    .map((t) => ({ hash: hashHex(t.hash), time: t.now * 1000, from: friendly(t.in_msg!.source!, false), body: Cell.fromBase64(t.in_msg!.message_content!.body!), aborted: !!t.description?.aborted }));
}

async function txsTonapi(room: string): Promise<RawTx[]> {
  const res = await getJson<{ transactions: { hash: string; utime: number; aborted?: boolean; in_msg?: { source?: { address: string }; raw_body?: string } }[] }>(
    `https://tonapi.io/v2/blockchain/accounts/${encodeURIComponent(room)}/transactions?limit=200&sort_order=desc`,
    { revalidate: 4, headers: process.env.TONAPI_KEY ? { authorization: `Bearer ${process.env.TONAPI_KEY}` } : undefined },
  );
  return res.transactions
    .filter((t) => t.in_msg?.source && t.in_msg.raw_body)
    .map((t) => ({ hash: hashHex(t.hash), time: t.utime * 1000, from: friendly(t.in_msg!.source!.address, false), body: Cell.fromBoc(Buffer.from(t.in_msg!.raw_body!, "hex"))[0], aborted: !!t.aborted }));
}

/** Does `owner` hold any of `token` right now? (cached 2 min) */
function holds(owner: string, token: string) {
  return memo(`holds:${owner}:${token}`, 120_000, async () => {
    const t = Address.parse(token);
    const list = await accountJettons(owner);
    return list.some((b) => BigInt(b.balance) > 0n && Address.parse(b.jetton.address).equals(t));
  }).catch(() => false);
}

/** The room's recent posts, newest first, with like/reply counts and holder badges on calls. */
export function getChat() {
  return memo("trench-chat", 4_000, async () => {
    await ensureRuntimeConfig();
    if (!config.feeWallet) return { room: null, deployed: false, messages: [] as ChatMessage[], ok: false };
    const room = chatAddress(config.feeWallet).toString();
    let raw: RawTx[] = [];
    let ok = false;
    for (const fn of [txsToncenter, txsTonapi]) {
      const r = await safe(fn(room), [] as RawTx[], "chat txs");
      if (r.ok) {
        raw = r.value;
        ok = true;
        break;
      }
    }
    const posts: ChatMessage[] = [];
    const likes = new Map<string, Set<string>>();
    const replies = new Map<string, number>();
    for (const t of raw) {
      if (t.aborted) continue;
      const d = decodePost(t.body);
      if (!d) continue;
      if (d.kind === "like") {
        if (d.parent) (likes.get(d.parent) ?? likes.set(d.parent, new Set()).get(d.parent)!).add(t.from); // one like per wallet
        continue;
      }
      if (d.kind === "reply" && d.parent) replies.set(d.parent, (replies.get(d.parent) ?? 0) + 1);
      posts.push({ ...d, id: t.hash, time: t.time, author: t.from, likes: 0, replies: 0 });
    }
    for (const p of posts) {
      p.likes = likes.get(p.id)?.size ?? 0;
      p.replies = replies.get(p.id) ?? 0;
    }
    await Promise.all(posts.filter((p) => p.kind === "call" && p.token).slice(0, 40).map(async (p) => (p.holder = await holds(p.author, p.token!))));
    return { room, deployed: raw.length > 0, messages: posts, ok, likedBy: Object.fromEntries([...likes].map(([k, v]) => [k, [...v]])) };
  });
}
