export function ChartCard({ title, sub, right, children, className = "" }: { title: string; sub?: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`card flex min-w-0 flex-col p-4 ${className}`}>
      <div className="mb-3 flex flex-wrap items-start gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{title}</h3>
          {sub && <p className="text-xs text-muted">{sub}</p>}
        </div>
        {right && <div className="ml-auto">{right}</div>}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}

export const AXIS = { stroke: "#8492a6", fontSize: 11, tickLine: false, axisLine: false } as const;
export const GRID = "#eef1f5";

export function TipBox({ title, rows }: { title: string; rows: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg">
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
