import type { Metadata } from "next";
import { getPairAssets } from "@/lib/prices";
import { StocksView } from "@/components/StocksView";

export const metadata: Metadata = { title: "Stocks & gold" };
export const dynamic = "force-dynamic";

export default async function StocksPage() {
  const { assets } = await getPairAssets();
  return <StocksView assets={assets} />;
}
