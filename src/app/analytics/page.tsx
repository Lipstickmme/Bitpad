import type { Metadata } from "next";
import { getAnalytics } from "@/lib/analytics";
import { AnalyticsView } from "@/components/analytics/AnalyticsView";

export const metadata: Metadata = { title: "Analytics" };
export const revalidate = 120;

export default async function AnalyticsPage() {
  const data = await getAnalytics();
  return <AnalyticsView data={data} />;
}
