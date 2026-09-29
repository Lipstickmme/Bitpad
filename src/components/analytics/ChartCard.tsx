import { Hint } from "../ui";

export function ChartCard({ title, sub, hint, right, children, className = "" }: { title: string; sub?: string; hint?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`card flex min-w-0 flex-col p-5 ${className}`}>
      <div className="mb-4 flex flex-wrap items-start gap-2">
        <div className="min-w-0">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">{title}{hint && <Hint>{hint}</Hint>}</h3>
          {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
        </div>
        {right && <div className="ml-auto">{right}</div>}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}

/** Chart palette: greys plus the brand accent — up/down only where a value is a gain or a loss. */
export const C = {
  accent: "#8cbfd1",
  bar: "#3a525b",
  faint: "#26373d",
  up: "#3fbf8f",
  down: "#f0566f",
  ref: "#4b6069",
  cursor: "rgba(255,255,255,0.03)",
  bg: "#0f191d",
  label: "#a3b3b9",
} as const;

export const AXIS = { stroke: "#6c7f86", fontSize: 11, tickLine: false, axisLine: false } as const;
export const GRID = "#18252a";

export function TipBox({ title, rows }: { title: string; rows: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="rounded-lg border border-line-strong bg-surface-2 px-3 py-2 text-xs shadow-2xl shadow-black/50">
      <div className="mb-1 font-semibold">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2">
          {r.color && <span className="size-2 rounded-sm" style={{ background: r.color }} />}
          <span className="text-muted">{r.label}</span>
          <span className="num ml-auto pl-3 font-semibold text-ink">{r.value}</span>
        </div>
      ))}
    </div>
  );
}
