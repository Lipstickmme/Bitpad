/**
 * Turn technical errors (HTTP codes, SDK names, RPC details) into plain
 * sentences people can act on. Used by every error toast; messages that are
 * already readable pass through, minus jargon like "[POST]: 400 Bad Request".
 */
const RULES: [RegExp, string][] = [
  [/user ?reject|rejected by user|declined|user cancel|cancelled by user|canceled|denied transaction|UserRejectsError/i, "You cancelled it in your wallet. Nothing was sent."],
  [/before\s+"?ack"?/i, "The exchange's price feed hiccuped for this one. Retry it, it usually goes through."],
  [/no live route|no route for this pair|has no route/i, "There's no market for this token in the currency you chose right now. Try a different amount, or pay with GRAM or USDT."],
  [/no market maker/i, "No market maker is quoting this stock right now. Try a different amount, or again in a minute."],
  [/429|too many requests|rate.?limit/i, "Too many requests right now. Wait a few seconds and try again."],
  [/failed to fetch|fetch failed|networkerror|network request failed|ERR_NETWORK|ECONNRESET|ENOTFOUND/i, "Network problem. Check your connection and try again."],
  [/timed? ?out|timeout|aborted|AbortError/i, "That took too long. Please try again."],
  [/unexpected token|not valid json|JSON\.parse|unexpected end of json/i, "The server sent an unexpected reply. Try again in a moment."],
  [/websocket|aggregator/i, "Couldn't reach the exchange just now. Try again in a moment."],
  [/wallet.*not connected|not connected|no wallet/i, "Connect your wallet first."],
  [/unknown token/i, "We couldn't find this token."],
  [/exit code|exit_code|compute phase|bounced/i, "The transaction failed on-chain. Nothing was bought; any funds sent are refunded minus gas."],
  [/\b(500|502|503|504)\b|internal server error|bad gateway|service unavailable/i, "The service is having trouble right now. Try again in a minute."],
  [/\b(400|404)\b.*(bad request|not found)|bad request/i, "That request couldn't be processed. Check the amount and try again."],
];

export function humanError(e: unknown): string {
  const raw = (e instanceof Error ? e.message : typeof e === "string" ? e : (e as { message?: string })?.message) ?? "";
  for (const [re, text] of RULES) if (re.test(raw)) return text;
  const clean = raw
    .replace(/\[?TON_CONNECT_SDK_ERROR\]?\s*/gi, "")
    .replace(/^(\w*Error|Error):\s*/i, "")
    .replace(/\(\[?(GET|POST|PUT|DELETE)\]?:?[^)]*\)/gi, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/←.*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return clean || "Something went wrong. Please try again.";
}
