import type { Metadata } from "next";
import { getPairAssets } from "@/lib/prices";
import { StocksView } from "@/components/StocksView";
import { XChainStocks } from "@/components/XChainStocks";
import { getXChainStocks } from "@/lib/xchain-stocks";

export const metadata: Metadata = { title: "Stocks & gold" };
export const dynamic = "force-dynamic";

export default async function StocksPage() {
  const [{ assets }, x] = await Promise.all([getPairAssets(), getXChainStocks().catch(() => ({ assets: [], paired: [], live: false }))]);
  return (
    <div className="space-y-6">
      <StocksView assets={assets} />
      <XChainStocks assets={x.assets} paired={x.paired} live={x.live} />
    </div>
  );
}
