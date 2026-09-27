import Link from "next/link";
import { ArrowRight, Layers, Zap, Coins } from "lucide-react";
import { getPairAssets, getTokens } from "@/lib/market";
import { MarketsView } from "@/components/MarketsView";
import { AssetTicker } from "@/components/AssetTicker";
import { usd } from "@/lib/format";
import { config } from "@/lib/config";

export const revalidate = 30;

export default async function Home() {
  const [tokens, { assets, live }] = await Promise.all([getTokens(), getPairAssets()]);
  const totalMcap = tokens.reduce((s, t) => s + t.marketCap, 0);
  const vol = tokens.reduce((s, t) => s + t.volume24h, 0);
  const fees = vol * (config.swapFeeBps / 10_000);

  return (
    <div className="space-y-6">
      <AssetTicker assets={assets} live={live} />

      <section className="card grid grid-cols-1 gap-6 overflow-hidden p-6 sm:p-8 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <span className="chip border-brand/20 bg-brand-soft text-brand-ink">Built on TON · Telegram native</span>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
            Launch tokens paired with <span className="text-brand">stocks, gold & jettons</span>.
            <br className="hidden sm:block" /> Trade from block one.
          </h1>
          <p className="mt-3 max-w-xl text-ink-2">
            No bonding curve. Your liquidity goes straight into a STON.fi pool against the asset you choose — SPYx, NVDAx, XAUt, TON, $GRAM or any
            cross-chain asset — so price discovery starts the moment you launch.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/launch" className="btn btn-primary">Launch a token <ArrowRight className="size-4" /></Link>
            <Link href="/analytics" className="btn btn-ghost">Where is it hot?</Link>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 self-center">
          <Hero icon={<Layers className="size-4" />} label="Market cap on Bitpad" value={usd(totalMcap, { compact: true })} />
          <Hero icon={<Zap className="size-4" />} label="24h volume" value={usd(vol, { compact: true })} />
          <Hero icon={<Coins className="size-4" />} label="Pairable assets" value={String(assets.length)} />
          <Hero icon={<Coins className="size-4" />} label="24h fees routed" value={usd(fees, { compact: true })} />
        </div>
      </section>

      <MarketsView tokens={tokens} />
    </div>
  );
}

function Hero({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface-2/60 p-4">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted">{icon}{label}</div>
      <div className="num mt-1 text-2xl font-extrabold tracking-tight">{value}</div>
    </div>
  );
}
