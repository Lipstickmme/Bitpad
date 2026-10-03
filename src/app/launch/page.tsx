import type { Metadata } from "next";
import { getPairAssets } from "@/lib/prices";
import { LaunchForm } from "@/components/LaunchForm";
import { getFactoryConfig, getRegisteredPairs } from "@/lib/launches";
import { getBitpadTokens } from "@/lib/market";
import { creatorBoard } from "@/lib/creators";
import { CreatorJettons } from "@/components/CreatorJettons";
import { Hint } from "@/components/ui";
import { colorFor } from "@/lib/assets";
import { TON_ASSETS } from "@/lib/config";
import type { PairAsset } from "@/lib/types";

export const metadata: Metadata = { title: "Launch Creator Jetton" };
export const dynamic = "force-dynamic";

export default async function LaunchPage({ searchParams }: { searchParams: Promise<{ pair?: string }> }) {
  const sp = await searchParams;
  const [{ assets }, factory, bitpad] = await Promise.all([getPairAssets(), getFactoryConfig(), getBitpadTokens().catch(() => ({ tokens: [], ok: false }))]);
  // Creator jettons can back other creator jettons
  const board = creatorBoard(bitpad.tokens);
  const creators: PairAsset[] = board.map(({ token: t, paired }) => ({
    symbol: t.symbol, name: `${t.name}${t.bitpad!.creatorJetton!.tg ? ` · @${t.bitpad!.creatorJetton!.tg}` : ""}`, kind: "creator", chain: "ton",
    badge: t.bitpad!.creatorJetton!.verified ? "CREATOR ✓" : "CREATOR", color: colorFor(t.symbol), image: t.image,
    priceUsd: t.priceUsd, change24h: t.change24h, tonAddress: t.address, sector: `${paired.length} paired`,
  }));
  // Only assets with a verified jetton on TON can back a pool (when TON data is down, show the catalog as before)
  const onTon = assets.filter((a) => a.tonAddress);
  const all = [...(onTon.length ? onTon : assets), ...creators];
  const jettonMasters = all.map((a) => a.tonAddress).filter((a): a is string => !!a && a !== TON_ASSETS.TON);
  const registered = await getRegisteredPairs(jettonMasters);
  const ready = registered.filter((r) => r.enabled && r.ready);
  const pairable = new Set(ready.map((r) => r.master));
  return (
    <div className="space-y-8">
      <LaunchForm
        assets={all}
        initialPair={sp.pair}
        registeredPairs={ready.map((r) => ({ master: r.master, decimals: r.decimals, minLiquidity: r.minLiquidity }))}
        factory={factory && { launchFee: factory.launchFee.toString(), minTonLiquidity: factory.minTonLiquidity.toString(), tradeFeeBps: factory.protocolFeeBps + factory.creatorFeeBps, launches: factory.launches }}
      />
      <section id="creator-jettons" className="scroll-mt-24 space-y-3">
        <h2 className="flex items-center gap-1.5 text-lg font-semibold tracking-tight">
          Live creator jettons
          <Hint>Every jetton launched on Bitpad is a creator jetton, with its pool live from the first block and liquidity locked. The ✓ means the creator was logged in with Telegram at launch: Bitpad signed their Telegram account, launching wallet and ticker into the jetton, so the link can be checked. Once a creator jetton is enabled as a pair, new creator jettons can be backed by it.</Hint>
        </h2>
        <CreatorJettons board={board} pairable={pairable} ok={bitpad.ok} />
      </section>
    </div>
  );
}
