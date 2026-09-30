import type { Metadata } from "next";
import { getPairAssets } from "@/lib/prices";
import { LaunchForm } from "@/components/LaunchForm";
import { getFactoryConfig, getRegisteredPairs } from "@/lib/launches";
import { getBitpadTokens } from "@/lib/market";
import { creatorBoard } from "@/lib/creators";
import { colorFor } from "@/lib/assets";
import { TON_ASSETS } from "@/lib/config";
import type { PairAsset } from "@/lib/types";

export const metadata: Metadata = { title: "Launch a token" };
export const dynamic = "force-dynamic";

export default async function LaunchPage({ searchParams }: { searchParams: Promise<{ pair?: string; mode?: string }> }) {
  const sp = await searchParams;
  const [{ assets }, factory, bitpad] = await Promise.all([getPairAssets(), getFactoryConfig(), getBitpadTokens().catch(() => ({ tokens: [] }))]);
  // Creator jettons are pair assets too: tokens launched against a creator's coin
  const creators: PairAsset[] = creatorBoard(bitpad.tokens).map(({ token: t, paired }) => ({
    symbol: t.symbol, name: `${t.name}${t.bitpad!.creatorJetton!.tg ? ` · @${t.bitpad!.creatorJetton!.tg}` : ""}`, kind: "creator", chain: "ton",
    badge: t.bitpad!.creatorJetton!.verified ? "CREATOR ✓" : "CREATOR", color: colorFor(t.symbol), image: t.image,
    priceUsd: t.priceUsd, change24h: t.change24h, tonAddress: t.address, sector: `${paired.length} paired`,
  }));
  const all = [...assets, ...creators];
  const jettonMasters = all.map((a) => a.tonAddress).filter((a): a is string => !!a && a !== TON_ASSETS.TON);
  const registered = await getRegisteredPairs(jettonMasters);
  return (
    <LaunchForm
      assets={all}
      initialMode={sp.mode === "creator" ? "creator" : "token"}
      initialPair={sp.pair}
      registeredPairs={registered.filter((r) => r.enabled && r.ready).map((r) => ({ master: r.master, decimals: r.decimals, minLiquidity: r.minLiquidity }))}
      factory={factory && { launchFee: factory.launchFee.toString(), minTonLiquidity: factory.minTonLiquidity.toString(), tradeFeeBps: factory.protocolFeeBps + factory.creatorFeeBps, launches: factory.launches }}
    />
  );
}
