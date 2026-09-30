"use client";
import { useState } from "react";
import { useTonAddress, useTonConnectUI } from "@tonconnect/ui-react";
import { Address, beginCell, toNano } from "@ton/core";
import { toast } from "./Toast";
import { sendTx } from "@/lib/ton/send";

/** STON.fi v2 Vault `withdraw_fee` (op 0x354bcdf4): sends the accrued referral fees to the vault owner. */
const WITHDRAW_FEE = 0x354bcdf4;

const same = (a: string, b: string) => {
  try {
    return Address.parse(a).equals(Address.parse(b));
  } catch {
    return false;
  }
};

export function WithdrawVault({ vault, owner, label }: { vault: string; owner: string; label: string }) {
  const wallet = useTonAddress();
  const [tc] = useTonConnectUI();
  const [busy, setBusy] = useState(false);
  const isOwner = !!wallet && same(wallet, owner);

  async function go() {
    if (!wallet) return tc.openModal();
    setBusy(true);
    try {
      const body = beginCell().storeUint(WITHDRAW_FEE, 32).storeUint(0, 64).endCell();
      await sendTx(tc, [{ address: vault, amount: toNano("0.3").toString(), payload: body.toBoc().toString("base64") }]);
      toast.success(`Withdrawing ${label}`, "The vault sends the balance to the fee wallet; unused gas is refunded.");
    } catch (e) {
      toast.error("Withdraw not sent", (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button onClick={go} disabled={busy || (!!wallet && !isOwner)} title={wallet && !isOwner ? "Connect the fee wallet to withdraw" : undefined} className="btn btn-ghost h-8 px-3 text-xs">
      {busy ? "Confirm in wallet…" : !wallet ? "Connect to withdraw" : isOwner ? "Withdraw" : "Fee wallet only"}
    </button>
  );
}
