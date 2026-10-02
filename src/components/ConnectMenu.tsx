"use client";
import { useTonAddress, useTonConnectUI } from "@tonconnect/ui-react";
import { Wallet, ChevronDown, LogOut, Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/store";
import { shortAddr } from "@/lib/format";
import { EthIcon, SolanaIcon, TelegramIcon, TonIcon } from "./Brand";
import { toast } from "./Toast";
import { humanError } from "@/lib/errors";
import type { TelegramUser } from "@/lib/auth-types";
import { TgAvatar } from "./TgAvatar";

/**
 * Telegram login through the bot (no Login Widget, so it doesn't depend on
 * @BotFather /setdomain): the bot sends a one-tap login link, and this tab
 * notices the new session.
 */
function TelegramBotLogin({ bot, onUser }: { bot: string; onUser: (u: TelegramUser) => void }) {
  const [waiting, setWaiting] = useState(false);
  if (!bot) return <p className="text-xs text-muted">Telegram login isn&apos;t set up on this site yet.</p>;
  async function start() {
    const w = window.open("", "_blank"); // open now so the popup isn't blocked
    try {
      const r = await fetch("/api/auth/telegram/bot", { method: "PUT" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      if (w) w.location.href = d.url; else window.location.href = d.url;
      setWaiting(true);
      for (let i = 0; i < 120; i++) {
        await new Promise((res) => setTimeout(res, 2500));
        const s = await fetch("/api/auth/telegram").then((x) => x.json()).catch(() => null);
        if (s?.session?.tg) return onUser(s.session.tg);
      }
      toast.info("Telegram login timed out", "Press Log in with Telegram to try again.");
    } catch (e) {
      w?.close();
      toast.error("Couldn't start Telegram login", humanError(e));
    } finally {
      setWaiting(false);
    }
  }
  return (
    <div>
      <button onClick={start} disabled={waiting} className="btn btn-primary h-9 w-full text-sm"><TelegramIcon className="size-4" /> {waiting ? "Waiting for Telegram…" : "Log in with Telegram"}</button>
      <p className="mt-1.5 text-[11px] text-muted">{waiting ? `Press Start in @${bot}, then tap “Log in to Bitpad”.` : `Opens @${bot}. One tap there signs you in here.`}</p>
    </div>
  );
}

export function ConnectMenu({ telegramBot }: { telegramBot: string }) {
  const [tc] = useTonConnectUI();
  const ton = useTonAddress();
  const { tgUser, setTgUser, external, addExternal, removeExternal } = useApp();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const close = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const sol = external.find((w) => w.chain === "solana");
  const evm = external.find((w) => w.chain === "evm");

  async function connectSolana() {
    const p = window.phantom?.solana ?? window.solana;
    if (!p) return toast.error("No Solana wallet found", "Install Phantom, Solflare or Backpack.");
    try {
      const r = await p.connect();
      addExternal({ chain: "solana", address: r.publicKey.toString(), provider: p.isPhantom ? "Phantom" : "Solana" });
    } catch (e) {
      toast.error("Solana connection rejected", (e as Error).message);
    }
  }
  async function connectEvm() {
    if (!window.ethereum) return toast.error("No EVM wallet found", "Install MetaMask, Rabby or Coinbase Wallet.");
    try {
      const [addr] = (await window.ethereum.request({ method: "eth_requestAccounts" })) as string[];
      addExternal({ chain: "evm", address: addr, provider: window.ethereum.isMetaMask ? "MetaMask" : "EVM" });
    } catch (e) {
      toast.error("EVM connection rejected", (e as Error).message);
    }
  }
  function onTelegram(u: TelegramUser) {
    setTgUser(u);
    toast.success(`Signed in as ${u.username ? "@" + u.username : u.first_name}`);
  }
  async function logoutTg() {
    await fetch("/api/auth/telegram", { method: "DELETE" });
    setTgUser(undefined);
  }

  const label = !mounted ? "Connect" : ton ? shortAddr(ton, 4, 4) : tgUser ? (tgUser.username ? `@${tgUser.username}` : tgUser.first_name) : sol ? shortAddr(sol.address) : evm ? shortAddr(evm.address, 6, 4) : "Connect";
  const connected = mounted && (ton || tgUser || sol || evm);

  const Row = ({ title, sub, ok, onConnect, onOff, icon }: { title: string; sub?: string; ok: boolean; onConnect: () => void; onOff: () => void; icon: React.ReactNode }) => (
    <div className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-surface-2">
      <div className="grid size-9 place-items-center rounded-lg border border-white/10 bg-white/[0.04] shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-sm font-semibold">{title}{ok && <Check className="size-3.5 text-up" />}</div>
        <div className="truncate text-xs text-muted">{sub}</div>
      </div>
      {ok ? (
        <button onClick={onOff} className="text-xs font-semibold text-muted hover:text-down">Disconnect</button>
      ) : (
        <button onClick={onConnect} className="rounded-lg bg-brand-soft px-2.5 py-1 text-xs font-bold text-brand-ink hover:bg-brand hover:text-[var(--color-action-ink)]">Connect</button>
      )}
    </div>
  );

  return (
    <div className="relative" ref={box}>
      <button onClick={() => setOpen((o) => !o)} className="btn btn-ghost num">
        {mounted && tgUser && !ton ? <TgAvatar me name={tgUser.first_name} size={18} /> : <Wallet className="size-4" />}
        <span className="max-w-[6.5rem] truncate sm:max-w-[9rem]">{label}</span>
        <ChevronDown className="size-3.5 opacity-60" />
      </button>
      {open && (
        <div className="card glass absolute right-0 mt-2 w-[min(340px,calc(100vw-2rem))] p-2 shadow-2xl shadow-black/40">
          <div className="px-2 pb-1 pt-1 text-xs font-bold uppercase tracking-wider text-muted">Sign in & wallets</div>
          <Row title="TON wallet" sub={ton ? shortAddr(ton, 6, 6) : "Tonkeeper, MyTonWallet, Telegram Wallet"} ok={!!ton} onConnect={() => tc.openModal()} onOff={() => tc.disconnect()} icon={<TonIcon className="size-[18px] text-[#0098ea]" />} />
          <Row title="Solana" sub={sol ? shortAddr(sol.address, 6, 6) : "Phantom, Solflare, Backpack"} ok={!!sol} onConnect={connectSolana} onOff={() => removeExternal("solana")} icon={<SolanaIcon className="size-[18px] text-[#14f195]" />} />
          <Row title="EVM" sub={evm ? shortAddr(evm.address, 6, 4) : "MetaMask, Rabby, Coinbase"} ok={!!evm} onConnect={connectEvm} onOff={() => removeExternal("evm")} icon={<EthIcon className="size-[18px] text-[#8c9eff]" />} />
          <div className="mt-1 border-t border-line px-2 pb-1 pt-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><TelegramIcon className="size-4 text-ink-2" /> Telegram</div>
            {tgUser ? (
              <div className="flex items-center justify-between text-sm">
                <span className="inline-flex items-center gap-2 text-ink-2"><TgAvatar me name={tgUser.first_name} size={24} />{tgUser.username ? `@${tgUser.username}` : tgUser.first_name}</span>
                <button onClick={logoutTg} className="flex items-center gap-1 text-xs font-semibold text-muted hover:text-down"><LogOut className="size-3.5" /> Sign out</button>
              </div>
            ) : (
              <TelegramBotLogin bot={telegramBot} onUser={onTelegram} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
