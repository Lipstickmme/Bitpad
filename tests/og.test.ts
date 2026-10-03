import { test } from "node:test";
import assert from "node:assert/strict";
import { ogGrade } from "../src/lib/og";

const YEAR = 365.25 * 86_400_000;
const now = Date.UTC(2026, 9, 3);

test("ogGrade: stars by years trading", () => {
  assert.equal(ogGrade(now - 0.5 * YEAR, now), 0);
  assert.equal(ogGrade(now - 1.2 * YEAR, now), 1);
  assert.equal(ogGrade(now - 2.1 * YEAR, now), 2);
  assert.equal(ogGrade(now - 4 * YEAR, now), 3);
});

test("ogGrade: unknown or future dates get no badge", () => {
  assert.equal(ogGrade(undefined, now), 0);
  assert.equal(ogGrade(null, now), 0);
  assert.equal(ogGrade(NaN, now), 0);
  assert.equal(ogGrade(now + YEAR, now), 0);
});
