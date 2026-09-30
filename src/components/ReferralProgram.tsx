"use client";
import { useEffect, useState } from "react";
import { useTonAddress, useTonConnectUI } from "@tonconnect/ui-react";
import { Users } from "lucide-react";
import { ago, num, shortAddr } from "@/lib/format";
import { CopyButton } from "./CopyButton";
import { Hint } from "./ui";

interface Stats {
  address: string;
  buys: number;
  traders: number;
  fees: number;
  earned: number;
  paid: number;
  owed: number;
  history?: { time: number; kind: "earned" | "paid"; amount: number; route?: string; trader?: string; hash?: string }[];
}
interface Res { ok: boolean; shareBps: number; me: Stats | null; leaderboard: Stats[]; totals: { referrers: number; fees: number; earned: number; paid: number } }

/** Everyone's referral link, their on-chain earnings and payout history, plus the leaderboard. */
export function ReferralProgram() {
  const wallet = useTonAddress();
  const [tc] = useTonConnectUI();
  const [d, setD] = useState<Res | null>(null);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  useEffect(() => {
    fetch(`/api/referrals${wallet ? `?address=${wallet}` : ""}`).then((r) => r.json()).then(setD).catch(() => {});
  }, [wallet]);

  const share = d ? d.shareBps / 100 : 20;
  const link = wallet && origin ? `${origin}/?r=${wallet}` : "";
  const me = d?.me;

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <Users className="size-4 text-brand" /> Referral program
          <Hint>
            Share your link. Every buy routed through Bitpad by someone who arrived through it (quick buys and the trade panel, via STON.fi or DeDust) pays the platform fee as a separate on-chain transfer tagged with your wallet. You earn {share}% of those fees. Payouts are sent from the fee wallet with the comment &quot;bitpad:refpay&quot;. Both sides are public on-chain, and this page reads them straight from the fee wallet&apos;s history. Buying through your own link doesn&apos;t count. Buys inside Bitpad launch pools use each jetton&apos;s creator links instead.
          </Hint>
        </h2>
        {d && <span className="ml-auto text-xs text-muted">{d.totals.referrers} referrers · {num(d.totals.earned, 3)} TON earned in total</span>}
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          {!wallet ? (
            <div className="rounded-lg bg-surface-2 p-4 text-sm">
              <p className="text-ink-2">Connect your TON wallet to get your link. It&apos;s also where your payouts go.</p>
              <button onClick={() => tc.openModal()} className="btn btn-primary mt-3">Connect TON wallet</button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2">
                <span className="min-w-0 flex-1 truncate font-mono text-xs">{link}</span>
                <CopyButton value={link} label="Copy link" />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <Tile k="Referred buys" v={me ? String(me.buys) : "0"} sub={me ? `${me.traders} traders` : undefined} />
                <Tile k="Fees generated" v={`${num(me?.fees ?? 0, 4)} TON`} />
                <Tile k={`Your ${share}%`} v={`${num(me?.earned ?? 0, 4)} TON`} />
                <Tile k="Paid · owed" v={`${num(me?.paid ?? 0, 3)} · ${num(me?.owed ?? 0, 3)}`} sub="TON" />
              </div>
              <div className="overflow-hidden rounded-lg border border-line">
                <div className="border-b border-line px-3 py-2 text-xs font-semibold">History</div>
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-xs">
                    <tbody className="num">
                      {(me?.history ?? []).map((h, i) => (
                        <tr key={i} className="border-b border-line/60 last:border-0">
                          <td className="px-3 py-2 text-muted">{ago(h.time)}</td>
                          <td>{h.kind === "paid" ? <span className="text-up">Payout</span> : <span className="text-ink-2">Buy via {h.route}</span>}</td>
                          <td className="font-mono text-muted">{h.trader ? shortAddr(h.trader, 4, 4) : ""}</td>
                          <td className="px-3 text-right font-medium">{h.kind === "paid" ? "+" : ""}{num(h.amount, 5)} TON</td>
                          <td className="pr-3 text-right">{h.hash && <a className="text-muted hover:text-ink" href={`https://tonviewer.com/transaction/${h.hash}`} target="_blank" rel="noreferrer">↗</a>}</td>
                        </tr>
                      ))}
                      {!me?.history?.length && <tr><td className="px-3 py-6 text-center text-muted">{d && !d.ok ? "Couldn't read the fee wallet right now." : "Nothing yet. Share your link to start earning."}</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
        <div>
          <div className="mb-2 text-xs font-semibold text-muted">Top referrers</div>
          <ol className="space-y-1 text-xs">
            {(d?.leaderboard ?? []).map((r, i) => (
              <li key={r.address} className={`flex items-center gap-2 rounded-md px-2 py-1.5 ${me?.address === r.address ? "bg-surface-2" : ""}`}>
                <span className="w-4 text-muted">{i + 1}</span>
                <span className="font-mono">{shortAddr(r.address, 4, 4)}</span>
                <span className="num ml-auto">{num(r.earned, 3)} TON</span>
              </li>
            ))}
            {!d?.leaderboard?.length && <li className="text-muted">No referred buys yet.</li>}
          </ol>
        </div>
      </div>
    </section>
  );
}

function Tile({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-surface-2 p-2.5">
      <div className="text-muted">{k}</div>
      <div className="num font-semibold">{v}</div>
      {sub && <div className="text-[10px] text-muted">{sub}</div>}
    </div>
  );
}
