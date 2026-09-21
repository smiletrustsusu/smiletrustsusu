import test from "node:test";
import assert from "node:assert/strict";
import { canAction } from "../src/core/rbac.js";
import { isFeatureEnabled } from "../src/core/system-config.js";
import {
  assertPlatformLifecycleBoundary,
  PLATFORM_ERROR_CODES,
  DEFAULT_TENANT_ID
} from "../src/core/platform-lifecycle.js";
import {
  ensurePlatformState,
  registerTenant,
  transitionTenant,
  getTenantConfig,
  updateTenantConfig,
  publishPlatformConfig,
  evaluateFeatureFlag,
  setPlatformFlag,
  killFeatureFlag,
  flagRolloutBucket,
  enforceLicense,
  revokeLicense,
  scheduleMaintenance,
  startMaintenance,
  planDeployment,
  approveDeployment,
  executeDeployment,
  platformOpsDashboard,
  assertPlatformBoundary,
  isPlatformReadOnly
} from "../src/core/platform-ops.js";
import "../src/core/platform-api.js";
import { invokeContract, getContract } from "../src/core/module-contracts.js";
import { dispatchGatewayRequest, ensureGatewayState } from "../src/core/api-gateway-ops.js";
import { ensureMonitoringState } from "../src/core/monitoring-ops.js";
import { ensureBackupRecoveryState } from "../src/core/backup-recovery-ops.js";
import { ensureSecurityState } from "../src/core/security-ops.js";

const uid = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 7)}`;
const owner = { id: "u-owner", role: "SystemOwner", systemOwner: true, username: "john" };
const kba = { id: "u-kba", role: "KBA", username: "kba" };
const admin = { id: "u-admin", role: "Admin", username: "ama-admin" };
const collector = { id: "u-col", role: "Collector", username: "yaw" };
const now = "2026-09-12T14:00:00.000Z";

function blank() {
  const state = {
    settings: { currency: "GHS", loanInterest: 15, collectionDays: 31 },
    collections: [{ id: "col-1", customerId: "c-a", date: "2026-09-11", amount: 2000 }],
    customers: [{ id: "c-a", name: "Ama", active: true }],
    loans: [],
    withdrawals: [],
    users: [{ id: "u-owner", role: "SystemOwner" }],
    branches: [{ id: "br-1" }],
    devices: [],
    audit: [],
    paymentTransactions: [{ id: "p1", status: "Completed" }]
  };
  ensureGatewayState(state);
  ensureMonitoringState(state);
  ensureBackupRecoveryState(state);
  ensureSecurityState(state);
  ensurePlatformState(state, uid, now);
  return state;
}

test("tenant isolation: config/branding not leaked across tenants", () => {
  const state = blank();
  const a = registerTenant(state, { code: "ALPHA", name: "Alpha Co", primaryColor: "#111111" }, owner, uid, now);
  const b = registerTenant(state, { code: "BETA", name: "Beta Co", primaryColor: "#222222" }, owner, uid, now);
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  const cfgA = getTenantConfig(state, a.tenant.id, owner);
  const cfgB = getTenantConfig(state, b.tenant.id, owner);
  assert.equal(cfgA.branding.primaryColor, "#111111");
  assert.equal(cfgB.branding.primaryColor, "#222222");
  assert.equal(cfgA.configuration.tenantId, a.tenant.id);
  assert.equal(cfgB.configuration.tenantId, b.tenant.id);
  assert.notEqual(cfgA.branding.tenantId, cfgB.branding.tenantId);
  updateTenantConfig(state, a.tenant.id, { branding: { productName: "Alpha Only" } }, owner, uid, now);
  const againB = getTenantConfig(state, b.tenant.id, owner);
  assert.notEqual(againB.branding.productName, "Alpha Only");
});

test("config versioning creates immutable history and audit", () => {
  const state = blank();
  const first = publishPlatformConfig(state, { key: "platform.auth", value: { minPasswordLength: 10 }, reason: "harden" }, owner, uid, now);
  assert.equal(first.ok, true);
  assert.equal(first.version, 1);
  const second = publishPlatformConfig(state, { key: "platform.auth", value: { minPasswordLength: 12 }, reason: "harden2" }, owner, uid, now);
  assert.equal(second.version, 2);
  const hist = state.platformConfigurationHistory.filter((h) => h.key === "platform.auth");
  assert.equal(hist.length, 2);
  assert.equal(hist[0].immutable, true);
  assert.ok((state.audit || []).some((row) => String(row.action || "").includes("Platform.Config")));
});

test("feature flag evaluation is deterministic for %, branch, tenant, kill switch", () => {
  const state = blank();
  assert.equal(flagRolloutBucket("enableEnterpriseBi", "user-a"), flagRolloutBucket("enableEnterpriseBi", "user-a"));
  setPlatformFlag(state, {
    flagId: "enableEnterpriseBi",
    rule: { rolloutPercent: 50, tenantIds: [DEFAULT_TENANT_ID] }
  }, owner, uid, now);
  const e1 = evaluateFeatureFlag(state, "enableEnterpriseBi", { tenantId: DEFAULT_TENANT_ID, subjectKey: "subj-1" }, now);
  const e2 = evaluateFeatureFlag(state, "enableEnterpriseBi", { tenantId: DEFAULT_TENANT_ID, subjectKey: "subj-1" }, now);
  assert.equal(e1.enabled, e2.enabled);
  assert.equal(e1.deterministic, true);
  const otherTenant = evaluateFeatureFlag(state, "enableEnterpriseBi", { tenantId: "tenant-other", subjectKey: "subj-1" }, now);
  assert.equal(otherTenant.reason, "base_flag");
  killFeatureFlag(state, "enableEnterpriseBi", owner, uid, now);
  const killed = evaluateFeatureFlag(state, "enableEnterpriseBi", { subjectKey: "subj-1" }, now);
  assert.equal(killed.enabled, false);
  assert.equal(killed.reason, "kill_switch");
  assert.equal(isFeatureEnabled(state, "enableEnterpriseBi"), false);
  assert.equal(isFeatureEnabled(state, "enablePlatformAdmin"), true);
});

test("license enforcement returns clear errors without corrupting collections", () => {
  const state = blank();
  const before = state.collections.length;
  const amount = state.collections[0].amount;
  const ok = enforceLicense(state, { users: 1 }, owner, uid, now);
  assert.equal(ok.ok, true);
  assert.equal(ok.collectionsUnchanged, true);
  const denied = enforceLicense(state, { users: 999999 }, owner, uid, now);
  assert.equal(denied.ok, false);
  assert.equal(denied.errorCode, "PLT-011");
  assert.equal(state.collections.length, before);
  assert.equal(state.collections[0].amount, amount);
  const revoked = revokeLicense(state, state.platformLicenses[0].id, owner, uid, now, "test revoke");
  assert.equal(revoked.ok, true);
});

test("maintenance read-only mode blocks mutating platform ops", () => {
  const state = blank();
  const scheduled = scheduleMaintenance(state, {
    title: "Emergency RO",
    type: "emergency",
    readOnly: true,
    startsAt: "2026-09-12T00:00:00.000Z",
    endsAt: "2026-09-13T00:00:00.000Z"
  }, owner, uid, now);
  assert.equal(scheduled.ok, true);
  startMaintenance(state, scheduled.window.id, owner, uid, now);
  assert.equal(isPlatformReadOnly(state, now), true);
  const blocked = registerTenant(state, { code: "BLOCKED", name: "Blocked" }, owner, uid, now);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.errorCode, "PLT-015");
  const view = platformOpsDashboard(state, owner, uid, now);
  assert.equal(view.ok, true);
});

test("deployment approval gate and SoD", () => {
  const state = blank();
  const planned = planDeployment(state, { version: "30.0.0", strategy: "canary" }, kba, uid, now);
  assert.equal(planned.ok, true);
  assert.equal(planned.requiresApproval, true);
  const selfApprove = approveDeployment(state, planned.deployment.id, kba, uid, now);
  assert.equal(selfApprove.ok, false);
  assert.equal(selfApprove.errorCode, "PLT-020");
  const unapproved = executeDeployment(state, planned.deployment.id, owner, uid, now);
  assert.equal(unapproved.ok, false);
  assert.equal(unapproved.errorCode, "PLT-017");
  const approved = approveDeployment(state, planned.deployment.id, owner, uid, now);
  assert.equal(approved.ok, true);
  const executed = executeDeployment(state, planned.deployment.id, owner, uid, now);
  assert.equal(executed.ok, true);
});

test("ops dashboard aggregates without posting money; constants preserved", () => {
  const state = blank();
  const before = state.collections[0].amount;
  const dash = platformOpsDashboard(state, owner, uid, now);
  assert.equal(dash.ok, true);
  assert.equal(dash.postsMoney, false);
  assert.ok(dash.tenants.total >= 1);
  assert.equal(state.collections[0].amount, before);
  assert.equal(state.settings.loanInterest, 15);
  assert.equal(state.settings.collectionDays, 31);
  const smile = getTenantConfig(state, DEFAULT_TENANT_ID, owner);
  assert.equal(smile.configuration.loanInterestDefault, 15);
  assert.equal(smile.configuration.collectionDaysDefault, 31);
});

test("Collector denied Platform.Admin; Admin limited View", () => {
  assert.equal(canAction(collector, "Platform.Admin"), false);
  assert.equal(canAction(collector, "Platform.View"), false);
  assert.equal(canAction(admin, "Platform.View"), true);
  assert.equal(canAction(admin, "Platform.Admin"), false);
  assert.equal(canAction(owner, "Platform.Admin"), true);
  assert.equal(canAction(kba, "Platform.Admin"), true);
  const state = blank();
  const denied = killFeatureFlag(state, "enableOfflineMode", collector, uid, now);
  assert.equal(denied.ok, false);
  assert.equal(denied.errorCode, "PLT-002");
});

test("gateway and contracts work for Module 30", () => {
  const state = blank();
  assert.ok(getContract("Platform.Ops.Dashboard.v1"));
  assert.ok(getContract("Platform.Flag.Evaluate.v1"));
  assert.ok(getContract("Platform.Tenant.Register.v1"));
  const viaContract = invokeContract(state, { contractId: "Platform.Health.v1", fromModule: 20, payload: {} }, { user: owner, uid, now });
  assert.equal(viaContract.ok, true);
  const dash = invokeContract(state, { contractId: "Platform.Ops.Dashboard.v1", fromModule: 20, payload: {} }, { user: owner, uid, now });
  assert.equal(dash.ok, true);
  const viaGw = dispatchGatewayRequest(state, {
    route: "platform.health",
    version: "v1",
    user: owner
  }, { uid, now, user: owner });
  assert.equal(viaGw.ok, true);
  assert.equal(assertPlatformBoundary().postsCollections, false);
  assert.equal(assertPlatformBoundary().doesNotDuplicateModules1to29, true);
  assert.equal(assertPlatformLifecycleBoundary().restHttp, false);
  assert.ok(PLATFORM_ERROR_CODES["PLT-015"]);
});

test("tenant suspend emits event; default smile tenant seeded", () => {
  const state = blank();
  assert.ok(state.platformTenants.some((t) => t.id === DEFAULT_TENANT_ID));
  assert.ok(state.platformLicenses.some((l) => l.status === "active"));
  assert.equal(state.platformEnvironmentRegistry.length, 6);
  const suspended = transitionTenant(state, DEFAULT_TENANT_ID, "suspended", owner, uid, now);
  assert.equal(suspended.ok, true);
  assert.ok((state.domainEvents || []).some((e) => e.name === "TenantSuspended"));
});
