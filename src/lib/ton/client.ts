import { Client } from "@ston-fi/sdk";
import { config } from "../config";

let client: Client | undefined;

/** Shared TON RPC client (toncenter v2). STON.fi's Client adds cached get-method calls. */
export function tonClient(): Client {
  client ??= new Client({
    endpoint: config.network === "testnet" ? "https://testnet.toncenter.com/api/v2/jsonRPC" : "https://toncenter.com/api/v2/jsonRPC",
    apiKey: config.toncenterKey || undefined,
  });
  return client;
}

/** TON Connect message shape */
export interface TcMessage {
  address: string;
  amount: string;
  payload?: string;
  stateInit?: string;
}
