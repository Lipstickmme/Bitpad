import type { Metadata } from "next";
import { BundlerView } from "@/components/BundlerView";

export const metadata: Metadata = { title: "Multi-wallet bundler" };

export default function BundlerPage() {
  return <BundlerView />;
}
