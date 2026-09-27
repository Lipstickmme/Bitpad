import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { runCopilot } from "@/lib/agent";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Copilot is offline: set ANTHROPIC_API_KEY on the server." }, { status: 503 });
  }
  const { messages } = (await req.json()) as { messages: { role: "user" | "assistant"; content: string }[] };
  if (!Array.isArray(messages) || !messages.length) return NextResponse.json({ error: "messages required" }, { status: 400 });
  try {
    const out = await runCopilot(messages.slice(-20).map((m) => ({ role: m.role, content: String(m.content).slice(0, 4000) })));
    return NextResponse.json(out);
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return NextResponse.json({ error: "Copilot is busy — try again in a moment." }, { status: 429 });
    if (e instanceof Anthropic.APIError) return NextResponse.json({ error: `Copilot error (${e.status ?? "network"})` }, { status: 502 });
    throw e;
  }
}
