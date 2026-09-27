import Link from "next/link";
import { ArrowRight, Layers, Zap, Coins, Rocket } from "lucide-react";
import { getBitpadTokens, getTonMarket } from "@/lib/market";
import { getPairAssets } from "@/lib/prices";
import { MarketsView } from "@/components/MarketsView";
import { AssetTicker } from "@/components/AssetTicker";
import { usd } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [bitpad, ton, { assets, live }] = await Promise.all([getBitpadTokens(), getTonMarket(), getPairAssets()]);
  const vol = ton.tokens.reduce((s, t) => s + (t.volume24h ?? 0), 0);
  const bpVol = bitpad.tokens.reduce((s, t) => s + (t.volume24h ?? 0), 0);

  return (
    <div className="space-y-5">
      <AssetTicker assets={assets} live={live} />

      <section className="grid grid-cols-1 items-center gap-5 lg:grid-cols-[1fr_auto]">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.75rem]">
            Launch tokens paired with stocks, gold &amp; jettons. <span className="text-muted">Trade from block one.</span>
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-ink-2">
            No bonding curve — liquidity goes straight into a STON.fi pool against TON, USDT, $GRAM or a tokenized asset.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/launch" className="btn btn-primary">Launch a token <ArrowRight className="size-4" /></Link>
            <Link href="/analytics" className="btn btn-ghost">Where is it hot?</Link>
          </div>
        </div>
        <div className="card grid grid-cols-2 divide-x divide-y divide-line sm:grid-cols-4 sm:divide-y-0 lg:w-[600px]">
          <Hero icon={<Rocket className="size-3.5" />} label="Launches" value={bitpad.factory ? String(bitpad.count) : "—"} />
          <Hero icon={<Zap className="size-3.5" />} label="Bitpad vol 24h" value={bitpad.tokens.length ? usd(bpVol, { compact: true }) : "—"} />
          <Hero icon={<Layers className="size-3.5" />} label="TON vol 24h" value={vol ? usd(vol, { compact: true }) : "—"} />
          <Hero icon={<Coins className="size-3.5" />} label="Assets priced" value={`${assets.filter((a) => a.priceUsd != null).length}/${assets.length}`} />
        </div>
      </section>

      <MarketsView bitpad={bitpad.tokens} ton={ton.tokens} tonSource={ton.source} factory={bitpad.factory} />
    </div>
  );
}

function Hero({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface-2/60 p-4">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted">{icon}{label}</div>
      <div className="num mt-1 text-xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}
