"use client";
import type { ChainId } from "@/lib/types";
import { QuickBuyAmount, QuickBuyButton } from "./QuickBuy";
import { XBuyButton, xBuyable } from "./XBuy";

export function PoolBuy({ chain, token, symbol }: { chain: ChainId; token: string; symbol: string }) {
  return (
    <div className="card space-y-3 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Buy {symbol}</span>
        <QuickBuyAmount />
      </div>
      {chain === "ton" ? (
        <div className="flex items-center justify-between text-sm"><span className="text-ink-2">Best of STON.fi / DeDust</span><QuickBuyButton token={{ address: token, symbol }} className="h-9 px-3 text-sm" /></div>
      ) : xBuyable(chain) ? (
        <div className="flex items-center justify-between text-sm"><span className="text-ink-2">Best route via LI.FI</span><XBuyButton chain={chain} token={token} symbol={symbol} className="h-9 px-3 text-sm" /></div>
      ) : (
        <p className="text-sm text-muted">Buying on this chain isn&apos;t supported yet.</p>
      )}
    </div>
  );
}
