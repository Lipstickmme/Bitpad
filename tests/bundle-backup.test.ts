import { test } from "node:test";
import assert from "node:assert/strict";

// Minimal browser globals for the bundler vault (Node has WebCrypto built in)
const store = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) },
  location: { origin: "https://bitpad.test" },
});

test("bundler backup: restores the same wallets in a fresh browser, refuses a wrong password", async () => {
  const lib = await import("../src/lib/ton/bundler");
  const made = await lib.createWallets(2, "vault-pass-1");
  const backup = JSON.parse(JSON.stringify(await lib.exportBackup(made, "vault-pass-1")));
  assert.equal(backup.format, "bitpad-bundle-backup");
  assert.equal(backup.wallets.length, 2);
  assert.ok(!JSON.stringify(backup).match(/\b(\w+ ){23}\w+\b/), "backup must not contain plain phrases");
  await assert.rejects(() => lib.exportBackup(made, "wrong-password"));

  // A different browser: no salt, different vault password
  store.clear();
  await assert.rejects(() => lib.restoreBackup(backup, "nope-nope", "vault-pass-2", []), /Wrong password/);
  const restored = await lib.restoreBackup(backup, "vault-pass-1", "vault-pass-2", []);
  assert.deepEqual(restored.map((w) => w.address), made.map((w) => w.address));
  // re-encrypted for the new vault: the new password reveals the same 24 words
  const words = await lib.revealMnemonic(restored[0], "vault-pass-2");
  assert.equal(words.split(" ").length, 24);
  // restoring again adds nothing
  assert.equal((await lib.restoreBackup(backup, "vault-pass-1", "vault-pass-2", restored)).length, 0);

  const text = await lib.exportPhrases(restored, "vault-pass-2");
  assert.ok(text.includes(made[0].address) && text.includes(words));
});

test("bundler backup: rejects files that aren't backups", async () => {
  const lib = await import("../src/lib/ton/bundler");
  await assert.rejects(() => lib.restoreBackup({} as never, "x", "y", []), /isn't a Bitpad bundler backup/);
});
