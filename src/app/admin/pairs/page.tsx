import type { Metadata } from "next";
import { getPairCandidates } from "@/lib/pair-candidates";
import { getFactoryConfig } from "@/lib/launches";
import { PairAdmin } from "@/components/PairAdmin";

export const metadata: Metadata = { title: "Pair assets", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function PairsAdminPage() {
  const [candidates, factory] = await Promise.all([getPairCandidates(), getFactoryConfig()]);
  return <PairAdmin candidates={candidates} owner={factory?.owner ?? null} />;
}
