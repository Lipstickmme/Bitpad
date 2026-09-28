import { Client } from "@ston-fi/sdk";
import { config } from "../config";

let client: Client | undefined;

/**
 * Shared TON RPC client (toncenter v2). In the browser it goes through the
 * same-origin /api/ton-rpc proxy, which adds TONCENTER_API_KEY server-side —
 * the key is never exposed to clients. On the server it calls toncenter directly.
 */
export function tonClient(): Client {
  if (client) return client;
  const direct = config.network === "testnet" ? "https://testnet.toncenter.com/api/v2/jsonRPC" : "https://toncenter.com/api/v2/jsonRPC";
  client =
    typeof window === "undefined"
      ? new Client({ endpoint: direct, apiKey: process.env.TONCENTER_API_KEY || undefined })
      : new Client({ endpoint: `${window.location.origin}/api/ton-rpc` });
  return client;
}

/** TON Connect message shape */
export interface TcMessage {
  address: string;
  amount: string;
  payload?: string;
  stateInit?: string;
}
