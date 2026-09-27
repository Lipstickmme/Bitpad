import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import "./stub-server-only";

const BOT = "123456:TEST_TOKEN";

test("verifyInitData accepts a correctly signed Mini App payload and rejects tampering", async () => {
  const { verifyInitData } = await import("../src/lib/auth");
  const user = JSON.stringify({ id: 42, first_name: "Ada", username: "ada" });
  const p = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000)), query_id: "q1", user });
  const check = [...p.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join("\n");
  const secret = createHmac("sha256", "WebAppData").update(BOT).digest();
  p.set("hash", createHmac("sha256", secret).update(check).digest("hex"));
  assert.equal(verifyInitData(p.toString(), BOT)?.id, 42);
  p.set("user", JSON.stringify({ id: 1, first_name: "Mallory" }));
  assert.equal(verifyInitData(p.toString(), BOT), null);
});

test("verifyLoginWidget checks the widget hash", async () => {
  const { verifyLoginWidget } = await import("../src/lib/auth");
  const data: Record<string, string | number> = { id: 7, first_name: "Bob", auth_date: Math.floor(Date.now() / 1000) };
  const check = Object.keys(data).sort().map((k) => `${k}=${data[k]}`).join("\n");
  const hash = createHmac("sha256", createHash("sha256").update(BOT).digest()).update(check).digest("hex");
  assert.equal(verifyLoginWidget({ ...data, hash }, BOT)?.id, 7);
  assert.equal(verifyLoginWidget({ ...data, first_name: "Eve", hash }, BOT), null);
});

test("session cookies round-trip and reject forgeries", async () => {
  const { signSession, readSession } = await import("../src/lib/auth");
  const tok = signSession({ wallets: [], iat: 1 });
  assert.deepEqual(readSession(tok), { wallets: [], iat: 1 });
  assert.equal(readSession(tok.replace(/.$/, (c) => (c === "A" ? "B" : "A"))), null);
});
