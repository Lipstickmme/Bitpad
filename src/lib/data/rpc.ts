/** Free public RPCs for native balances on non-TON chains. */
const SOLANA_RPC = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const EVM_RPC: Record<string, string> = {
  ethereum: process.env.ETH_RPC_URL || "https://ethereum-rpc.publicnode.com",
  base: process.env.BASE_RPC_URL || "https://base-rpc.publicnode.com",
  bsc: process.env.BSC_RPC_URL || "https://bsc-rpc.publicnode.com",
};

async function rpc<T>(url: string, method: string, params: unknown[]): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), cache: "no-store" });
  const j = await res.json();
  if (j.error) throw new Error(j.error.message ?? "rpc error");
  return j.result as T;
}

export async function solBalance(address: string) {
  const r = await rpc<{ value: number }>(SOLANA_RPC, "getBalance", [address]);
  return r.value / 1e9;
}

export async function evmBalances(address: string) {
  const out: Record<string, number> = {};
  await Promise.all(
    Object.entries(EVM_RPC).map(async ([chain, url]) => {
      try {
        out[chain] = Number(BigInt(await rpc<string>(url, "eth_getBalance", [address, "latest"]))) / 1e18;
      } catch {
        /* chain unavailable */
      }
    }),
  );
  return out;
}
