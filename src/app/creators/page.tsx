import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Plus, Rocket } from "lucide-react";
import { getBitpadTokens } from "@/lib/market";
import { creatorBoard } from "@/lib/creators";
import { getRegisteredPairs } from "@/lib/launches";
import { price, usd } from "@/lib/format";
import { Change, Hint } from "@/components/ui";
import { QuickBuyButton } from "@/components/QuickBuy";

export const metadata: Metadata = { title: "Creator jettons" };
export const dynamic = "force-dynamic";

export default async function CreatorsPage() {
  const { tokens, ok } = await getBitpadTokens();
  const board = creatorBoard(tokens);
  const pairable = new Set((await getRegisteredPairs(board.map((b) => b.token.address))).filter((r) => r.enabled && r.ready).map((r) => r.master));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="flex items-center gap-1.5 text-3xl font-bold tracking-tight">
            Creator jettons
            <Hint>
              A creator jetton is a creator&apos;s own coin on TON, launched through Bitpad with its pool live from the first block and liquidity locked. It&apos;s linked to the creator&apos;s Telegram account: when they launch while logged in, Bitpad signs their Telegram identity, launching wallet and ticker into the jetton&apos;s metadata, which is what the verified badge checks. The creator earns the creator fee on every trade. Once a creator jetton is enabled as a pair, anyone can launch tokens paired with it, so every buy of those tokens runs through the creator&apos;s coin.
            </Hint>
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-2">Coins that belong to creators. Buy the ones you back, or launch a token paired with a creator&apos;s jetton.</p>
        </div>
        <Link href="/launch?mode=creator" className="btn btn-primary ml-auto"><Plus className="size-4" /> Launch your creator jetton</Link>
      </div>

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
                  <div className="rounded-lg bg-surface-2 p-2"><div className="text-muted">Paired tokens</div><div className="font-semibold">{paired.length}</div></div>
                </div>
                {paired.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {paired.slice(0, 6).map((x) => <Link key={x.address} href={`/token/${x.address}`} className="chip hover:text-ink">${x.symbol}</Link>)}
                  </div>
                )}
                <div className="mt-auto flex items-center gap-2">
                  <QuickBuyButton token={{ address: t.address, symbol: t.symbol, bitpadPool: t.bitpad?.pool }} className="h-9 px-3 text-sm" />
                  {pairable.has(t.address) ? (
                    <Link href={`/launch?pair=${t.address}`} className="btn btn-ghost ml-auto h-9 text-xs"><Rocket className="size-3.5" /> Launch paired with ${t.symbol}</Link>
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
          <Link href="/launch?mode=creator" className="btn btn-primary mt-4"><Plus className="size-4" /> Launch your creator jetton</Link>
        </div>
      )}
    </div>
  );
}
