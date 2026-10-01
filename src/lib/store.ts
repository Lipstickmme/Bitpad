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
  /** "GRAM" is the native coin (prev. Toncoin) */
  payAsset: "GRAM" | "USDT" | "USDC";
  slippage: number;
  /** Quick-buy size in GRAM (the native coin), used by the ⚡ buttons on every token */
  quickBuy: number;
  setTgUser: (u?: TelegramUser) => void;
  addExternal: (w: ExternalWallet) => void;
  removeExternal: (chain: ExternalWallet["chain"]) => void;
  setPayAsset: (a: AppState["payAsset"]) => void;
  setSlippage: (s: number) => void;
  setQuickBuy: (n: number) => void;
}

export const useApp = create<AppState>()(
  persist(
    (set) => ({
      external: [],
      payAsset: "GRAM",
      slippage: 1,
      quickBuy: 1,
      setTgUser: (tgUser) => set({ tgUser }),
      addExternal: (w) => set((s) => ({ external: [...s.external.filter((x) => x.chain !== w.chain), w] })),
      removeExternal: (chain) => set((s) => ({ external: s.external.filter((x) => x.chain !== chain) })),
      setPayAsset: (payAsset) => set({ payAsset }),
      setSlippage: (slippage) => set({ slippage }),
      setQuickBuy: (quickBuy) => set({ quickBuy }),
    }),
    {
      name: "bitpad.app",
      // v2: Toncoin became Gram (GRAM = the native coin). Old "GRAM" amounts were sized for an unrelated
      // cheap jetton, so quick buy resets to 1 GRAM rather than carrying e.g. 1000 over.
      version: 2,
      migrate: (old) => {
        const o = (old ?? {}) as Partial<AppState> & { quickBuyAsset?: string; quickBuyGram?: number };
        return { ...o, payAsset: o.payAsset === "USDT" || o.payAsset === "USDC" ? o.payAsset : "GRAM", quickBuy: o.quickBuyAsset === "TON" && o.quickBuy ? o.quickBuy : 1 } as AppState;
      },
    },
  ),
);
