"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useTonAddress, useTonConnectUI } from "@tonconnect/ui-react";
import { Wallet, ExternalLink } from "lucide-react";
import { useApp } from "@/lib/store";
import { num, price, shortAddr, usd } from "@/lib/format";
import { Change } from "./ui";
import { PortfolioCharts } from "./PortfolioCharts";
import { PortfolioHistory } from "./PortfolioHistory";
import { Verified } from "./ui";

interface Holding { address: string; symbol: string; name: string; image?: string; amount: number; priceUsd: number | null; valueUsd: number | null; change24h: number | null; chain?: string; verified?: boolean }
interface Data {
  ton: number | null;
  tonUsd: number | null;
  holdings: Holding[];
  tonLive: boolean;
  solana: { address: string; sol: number | null; usd: number | null; tokens?: Holding[]; tokensLive?: boolean } | null;
  evm: { address: string; balances: Record<string, number>; ethUsd: number | null; tokens?: Holding[]; tokensLive?: boolean } | null;
}

export function PortfolioView() {
  const ton = useTonAddress();
  const [tc] = useTonConnectUI();
  const { external, tgUser } = useApp();
  const sol = external.find((w) => w.chain === "solana")?.address;
  const evm = external.find((w) => w.chain === "evm")?.address;
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"ton" | "solana" | "evm">("ton");
  const [showSpam, setShowSpam] = useState(false);
  // open the holdings tab of a chain that's actually connected
  useEffect(() => setTab((t) => (t === "ton" && !ton ? (sol ? "solana" : evm ? "evm" : t) : t)), [ton, sol, evm]);

  useEffect(() => {
    if (!ton && !sol && !evm) return;
    setLoading(true);
    const qs = new URLSearchParams({ ...(ton && { address: ton }), ...(sol && { sol }), ...(evm && { evm }) });
    fetch(`/api/portfolio?${qs}`).then((r) => r.json()).then(setData).finally(() => setLoading(false));
  }, [ton, sol, evm]);

  if (!ton && !sol && !evm) {
    return (
      <div className="mx-auto max-w-md pt-10 text-center">
        <div className="card p-8">
          <Wallet className="mx-auto size-7 text-ink-2" />
          <h1 className="mt-3 text-lg font-semibold">Your portfolio</h1>
          <p className="mt-1 text-sm text-ink-2">Connect a TON, Solana or EVM wallet to see live balances across chains.</p>
          <button onClick={() => tc.openModal()} className="btn btn-primary mt-4">Connect TON wallet</button>
        </div>
      </div>
    );
  }

  const tonValue = data?.ton != null && data.tonUsd ? data.ton * data.tonUsd : 0;
  const holdings = data?.holdings ?? [];
  const jettonValue = holdings.reduce((s, h) => s + (h.valueUsd ?? 0), 0);
  const solTokens = data?.solana?.tokens ?? [];
  const evmTokens = data?.evm?.tokens ?? [];
  const sum = (l: Holding[]) => l.reduce((s, h) => s + (h.valueUsd ?? 0), 0);
  const solValue = (data?.solana?.usd ?? 0) + sum(solTokens);
  const ethValue = (data?.evm && data.evm.ethUsd ? ((data.evm.balances.ethereum ?? 0) + (data.evm.balances.base ?? 0)) * data.evm.ethUsd : 0) + sum(evmTokens);
  const total = tonValue + jettonValue + solValue + ethValue;
  const alloc = [
    { label: "GRAM", value: tonValue },
    ...holdings.slice(0, 4).map((h) => ({ label: h.symbol, value: h.valueUsd ?? 0 })),
    { label: "Solana", value: solValue },
    { label: "Ethereum + Base", value: ethValue },
  ].filter((a) => a.value > 0.01);
  const other = total - alloc.reduce((s, a) => s + a.value, 0);
  if (other > 0.01) alloc.push({ label: "Other jettons", value: other });

  const evmValue = (c: "ethereum" | "base") => (data?.evm?.ethUsd ? (data.evm.balances[c] ?? 0) * data.evm.ethUsd : 0) + sum(evmTokens.filter((t) => t.chain === c));
  const chains = [
    { label: "GRAM", value: tonValue + jettonValue },
    { label: "Solana", value: solValue },
    { label: "Ethereum", value: evmValue("ethereum") },
    { label: "Base", value: evmValue("base") },
  ].filter((c) => c.value > 0.01);
  // Value now × change / (100 + change) = the dollar move over 24h
  const pnl = [...holdings, ...solTokens]
    .filter((h) => h.valueUsd != null && h.change24h != null && h.valueUsd > 0.5)
    .map((h) => ({ label: h.symbol, value: (h.valueUsd! * h.change24h!) / (100 + h.change24h!) }))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, 8);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Portfolio</h1>
          <p className="text-sm text-ink-2">{tgUser ? `${tgUser.first_name} · ` : ""}{ton ? <span className="font-mono">{shortAddr(ton, 6, 6)}</span> : "No TON wallet connected"}</p>
        </div>
        {ton && <a href={`https://tonviewer.com/${ton}`} target="_blank" rel="noreferrer" className="btn btn-ghost ml-auto">Tonviewer <ExternalLink className="size-3.5" /></a>}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Net worth (all chains)" value={loading ? "…" : usd(total)} />
        <Tile label="GRAM" value={data?.ton != null ? num(data.ton, 3) : "—"} sub={tonValue ? usd(tonValue) : undefined} />
        <Tile label="Solana" value={data?.solana?.sol != null ? `${num(data.solana.sol, 3)} SOL` : "—"} sub={sol ? (solValue ? `${usd(solValue)} incl. ${solTokens.length} token${solTokens.length === 1 ? "" : "s"}` : undefined) : "not connected"} />
        <Tile label="EVM" value={data?.evm ? `${num((data.evm.balances.ethereum ?? 0) + (data.evm.balances.base ?? 0), 4)} ETH` : "—"} sub={data?.evm ? `${ethValue ? `${usd(ethValue)} incl. tokens · ` : ""}${num(data.evm.balances.bsc ?? 0, 4)} BNB` : evm ? undefined : "not connected"} />
      </div>

      <PortfolioCharts alloc={alloc} chains={chains} pnl={pnl} />

      <div className="grid grid-cols-1 gap-4">
        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
            <h2 className="text-sm font-semibold">Holdings</h2>
            {tab === "ton" && data && ton && !data.tonLive && <span className="chip">TonAPI unavailable</span>}
            {tab === "solana" && data?.solana && data.solana.tokensLive === false && <span className="chip">Solana tokens unavailable</span>}
            {tab === "evm" && data?.evm && data.evm.tokensLive === false && <span className="chip">Blockscout unavailable</span>}
            <div className="seg ml-auto">
              <button data-on={tab === "ton"} onClick={() => setTab("ton")}>TON {holdings.length ? holdings.length : ""}</button>
              <button data-on={tab === "solana"} onClick={() => setTab("solana")}>Solana {solTokens.length ? solTokens.length : ""}</button>
              <button data-on={tab === "evm"} onClick={() => setTab("evm")}>Ethereum &amp; Base {evmTokens.length ? evmTokens.length : ""}</button>
            </div>
          </div>
          {(() => {
            const list = tab === "ton" ? holdings : tab === "solana" ? solTokens : evmTokens;
            const spam = tab === "ton" ? [] : list.filter((h) => !h.verified && h.valueUsd == null);
            const visible = showSpam ? list : list.filter((h) => !spam.includes(h));
            const connected = tab === "ton" ? !!ton : tab === "solana" ? !!sol : !!evm;
            const href = (h: Holding) => (tab === "ton" ? `/token/${h.address}` : tab === "solana" ? `https://solscan.io/token/${h.address}` : `${h.chain === "base" ? "https://basescan.org" : "https://etherscan.io"}/token/${h.address}`);
            return (
              <>
                <div className="scroll-x">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead className="text-left text-xs text-muted"><tr className="border-b border-line"><th className="px-4 py-2 font-medium">Asset</th>{tab === "evm" && <th className="font-medium">Chain</th>}<th className="text-right font-medium">Amount</th><th className="text-right font-medium">Price</th><th className="text-right font-medium">24h</th><th className="px-4 text-right font-medium">Value</th></tr></thead>
                    <tbody className="num">
                      {visible.map((h) => (
                        <tr key={`${h.chain ?? "ton"}:${h.address}`} className="border-b border-line/60 last:border-0 hover:bg-surface-2/60">
                          <td className="px-4 py-2.5">
                            <Link href={href(h)} target={tab === "ton" ? undefined : "_blank"} className="flex items-center gap-2 hover:text-brand">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              {h.image ? <img src={h.image} alt="" className="size-6 rounded-full" /> : <span className="size-6 rounded-full bg-surface-2" />}
                              <span className="font-medium">{h.symbol}</span>{tab !== "ton" && h.verified && <Verified />}<span className="hidden max-w-[180px] truncate text-xs text-muted sm:inline">{h.name}</span>
                            </Link>
                          </td>
                          {tab === "evm" && <td className="text-xs text-ink-2">{h.chain === "base" ? "Base" : "Ethereum"}</td>}
                          <td className="text-right">{num(h.amount, 2)}</td>
                          <td className="text-right">{h.priceUsd != null ? price(h.priceUsd) : "—"}</td>
                          <td className="text-right"><Change value={h.change24h} /></td>
                          <td className="px-4 text-right font-medium">{h.valueUsd != null ? usd(h.valueUsd) : "—"}</td>
                        </tr>
                      ))}
                      {!loading && !visible.length && <tr><td colSpan={6} className="py-8 text-center text-muted">{!connected ? `Connect a ${tab === "ton" ? "TON" : tab === "solana" ? "Solana" : "EVM"} wallet to list its tokens.` : "No tokens in this wallet."}</td></tr>}
                    </tbody>
                  </table>
                </div>
                {spam.length > 0 && (
                  <label className="flex items-center gap-1.5 border-t border-line px-4 py-2 text-xs text-muted">
                    <input type="checkbox" checked={showSpam} onChange={(e) => setShowSpam(e.target.checked)} /> Show {spam.length} unpriced token{spam.length === 1 ? "" : "s"} (usually airdropped spam)
                  </label>
                )}
              </>
            );
          })()}
        </section>

        <PortfolioHistory ton={ton || undefined} sol={sol} evm={evm} />
      </div>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className="num mt-1 truncate text-xl font-semibold">{value}</div>
      {sub && <div className="num truncate text-xs text-ink-2">{sub}</div>}
    </div>
  );
}
