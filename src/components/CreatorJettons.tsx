import Link from "next/link";
import { BadgeCheck, Rocket } from "lucide-react";
import type { MarketToken } from "@/lib/types";
import { price, usd } from "@/lib/format";
import { Change } from "./ui";
import { QuickBuyButton } from "./QuickBuy";

/** Live creator jettons: verified badge, market data, what's backed by each, quick buy. */
export function CreatorJettons({ board, pairable, ok }: { board: { token: MarketToken; paired: MarketToken[] }[]; pairable: Set<string>; ok: boolean }) {
  return (
    <>
      {board.length ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {board.map(({ token: t, paired }) => {
            const p = t.bitpad!.creatorJetton!;
            return (
              <div key={t.address} className="card flex flex-col gap-3 p-4">
                <Link href={`/token/${t.address}`} className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {t.image ? <img src={t.image} alt="" className="size-11 rounded-full object-cover" /> : <span className="grid size-11 place-items-center rounded-full bg-surface-2 text-xs font-bold">{t.symbol.slice(0, 3)}</span>}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 font-semibold">${t.symbol} {p.verified && <BadgeCheck className="size-4 text-brand" aria-label="Verified creator" />}</div>
                    <div className="truncate text-xs text-ink-2">{p.name || t.name}{p.tg ? ` · @${p.tg}` : ""}{!p.verified && <span className="text-muted"> · unverified</span>}</div>
                  </div>
                  <div className="num text-right text-sm">
                    <div>{t.priceUsd != null ? price(t.priceUsd) : "—"}</div>
                    <Change value={t.change24h} className="text-xs" />
                  </div>
                </Link>
                <div className="num grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-lg bg-surface-2 p-2"><div className="text-muted">Mcap</div><div className="font-semibold">{t.marketCap != null ? usd(t.marketCap, { compact: true }) : "—"}</div></div>
                  <div className="rounded-lg bg-surface-2 p-2"><div className="text-muted">Liquidity</div><div className="font-semibold">{t.liquidityUsd != null ? usd(t.liquidityUsd, { compact: true }) : "—"}</div></div>
                  <div className="rounded-lg bg-surface-2 p-2"><div className="text-muted" title="Creator jettons backed by this one">Backs</div><div className="font-semibold">{paired.length}</div></div>
                </div>
                {paired.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {paired.slice(0, 6).map((x) => <Link key={x.address} href={`/token/${x.address}`} className="chip hover:text-ink">${x.symbol}</Link>)}
                  </div>
                )}
                <div className="mt-auto flex items-center gap-2">
                  <QuickBuyButton token={{ address: t.address, symbol: t.symbol, bitpadPool: t.bitpad?.pool }} className="h-9 px-3 text-sm" />
                  {pairable.has(t.address) ? (
                    <Link href={`/launch?pair=${t.address}`} className="btn btn-ghost ml-auto h-9 text-xs"><Rocket className="size-3.5" /> Back yours with ${t.symbol}</Link>
                  ) : (
                    <span className="ml-auto text-[11px] text-muted" title="The factory owner enables creator jettons as pairs from the Pairs admin page">Pairing not enabled yet</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card p-10 text-center">
          <p className="text-sm text-ink-2">{ok ? "No creator jettons yet. Be the first." : "Couldn't read the Bitpad factory right now."}</p>
        </div>
      )}
    </>
  );
}
