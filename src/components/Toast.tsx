"use client";
import { create } from "zustand";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

type Kind = "success" | "error" | "info";
interface T { id: number; kind: Kind; title: string; body?: string }
const useToasts = create<{ items: T[]; push: (t: Omit<T, "id">) => void; drop: (id: number) => void }>((set) => ({
  items: [],
  push: (t) => {
    const id = Date.now() + Math.random();
    set((s) => ({ items: [...s.items, { ...t, id }] }));
    setTimeout(() => set((s) => ({ items: s.items.filter((x) => x.id !== id) })), 5000);
  },
  drop: (id) => set((s) => ({ items: s.items.filter((x) => x.id !== id) })),
}));

export const toast = {
  success: (title: string, body?: string) => useToasts.getState().push({ kind: "success", title, body }),
  error: (title: string, body?: string) => useToasts.getState().push({ kind: "error", title, body }),
  info: (title: string, body?: string) => useToasts.getState().push({ kind: "info", title, body }),
};

export function Toaster() {
  const { items, drop } = useToasts();
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2">
      {items.map((t) => {
        const Icon = t.kind === "success" ? CheckCircle2 : t.kind === "error" ? AlertTriangle : Info;
        const color = t.kind === "success" ? "text-up" : t.kind === "error" ? "text-down" : "text-brand";
        return (
          <div key={t.id} className="card pointer-events-auto flex items-start gap-3 p-3 shadow-lg" role="status">
            <Icon className={`mt-0.5 size-5 shrink-0 ${color}`} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">{t.title}</div>
              {t.body && <div className="mt-0.5 break-words text-xs text-ink-2">{t.body}</div>}
            </div>
            <button onClick={() => drop(t.id)} aria-label="Dismiss" className="text-muted hover:text-ink"><X className="size-4" /></button>
          </div>
        );
      })}
    </div>
  );
}
