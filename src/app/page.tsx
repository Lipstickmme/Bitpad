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
        <HeroScene />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,16,20,0.92)_0%,rgba(7,16,20,0.7)_38%,rgba(7,16,20,0)_65%)] max-sm:bg-[linear-gradient(180deg,rgba(7,16,20,0.2)_0%,rgba(7,16,20,0.85)_55%)]" />
        <div className="relative max-w-xl px-6 pb-12 pt-52 sm:px-12 sm:py-24">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-brand">Believe in TON</p>
          <h1 className="text-[2.1rem] font-extrabold uppercase leading-[1.02] tracking-[-0.03em] sm:text-[3.4rem]">
            Buy stocks on TON.
            <span className="block text-ink-2">Launch jettons paired with any asset.</span>
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-ink-2">
            Apple, Tesla, the S&amp;P 500 and gold, tokenized 1:1 and live on TON. Pair your own jetton with any of them, and every TON of liquidity lands in the pool, so it trades from the first block. No bonding curve.
          </p>
          <div className="mt-8 flex flex-wrap gap-2">
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
