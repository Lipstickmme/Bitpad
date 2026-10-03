import { ogGrade } from "@/lib/og";

/** Gold "OG ★★" chip for tokens trading for a year or more (see lib/og). */
export function OgBadge({ createdAt, className = "" }: { createdAt?: number | null; className?: string }) {
  const g = ogGrade(createdAt);
  if (!g) return null;
  const years = Math.floor((Date.now() - createdAt!) / (365.25 * 86_400_000));
  return (
    <span className={`og-badge inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-px text-[9.5px] font-extrabold leading-none tracking-wide ${className}`} title={`OG: trading for ${years}+ year${years > 1 ? "s" : ""}`}>
      OG<span className="tracking-tighter">{"★".repeat(g)}</span>
    </span>
  );
}
