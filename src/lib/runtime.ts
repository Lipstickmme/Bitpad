import "server-only";
import { config } from "./config";
import { getFactoryConfig } from "./launches";

/**
 * Runtime settings that come from the chain rather than env vars. The fee
 * wallet is the factory's own `feeWallet`, so the app always pays fees to the
 * same address the contracts do.
 */
export async function ensureRuntimeConfig() {
  if (config.feeWallet) return config;
  const f = await getFactoryConfig();
  if (f?.feeWallet) config.feeWallet = f.feeWallet;
  return config;
}
