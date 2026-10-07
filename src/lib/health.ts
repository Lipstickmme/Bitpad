import "server-only";

/**
 * Live check of every environment variable the site uses: each key is tried
 * against its real service. Only pass/fail and public facts (bot username,
 * channel title, integrator name) are reported, never a secret value.
 */
export type CheckState = "ok" | "missing" | "error" | "warn";
export interface Check { name: string; state: CheckState; detail: string; required: boolean }

const T = 8000;
async function get(url: string, headers: Record<string, string> = {}) {
  return fetch(url, { headers: { accept: "application/json", ...headers }, cache: "no-store", signal: AbortSignal.timeout(T) });
}
const env = (k: string) => (process.env[k] ?? "").trim();
const fail = (e: unknown) => ((e as Error)?.name === "TimeoutError" ? "Service didn't answer in time" : (e as Error)?.message || "Request failed");

export async function runHealth(origin: string): Promise<{ checks: Check[]; deployment: Record<string, string> }> {
  const checks = await Promise.all([toncenter(), tonapi(), ...(await telegram(origin)), lifiIntegrator(), lifiKey(), solanaRpc()]);
  return {
    checks: checks.flat(),
    deployment: {
      environment: env("VERCEL_ENV") || "not on Vercel",
      productionUrl: env("VERCEL_PROJECT_PRODUCTION_URL") || "—",
      commit: env("VERCEL_GIT_COMMIT_SHA").slice(0, 7) || "—",
      branch: env("VERCEL_GIT_COMMIT_REF") || "—",
      region: env("VERCEL_REGION") || "—",
    },
  };
}

async function toncenter(): Promise<Check> {
  const name = "TONCENTER_API_KEY", key = env(name);
  if (!key) return { name, state: "missing", required: true, detail: "Not set. TON reads fall back to keyless calls, which get rate-limited." };
  try {
    const r = await get("https://toncenter.com/api/v2/getMasterchainInfo", { "X-API-Key": key });
    if (r.status === 401) return { name, state: "error", required: true, detail: "Toncenter rejected this key. Copy it again from @tonapibot." };
    if (r.status === 403) return { name, state: "error", required: true, detail: "Toncenter refused the request (403): the key may be invalid or blocked. Check it in @tonapibot." };
    const j = (await r.json()) as { ok?: boolean; result?: { last?: { seqno?: number } } };
    return j.ok ? { name, state: "ok", required: true, detail: `Key accepted · mainnet block ${j.result?.last?.seqno ?? "?"}` } : { name, state: "error", required: true, detail: `Toncenter answered ${r.status}` };
  } catch (e) { return { name, state: "error", required: true, detail: fail(e) }; }
}

async function tonapi(): Promise<Check> {
  const name = "TONAPI_KEY", key = env(name);
  if (!key) return { name, state: "missing", required: false, detail: "Not set. TonAPI works without it but at ~1 request/second." };
  try {
    const r = await get("https://tonapi.io/v2/status", { authorization: `Bearer ${key}` });
    if (r.status === 401) return { name, state: "error", required: false, detail: "TonAPI rejected this key. Copy it again from tonconsole.com." };
    if (r.status === 403) return { name, state: "error", required: false, detail: "TonAPI refused the request (403): check the key's plan and limits in tonconsole.com." };
    return r.ok ? { name, state: "ok", required: false, detail: "Key accepted" } : { name, state: "error", required: false, detail: `TonAPI answered ${r.status}` };
  } catch (e) { return { name, state: "error", required: false, detail: fail(e) }; }
}

async function telegram(origin: string): Promise<Check[]> {
  const token = env("TELEGRAM_BOT_TOKEN");
  const out: Check[] = [];
  const tg = async <R,>(method: string, params: Record<string, string> = {}) => {
    const r = await get(`https://api.telegram.org/bot${token}/${method}?${new URLSearchParams(params)}`);
    const j = (await r.json()) as { ok: boolean; result?: R; description?: string };
    if (!j.ok) throw new Error(j.description ?? `Telegram answered ${r.status}`);
    return j.result as R;
  };
  if (!token) {
    out.push({ name: "TELEGRAM_BOT_TOKEN", state: "missing", required: false, detail: "Not set. Telegram login, the Mini App and the bot are off." });
    for (const n of ["TELEGRAM_APP_NAME", "TELEGRAM_CHAT_CHANNEL"]) out.push({ name: n, state: env(n) ? "warn" : "missing", required: false, detail: "Needs TELEGRAM_BOT_TOKEN first." });
    return out;
  }
  let bot: { id: number; username: string } | null = null;
  try {
    bot = await tg<{ id: number; username: string }>("getMe");
    out.push({ name: "TELEGRAM_BOT_TOKEN", state: "ok", required: false, detail: `Token works · bot @${bot.username}` });
  } catch (e) {
    out.push({ name: "TELEGRAM_BOT_TOKEN", state: "error", required: false, detail: `${fail(e)}. Copy the token again from @BotFather.` });
  }
  // Webhook + menu button are set by visiting /api/telegram/setup once
  if (bot) {
    try {
      const w = await tg<{ url: string; last_error_message?: string }>("getWebhookInfo");
      const want = `${origin}/api/telegram/webhook`;
      out.push(w.url === want
        ? { name: "Bot webhook", state: w.last_error_message ? "warn" : "ok", required: false, detail: w.last_error_message ? `Connected, last error: ${w.last_error_message}` : "Connected to this site" }
        : { name: "Bot webhook", state: "warn", required: false, detail: w.url ? `Points to ${new URL(w.url).host}, not this site. Open /api/telegram/setup here to fix.` : "Not connected. Open /api/telegram/setup on this site once." });
    } catch (e) { out.push({ name: "Bot webhook", state: "error", required: false, detail: fail(e) }); }
  }
  const app = env("TELEGRAM_APP_NAME");
  out.push(!app
    ? { name: "TELEGRAM_APP_NAME", state: "missing", required: false, detail: "Not set. Wallets return to the bot chat instead of the Mini App after approving." }
    : /^[A-Za-z0-9_]{3,30}$/.test(app)
      ? { name: "TELEGRAM_APP_NAME", state: "ok", required: false, detail: bot ? `Set · Mini App link t.me/${bot.username}/${app} (open it to confirm)` : "Set" }
      : { name: "TELEGRAM_APP_NAME", state: "error", required: false, detail: "Use the short name only (letters, digits, _), not a link." });
  const ch = env("TELEGRAM_CHAT_CHANNEL").replace(/^@/, "").replace(/^https?:\/\/t\.me\//, "");
  if (!ch) out.push({ name: "TELEGRAM_CHAT_CHANNEL", state: "missing", required: false, detail: "Not set. Free off-chain Trench Chat is off." });
  else if (bot) {
    try {
      const chat = await tg<{ title?: string; type: string }>("getChat", { chat_id: `@${ch}` });
      const me = await tg<{ status: string; can_post_messages?: boolean }>("getChatMember", { chat_id: `@${ch}`, user_id: String(bot.id) });
      const canPost = me.status === "creator" || (me.status === "administrator" && me.can_post_messages !== false);
      out.push(canPost
        ? { name: "TELEGRAM_CHAT_CHANNEL", state: "ok", required: false, detail: `@${ch} (${chat.title ?? chat.type}) · bot can post` }
        : { name: "TELEGRAM_CHAT_CHANNEL", state: "error", required: false, detail: `@${ch} found, but the bot isn't an admin that can post there. Add it as admin with “Post messages”.` });
    } catch (e) {
      out.push({ name: "TELEGRAM_CHAT_CHANNEL", state: "error", required: false, detail: `${fail(e)}. Use the public channel username without @, and add the bot to it.` });
    }
  } else out.push({ name: "TELEGRAM_CHAT_CHANNEL", state: "warn", required: false, detail: "Set, but can't be checked until the bot token works." });
  return out;
}

async function lifiIntegrator(): Promise<Check> {
  const name = "LIFI_INTEGRATOR", v = env(name);
  if (!v) return { name, state: "missing", required: false, detail: "Not set. Solana/EVM buys work, but without your platform fee." };
  return /^[A-Za-z0-9._-]{2,40}$/.test(v)
    ? { name, state: "ok", required: false, detail: `Set · integrator “${v}”. Your fee shows up in the LI.FI partner portal after the first buy.` }
    : { name, state: "error", required: false, detail: "Use the integrator string from the LI.FI portal (letters, digits, - _ .)." };
}

async function lifiKey(): Promise<Check> {
  const name = "LIFI_API_KEY", key = env(name);
  if (!key) return { name, state: "missing", required: false, detail: "Not set. LI.FI works with lower rate limits." };
  try {
    const r = await get("https://li.quest/v1/chains?chainTypes=SVM", { "x-lifi-api-key": key });
    if (r.status === 401) return { name, state: "error", required: false, detail: "LI.FI rejected this key. Copy it again from the partner portal." };
    if (r.status === 403) return { name, state: "error", required: false, detail: "LI.FI refused the request (403): check the key in the partner portal." };
    return r.ok ? { name, state: "ok", required: false, detail: "Key accepted" } : { name, state: "error", required: false, detail: `LI.FI answered ${r.status}` };
  } catch (e) { return { name, state: "error", required: false, detail: fail(e) }; }
}

async function solanaRpc(): Promise<Check> {
  const name = "SOLANA_RPC_URL", url = env(name);
  if (!url) return { name, state: "missing", required: false, detail: "Optional. Using the public Solana RPC, which is often rate-limited (Solana tokens and history may load slowly)." };
  try {
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getHealth" }), cache: "no-store", signal: AbortSignal.timeout(T) });
    const j = (await r.json()) as { result?: string; error?: { message: string } };
    return j.result === "ok" ? { name, state: "ok", required: false, detail: "RPC healthy" } : { name, state: "error", required: false, detail: j.error?.message ?? `RPC answered ${r.status}` };
  } catch (e) { return { name, state: "error", required: false, detail: fail(e) }; }
}
