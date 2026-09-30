import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getPairAssets } from "@/lib/prices";
import { StockDetail } from "@/components/StockDetail";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ symbol: string }> }): Promise<Metadata> {
  return { title: decodeURIComponent((await params).symbol) };
}

export default async function StockPage({ params }: { params: Promise<{ symbol: string }> }) {
  const sym = decodeURIComponent((await params).symbol).toLowerCase();
  const asset = (await getPairAssets()).assets.find((a) => a.symbol.toLowerCase() === sym && (a.kind === "stock" || a.kind === "commodity"));
  if (!asset) notFound();
  return (
    <div className="space-y-4">
      <Link href="/stocks" className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink"><ArrowLeft className="size-4" /> Stocks &amp; gold</Link>
      <StockDetail asset={asset} />
    </div>
  );
}
