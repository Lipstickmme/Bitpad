"use client";
import type { TonConnectUI } from "@tonconnect/ui-react";
import type { TcMessage } from "./client";
import { toast } from "@/components/Toast";

const WAIT_HINT_MS = 25_000;
const TTL_S = 300;

/**
 * Send a transaction to the connected TON wallet with feedback while it waits:
 * after a while with no answer it tells the user to open the wallet app, with
 * a button to reopen it, and a reconnect option for stale wallet sessions
 * (the usual reason a request never shows up). Errors come back in plain words.
 */
export async function sendTx(tc: TonConnectUI, messages: TcMessage[]) {
  let redirect: (() => void) | undefined;
  let done = false;
  const hint = setTimeout(() => {
    if (done) return;
    toast.info(
      "Waiting for your wallet",
      `Open ${tc.wallet && "name" in tc.wallet ? tc.wallet.name : "your wallet"} and approve the request. If nothing shows up there, the wallet link has expired: reconnect and try again.`,
      { ms: 20_000, action: redirect ? { label: "Open wallet", onClick: redirect } : { label: "Reconnect wallet", onClick: () => void reconnect(tc) } },
    );
  }, WAIT_HINT_MS);
  try {
    return await tc.sendTransaction(
      { validUntil: Math.floor(Date.now() / 1000) + TTL_S, messages },
      { onRequestSent: (r) => { redirect = r; } },
    );
  } catch (e) {
    throw new Error(explain(e));
  } finally {
    done = true;
    clearTimeout(hint);
  }
}

async function reconnect(tc: TonConnectUI) {
  await tc.disconnect().catch(() => {});
  await tc.openModal();
}

function explain(e: unknown): string {
  const msg = (e as Error)?.message ?? String(e);
  const name = (e as Error)?.name ?? "";
  if (/reject|declin|cancel/i.test(name + msg)) return "You declined it in your wallet. Nothing was sent.";
  if (/expired|timeout|valid.?until/i.test(msg)) return "The request expired before the wallet approved it. Try again, and reconnect your wallet if it doesn't appear.";
  if (/not connected|no wallet|wallet.*disconnect/i.test(msg)) return "Your wallet isn't connected. Connect it and try again.";
  if (/insufficient|not enough|balance/i.test(msg)) return "Not enough balance in the wallet for this amount plus network fees.";
  return msg || "The wallet didn't send the transaction.";
}
