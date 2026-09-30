"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTonAddress, useTonConnectUI } from "@tonconnect/ui-react";
import { beginCell, storeStateInit } from "@ton/core";
import { Heart, ImagePlus, MessageCircle, Megaphone, Send, Smile, Sticker, X } from "lucide-react";
import { config } from "@/lib/config";
import { chatInit, encodePost, isAllowedGif, MAX_IMAGE_BYTES, MAX_TEXT, POST_VALUE, STICKERS, type Media, type PostInput } from "@/lib/chat";
import { ago, shortAddr } from "@/lib/format";
import { Mark } from "./Brand";
import { Hint } from "./ui";
import { toast } from "./Toast";
import { haptic } from "./TelegramBridge";

interface Msg {
  id: string;
  time: number;
  author: string;
  kind: "post" | "reply" | "like" | "call";
  parent: string | null;
  token: string | null;
  text: string;
  media: { type: "gif"; url: string } | { type: "image"; dataUrl: string } | { type: "sticker"; id: string } | null;
  likes: number;
  replies: number;
  liked?: boolean;
  holder?: boolean;
}

const EMOJIS = ["🚀", "🔥", "💎", "🙌", "😂", "🫡", "👀", "📈", "📉", "🐸", "🌕", "💀", "❤️", "🤝", "⚡", "🧠"];
const STICKER_LABEL: Record<string, string> = { believe: "BELIEVE IN TON", gm: "GM", lfg: "LFG", wagmi: "WAGMI", ngmi: "NGMI", moon: "TO THE MOON", rekt: "REKT", ape: "APE IN" };

/** Compress an image to ≤ MAX_IMAGE_BYTES (WebP, max 160px) so it can live on-chain. */
async function tinyImage(file: File): Promise<Uint8Array> {
  const img = await createImageBitmap(file);
  for (const size of [160, 128, 96, 72]) {
    const k = Math.min(1, size / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.width * k));
    c.height = Math.max(1, Math.round(img.height * k));
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    for (const q of [0.7, 0.5, 0.35, 0.2]) {
      const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/webp", q));
      if (blob && blob.size <= MAX_IMAGE_BYTES) return new Uint8Array(await blob.arrayBuffer());
    }
  }
  throw new Error("Couldn't shrink that image under 3 KB. Try a simpler one.");
}

export function TrenchChat() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"all" | "calls">("all");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [room, setRoom] = useState<{ address: string | null; deployed: boolean; ok: boolean }>({ address: null, deployed: false, ok: true });
  const [seen, setSeen] = useState(0);
  const wallet = useTonAddress();
  const [tc] = useTonConnectUI();
  const list = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    fetch(`/api/chat${wallet ? `?me=${wallet}` : ""}`)
      .then((r) => r.json())
      .then((d) => {
        setMsgs(d.messages ?? []);
        setRoom({ address: d.room, deployed: !!d.deployed, ok: !!d.ok });
      })
      .catch(() => {});
  }, [wallet]);
  useEffect(() => {
    load();
    const t = setInterval(load, open ? 6_000 : 30_000);
    return () => clearInterval(t);
  }, [load, open]);

  const latest = msgs[0]?.time ?? 0;
  useEffect(() => {
    if (open) setSeen(latest);
  }, [open, latest]);
  const unread = !open && latest > seen && seen > 0;
  useEffect(() => {
    if (!seen && latest) setSeen(latest);
  }, [latest, seen]);

  const top = useMemo(() => msgs.filter((m) => m.kind !== "reply" && (tab === "all" || m.kind === "call")).slice(0, 80).reverse(), [msgs, tab]);
  const repliesOf = useCallback((id: string) => msgs.filter((m) => m.kind === "reply" && m.parent === id).reverse(), [msgs]);
  useEffect(() => {
    if (open) list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [open, top.length]);

  async function post(p: PostInput) {
    haptic("medium");
    if (!wallet) {
      tc.openModal();
      throw new Error("Connect your TON wallet to post");
    }
    if (!room.address || !config.feeWallet) throw new Error("Chat room unavailable right now");
    const init = room.deployed ? undefined : beginCell().store(storeStateInit(chatInit(config.feeWallet))).endCell().toBoc().toString("base64");
    await tc.sendTransaction({
      validUntil: Math.floor(Date.now() / 1000) + 300,
      messages: [{ address: room.address, amount: POST_VALUE.toString(), payload: encodePost(p).toBoc().toString("base64"), ...(init ? { stateInit: init } : {}) }],
    });
    haptic("success");
    [4000, 9000, 16000].forEach((ms) => setTimeout(load, ms));
  }

  return (
    <>
      {!open && (
        <button onClick={() => setOpen(true)} className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full border border-line-strong bg-surface px-4 py-2.5 text-sm font-semibold shadow-2xl shadow-black/50 hover:bg-surface-2">
          <Mark size={18} /> Trench chat
          {unread && <span className="size-2 rounded-full bg-launch" />}
        </button>
      )}
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-bg sm:inset-auto sm:bottom-4 sm:right-4 sm:h-[620px] sm:w-[400px] sm:rounded-2xl sm:border sm:border-line-strong sm:shadow-2xl sm:shadow-black/60">
          <div className="flex items-center gap-2 border-b border-line px-4 py-3">
            <Mark size={20} />
            <span className="text-sm font-bold">Trench chat</span>
            <Hint>
              Every message is an on-chain transaction to Bitpad&apos;s chat contract. That makes it permanent and public, and it costs about 0.01 TON in fees. Nothing is stored on our servers; the feed is read straight from the chain. Calls are theses on a jetton, and only wallets that hold it can post one; the ✓ holder badge is re-checked against current balances. Keep images tiny (3 KB). GIFs are Giphy or Tenor links.
            </Hint>
            <div className="seg ml-auto">
              <button data-on={tab === "all"} onClick={() => setTab("all")}>All</button>
              <button data-on={tab === "calls"} onClick={() => setTab("calls")}>Calls</button>
            </div>
            <button onClick={() => setOpen(false)} className="ml-1 text-muted hover:text-ink" aria-label="Close chat"><X className="size-4" /></button>
          </div>
          <div ref={list} className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
            {!top.length && <p className="py-10 text-center text-sm text-muted">{room.ok ? "No messages yet. Say gm on-chain 👋" : "Couldn't read the chat from the chain right now."}</p>}
            {top.map((m) => <Message key={m.id} m={m} me={wallet} replies={repliesOf(m.id)} onPost={post} />)}
          </div>
          <Composer me={wallet} onPost={post} />
        </div>
      )}
    </>
  );
}

function Message({ m, me, replies, onPost, nested = false }: { m: Msg; me: string; replies?: Msg[]; onPost: (p: PostInput) => Promise<void>; nested?: boolean }) {
  const [showReplies, setShowReplies] = useState(false);
  const [replying, setReplying] = useState(false);
  const mine = !!me && m.author.replace(/^.{2}/, "") === me.replace(/^.{2}/, "");
  const like = () => onPost({ kind: "like", parent: m.id, text: "" }).catch((e) => toast.error("Like not sent", (e as Error).message));
  return (
    <div className={`${nested ? "ml-5 border-l border-line pl-3" : ""}`}>
      <div className={`rounded-xl px-3 py-2 ${m.kind === "call" ? "border border-line-strong bg-surface-2" : "bg-surface"}`}>
        <div className="flex items-center gap-1.5 text-[11px] text-muted">
          <a href={`https://tonviewer.com/${m.author}`} target="_blank" rel="noreferrer" className="font-mono hover:text-ink">{mine ? "you" : shortAddr(m.author, 4, 4)}</a>
          <span>· {ago(m.time)}</span>
          {m.kind === "call" && (
            <span className="ml-auto flex items-center gap-1 font-semibold text-ink-2">
              <Megaphone className="size-3" /> CALL
              {m.holder ? <span className="text-up">✓ holder</span> : <span className="text-muted">not holding</span>}
            </span>
          )}
        </div>
        {m.kind === "call" && m.token && <TokenLink address={m.token} />}
        {m.text && <p className="mt-1 whitespace-pre-wrap break-words text-sm"><RichText text={m.text} /></p>}
        {m.media && <MediaView media={m.media} />}
        <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted">
          <button onClick={like} disabled={m.liked} className={`flex items-center gap-1 ${m.liked ? "text-launch" : "hover:text-ink"}`}><Heart className={`size-3 ${m.liked ? "fill-current" : ""}`} /> {m.likes || ""}</button>
          {!nested && <button onClick={() => setReplying((r) => !r)} className="flex items-center gap-1 hover:text-ink"><MessageCircle className="size-3" /> Reply</button>}
          {!nested && !!replies?.length && <button onClick={() => setShowReplies((s) => !s)} className="hover:text-ink">{showReplies ? "Hide" : `${replies.length} repl${replies.length === 1 ? "y" : "ies"}`}</button>}
          <a href={`https://tonviewer.com/transaction/${m.id}`} target="_blank" rel="noreferrer" className="ml-auto hover:text-ink" title="View on-chain">↗</a>
        </div>
      </div>
      {showReplies && replies?.map((r) => <Message key={r.id} m={r} me={me} onPost={onPost} nested />)}
      {replying && <div className="ml-5 mt-1"><Composer me={me} onPost={async (p) => { await onPost({ ...p, kind: "reply", parent: m.id }); setReplying(false); setShowReplies(true); }} compact /></div>}
    </div>
  );
}

function Composer({ me, onPost, compact = false }: { me: string; onPost: (p: PostInput) => Promise<void>; compact?: boolean }) {
  const [text, setText] = useState("");
  const [media, setMedia] = useState<Media | null>(null);
  const [panel, setPanel] = useState<"emoji" | "sticker" | "gif" | null>(null);
  const [gif, setGif] = useState("");
  const [call, setCall] = useState(false);
  const [token, setToken] = useState("");
  const [holds, setHolds] = useState<{ ok: boolean; symbol?: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHolds(null);
    if (!call || !me || !/^[A-Za-z0-9_\-:]{40,70}$/.test(token.trim())) return;
    const t = setTimeout(() => fetch(`/api/chat?holds=${encodeURIComponent(token.trim())}&me=${me}`).then((r) => r.json()).then((d) => setHolds({ ok: !!d.holds, symbol: d.symbol })).catch(() => setHolds({ ok: false })), 400);
    return () => clearTimeout(t);
  }, [call, token, me]);

  async function send() {
    if (!text.trim() && !media) return;
    if (call && !holds?.ok) return toast.error("Can't post this call", "You need to hold the jetton to post a call on it.");
    setBusy(true);
    try {
      await onPost({ kind: call ? "call" : "post", token: call ? token.trim() : null, text: text.trim(), media });
      setText("");
      setMedia(null);
      setCall(false);
      setToken("");
      setPanel(null);
      toast.success("Posted on-chain", "It shows up once the transaction lands (a few seconds).");
    } catch (e) {
      toast.error("Not posted", (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`${compact ? "" : "border-t border-line p-3"} space-y-2`}>
      {call && (
        <div className="flex items-center gap-2 rounded-lg border border-line px-2 py-1.5 text-xs">
          <Megaphone className="size-3.5 text-muted" />
          <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Jetton address you're calling" className="min-w-0 flex-1 bg-transparent font-mono outline-none" />
          {holds && <span className={holds.ok ? "text-up" : "text-down"}>{holds.ok ? `✓ you hold ${holds.symbol ?? "it"}` : "you don't hold it"}</span>}
        </div>
      )}
      {media && (
        <div className="flex items-center gap-2 text-xs text-muted">
          <span>Attached: {media.type === "image" ? `image · ${media.bytes.length} B` : media.type === "gif" ? "GIF" : STICKER_LABEL[media.id]}</span>
          <button onClick={() => setMedia(null)} className="hover:text-ink"><X className="size-3" /></button>
        </div>
      )}
      {panel === "emoji" && <div className="flex flex-wrap gap-1">{EMOJIS.map((e) => <button key={e} onClick={() => setText((t) => (t + e).slice(0, MAX_TEXT))} className="rounded p-1 text-lg hover:bg-surface-2">{e}</button>)}</div>}
      {panel === "sticker" && <div className="flex flex-wrap gap-1.5">{STICKERS.map((s) => <button key={s} onClick={() => { setMedia({ type: "sticker", id: s }); setPanel(null); }}><StickerView id={s} small /></button>)}</div>}
      {panel === "gif" && (
        <div className="flex gap-2">
          <input value={gif} onChange={(e) => setGif(e.target.value)} placeholder="Paste a Giphy or Tenor GIF link (.gif)" className="input h-8 text-xs" />
          <button className="btn btn-ghost h-8 text-xs" onClick={() => (isAllowedGif(gif.trim()) ? (setMedia({ type: "gif", url: gif.trim() }), setGif(""), setPanel(null)) : toast.error("Unsupported link", "Use a media.giphy.com or media.tenor.com GIF URL."))}>Add</button>
        </div>
      )}
      <div className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_TEXT))}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
          rows={compact ? 1 : 2}
          placeholder={call ? "Your thesis: why this jetton, why now…" : compact ? "Reply…" : "Say something on-chain · $TICKER to link"}
          className="min-h-9 flex-1 resize-none rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-line-strong"
        />
        <button onClick={send} disabled={busy || (!text.trim() && !media)} className="btn btn-primary h-9 w-9 px-0" aria-label="Send">{busy ? "…" : <Send className="size-4" />}</button>
      </div>
      <div className="flex items-center gap-1 text-muted">
        <IconBtn on={panel === "emoji"} onClick={() => setPanel(panel === "emoji" ? null : "emoji")} label="Emoji"><Smile className="size-4" /></IconBtn>
        <IconBtn on={panel === "sticker"} onClick={() => setPanel(panel === "sticker" ? null : "sticker")} label="Stickers"><Sticker className="size-4" /></IconBtn>
        <IconBtn on={panel === "gif"} onClick={() => setPanel(panel === "gif" ? null : "gif")} label="GIF"><span className="text-[10px] font-bold">GIF</span></IconBtn>
        <IconBtn onClick={() => file.current?.click()} label="Tiny image"><ImagePlus className="size-4" /></IconBtn>
        <input ref={file} type="file" accept="image/*" hidden onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          try {
            setMedia({ type: "image", bytes: await tinyImage(f) });
          } catch (err) {
            toast.error("Image not added", (err as Error).message);
          }
        }} />
        {!compact && <IconBtn on={call} onClick={() => setCall((c) => !c)} label="Make a call (holders only)"><Megaphone className="size-4" /></IconBtn>}
        <span className="ml-auto text-[10px]">{text.length}/{MAX_TEXT} · ~0.01 TON</span>
      </div>
    </div>
  );
}

function IconBtn({ children, onClick, label, on }: { children: React.ReactNode; onClick: () => void; label: string; on?: boolean }) {
  return <button type="button" onClick={onClick} title={label} aria-label={label} className={`grid size-7 place-items-center rounded-md hover:bg-surface-2 hover:text-ink ${on ? "bg-surface-2 text-ink" : ""}`}>{children}</button>;
}

function StickerView({ id, small = false }: { id: string; small?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-bg font-black uppercase tracking-wide [image-rendering:pixelated] ${small ? "px-2 py-1 text-[10px]" : "mt-2 px-3 py-2 text-sm"}`}>
      <Mark size={small ? 12 : 22} /> {STICKER_LABEL[id] ?? id}
    </span>
  );
}

function MediaView({ media }: { media: NonNullable<Msg["media"]> }) {
  if (media.type === "sticker") return <StickerView id={media.id} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={media.type === "gif" ? media.url : media.dataUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className="mt-2 max-h-48 rounded-lg" />;
}

/** $TICKER → the stock page or the first search hit. */
function RichText({ text }: { text: string }) {
  const router = useRouter();
  const parts = text.split(/(\$[A-Za-z][A-Za-z0-9]{1,11})/g);
  const go = async (sym: string) => {
    if (/x$/.test(sym) && sym.length > 2) return router.push(`/stocks/${sym}`);
    const d = await fetch(`/api/search?q=${encodeURIComponent(sym)}`).then((r) => r.json()).catch(() => null);
    const hit = d?.results?.[0];
    if (hit) router.push(`/token/${hit.address}`);
    else toast.error(`No market for $${sym}`, "Nothing matched on STON.fi.");
  };
  return <>{parts.map((p, i) => (p.startsWith("$") ? <button key={i} onClick={() => go(p.slice(1))} className="font-semibold text-brand hover:underline">{p}</button> : <span key={i}>{p}</span>))}</>;
}

function TokenLink({ address }: { address: string }) {
  return <a href={`/token/${address}`} className="mt-1 inline-block font-mono text-[11px] text-ink-2 hover:text-ink">{shortAddr(address, 6, 6)} →</a>;
}
