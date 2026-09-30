import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getBitpadTokens, getTonMarket } from "@/lib/market";
import { getPairAssets } from "@/lib/prices";
import { MarketsView } from "@/components/MarketsView";
import { AssetTicker } from "@/components/AssetTicker";
import { HeroScene } from "@/components/HeroScene";
import { StockBoard } from "@/components/StockBoard";
import { Mark } from "@/components/Brand";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [bitpad, ton, { assets }] = await Promise.all([getBitpadTokens(), getTonMarket(), getPairAssets()]);

  return (
    <div className="space-y-6">
      <AssetTicker assets={assets} />

      {/* Sized to the screen so the animation and both buttons are visible without scrolling */}
      <section className="relative isolate flex h-[calc(100svh-166px)] max-h-[760px] min-h-[440px] flex-col overflow-hidden rounded-2xl border border-line bg-[#071014] sm:h-[calc(100svh-160px)] sm:max-h-[580px] sm:min-h-[420px] sm:flex-row sm:items-center">
        {/* Phones / Mini App: the animation takes the space above the text. Wider: it fills the hero behind the text. */}
        <div className="relative min-h-0 flex-1 sm:absolute sm:inset-0">
          <HeroScene />
          <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-b from-transparent to-[#071014] sm:hidden" />
        </div>
        <div className="absolute inset-0 hidden bg-[linear-gradient(90deg,rgba(7,16,20,0.92)_0%,rgba(7,16,20,0.7)_38%,rgba(7,16,20,0)_65%)] sm:block" />
        {/* soft accent glow + a hairline highlight along the top edge */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_85%_10%,rgba(140,191,209,0.14),transparent_55%),radial-gradient(ellipse_at_10%_100%,rgba(217,181,107,0.08),transparent_50%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand/60 to-transparent" />
        <div className="relative shrink-0 px-5 pb-5 sm:max-w-xl sm:px-12 sm:py-8">
          <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-brand/25 bg-brand-soft/60 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-ink sm:mb-4 sm:text-xs"><span className="size-1.5 animate-pulse rounded-full bg-brand" />Believe in TON</p>
          <h1 className="text-[1.6rem] font-extrabold uppercase leading-[1.05] tracking-[-0.03em] sm:text-[2.6rem] lg:text-[3.2rem]">
            Buy <span className="text-accent-gradient">stocks</span> on TON.
            <span className="block text-ink-2">Launch jettons paired with <span className="text-gold">any asset</span>.</span>
          </h1>
          <p className="mt-2 line-clamp-3 max-w-md text-[13px] leading-relaxed text-ink-2 sm:mt-4 sm:line-clamp-none sm:text-base">
            Apple, Tesla, the S&amp;P 500 and gold, tokenized 1:1 and live on TON. Pair your own jetton with any of them, and every TON of liquidity lands in the pool, so it trades from the first block. No bonding curve.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:mt-7 sm:flex sm:flex-wrap">
            <Link href="/launch" className="btn btn-launch h-11 px-4 text-[14px] font-semibold sm:px-5 sm:text-[15px]"><Mark size={20} /> Launch a jetton</Link>
            <Link href="/stocks" className="btn btn-ghost h-11 px-4 text-[14px] font-semibold sm:px-5 sm:text-[15px]">Buy stocks <ArrowRight className="size-4" /></Link>
          </div>
        </div>
      </section>

      <StockBoard assets={assets} />

      <MarketsView bitpad={bitpad.tokens} ton={ton.tokens} tonSource={ton.source} />
    </div>
  );
}
