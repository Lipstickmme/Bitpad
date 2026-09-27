import type { Metadata } from "next";
import { getPairAssets } from "@/lib/prices";
import { LaunchForm } from "@/components/LaunchForm";

export const metadata: Metadata = { title: "Launch a token" };
export const revalidate = 60;

export default async function LaunchPage() {
  const { assets } = await getPairAssets();
  return <LaunchForm assets={assets} />;
}
