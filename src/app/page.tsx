import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getBitpadTokens, getTonMarket } from "@/lib/market";
import { getPairAssets } from "@/lib/prices";
import { MarketsView } from "@/components/MarketsView";
import { AssetTicker } from "@/components/AssetTicker";
import { NewsStrip } from "@/components/NewsStrip";
import { HeroScene } from "@/components/HeroScene";
import { StockBoard } from "@/components/StockBoard";
import { Mark } from "@/components/Brand";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [bitpad, ton, { assets }] = await Promise.all([getBitpadTokens(), getTonMarket(), getPairAssets()]);

  return (
    <div className="space-y-6">
      {/* Prices + news share the space the price strip alone used to take above the hero */}
      <div className="-mt-2 mb-4">
        <AssetTicker assets={assets} />
        <NewsStrip />
      </div>

      {/* Sized to the screen so the animation and both buttons are visible without scrolling */}
      <section className="relative isolate flex h-[calc(100svh-166px)] max-h-[760px] min-h-[440px] flex-col overflow-hidden rounded-2xl border border-line bg-[#071014] sm:h-[calc(100svh-160px)] sm:max-h-[580px] sm:min-h-[420px] sm:flex-row sm:items-center">
        {/* Phones / Mini App: the animation takes the space above the text. Wider: it fills the hero behind the text. */}
        <div className="relative min-h-0 flex-1 sm:absolute sm:inset-0">
          <HeroScene />
          <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-b from-transparent to-[#071014] sm:hidden" />
        </div>
        <div className="absolute inset-0 hidden bg-[linear-gradient(90deg,rgba(7,16,20,0.92)_0%,rgba(7,16,20,0.7)_38%,rgba(7,16,20,0)_65%)] sm:block" />
        <div className="relative shrink-0 px-5 pb-5 sm:max-w-xl sm:px-12 sm:py-8 lg:max-w-3xl">
          <h1 className="text-[1.6rem] font-extrabold uppercase leading-[1.05] tracking-[-0.03em] sm:text-[2.4rem] lg:text-[2.9rem]">
            Buy stocks on TON.
            <span className="block text-ink-2">Launch creator jettons.</span>
          </h1>
          <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-ink-2 sm:mt-4 sm:text-base">
            Buy tokenized Apple, Tesla, the S&amp;P 500 and gold. Launch your own jetton backed by any of them and earn on every trade.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:mt-6 sm:flex sm:flex-wrap">
            <Link href="/launch" className="btn btn-launch h-11 px-4 text-[14px] font-semibold sm:px-5 sm:text-[15px]"><Mark size={20} /> <span className="sm:hidden">Launch jetton</span><span className="hidden sm:inline">Launch creator jetton</span></Link>
            <Link href="/stocks" className="btn btn-ghost h-11 px-4 text-[14px] font-semibold sm:px-5 sm:text-[15px]">Buy stocks <ArrowRight className="size-4" /></Link>
          </div>
        </div>
      </section>

      <StockBoard assets={assets} />

      <MarketsView bitpad={bitpad.tokens} ton={ton.tokens} tonSource={ton.source} />
    </div>
  );
}
