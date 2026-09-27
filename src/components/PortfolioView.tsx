"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useTonAddress, useTonConnectUI } from "@tonconnect/ui-react";
import { Wallet, ExternalLink, PieChart } from "lucide-react";
import { useApp } from "@/lib/store";
import { DEMO_TOKENS } from "@/lib/demo";
import { num, price, shortAddr, usd } from "@/lib/format";
import { Change } from "./ui";

interface Holding { address: string; symbol: string; name: string; image?: string; amount: number; priceUsd: number; valueUsd: number; change24h: number }

export function PortfolioView() {
  const ton = useTonAddress();
  const [tc] = useTonConnectUI();
  const { external, tgUser } = useApp();
  const [data, setData] = useState<{ ton: number; tonUsd: number; holdings: Holding[]; live: boolean } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!ton) return;
    setLoading(true);
    fetch(`/api/portfolio?address=${ton}`).then((r) => r.json()).then(setData).finally(() => setLoading(false));
  }, [ton]);

  if (!ton) {
    return (
      <div className="mx-auto max-w-md pt-10 text-center">
        <div className="card p-8">
          <Wallet className="mx-auto size-8 text-brand" />
          <h1 className="mt-3 text-xl font-extrabold">Your portfolio</h1>
          <p className="mt-1 text-sm text-ink-2">Connect a TON wallet to see jettons, Bitpad positions, paired-asset exposure and dividend estimates.</p>
          <button onClick={() => tc.openModal()} className="btn btn-primary mt-4">Connect TON wallet</button>
        </div>
      </div>
    );
  }

  const tonValue = (data?.ton ?? 0) * (data?.tonUsd ?? 0);
  const holdings = data?.holdings ?? [];
  const total = tonValue + holdings.reduce((s, h) => s + h.valueUsd, 0);
  const change = total ? holdings.reduce((s, h) => s + h.valueUsd * (h.change24h / 100), 0) / total * 100 : 0;
  const bitpad = holdings.map((h) => ({ h, t: DEMO_TOKENS.find((t) => t.address === h.address) })).filter((x) => x.t);
  const alloc = [{ label: "TON", value: tonValue }, ...holdings.slice(0, 6).map((h) => ({ label: h.symbol, value: h.valueUsd }))].filter((a) => a.value > 0);
  const other = total - alloc.reduce((s, a) => s + a.value, 0);
  if (other > 0.01) alloc.push({ label: "Other", value: other });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Portfolio</h1>
          <p className="text-sm text-ink-2">{tgUser ? `${tgUser.first_name} · ` : ""}<span className="font-mono">{shortAddr(ton, 6, 6)}</span></p>
        </div>
        <a href={`https://tonviewer.com/${ton}`} target="_blank" rel="noreferrer" className="btn btn-ghost ml-auto">Tonviewer <ExternalLink className="size-3.5" /></a>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card p-4"><div className="text-xs text-muted">Net worth (TON chain)</div><div className="num mt-1 text-3xl font-extrabold">{loading ? "…" : usd(total)}</div><Change value={change} className="text-sm" /></div>
        <div className="card p-4"><div className="text-xs text-muted">TON balance</div><div className="num mt-1 text-3xl font-extrabold">{num(data?.ton ?? 0, 3)}</div><div className="num text-sm text-ink-2">{usd(tonValue)}</div></div>
        <div className="card p-4"><div className="text-xs text-muted">Jettons held</div><div className="num mt-1 text-3xl font-extrabold">{holdings.length}</div><div className="text-sm text-ink-2">{bitpad.length} Bitpad positions</div></div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="card overflow-hidden">
          <div className="border-b border-line px-4 py-3 font-bold">Holdings {data && !data.live && <span className="chip ml-2">TonAPI unavailable</span>}</div>
          <div className="scroll-x">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="text-left text-xs text-muted"><tr className="border-b border-line"><th className="px-4 py-2 font-medium">Asset</th><th className="text-right font-medium">Amount</th><th className="text-right font-medium">Price</th><th className="text-right font-medium">24h</th><th className="px-4 text-right font-medium">Value</th></tr></thead>
              <tbody className="num">
                <tr className="border-b border-line/60"><td className="px-4 py-2.5 font-semibold">TON</td><td className="text-right">{num(data?.ton ?? 0, 3)}</td><td className="text-right">{price(data?.tonUsd ?? 0)}</td><td /><td className="px-4 text-right font-semibold">{usd(tonValue)}</td></tr>
                {holdings.map((h) => (
                  <tr key={h.address} className="border-b border-line/60 last:border-0">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {h.image ? <img src={h.image} alt="" className="size-6 rounded-full" /> : <span className="size-6 rounded-full bg-surface-2" />}
                        <span className="font-semibold">{h.symbol}</span><span className="hidden text-xs text-muted sm:inline">{h.name}</span>
                      </div>
                    </td>
                    <td className="text-right">{num(h.amount, 2)}</td>
                    <td className="text-right">{price(h.priceUsd)}</td>
                    <td className="text-right"><Change value={h.change24h} /></td>
                    <td className="px-4 text-right font-semibold">{usd(h.valueUsd)}</td>
                  </tr>
                ))}
                {!loading && !holdings.length && <tr><td colSpan={5} className="py-8 text-center text-muted">No jettons found for this wallet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="card p-4">
            <h3 className="flex items-center gap-2 font-bold"><PieChart className="size-4" /> Allocation</h3>
            <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-surface-2">
              {alloc.map((a, i) => <div key={a.label} style={{ width: `${(a.value / (total || 1)) * 100}%`, background: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#8492a6"][i] }} className="border-r-2 border-surface last:border-0" title={a.label} />)}
            </div>
            <ul className="mt-3 space-y-1.5 text-sm">
              {alloc.map((a, i) => (
                <li key={a.label} className="flex items-center gap-2">
                  <span className="size-2.5 rounded-sm" style={{ background: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#8492a6"][i] }} />
                  {a.label}<span className="num ml-auto text-ink-2">{((a.value / (total || 1)) * 100).toFixed(1)}%</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="card p-4">
            <h3 className="font-bold">Paired exposure & dividends</h3>
            {bitpad.length ? (
              <ul className="mt-2 space-y-2 text-sm">
                {bitpad.map(({ h, t }) => (
                  <li key={h.address} className="flex justify-between"><Link href={`/token/${t!.address}`} className="font-semibold hover:text-brand">${t!.symbol}</Link><span className="text-ink-2">{t!.pair.symbol}{t!.pair.dividendYield ? ` · ${t!.pair.dividendYield}% div` : ""}</span></li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted">Hold Bitpad tokens paired with dividend stocks (e.g. $DIVI / KO) to see estimated pool dividends here.</p>
            )}
          </section>
          <section className="card p-4">
            <h3 className="font-bold">Linked wallets</h3>
            <ul className="mt-2 space-y-1.5 text-sm">
              <li className="flex justify-between"><span>TON</span><span className="font-mono text-xs">{shortAddr(ton, 6, 6)}</span></li>
              {external.map((w) => (
                <li key={w.chain} className="flex justify-between">
                  <span className="capitalize">{w.chain === "evm" ? "EVM" : "Solana"} · {w.provider}</span>
                  <a className="font-mono text-xs hover:text-brand" target="_blank" rel="noreferrer" href={w.chain === "solana" ? `https://solscan.io/account/${w.address}` : `https://debank.com/profile/${w.address}`}>{shortAddr(w.address, 6, 4)}</a>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
