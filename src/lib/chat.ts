import { Address, Cell, beginCell, contractAddress, type Slice } from "@ton/core";

/**
 * Trench Chat — posts are messages to the TrenchChat contract
 * (contracts/chat.tact), which records them and stores nothing. This file is
 * the one place that defines the body layout; the app writes and reads it.
 *
 *   uint32  op = 0x42504c80
 *   uint8   kind        0 post · 1 reply · 2 like · 3 call (holder thesis)
 *   uint256 parent      tx hash replied to / liked (0 = none)
 *   Address? token      the jetton a call is about
 *   ^Cell   text        UTF-8, ≤ 280 chars
 *   Maybe ^Cell media   uint8 type (1 gif url · 2 image bytes · 3 sticker id) + data
 */
export const CHAT_OP = 0x42504c80;
export const KIND = { post: 0, reply: 1, like: 2, call: 3 } as const;
export type Kind = keyof typeof KIND;
export const MAX_TEXT = 280;
export const MAX_IMAGE_BYTES = 3000;
/** TON attached per post: covers the contract's compute fee; the rest stays in the room. */
export const POST_VALUE = 5_000_000n; // 0.005 TON

/** Compiled contracts/chat.tact (tests check it matches a fresh build). */
export const CHAT_CODE_HEX = "b5ee9c7241020701000102000114ff00f4a413f4bcf2c80b010201620205018ed0eda2edfb01d072d721d200d200fa4021103450666f04f86102f862ed44d0fa40013102915be07021d74920c21f963121d70b1f01de21c00001c121b0925f03e0c000915be30d0301f4f90182f0095190194aee611ce895c5503adf85fd864de7905746142f608d3eb2faad14e4ba8ed182008aabf84222c705f2f4820afaf08070fb02708306708810246d50436d03c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb00db31e030040028000000005472656e6368436861742073776565700119a08a3bda89a1f4800263b678630600022072be24a6";

export function chatInit(owner: string | Address) {
  const code = Cell.fromHex(CHAT_CODE_HEX);
  const data = beginCell().storeAddress(typeof owner === "string" ? Address.parse(owner) : owner).endCell();
  return { code, data };
}
export const chatAddress = (owner: string | Address) => contractAddress(0, chatInit(owner));

export type Media = { type: "gif"; url: string } | { type: "image"; bytes: Uint8Array } | { type: "sticker"; id: string };
export interface PostInput {
  kind: Kind;
  parent?: string | null; // tx hash (base64 or hex)
  token?: string | null;
  text: string;
  media?: Media | null;
}

const GIF_HOSTS = /^https:\/\/(media\d*\.giphy\.com|i\.giphy\.com|media\.tenor\.com|c\.tenor\.com)\//;
export const isAllowedGif = (url: string) => GIF_HOSTS.test(url) && url.length <= 300;
export const STICKERS = ["believe", "gm", "lfg", "wagmi", "ngmi", "moon", "rekt", "ape"] as const;

function hashToBigInt(h?: string | null): bigint {
  if (!h) return 0n;
  const buf = /^[0-9a-f]{64}$/i.test(h) ? Buffer.from(h, "hex") : Buffer.from(h, "base64");
  return buf.length === 32 ? BigInt("0x" + buf.toString("hex")) : 0n;
}
export const hashHex = (h: string) => (/^[0-9a-f]{64}$/i.test(h) ? h.toLowerCase() : Buffer.from(h, "base64").toString("hex"));

function bytesCell(bytes: Uint8Array): Cell {
  // snake: 127 bytes per cell
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < bytes.length; i += 127) chunks.push(bytes.slice(i, i + 127));
  let tail: Cell | null = null;
  for (let i = chunks.length - 1; i >= 0; i--) {
    const b = beginCell().storeBuffer(Buffer.from(chunks[i]));
    if (tail) b.storeRef(tail);
    tail = b.endCell();
  }
  return tail ?? beginCell().endCell();
}
function readBytes(s: Slice): Uint8Array {
  const out: number[] = [];
  let cur: Slice | null = s;
  while (cur) {
    const n = cur.remainingBits / 8;
    out.push(...cur.loadBuffer(n));
    cur = cur.remainingRefs ? cur.loadRef().beginParse() : null;
  }
  return Uint8Array.from(out);
}

export function encodePost(p: PostInput): Cell {
  const text = [...p.text].slice(0, MAX_TEXT).join("");
  const b = beginCell()
    .storeUint(CHAT_OP, 32)
    .storeUint(KIND[p.kind], 8)
    .storeUint(hashToBigInt(p.parent), 256)
    .storeAddress(p.token ? Address.parse(p.token) : null)
    .storeRef(beginCell().storeStringTail(text).endCell());
  if (!p.media) return b.storeBit(false).endCell();
  let m: Cell;
  if (p.media.type === "gif") {
    if (!isAllowedGif(p.media.url)) throw new Error("GIFs must be Giphy or Tenor links");
    m = beginCell().storeUint(1, 8).storeStringTail(p.media.url).endCell();
  } else if (p.media.type === "image") {
    if (p.media.bytes.length > MAX_IMAGE_BYTES) throw new Error(`Image too large (max ${MAX_IMAGE_BYTES} bytes)`);
    m = beginCell().storeUint(2, 8).storeRef(bytesCell(p.media.bytes)).endCell();
  } else {
    m = beginCell().storeUint(3, 8).storeStringTail(p.media.id).endCell();
  }
  return b.storeBit(true).storeRef(m).endCell();
}

export interface DecodedPost {
  kind: Kind;
  parent: string | null; // hex
  token: string | null;
  text: string;
  media: { type: "gif"; url: string } | { type: "image"; dataUrl: string } | { type: "sticker"; id: string } | null;
}

const KINDS = Object.fromEntries(Object.entries(KIND).map(([k, v]) => [v, k])) as Record<number, Kind>;

/** Image magic numbers we render (anything else is dropped). */
function imageMime(b: Uint8Array): string | null {
  if (b[0] === 0x89 && b[1] === 0x50) return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8) return "image/jpeg";
  if (b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57 && b[9] === 0x45) return "image/webp";
  if (b[0] === 0x47 && b[1] === 0x49) return "image/gif";
  return null;
}

export function decodePost(body: Cell): DecodedPost | null {
  try {
    const s = body.beginParse();
    if (s.remainingBits < 32 || s.loadUint(32) !== CHAT_OP) return null;
    const kind = KINDS[s.loadUint(8)];
    if (!kind) return null;
    const parent = s.loadUintBig(256);
    const token = s.loadMaybeAddress();
    const text = s.loadRef().beginParse().loadStringTail().slice(0, MAX_TEXT * 2);
    let media: DecodedPost["media"] = null;
    if (s.remainingBits > 0 && s.loadBit()) {
      const m = s.loadRef().beginParse();
      const t = m.loadUint(8);
      if (t === 1) {
        const url = m.loadStringTail();
        if (isAllowedGif(url)) media = { type: "gif", url };
      } else if (t === 2) {
        const bytes = readBytes(m.loadRef().beginParse());
        const mime = bytes.length <= MAX_IMAGE_BYTES ? imageMime(bytes) : null;
        if (mime) media = { type: "image", dataUrl: `data:${mime};base64,${Buffer.from(bytes).toString("base64")}` };
      } else if (t === 3) {
        const id = m.loadStringTail();
        if ((STICKERS as readonly string[]).includes(id)) media = { type: "sticker", id };
      }
    }
    return { kind, parent: parent ? parent.toString(16).padStart(64, "0") : null, token: token ? token.toString() : null, text, media };
  } catch {
    return null;
  }
}
