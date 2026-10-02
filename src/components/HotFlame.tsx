/** Animated flame-red "hot" badge for tokens with a sudden price or volume spike. */
export function HotFlame({ size = 16, className = "", title = "Hot right now" }: { size?: number; className?: string; title?: string }) {
  return (
    <span className={`hot-flame inline-grid shrink-0 place-items-center ${className}`} style={{ width: size, height: size }} title={title} role="img" aria-label={title}>
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
        <defs>
          <linearGradient id="hf-outer" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#ff2d2d" />
            <stop offset="0.6" stopColor="#ff5a1f" />
            <stop offset="1" stopColor="#ff8a00" />
          </linearGradient>
          <linearGradient id="hf-inner" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#ffd23f" />
            <stop offset="1" stopColor="#fff4c2" />
          </linearGradient>
        </defs>
        <path className="hf-outer" fill="url(#hf-outer)" d="M12 1.5c.6 3.2-1.2 5-2.9 6.9C7.3 10.3 5.5 12.4 5.5 15.6 5.5 19.4 8.4 22.5 12 22.5s6.5-3.1 6.5-6.9c0-2.6-1.2-4.4-2.4-5.8-.3 1.6-1.1 2.7-2.2 3.3.4-3.9-.8-8.6-1.9-11.6Z" />
        <path className="hf-inner" fill="url(#hf-inner)" d="M12.2 11.5c.2 1.9-.8 2.9-1.7 3.9-.8.8-1.4 1.7-1.4 2.9 0 1.8 1.3 3.2 2.9 3.2s2.9-1.4 2.9-3.2c0-1.1-.5-1.9-1.1-2.6-.2.7-.6 1.1-1 1.3.2-1.8-.2-3.9-.6-5.5Z" />
      </svg>
    </span>
  );
}
