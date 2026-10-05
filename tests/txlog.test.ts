import { test } from "node:test";
import assert from "node:assert/strict";
import { toCsv } from "../src/lib/txlog";

test("toCsv: header from keys, quotes commas, quotes and newlines", () => {
  const csv = toCsv([
    { time: "2026-10-05T10:00:00Z", action: "⚡ Buy $TSLAx", details: "1 GRAM, via STON.fi", note: 'say "hi"' },
    { time: "2026-10-05T11:00:00Z", action: "Sell", details: "line1\nline2", note: undefined },
  ]);
  const lines = csv.split("\n");
  assert.equal(lines[0], "time,action,details,note");
  assert.equal(lines[1], '2026-10-05T10:00:00Z,⚡ Buy $TSLAx,"1 GRAM, via STON.fi","say ""hi"""');
  assert.ok(csv.includes('"line1\nline2"'));
  assert.ok(csv.endsWith(","));
});

test("toCsv: empty input gives empty string", () => {
  assert.equal(toCsv([]), "");
});
