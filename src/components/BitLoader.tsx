/**
 * Page-loading animation: BIT on his rocket streaks across a starfield from
 * left to right at rocket speed, leaving a flame trail, over and over.
 * Pure CSS (no JS), so it shows instantly on navigation.
 */
export function BitLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="bit-loader grid min-h-[60vh] place-items-center" role="status" aria-live="polite">
      <div className="flex w-full flex-col items-center">
        <div className="bl-track relative h-28 w-full max-w-md overflow-hidden">
          {/* speed-line stars rushing past */}
          {Array.from({ length: 16 }, (_, i) => (
            <span key={i} className="bl-streak" style={{ top: `${6 + ((i * 41) % 88)}%`, animationDelay: `${-((i * 0.137) % 0.9)}s`, animationDuration: `${0.5 + (i % 4) * 0.14}s`, width: `${8 + (i % 3) * 10}px` }} />
          ))}
          {/* BIT on the rocket, with a flame trail */}
          <div className="bl-ship absolute top-1/2 left-0">
            <span className="bl-trail" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/mark.png" alt="" className="relative h-14 [image-rendering:pixelated]" draggable={false} />
          </div>
        </div>
        <div className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted">
          {label}<span className="bl-dots" />
        </div>
      </div>
    </div>
  );
}
