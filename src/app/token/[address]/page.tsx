import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getToken } from "@/lib/market";
import { TokenView } from "@/components/TokenView";

type Props = { params: Promise<{ address: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = await getToken((await params).address);
  return { title: t ? `$${t.symbol} / ${t.pair.symbol}` : "Token" };
}

export default async function TokenPage({ params }: Props) {
  const token = await getToken((await params).address);
  if (!token) notFound();
  return <TokenView token={token} />;
}
