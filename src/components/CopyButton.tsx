"use client";
import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CopyButton({ value, label, className = "" }: { value: string; label?: string; className?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        navigator.clipboard?.writeText(value);
        setOk(true);
        setTimeout(() => setOk(false), 1200);
      }}
      className={`inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2 py-1 text-xs font-semibold text-ink-2 hover:border-line-strong ${className}`}
      aria-label={`Copy ${label ?? "value"}`}
    >
      {label && <span>{label}</span>}
      {ok ? <Check className="size-3.5 text-up" /> : <Copy className="size-3.5" />}
    </button>
  );
}
