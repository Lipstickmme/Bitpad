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
  /** Quick-buy size in TON, used by the ⚡ buttons on every token */
  quickBuy: number;
  /** Quick-buy size in GRAM */
  quickBuyGram: number;
  /** What ⚡ buys spend by default */
  quickBuyAsset: "GRAM" | "TON";
  setTgUser: (u?: TelegramUser) => void;
  addExternal: (w: ExternalWallet) => void;
  removeExternal: (chain: ExternalWallet["chain"]) => void;
  setPayAsset: (a: AppState["payAsset"]) => void;
  setSlippage: (s: number) => void;
  setQuickBuy: (n: number) => void;
  setQuickBuyGram: (n: number) => void;
  setQuickBuyAsset: (a: "GRAM" | "TON") => void;
}

export const useApp = create<AppState>()(
  persist(
    (set) => ({
      external: [],
      payAsset: "GRAM",
      slippage: 1,
      quickBuy: 1,
      quickBuyGram: 1000,
      quickBuyAsset: "GRAM",
      setTgUser: (tgUser) => set({ tgUser }),
      addExternal: (w) => set((s) => ({ external: [...s.external.filter((x) => x.chain !== w.chain), w] })),
      removeExternal: (chain) => set((s) => ({ external: s.external.filter((x) => x.chain !== chain) })),
      setPayAsset: (payAsset) => set({ payAsset }),
      setSlippage: (slippage) => set({ slippage }),
      setQuickBuy: (quickBuy) => set({ quickBuy }),
      setQuickBuyGram: (quickBuyGram) => set({ quickBuyGram }),
      setQuickBuyAsset: (quickBuyAsset) => set({ quickBuyAsset }),
    }),
    { name: "bitpad.app" },
  ),
);
