/**
 * Page-loading animation in the hero's pixel style: BIT stands on the pad,
 * the rocket rumbles, then blasts off on a pixel flame and smoke trail,
 * over twinkling stars. Pure CSS (no JS), so it shows instantly on navigation.
 */
export function BitLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="bit-loader grid min-h-[60vh] place-items-center" role="status" aria-live="polite">
      <div className="relative h-56 w-56 overflow-hidden rounded-2xl">
        {/* stars */}
        {Array.from({ length: 14 }, (_, i) => (
          <span key={i} className="bl-star" style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 70}%`, animationDelay: `${(i % 7) * 0.25}s` }} />
        ))}
        {/* ground */}
        <div className="absolute inset-x-0 bottom-0 h-6 bg-[#0f1d22] [image-rendering:pixelated]" />
        <div className="absolute inset-x-0 bottom-6 h-px bg-[#1c2a30]" />
        {/* BIT standing on the pad, waves off */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/bit.png" alt="" className="bl-bit absolute bottom-6 left-6 h-12 [image-rendering:pixelated]" draggable={false} />
        {/* rocket + flame */}
        <div className="bl-rocket absolute bottom-6 left-1/2 -translate-x-1/2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/mark.png" alt="" className="h-20 [image-rendering:pixelated]" draggable={false} />
          <div className="bl-flame mx-auto">
            <span /><span /><span />
          </div>
        </div>
        {/* smoke puffs */}
        {[0, 1, 2, 3].map((i) => <span key={i} className="bl-smoke" style={{ left: `${38 + i * 7}%`, animationDelay: `${0.9 + i * 0.08}s` }} />)}
      </div>
      <div className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted">
        {label}<span className="bl-dots" />
      </div>
    </div>
  );
}
