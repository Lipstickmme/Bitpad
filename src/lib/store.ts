"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TelegramUser } from "./auth-types";

export interface ExternalWallet {
  chain: "solana" | "evm";
  address: string;
  provider: string;
}

interface AppState {
  tgUser?: TelegramUser;
  external: ExternalWallet[];
  payAsset: "TON" | "USDT" | "GRAM" | "USDC";
  slippage: number;
  setTgUser: (u?: TelegramUser) => void;
  addExternal: (w: ExternalWallet) => void;
  removeExternal: (chain: ExternalWallet["chain"]) => void;
  setPayAsset: (a: AppState["payAsset"]) => void;
  setSlippage: (s: number) => void;
}

export const useApp = create<AppState>()(
  persist(
    (set) => ({
      external: [],
      payAsset: "TON",
      slippage: 1,
      setTgUser: (tgUser) => set({ tgUser }),
      addExternal: (w) => set((s) => ({ external: [...s.external.filter((x) => x.chain !== w.chain), w] })),
      removeExternal: (chain) => set((s) => ({ external: s.external.filter((x) => x.chain !== chain) })),
      setPayAsset: (payAsset) => set({ payAsset }),
      setSlippage: (slippage) => set({ slippage }),
    }),
    { name: "bitpad.app" },
  ),
);
