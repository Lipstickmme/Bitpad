"use client";
import { useRouter } from "next/navigation";
import type { MarketToken } from "@/lib/types";
import { ago, num, price, usd } from "@/lib/format";
import { AssetDot, Change, TokenAvatar, orDash, Verified } from "./ui";
import { QuickBuyButton } from "./QuickBuy";
import { hotReason, isHot } from "@/lib/spike";
import { HotFlame } from "./HotFlame";
import { coin } from "@/lib/coin";
import { useHolders } from "@/lib/useHolders";
import { OgBadge } from "./OgBadge";

/** Dense market table — the default view for traders. */
export function TokenTable({ tokens }: { tokens: MarketToken[] }) {
  const router = useRouter();
  const fetched = useHolders("ton", tokens.filter((t) => t.holders == null).map((t) => t.address));
  return (
    <div className="card scroll-x">
      <table className="w-full min-w-[960px] text-sm">
        <thead className="text-left text-xs text-muted">
          <tr className="border-b border-line">
            <th className="px-4 py-2.5 font-medium">Token</th>
            <th className="font-medium">Pair</th>
            <th className="text-right font-medium">Price</th>
            <th className="text-right font-medium">1h</th>
            <th className="text-right font-medium">24h</th>
            <th className="text-right font-medium">Volume</th>
            <th className="text-right font-medium">Liquidity</th>
            <th className="text-right font-medium">Mkt cap</th>
            <th className="text-right font-medium">Holders</th>
            <th className="text-right font-medium">Txns</th>
            <th className="text-right font-medium">Age</th>
            <th className="px-4 text-right font-medium">Buy</th>
          </tr>
        </thead>
        <tbody className="num">
          {tokens.map((t) => (
            <tr key={t.address} onClick={() => router.push(`/token/${t.address}`)} title={hotReason(t)} className={`cursor-pointer border-b border-line/60 last:border-0 hover:bg-surface-2/70 ${isHot(t) ? "spike" : ""}`}>
              <td className="px-4 py-2">
                <div className="flex items-center gap-2.5">
                  <TokenAvatar token={t} size={26} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 font-medium">{t.symbol}{t.verified ? <Verified /> : <OgBadge createdAt={t.createdAt} />}{isHot(t) && <HotFlame size={14} title={hotReason(t)} />}{t.bitpad && <span className="chip">Bitpad</span>}</div>
                    <div className="max-w-[160px] truncate text-xs text-muted">{t.name}</div>
                  </div>
                </div>
              </td>
              <td><span className="inline-flex items-center gap-1.5 text-xs text-ink-2"><AssetDot asset={t.pair} size={14} />{coin(t.pair.symbol)}</span></td>
              <td className="text-right">{orDash(t.priceUsd, price)}</td>
              <td className="text-right text-xs"><Change value={t.changes?.h1} /></td>
              <td className="text-right text-xs"><Change value={t.change24h} /></td>
              <td className="text-right">{orDash(t.volume24h, (v) => usd(v, { compact: true }))}</td>
              <td className="text-right">{orDash(t.liquidityUsd, (v) => usd(v, { compact: true }))}</td>
              <td className="text-right">{orDash(t.marketCap ?? t.fdv, (v) => usd(v, { compact: true }))}</td>
              <td className="text-right text-ink-2">{orDash(t.holders ?? fetched[t.address], (v) => num(v, 0))}</td>
              <td className="text-right text-ink-2">{t.buys24h != null ? <><span className="text-up">{t.buys24h}</span>/<span className="text-down">{t.sells24h}</span></> : "—"}</td>
              <td className="text-right text-muted">{t.createdAt ? ago(t.createdAt) : "—"}</td>
              <td className="px-4 text-right"><QuickBuyButton token={{ address: t.address, symbol: t.symbol, bitpadPool: t.bitpad?.pool }} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
