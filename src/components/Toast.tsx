"use client";
import { create } from "zustand";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
import { humanError } from "@/lib/errors";

type Kind = "success" | "error" | "info";
interface Action { label: string; onClick: () => void }
interface T { id: number; kind: Kind; title: string; body?: string; action?: Action; ms?: number }
const useToasts = create<{ items: T[]; push: (t: Omit<T, "id">) => void; drop: (id: number) => void }>((set) => ({
  items: [],
  push: (t) => {
    const id = Date.now() + Math.random();
    set((s) => ({ items: [...s.items, { ...t, id }] }));
    setTimeout(() => set((s) => ({ items: s.items.filter((x) => x.id !== id) })), t.ms ?? 5000);
  },
  drop: (id) => set((s) => ({ items: s.items.filter((x) => x.id !== id) })),
}));

export const toast = {
  success: (title: string, body?: string) => useToasts.getState().push({ kind: "success", title, body }),
  // Error bodies are translated into plain language (see lib/errors.ts)
  error: (title: string, body?: string, opts: { action?: Action; ms?: number } = {}) => useToasts.getState().push({ kind: "error", title, body: body != null ? humanError(body) : undefined, ...opts }),
  info: (title: string, body?: string, opts: { action?: Action; ms?: number } = {}) => useToasts.getState().push({ kind: "info", title, body, ...opts }),
};

export function Toaster() {
  const { items, drop } = useToasts();
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2">
      {items.map((t) => {
        const Icon = t.kind === "success" ? CheckCircle2 : t.kind === "error" ? AlertTriangle : Info;
        const color = t.kind === "success" ? "text-up" : t.kind === "error" ? "text-down" : "text-brand";
        return (
          <div key={t.id} className="card pointer-events-auto flex items-start gap-3 p-3 shadow-2xl shadow-black/40" role="status">
            <Icon className={`mt-0.5 size-5 shrink-0 ${color}`} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">{t.title}</div>
              {t.body && <div className="mt-0.5 break-words text-xs text-ink-2">{t.body}</div>}
              {t.action && <button onClick={() => { t.action!.onClick(); drop(t.id); }} className="mt-1.5 text-xs font-semibold text-brand hover:underline">{t.action.label}</button>}
            </div>
            <button onClick={() => drop(t.id)} aria-label="Dismiss" className="text-muted hover:text-ink"><X className="size-4" /></button>
          </div>
        );
      })}
    </div>
  );
}
