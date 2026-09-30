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

      <section className="relative isolate overflow-hidden rounded-2xl border border-line bg-[#071014]">
        {/* Phones / Mini App: the animation gets its own band above the text. Wider: it fills the hero behind the text. */}
        <div className="relative h-[46vw] max-h-72 min-h-52 sm:absolute sm:inset-0 sm:h-auto sm:max-h-none">
          <HeroScene />
          <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-b from-transparent to-[#071014] sm:hidden" />
        </div>
        <div className="absolute inset-0 hidden bg-[linear-gradient(90deg,rgba(7,16,20,0.92)_0%,rgba(7,16,20,0.7)_38%,rgba(7,16,20,0)_65%)] sm:block" />
        <div className="relative max-w-xl px-5 pb-8 pt-1 sm:px-12 sm:py-24">
          <p className="mb-3 text-xs font-semibold sm:mb-4 uppercase tracking-[0.2em] text-brand">Believe in TON</p>
          <h1 className="text-[1.9rem] font-extrabold uppercase leading-[1.04] tracking-[-0.03em] sm:text-[3.4rem]">
            Buy stocks on TON.
            <span className="block text-ink-2">Launch jettons paired with any asset.</span>
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-2 sm:mt-5 sm:text-base">
            Apple, Tesla, the S&amp;P 500 and gold, tokenized 1:1 and live on TON. Pair your own jetton with any of them, and every TON of liquidity lands in the pool, so it trades from the first block. No bonding curve.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-2 sm:mt-8 sm:flex sm:flex-wrap">
            <Link href="/launch" className="btn btn-launch h-11 px-5 text-[15px] font-semibold"><Mark size={22} /> Launch a jetton <ArrowRight className="size-4" /></Link>
            <Link href="/stocks" className="btn btn-ghost h-11 px-5 text-[15px] font-semibold">Buy stocks</Link>
          </div>
        </div>
      </section>

      <StockBoard assets={assets} />

      <MarketsView bitpad={bitpad.tokens} ton={ton.tokens} tonSource={ton.source} />
    </div>
  );
}
