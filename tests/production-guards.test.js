import test from "node:test";
import assert from "node:assert/strict";
import {
  productionWarnings,
  blockFinancialWriteIfUnsafe,
  hasBootstrapDefaultPassword,
  assessBootstrapPasswordGuard,
  forbiddenClientConfigKeys,
  BOOTSTRAP_DEFAULT_PASSWORDS
} from "../src/core/production-guards.js";

test("production mode blocks when relational sync disabled", () => {
  const state = { settings: { productionMode: true, relationalSync: false } };
  const result = blockFinancialWriteIfUnsafe(state, {});
  assert.equal(result.ok, false);
});

test("production warnings flag a legacy sync access key left on the device", () => {
  const warnings = productionWarnings({ settings: { syncAccessKey: "short" } }, {});
  assert.ok(warnings.some((item) => /access key/i.test(item)));
  assert.equal(productionWarnings({ settings: {} }, {}).some((item) => /access key/i.test(item)), false);
});

test("GAP-024 bootstrap default password helper recognizes weak bootstrap values", () => {
  assert.ok(BOOTSTRAP_DEFAULT_PASSWORDS.includes("change-me"));
  assert.equal(hasBootstrapDefaultPassword({ defaultOwnerPassword: "1234" }), true);
  assert.equal(hasBootstrapDefaultPassword({ defaultOwnerPassword: "98765" }), true);
  assert.equal(hasBootstrapDefaultPassword({ developerPassword: "change-me" }), true);
  assert.equal(hasBootstrapDefaultPassword({ defaultOwnerPassword: "unique-strong-secret-99" }), false);
});

test("GAP-024 productionMode fail-closed on any secret distributed in client config", () => {
  const state = {
    settings: {
      productionMode: true,
      relationalSync: true,
      postgresSourceOfTruth: true
    }
  };
  const blocked = blockFinancialWriteIfUnsafe(state, { defaultOwnerPassword: "1234" });
  assert.equal(blocked.ok, false);
  assert.match(blocked.error, /password|Bootstrap|distributed/i);

  const strongButShipped = blockFinancialWriteIfUnsafe(state, {
    defaultOwnerPassword: "unique-strong-secret-99",
    developerPassword: "another-unique-secret-88"
  });
  assert.equal(strongButShipped.ok, false);

  const syncKeyShipped = blockFinancialWriteIfUnsafe(state, { syncAccessKey: "a".repeat(32) });
  assert.equal(syncKeyShipped.ok, false);

  const ok = blockFinancialWriteIfUnsafe(state, { supabaseUrl: "https://x.supabase.co", supabaseAnonKey: "public" });
  assert.equal(ok.ok, true);
});

test("forbiddenClientConfigKeys lists only populated secret keys", () => {
  assert.deepEqual(forbiddenClientConfigKeys({ supabaseAnonKey: "public", syncAccessKey: "" }), []);
  assert.deepEqual(forbiddenClientConfigKeys({ syncAccessKey: "x", developerPassword: "y" }).sort(), ["developerPassword", "syncAccessKey"]);
});

test("GAP-024 assessBootstrapPasswordGuard never invents secrets", () => {
  const off = assessBootstrapPasswordGuard({
    productionMode: false,
    config: { defaultOwnerPassword: "1234" }
  });
  assert.equal(off.gap, "GAP-024");
  assert.ok(off.status === "Partial" || off.status === "Ready");

  const blocked = assessBootstrapPasswordGuard({
    productionMode: true,
    config: { defaultOwnerPassword: "1234" }
  });
  assert.equal(blocked.status, "Blocked");

  const ready = assessBootstrapPasswordGuard({
    productionMode: true,
    config: { defaultOwnerPassword: "unique-strong-secret-99" }
  });
  assert.equal(ready.status, "Ready");
});
