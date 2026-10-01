import "server-only";
import { Address, Cell } from "@ton/core";
import { AutoReconnectTransport, Omniston, type ConnectionStatusEvent, type Quote, type Transport } from "@ston-fi/omniston-sdk";
import { config, TON_ASSETS } from "../config";
import type { TcMessage } from "./client";

/**
 * STON.fi Omniston: the aggregator that also reaches market-maker (RFQ)
 * liquidity. xStocks on TON trade there rather than in AMM pools, so Bitpad
 * uses it when no pool route exists. Server-side only: one short-lived
 * WebSocket per request (quote, then build), closed right after.
 *
 * Bitpad's fee rides along as Omniston's integrator fee (paid to the fee
 * wallet in the token bought). SDK pinned to an exact version in package.json.
 */
const API = "wss://omni-ws.ston.fi";
const QUOTE_TIMEOUT_MS = 6000; // market makers get this long to answer

const tonAsset = (addr: string) =>
  addr === TON_ASSETS.TON
    ? { chain: { $case: "ton" as const, value: { kind: { $case: "native" as const, value: {} } } } }
    : { chain: { $case: "ton" as const, value: { kind: { $case: "jetton" as const, value: addr } } } };
const tonAddr = (a: string) => ({ chain: { $case: "ton" as const, value: a } });

export interface OmniQuote {
  quote: Quote;
  outputUnits: bigint;
  inputUnits: bigint;
  resolver: string;
  /** Quoted only without Bitpad's integrator fee (some market makers refuse fee-carrying requests) */
  feeWaived?: boolean;
}

/** Why Omniston returned nothing (shown in errors and the route check). */
export class NoQuote extends Error {
  constructor(public readonly acked: boolean, public readonly noQuoteEvents: number) {
    super(acked ? "no market maker quoted this amount" : "the request wasn't acknowledged");
  }
}

/**
 * Best Omniston quote to spend `inputUnits` of `offer` for `ask`. Waits the
 * whole quote window (market makers answer at different speeds and "no
 * quote" events are normal while they do), keeping the latest quote.
 */
async function rfq(omni: Omniston, offer: string, ask: string, inputUnits: bigint, slippagePct: number, withFee: boolean): Promise<OmniQuote> {
  const fee = withFee && config.feeWallet && config.swapFeeBps > 0 ? { integratorAddress: tonAddr(config.feeWallet), integratorFeePips: config.swapFeeBps * 100 } : {};
  return new Promise((resolve, reject) => {
    let best: Quote | null = null;
    let done = false;
    let acked = false;
    let noQuotes = 0;
    let settle: ReturnType<typeof setTimeout> | undefined;
    const finish = (err?: Error) => {
      if (done) return;
      done = true;
      clearTimeout(window);
      clearTimeout(settle);
      sub.unsubscribe();
      status.unsubscribe();
      if (best) resolve({ quote: best, outputUnits: BigInt(best.outputUnits), inputUnits: BigInt(best.inputUnits), resolver: best.resolverName, feeWaived: !withFee });
      else reject(err ?? new NoQuote(acked, noQuotes));
    };
    const sub = omni.requestForQuote({
      inputAsset: tonAsset(offer),
      outputAsset: tonAsset(ask),
      amount: { $case: "inputUnits", value: inputUnits.toString() },
      ...fee,
      settlementParams: [{ params: { $case: "swap", value: { maxPriceSlippagePips: Math.round(slippagePct * 10_000), maxRoutes: 4, flexibleIntegratorFee: true } } }],
    }).subscribe({
      next: (e) => {
        if (e.$case === "ack") acked = true;
        else if (e.$case === "quoteUpdated") {
          // each update supersedes the previous one (better terms, or the old one expired)
          best = e.value;
          // give other market makers a moment to beat it, then go
          settle ??= setTimeout(() => finish(), 1200);
        } else if (e.$case === "noQuote") noQuotes++;
      },
      error: (err) => finish(new Error(err?.message || "Omniston error")),
      complete: () => finish(),
    });
    // Fail fast when the connection can't be made (after the transport's retries)
    const status = omni.connectionStatusEvents.subscribe((e) => { if (e.status === "error" || e.status === "closed") finish(new Error("Couldn't reach STON.fi's aggregator")); });
    const window = setTimeout(() => finish(), QUOTE_TIMEOUT_MS);
  });
}

/** With Bitpad's fee first; if nobody quotes, once more without it so the buy still has a route. */
async function rfqWithFallback(omni: Omniston, offer: string, ask: string, inputUnits: bigint, slippagePct: number): Promise<OmniQuote> {
  try {
    return await rfq(omni, offer, ask, inputUnits, slippagePct, true);
  } catch (e) {
    if (!(e instanceof NoQuote) || !config.feeWallet) throw e;
    return rfq(omni, offer, ask, inputUnits, slippagePct, false);
  }
}

const hexToB64 = (hex: string) => (hex ? Cell.fromBoc(Buffer.from(hex, "hex"))[0].toBoc().toString("base64") : undefined);

type Listener<T> = { next?: (v: T) => void; error?: (e: never) => void; complete?: () => void } | ((v: T) => void);
/** Minimal multicast stream matching the SDK's Observable interface. */
class Stream<T> {
  private subs = new Set<Listener<T>>();
  subscribe(cb?: Listener<T>) {
    if (cb) this.subs.add(cb);
    return { unsubscribe: () => { if (cb) this.subs.delete(cb); } };
  }
  next(v: T) {
    for (const s of this.subs) (typeof s === "function" ? s : s.next)?.(v);
  }
}

/**
 * WebSocket transport with an error listener. The SDK's own transport has
 * none, so in Node a refused connection becomes an unhandled 'error' event
 * and crashes the server process. Uses Node's built-in WebSocket.
 */
class SafeTransport implements Transport {
  private ws?: WebSocket;
  private closing = false;
  readonly messages = new Stream<string>();
  readonly connectionStatusEvents = new Stream<ConnectionStatusEvent>();
  constructor(private readonly url: string) {}
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws?.close();
      this.closing = false;
      const ws = new WebSocket(this.url);
      this.ws = ws;
      this.connectionStatusEvents.next({ status: "connecting" });
      // Don't hang on a connection that never opens
      const timer = setTimeout(() => { if (ws.readyState === 0) { this.closing = false; ws.close(); reject(new Error("Omniston connection timed out")); if (this.ws === ws) this.connectionStatusEvents.next({ status: "error", errorMessage: "timeout" }); } }, 4000);
      ws.addEventListener("open", () => { clearTimeout(timer); resolve(); this.connectionStatusEvents.next({ status: "connected" }); });
      ws.addEventListener("message", (e) => this.messages.next(String(e.data)));
      ws.addEventListener("error", () => { /* surfaced through 'close' below */ });
      ws.addEventListener("close", (e) => {
        clearTimeout(timer);
        const byUs = this.closing;
        this.closing = false;
        reject(new Error(byUs ? "Closed by client" : e.reason || "Connection to Omniston failed"));
        if (this.ws === ws) this.connectionStatusEvents.next(byUs ? { status: "closed" } : { status: "error", errorMessage: e.reason || "connection failed" });
      });
    });
  }
  reconnect() {
    return this.connect();
  }
  send(message: string) {
    if (this.ws?.readyState !== 1) return Promise.reject(new Error("WebSocket is not ready"));
    this.ws.send(message);
    return Promise.resolve();
  }
  close() {
    this.closing = true;
    this.ws?.close();
  }
}

function open() {
  if (typeof WebSocket === "undefined") throw new Error("This server has no WebSocket support (Node 22+ needed)");
  // A couple of quick retries, then give up (the request falls back to the STON.fi link)
  const transport = new AutoReconnectTransport({ transport: new SafeTransport(API), maxRetries: 1, reconnectDelayMs: 300 });
  return new Omniston({ apiUrl: API, transport });
}

/** Quote only (for showing the route). Throws NoQuote when no market maker answers. */
export async function omniQuote(offer: string, ask: string, inputUnits: bigint, slippagePct = 1): Promise<OmniQuote> {
  const omni = open();
  try {
    return await rfqWithFallback(omni, offer, ask, inputUnits, slippagePct);
  } finally {
    omni.transport.close();
  }
}

/** Quote and build the swap transaction for `wallet` in one connection. */
export async function omniBuild(offer: string, ask: string, inputUnits: bigint, wallet: string, slippagePct = 1): Promise<{ q: OmniQuote; messages: TcMessage[] }> {
  const omni = open();
  try {
    const q = await rfqWithFallback(omni, offer, ask, inputUnits, slippagePct);
    if (q.quote.settlementData?.$case !== "swap") throw new Error("Omniston returned a non-swap quote");
    const owner = Address.parse(wallet).toString({ bounceable: false });
    const tx = await omni.tonBuildSwap({ quoteId: q.quote.quoteId, transferSrcAddress: tonAddr(owner), useRecommendedSlippage: false });
    if (!tx.messages.length) throw new Error("Omniston built an empty transaction");
    const messages = tx.messages.map((m): TcMessage => ({
      address: m.targetAddress,
      amount: m.sendAmount,
      payload: hexToB64(m.payload),
      ...(m.jettonWalletStateInit ? { stateInit: hexToB64(m.jettonWalletStateInit) } : {}),
    }));
    return { q, messages };
  } finally {
    omni.transport.close();
  }
}
