import test from "node:test";
import assert from "node:assert/strict";
import {
  productionWarnings,
  blockFinancialWriteIfUnsafe,
  hasBootstrapDefaultPassword,
  assessBootstrapPasswordGuard,
  BOOTSTRAP_DEFAULT_PASSWORDS
} from "../src/core/production-guards.js";

test("production mode blocks when relational sync disabled", () => {
  const state = { settings: { productionMode: true, relationalSync: false } };
  const result = blockFinancialWriteIfUnsafe(state, {});
  assert.equal(result.ok, false);
});

test("production warnings flag short sync access key", () => {
  const warnings = productionWarnings({ settings: { syncAccessKey: "short" } }, {});
  assert.ok(warnings.some((item) => /access key/i.test(item)));
});

test("GAP-024 bootstrap default password helper recognizes known defaults", () => {
  assert.ok(BOOTSTRAP_DEFAULT_PASSWORDS.includes("7049"));
  assert.ok(BOOTSTRAP_DEFAULT_PASSWORDS.includes("05491"));
  assert.equal(hasBootstrapDefaultPassword({ defaultOwnerPassword: "7049" }), true);
  assert.equal(hasBootstrapDefaultPassword({ developerPassword: "change-me" }), true);
  assert.equal(hasBootstrapDefaultPassword({ defaultOwnerPassword: "unique-strong-secret-99" }), false);
});

test("GAP-024 productionMode fail-closed on bootstrap default passwords", () => {
  const state = {
    settings: {
      productionMode: true,
      relationalSync: true,
      postgresSourceOfTruth: true,
      syncAccessKey: "a".repeat(32)
    }
  };
  const blocked = blockFinancialWriteIfUnsafe(state, {
    defaultOwnerPassword: "7049",
    syncAccessKey: "a".repeat(32)
  });
  assert.equal(blocked.ok, false);
  assert.match(blocked.error, /password|Bootstrap/i);

  const ok = blockFinancialWriteIfUnsafe(state, {
    defaultOwnerPassword: "unique-strong-secret-99",
    developerPassword: "another-unique-secret-88",
    syncAccessKey: "a".repeat(32)
  });
  assert.equal(ok.ok, true);
});

test("GAP-024 assessBootstrapPasswordGuard never invents secrets", () => {
  const off = assessBootstrapPasswordGuard({
    productionMode: false,
    config: { defaultOwnerPassword: "7049" }
  });
  assert.equal(off.gap, "GAP-024");
  assert.ok(off.status === "Partial" || off.status === "Ready");

  const blocked = assessBootstrapPasswordGuard({
    productionMode: true,
    config: { defaultOwnerPassword: "7049" }
  });
  assert.equal(blocked.status, "Blocked");

  const ready = assessBootstrapPasswordGuard({
    productionMode: true,
    config: { defaultOwnerPassword: "unique-strong-secret-99" }
  });
  assert.equal(ready.status, "Ready");
});
