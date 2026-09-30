import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { poolInfo, poolTrades } from "@/lib/data/gecko";
import { safe } from "@/lib/data/http";
import { CHAINS } from "@/lib/chains";
import type { ChainId } from "@/lib/types";
import { ago, num, pct, price, shortAddr, usd } from "@/lib/format";
import { PoolBuy } from "@/components/PoolBuy";
import { PoolChart } from "@/components/PoolChart";

export const dynamic = "force-dynamic";

type P = { params: Promise<{ chain: string; pool: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { chain, pool } = await params;
  const info = chain in CHAINS ? await poolInfo(chain as ChainId, pool).catch(() => null) : null;
  return { title: info ? `${info.base}/${info.quote}` : "Pool" };
}

export default async function PoolPage({ params }: P) {
  const { chain: c, pool } = await params;
  if (!(c in CHAINS) || !CHAINS[c as ChainId].gecko) notFound();
  const chain = c as ChainId;
  const [info, trades] = await Promise.all([safe(poolInfo(chain, pool), null, "pool info"), safe(poolTrades(chain, pool, ""), [], "pool trades")]);
  const p = info.value;
  if (!p) {
    return (
      <div className="card p-8 text-center text-sm text-muted">
        GeckoTerminal didn&apos;t return this pool right now. <Link href="/analytics" className="text-ink underline">Back to analytics</Link>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <Link href="/analytics" className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink"><ArrowLeft className="size-4" /> Analytics</Link>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-4">
          <div className="card flex flex-wrap items-center gap-4 p-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {p.baseImage ? <img src={p.baseImage} alt="" className="size-12 rounded-full" /> : <div className="grid size-12 place-items-center rounded-full bg-surface-2 text-sm font-bold">{p.base.slice(0, 3)}</div>}
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{p.base}<span className="text-muted"> / {p.quote}</span></h1>
              <div className="text-sm text-ink-2">{p.baseName} · {CHAINS[chain].name} · {p.dex}</div>
            </div>
            <div className="num ml-auto text-right">
              <div className="text-2xl font-semibold">{price(p.priceUsd)}</div>
              <span className={`text-sm font-medium ${p.change24h >= 0 ? "text-up" : "text-down"}`}>{pct(p.change24h)} 24h</span>
            </div>
          </div>
          <PoolChart chain={chain} pool={pool} symbol={p.base} />
          <div className="card overflow-hidden">
            <div className="border-b border-line px-4 py-3 text-sm font-semibold">Recent trades</div>
            <div className="scroll-x">
              <table className="w-full min-w-[560px] text-sm">
                <tbody className="num">
                  {trades.value.slice(0, 30).map((t) => (
                    <tr key={t.id} className="border-b border-line/60 last:border-0">
                      <td className="px-4 py-2 text-muted">{ago(t.time)}</td>
                      <td className={t.side === "buy" ? "text-up" : "text-down"}>{t.side}</td>
                      <td className="text-right">{num(t.amountToken, 2)} {p.base}</td>
                      <td className="text-right">{usd(t.amountUsd)}</td>
                      <td className="px-4 text-right font-mono text-xs text-muted">{shortAddr(t.wallet, 4, 4)}</td>
                    </tr>
                  ))}
                  {!trades.value.length && <tr><td className="px-4 py-6 text-center text-muted">No trades returned</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <aside className="space-y-4">
          <PoolBuy chain={chain} token={p.baseAddress} symbol={p.base} />
          <div className="card space-y-2 p-4 text-sm">
            {[
              ["1h", pct(p.change1h)],
              ["Volume 24h", usd(p.volume24h, { compact: true })],
              ["Liquidity", usd(p.liquidityUsd, { compact: true })],
              ["FDV", usd(p.fdv, { compact: true })],
              ["Buys / sells 24h", `${num(p.buys24h, 0)} / ${num(p.sells24h, 0)}`],
              ["Pool age", p.ageHours < 48 ? `${Math.round(p.ageHours)}h` : `${Math.round(p.ageHours / 24)}d`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between"><span className="text-muted">{k}</span><span className="num font-medium">{v}</span></div>
            ))}
            {p.url && <a href={p.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 pt-1 text-xs text-muted hover:text-ink">GeckoTerminal <ExternalLink className="size-3" /></a>}
          </div>
        </aside>
      </div>
    </div>
  );
}
