import test from "node:test";
import assert from "node:assert/strict";
import { isValidGhanaPhone, normalizeGhanaPhone, formatGhanaPhoneDisplay } from "../src/core/ghana.js";

test("normalizeGhanaPhone converts international format", () => {
  assert.equal(normalizeGhanaPhone("+233 24 123 4567"), "0241234567");
});

test("isValidGhanaPhone accepts MTN numbers", () => {
  assert.equal(isValidGhanaPhone("0241234567"), true);
  assert.equal(isValidGhanaPhone("02412345"), false);
});

test("formatGhanaPhoneDisplay groups digits", () => {
  assert.equal(formatGhanaPhoneDisplay("0241234567"), "024 123 4567");
});
