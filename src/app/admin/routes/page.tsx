import type { Metadata } from "next";
import { getPairAssets } from "@/lib/prices";
import { RouteCheck } from "@/components/RouteCheck";

export const metadata: Metadata = { title: "Route check", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function RoutesPage() {
  const { assets } = await getPairAssets();
  return <RouteCheck assets={assets.map((a) => ({ symbol: a.symbol, name: a.name, kind: a.kind }))} />;
}
