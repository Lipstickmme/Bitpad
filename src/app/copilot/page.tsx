import type { Metadata } from "next";
import { CopilotView } from "@/components/CopilotView";

export const metadata: Metadata = { title: "AI Copilot" };

export default function CopilotPage() {
  return <CopilotView />;
}
