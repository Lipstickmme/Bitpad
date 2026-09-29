import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getBitpadTokens, getTonMarket } from "@/lib/market";
import { getPairAssets } from "@/lib/prices";
import { MarketsView } from "@/components/MarketsView";
import { AssetTicker } from "@/components/AssetTicker";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [bitpad, ton, { assets }] = await Promise.all([getBitpadTokens(), getTonMarket(), getPairAssets()]);

  return (
    <div className="space-y-6">
      <AssetTicker assets={assets} />

      <section className="relative overflow-hidden rounded-2xl border border-line bg-[linear-gradient(180deg,#11222a_0%,#0c171b_100%)] px-6 py-14 sm:px-12 sm:py-20">
        <HeroWave />
        <div className="relative max-w-xl">
          <h1 className="text-[2.6rem] font-extrabold leading-[1.02] tracking-[-0.035em] sm:text-6xl">Launch tokens paired with anything</h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-ink-2">
            Create and trade TON tokens paired with stocks, gold, jettons &amp; more. Liquidity goes straight into the pool — no bonding curve.
          </p>
          <Link href="/launch" className="btn btn-primary mt-8 h-11 px-5 text-[15px] font-semibold">Launch a token <ArrowRight className="size-4" /></Link>
        </div>
      </section>

      <MarketsView bitpad={bitpad.tokens} ton={ton.tokens} tonSource={ton.source} />
    </div>
  );
}

/** Decorative only — no data. A dashed price line drifting across a soft fill. */
function HeroWave() {
  const line = "M0,310 C90,310 130,330 190,312 S270,150 345,158 S440,285 505,272 S600,120 665,128 S745,238 790,226 S860,150 900,135";
  return (
    <svg
      viewBox="0 0 900 420"
      preserveAspectRatio="xMaxYMid slice"
      className="pointer-events-none absolute inset-y-0 right-0 h-full w-full opacity-40 [mask-image:linear-gradient(90deg,transparent_15%,#000_55%)] sm:w-[75%] sm:opacity-100"
      aria-hidden
    >
      <defs>
        <linearGradient id="hero-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8cbfd1" stopOpacity="0.10" />
          <stop offset="1" stopColor="#8cbfd1" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L900,420 L0,420 Z`} fill="url(#hero-fill)" />
      <path d={line} fill="none" stroke="#1d3640" strokeWidth="14" strokeLinecap="round" />
      <path d={line} fill="none" stroke="#a9ccd8" strokeWidth="3.5" strokeLinecap="round" strokeDasharray="16 12" className="hero-dash" />
    </svg>
  );
}
