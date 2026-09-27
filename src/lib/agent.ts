import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { getAnalytics } from "./analytics";
import { getPairAssets, getToken, getTokens } from "./market";
import { quoteBuy } from "./routing";

import type { TradeProposal } from "./agent-types";
export type { TradeProposal };

const MODEL = "claude-opus-5";
const MAX_TURNS = 8;

const SYSTEM = `You are Bitpad Copilot, a trading assistant inside Bitpad — a TON launchpad where tokens are paired with stocks, commodities, TON jettons and cross-chain assets, and liquidity is seeded directly into pools (no bonding curve).
Use the tools to ground every number you quote. Be concise and trader-friendly: lead with the answer, then the key figures.
When the user wants to trade, call propose_trade — you never execute trades yourself; the user reviews and signs in their wallet.
Flag risk plainly (thin liquidity, heavy sell pressure, price impact above 3%). Data marked "demo" is preview data; say so when it matters.`;

const tools: Anthropic.Beta.BetaTool[] = [
  {
    name: "list_tokens",
    description: "List Bitpad launches with price, market cap, 24h change/volume, liquidity and paired asset. Use to find movers or filter by pair type.",
    input_schema: {
      type: "object",
      properties: {
        sort: { type: "string", enum: ["marketCap", "volume24h", "change24h", "createdAt"] },
        pair_kind: { type: "string", enum: ["stock", "commodity", "jetton", "crypto", "any"] },
        limit: { type: "integer", minimum: 1, maximum: 20 },
      },
      required: [],
    },
  },
  {
    name: "get_token",
    description: "Full detail for one Bitpad token by symbol or address, including paired asset valuation and dividend yield.",
    input_schema: { type: "object", properties: { token: { type: "string" } }, required: ["token"] },
  },
  {
    name: "get_market_analytics",
    description: "Cross-chain launchpad & DEX comparison: volume, wins vs losses, average returns, FOMO score per chain, top trending pools.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_pair_asset",
    description: "Price, 24h change, dividend yield and underlying market cap for a pairable asset (e.g. SPYx, NVDAx, XAUt, TON, GRAM).",
    input_schema: { type: "object", properties: { symbol: { type: "string" } }, required: ["symbol"] },
  },
  {
    name: "quote_buy",
    description: "Compare buy routes (STON.fi, DeDust, split, Omniston, external) for a token. Returns receive amount, price impact and fees per route.",
    input_schema: {
      type: "object",
      properties: {
        token: { type: "string" },
        pay_asset: { type: "string", enum: ["TON", "USDT", "GRAM", "USDC"] },
        amount: { type: "number", exclusiveMinimum: 0 },
      },
      required: ["token", "pay_asset", "amount"],
    },
  },
  {
    name: "propose_trade",
    description: "Stage a trade for the user to review and sign. Does not execute anything.",
    input_schema: {
      type: "object",
      properties: {
        token: { type: "string" },
        side: { type: "string", enum: ["buy", "sell"] },
        pay_asset: { type: "string", enum: ["TON", "USDT", "GRAM", "USDC"] },
        amount: { type: "number", exclusiveMinimum: 0 },
        rationale: { type: "string" },
      },
      required: ["token", "side", "pay_asset", "amount", "rationale"],
    },
  },
];

type Input = Record<string, unknown>;

function slim<T extends { spark?: unknown }>(t: T) {
  const { spark: _s, ...rest } = t;
  return rest;
}

async function runTool(name: string, input: Input, proposals: TradeProposal[]): Promise<unknown> {
  switch (name) {
    case "list_tokens": {
      const sort = (input.sort as string) ?? "volume24h";
      const kind = (input.pair_kind as string) ?? "any";
      const list = (await getTokens())
        .filter((t) => kind === "any" || t.pair.kind === kind)
        .sort((a, b) => Number(b[sort as "marketCap"]) - Number(a[sort as "marketCap"]))
        .slice(0, Number(input.limit ?? 8));
      return list.map((t) => ({ symbol: t.symbol, name: t.name, address: t.address, pair: t.pair.symbol, pairKind: t.pair.kind, priceUsd: t.priceUsd, marketCap: t.marketCap, change24h: +t.change24h.toFixed(2), volume24h: Math.round(t.volume24h), liquidityUsd: Math.round(t.liquidityUsd), buys: t.buys24h, sells: t.sells24h, source: t.source }));
    }
    case "get_token": {
      const t = await getToken(String(input.token));
      return t ? slim(t) : { error: `No Bitpad token matches "${input.token}"` };
    }
    case "get_market_analytics": {
      const a = await getAnalytics();
      return {
        launchpads: a.launchpads.map((l) => ({ name: l.name, chain: l.chain, mechanism: l.mechanism, volume24h: Math.round(l.volume24h), wins: l.wins, losses: l.losses, avgReturn24h: +l.avgReturn24h.toFixed(1), source: l.source })),
        dexes: a.dexes.map((d) => ({ name: d.name, chain: d.chain, volume24h: Math.round(d.volume24h), change: +d.volumeChange.toFixed(1), source: d.source })),
        chains: a.chains,
        pairTypes: a.pairTypes,
        topTrending: a.trending.slice(0, 8).map((p) => ({ name: p.name, chain: p.chain, dex: p.dex, change24h: +p.change24h.toFixed(1), volume24h: Math.round(p.volume24h) })),
      };
    }
    case "get_pair_asset": {
      const { assets, live } = await getPairAssets();
      const a = assets.find((x) => x.symbol.toLowerCase() === String(input.symbol).toLowerCase());
      return a ? { ...a, live } : { error: `Unknown asset ${input.symbol}` };
    }
    case "quote_buy": {
      const t = await getToken(String(input.token));
      if (!t) return { error: `No Bitpad token matches "${input.token}"` };
      return quoteBuy(t, String(input.pay_asset), Number(input.amount));
    }
    case "propose_trade": {
      const t = await getToken(String(input.token));
      if (!t) return { error: `No Bitpad token matches "${input.token}"` };
      const p: TradeProposal = { symbol: t.symbol, address: t.address, side: input.side as "buy" | "sell", payAsset: String(input.pay_asset), amount: Number(input.amount), rationale: String(input.rationale) };
      proposals.push(p);
      return { staged: true, note: "Shown to the user as a confirm card; they sign in their wallet." };
    }
    default:
      return { error: `Unknown tool ${name}` };
  }
}

export async function runCopilot(history: Anthropic.Beta.BetaMessageParam[]) {
  const client = new Anthropic();
  const messages = [...history];
  const proposals: TradeProposal[] = [];
  const toolLog: string[] = [];

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      tools,
      messages,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });

    if (res.stop_reason === "refusal") {
      return { text: "I can't help with that request.", proposals, toolLog };
    }
    messages.push({ role: "assistant", content: res.content });

    if (res.stop_reason === "pause_turn") continue;
    if (res.stop_reason !== "tool_use") {
      const text = res.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join("\n");
      return { text, proposals, toolLog };
    }

    const calls = res.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    const results = await Promise.all(
      calls.map(async (c): Promise<Anthropic.Beta.BetaToolResultBlockParam> => {
        toolLog.push(c.name);
        try {
          return { type: "tool_result", tool_use_id: c.id, content: JSON.stringify(await runTool(c.name, c.input as Input, proposals)) };
        } catch (e) {
          return { type: "tool_result", tool_use_id: c.id, content: `Tool failed: ${(e as Error).message}`, is_error: true };
        }
      }),
    );
    messages.push({ role: "user", content: results });
  }
  return { text: "I ran out of steps before finishing — try a narrower question.", proposals, toolLog };
}
