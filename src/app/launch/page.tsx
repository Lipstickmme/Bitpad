import type { Metadata } from "next";
import { getPairAssets } from "@/lib/prices";
import { LaunchForm } from "@/components/LaunchForm";
import { getFactoryConfig, getRegisteredPairs } from "@/lib/launches";
import { TON_ASSETS } from "@/lib/config";

export const metadata: Metadata = { title: "Launch a token" };
export const dynamic = "force-dynamic";

export default async function LaunchPage() {
  const [{ assets }, factory] = await Promise.all([getPairAssets(), getFactoryConfig()]);
  const jettonMasters = assets.map((a) => a.tonAddress).filter((a): a is string => !!a && a !== TON_ASSETS.TON);
  const registered = await getRegisteredPairs(jettonMasters);
  return (
    <LaunchForm
      assets={assets}
      registeredPairs={registered.filter((r) => r.enabled && r.ready).map((r) => ({ master: r.master, decimals: r.decimals, minLiquidity: r.minLiquidity }))}
      factory={factory && { launchFee: factory.launchFee.toString(), minTonLiquidity: factory.minTonLiquidity.toString(), tradeFeeBps: factory.protocolFeeBps + factory.creatorFeeBps, launches: factory.launches }}
    />
  );
}
