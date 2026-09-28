"use client";
import { useTonAddress, useTonConnectUI } from "@tonconnect/ui-react";
import { Wallet, ChevronDown, LogOut, Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/store";
import { shortAddr } from "@/lib/format";
import { TelegramIcon } from "./Brand";
import { toast } from "./Toast";

function TelegramLoginWidget({ bot, onAuth }: { bot: string; onAuth: (u: Record<string, string | number>) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!bot || !ref.current) return;
    window.onTelegramAuth = onAuth;
    const s = document.createElement("script");
    s.src = "https://telegram.org/js/telegram-widget.js?22";
    s.async = true;
    s.setAttribute("data-telegram-login", bot);
    s.setAttribute("data-size", "medium");
    s.setAttribute("data-radius", "10");
    s.setAttribute("data-onauth", "onTelegramAuth(user)");
    s.setAttribute("data-request-access", "write");
    ref.current.innerHTML = "";
    ref.current.appendChild(s);
  }, [bot, onAuth]);
  if (!bot) return <p className="text-xs text-muted">Telegram login isn&apos;t configured on this deployment.</p>;
  return <div ref={ref} />;
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
  async function onTelegram(u: Record<string, string | number>) {
    const r = await fetch("/api/auth/telegram", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(u) });
    const d = await r.json();
    if (r.ok) {
      setTgUser(d.user);
      toast.success(`Signed in as ${d.user.username ? "@" + d.user.username : d.user.first_name}`);
    } else toast.error("Telegram login failed", d.error);
  }
  async function logoutTg() {
    await fetch("/api/auth/telegram", { method: "DELETE" });
    setTgUser(undefined);
  }

  const label = !mounted ? "Connect" : ton ? shortAddr(ton, 4, 4) : tgUser ? (tgUser.username ? `@${tgUser.username}` : tgUser.first_name) : sol ? shortAddr(sol.address) : evm ? shortAddr(evm.address, 6, 4) : "Connect";
  const connected = mounted && (ton || tgUser || sol || evm);

  const Row = ({ title, sub, ok, onConnect, onOff, icon }: { title: string; sub?: string; ok: boolean; onConnect: () => void; onOff: () => void; icon: React.ReactNode }) => (
    <div className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-surface-2">
      <div className="grid size-9 place-items-center rounded-lg border border-line bg-surface">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-sm font-semibold">{title}{ok && <Check className="size-3.5 text-up" />}</div>
        <div className="truncate text-xs text-muted">{sub}</div>
      </div>
      {ok ? (
        <button onClick={onOff} className="text-xs font-semibold text-muted hover:text-down">Disconnect</button>
      ) : (
        <button onClick={onConnect} className="rounded-lg bg-brand-soft px-2.5 py-1 text-xs font-bold text-brand-ink hover:bg-brand hover:text-white">Connect</button>
      )}
    </div>
  );

  return (
    <div className="relative" ref={box}>
      <button onClick={() => setOpen((o) => !o)} className="btn btn-ghost num">
        <Wallet className="size-4" />
        <span className="max-w-[9rem] truncate">{label}</span>
        <ChevronDown className="size-3.5 opacity-60" />
      </button>
      {open && (
        <div className="card absolute right-0 mt-2 w-[min(340px,calc(100vw-2rem))] p-2 shadow-xl">
          <div className="px-2 pb-1 pt-1 text-xs font-bold uppercase tracking-wider text-muted">Sign in & wallets</div>
          <Row title="TON wallet" sub={ton ? shortAddr(ton, 6, 6) : "Tonkeeper, MyTonWallet, Telegram Wallet"} ok={!!ton} onConnect={() => tc.openModal()} onOff={() => tc.disconnect()} icon={<span className="text-sm font-black text-[#0098ea]">◆</span>} />
          <Row title="Solana" sub={sol ? shortAddr(sol.address, 6, 6) : "Phantom, Solflare, Backpack"} ok={!!sol} onConnect={connectSolana} onOff={() => removeExternal("solana")} icon={<span className="text-sm font-black text-[#9945ff]">◎</span>} />
          <Row title="EVM" sub={evm ? shortAddr(evm.address, 6, 4) : "MetaMask, Rabby, Coinbase"} ok={!!evm} onConnect={connectEvm} onOff={() => removeExternal("evm")} icon={<span className="text-sm font-black text-[#627eea]">Ξ</span>} />
          <div className="mt-1 border-t border-line px-2 pb-1 pt-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><TelegramIcon className="size-4 text-[#229ed9]" /> Telegram</div>
            {tgUser ? (
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-2">{tgUser.username ? `@${tgUser.username}` : tgUser.first_name}</span>
                <button onClick={logoutTg} className="flex items-center gap-1 text-xs font-semibold text-muted hover:text-down"><LogOut className="size-3.5" /> Sign out</button>
              </div>
            ) : (
              <TelegramLoginWidget bot={telegramBot} onAuth={onTelegram} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
