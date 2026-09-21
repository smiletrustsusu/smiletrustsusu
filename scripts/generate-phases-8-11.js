/**
 * Generate remaining Phase 8–11 deliverables.
 * Usage: node scripts/generate-phases-8-11.js
 */
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const w = (rel, body) => {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, body.replace(/\r\n/g, "\n"), "utf8");
  console.log("wrote", rel, Buffer.byteLength(body), "bytes");
};

w("src/core/phase8-config-isolation.js", String.raw`/**
 * Phase 8 — thin tenant/branch isolation checkpoint for config resolution.
 */
import {
  assertTenantIsolation,
  resolveEffectiveConfig,
  getConfigItem
} from "./canonical-config-registry.js";

export const PHASE8_ISOLATION_VERSION = "1.0.0";

export function buildConfigIsolationAuditEvent({
  action = "Config.Isolation.Check",
  result,
  context = {},
  itemId = "",
  actorId = ""
} = {}) {
  return Object.freeze({
    action,
    category: "configuration",
    module: "14",
    guarantee: "G1",
    itemId,
    actorId,
    tenantId: context.tenantId || "",
    branchId: context.branchId || "",
    requestedTenantId: context.requestedTenantId || "",
    requestedBranchId: context.requestedBranchId || "",
    ok: Boolean(result?.ok),
    code: result?.code || (result?.ok ? "ECPFMS-000" : "ECPFMS-011"),
    details: result?.error || "Isolation check passed",
    at: new Date().toISOString()
  });
}

export function enforceConfigResolution(itemId, context = {}, options = {}) {
  const ctx = {
    requireTenant: options.requireTenant !== false,
    requireBranch: options.requireBranch === true,
    ...context
  };
  const isolation = assertTenantIsolation(ctx);
  const audit = buildConfigIsolationAuditEvent({
    action: "Config.Resolution.Checkpoint",
    result: isolation,
    context: ctx,
    itemId: itemId || "",
    actorId: options.actorId || context.actorId || ""
  });
  if (!isolation.ok) return { ok: false, ...isolation, audit };
  if (!itemId) return { ok: true, audit, isolation };
  if (!getConfigItem(itemId)) {
    return { ok: false, error: "Unknown config item", code: "ECPFMS-001", audit };
  }
  return { ...resolveEffectiveConfig(itemId, ctx), audit };
}
`);

w("tests/ecpfms-consistency.test.js", String.raw`import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CONFIG_ITEMS,
  POLICY_ITEMS,
  FEATURE_FLAG_ITEMS,
  CONFIG_PRECEDENCE,
  listConfigItems,
  getConfigItem,
  resolveEffectiveConfig,
  assertTenantIsolation,
  validateConfigRegistry,
  ECPFMS_COUNTS
} from "../src/core/canonical-config-registry.js";
import { enforceConfigResolution } from "../src/core/phase8-config-isolation.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

test("registry validation: unique IDs, owners, defaults 15/31/1000", () => {
  const result = validateConfigRegistry();
  assert.equal(result.ok, true, result.errors.join("; "));
  assert.equal(getConfigItem("CFG-FINANCE-LOAN-INTEREST").defaultValue, 15);
  assert.equal(getConfigItem("CFG-FINANCE-COLLECTION-DAYS").defaultValue, 31);
  assert.equal(getConfigItem("CFG-APPROVAL-CASHIER-LIMIT").defaultValue, 1000);
  assert.ok(ECPFMS_COUNTS.configItems >= 80);
  assert.ok(ECPFMS_COUNTS.policies >= 10);
  assert.ok(ECPFMS_COUNTS.featureFlags >= 20);
  assert.equal(listConfigItems().length, CONFIG_ITEMS.length);
});

test("unique config/policy/flag IDs and single owners", () => {
  assert.equal(new Set(CONFIG_ITEMS.map((i) => i.id)).size, CONFIG_ITEMS.length);
  assert.equal(new Set(POLICY_ITEMS.map((i) => i.id)).size, POLICY_ITEMS.length);
  assert.equal(new Set(FEATURE_FLAG_ITEMS.map((i) => i.id)).size, FEATURE_FLAG_ITEMS.length);
  assert.equal(new Set(FEATURE_FLAG_ITEMS.map((i) => i.runtimeFlagId)).size, FEATURE_FLAG_ITEMS.length);
  assert.ok(FEATURE_FLAG_ITEMS.some((f) => f.runtimeFlagId === "enableEnterpriseBi"));
  assert.ok(FEATURE_FLAG_ITEMS.some((f) => f.runtimeFlagId === "enableEnterpriseIntegration"));
  assert.ok(FEATURE_FLAG_ITEMS.some((f) => f.runtimeFlagId === "enableEnterpriseAi"));
  assert.ok(FEATURE_FLAG_ITEMS.some((f) => f.runtimeFlagId === "enablePlatformAdmin"));
});

test("precedence: branch beats tenant beats global; emergency wins", () => {
  assert.deepEqual(CONFIG_PRECEDENCE, ["Emergency", "Env", "Tenant", "Branch", "Product", "Global"]);
  const id = "CFG-FINANCE-LOAN-INTEREST";
  assert.equal(resolveEffectiveConfig(id, { tenantId: "t1" }).value, 15);
  assert.equal(resolveEffectiveConfig(id, { tenantId: "t1", tenantOverrides: { [id]: 12 } }).value, 12);
  assert.equal(resolveEffectiveConfig(id, {
    tenantId: "t1", tenantOverrides: { [id]: 12 }, branchOverrides: { [id]: 10 }
  }).value, 10);
  assert.equal(resolveEffectiveConfig(id, {
    tenantId: "t1",
    tenantOverrides: { [id]: 12 },
    branchOverrides: { [id]: 10 },
    emergencyOverrides: { [id]: 5 }
  }).value, 5);
});

test("non-overridable items ignore lower-scope overrides", () => {
  const id = "CFG-ORG-CURRENCY";
  assert.equal(getConfigItem(id).overridable, false);
  const resolved = resolveEffectiveConfig(id, {
    tenantId: "t1",
    tenantOverrides: { [id]: "USD" },
    branchOverrides: { [id]: "EUR" }
  });
  assert.equal(resolved.value, "GHS");
  assert.equal(resolved.layer, "Global");
});

test("cross-tenant access rejected", () => {
  assert.equal(assertTenantIsolation({ tenantId: "t1", requestedTenantId: "t2" }).code, "ECPFMS-011");
  assert.equal(assertTenantIsolation({}).code, "ECPFMS-010");
  assert.equal(assertTenantIsolation({ tenantId: "t1", requestedTenantId: "t1" }).ok, true);
  const enforced = enforceConfigResolution("CFG-FINANCE-COLLECTION-DAYS", {
    tenantId: "t1",
    requestedTenantId: "t9"
  });
  assert.equal(enforced.ok, false);
  assert.equal(enforced.code, "ECPFMS-011");
});

test("docs exist with Isolation and Enforcement sections", () => {
  const text = fs.readFileSync(path.join(root, "docs", "enterprise-configuration-policy-feature.md"), "utf8");
  assert.match(text, /CONFIGURATION PRECEDENCE/i);
  assert.match(text, /Tenant & Branch Isolation Rules/i);
  assert.match(text, /Tenant & Branch Enforcement Points/i);
  assert.equal(fs.existsSync(path.join(root, "docs", "ecpfms-catalogs.md")), true);
});
`);

console.log("batch A ok");
