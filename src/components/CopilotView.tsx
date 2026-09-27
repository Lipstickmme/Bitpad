"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { Bot, Send, Sparkles, User, Wrench } from "lucide-react";
import type { TradeProposal } from "@/lib/agent-types";

interface Msg { role: "user" | "assistant"; content: string; proposals?: TradeProposal[]; tools?: string[] }

const PROMPTS = [
  "Where is it hot right now — TON, Solana or Base?",
  "Compare Bitpad to pump.fun on wins vs losses today",
  "Which stock-paired tokens have the best buy pressure?",
  "Quote 50 TON into $SPYCAT and tell me the best route",
];

export function CopilotView() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  async function send(text: string) {
    if (!text.trim() || busy) return;
    const next: Msg[] = [...msgs, { role: "user", content: text.trim() }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    try {
      const r = await fetch("/api/agent", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: next.map(({ role, content }) => ({ role, content })) }) });
      const d = await r.json();
      setMsgs((m) => [...m, r.ok ? { role: "assistant", content: d.text, proposals: d.proposals, tools: d.toolLog } : { role: "assistant", content: d.error ?? "Something went wrong." }]);
    } catch {
      setMsgs((m) => [...m, { role: "assistant", content: "Network error — try again." }]);
    } finally {
      setBusy(false);
      setTimeout(() => end.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col" style={{ minHeight: "calc(100vh - 9rem)" }}>
      <div className="mb-4">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight"><Sparkles className="size-5 text-brand" /> Bitpad Copilot</h1>
        <p className="text-sm text-ink-2">An AI agent with live access to Bitpad markets, cross-chain analytics and the router. It stages trades — you sign them.</p>
      </div>

      <div className="flex-1 space-y-4">
        {!msgs.length && (
          <div className="grid gap-2 sm:grid-cols-2">
            {PROMPTS.map((p) => <button key={p} onClick={() => send(p)} className="card p-3 text-left text-sm text-ink-2 hover:border-line-strong hover:text-ink">{p}</button>)}
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
            <div className={`grid size-8 shrink-0 place-items-center rounded-full ${m.role === "user" ? "bg-ink text-white" : "bg-brand-soft text-brand"}`}>{m.role === "user" ? <User className="size-4" /> : <Bot className="size-4" />}</div>
            <div className={`max-w-[85%] space-y-2 ${m.role === "user" ? "text-right" : ""}`}>
              <div className={`inline-block whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-left text-sm ${m.role === "user" ? "bg-ink text-white" : "card"}`}>{m.content}</div>
              {!!m.tools?.length && <div className="flex flex-wrap gap-1 text-[11px] text-muted"><Wrench className="size-3" />{[...new Set(m.tools)].join(" · ")}</div>}
              {m.proposals?.map((p, j) => (
                <div key={j} className="card border-brand/30 p-3 text-left text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`chip ${p.side === "buy" ? "border-up/25 bg-up-soft text-up" : "border-down/25 bg-down-soft text-down"}`}>{p.side}</span>
                    <b>${p.symbol}</b><span className="text-muted">· {p.amount} {p.payAsset}</span>
                    <Link href={`/token/${p.address}`} className="btn btn-primary ml-auto h-8 px-3 text-xs">Review & sign</Link>
                  </div>
                  <p className="mt-1.5 text-xs text-ink-2">{p.rationale}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
        {busy && <div className="flex gap-3"><div className="grid size-8 place-items-center rounded-full bg-brand-soft text-brand"><Bot className="size-4" /></div><div className="card px-4 py-2.5 text-sm text-muted">Checking the markets…</div></div>}
        <div ref={end} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="card sticky bottom-4 mt-4 flex items-center gap-2 p-2 shadow-lg">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about tokens, launchpads, routes…" className="h-10 flex-1 bg-transparent px-2 text-sm outline-none" />
        <button type="submit" disabled={busy || !input.trim()} className="btn btn-primary h-10 w-10 px-0" aria-label="Send"><Send className="size-4" /></button>
      </form>
    </div>
  );
}
