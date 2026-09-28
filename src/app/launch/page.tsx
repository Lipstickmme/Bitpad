import type { Metadata } from "next";
import { getPairAssets } from "@/lib/prices";
import { LaunchForm } from "@/components/LaunchForm";
import { getFactoryConfig } from "@/lib/launches";

export const metadata: Metadata = { title: "Launch a token" };
export const revalidate = 60;

export default async function LaunchPage() {
  const [{ assets }, factory] = await Promise.all([getPairAssets(), getFactoryConfig()]);
  return (
    <LaunchForm
      assets={assets}
      factory={factory && { launchFee: factory.launchFee.toString(), minTonLiquidity: factory.minTonLiquidity.toString(), tradeFeeBps: factory.protocolFeeBps + factory.creatorFeeBps }}
    />
  );
}
