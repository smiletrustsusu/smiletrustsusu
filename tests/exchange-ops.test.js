import test from "node:test";
import assert from "node:assert/strict";
import { canAction } from "../src/core/rbac.js";
import { canTransitionExchange, assertExchangeLifecycleBoundary } from "../src/core/exchange-lifecycle.js";
import {
  EXPORT_PERMISSIONS,
  EXPORT_ROLE_MATRIX,
  ROLE_ALIASES,
  HIGH_RISK_EXPORT_PERMISSIONS,
  evaluateExportAuthorization,
  assertExportPolicyBoundary
} from "../src/core/export-policy.js";
import {
  ensureExchangeState,
  validateImport,
  importExchange,
  exportExchange,
  approveExportJob,
  migrateExchange,
  rollbackImport,
  bulkExchange,
  controlExchangeJob,
  requestExportPermissionAssignment,
  advanceExportPermissionAssignment,
  exchangeDashboard,
  assertExchangeBoundary
} from "../src/core/exchange-ops.js";
import "../src/core/exchange-api.js";
import { invokeContract, getContract } from "../src/core/module-contracts.js";
import { dispatchGatewayRequest, ensureGatewayState } from "../src/core/api-gateway-ops.js";

const uid = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 7)}`;
const owner = { id: "u-owner", role: "SystemOwner", systemOwner: true, username: "john" };
const kba = { id: "u-kba", role: "KBA", username: "kba" };
const md = { id: "u-md", role: "ManagingDirector", username: "md" };
const bm = { id: "u-bm", role: "Admin", username: "ama", branchId: "br-1" };
const cashier = { id: "u-cash", role: "Cashier", username: "kojo", branchId: "br-1" };
const collector = { id: "u-col", role: "Collector", username: "yaw", branchId: "br-1" };
const auditor = { id: "u-aud", role: "Auditor", username: "audit" };
const now = "2026-09-11T08:00:00.000Z";

function blank() {
  const state = {
    settings: { currency: "GHS", loanInterest: 15, collectionDays: 31 },
    collections: [{ id: "col-1", customerId: "c-a", date: "2026-09-11", amount: 20, branchId: "br-1" }],
    customers: [{ id: "c-a", name: "Ama", phone: "0200000001", active: true, branchId: "br-1" }],
    loans: [],
    audit: [],
    notifications: [],
    featureFlags: [{ id: "enableDataExchange", enabled: true }]
  };
  ensureGatewayState(state);
  ensureExchangeState(state);
  return state;
}

test("exchange lifecycle, policy, and financial boundary stay closed", () => {
  assert.equal(canTransitionExchange("queued", "running"), true);
  assert.equal(canTransitionExchange("completed", "queued"), false);
  assert.equal(assertExchangeLifecycleBoundary().postsCollections, false);
  assert.equal(assertExchangeBoundary().postsCollections, false);
  assert.equal(assertExportPolicyBoundary().centralMatrix, true);
  assert.equal(ROLE_ALIASES["Platform Administrator"], "SystemOwner");
  assert.ok(EXPORT_PERMISSIONS.includes("Export.All"));
  assert.ok(HIGH_RISK_EXPORT_PERMISSIONS.includes("Export.Backup"));
  assert.equal(canAction(owner, "Export.All"), true);
  assert.equal(canAction(kba, "Export.All"), false);
  assert.equal(canAction(md, "Export.All"), false);
  assert.equal(canAction(md, "Export.Backup"), false);
  assert.equal(canAction(collector, "Export.Customers"), false);
  assert.equal(canAction(cashier, "Export.Savings"), true);
  assert.equal(canAction(auditor, "Export.Audit"), true);
  assert.ok(EXPORT_ROLE_MATRIX.Admin.includes("Export.Loans"));
});

test("customer metadata import applies, financial import stages, and rollback restores", () => {
  const state = blank();
  const beforeCollections = state.collections.length;
  const financial = importExchange(state, {
    type: "savings_transactions",
    format: "csv",
    apply: true,
    text: "customerId,amount,date\nc-a,50,2026-09-11"
  }, owner, uid, now);
  assert.equal(financial.ok, true);
  assert.equal(financial.staged, true);
  assert.equal(financial.posted, false);
  assert.equal(state.collections.length, beforeCollections);
  assert.equal(state.collections[0].amount, 20);

  const imported = importExchange(state, {
    type: "customers",
    format: "csv",
    apply: true,
    text: "Full Name,Phone Number\nKwame,0201111222"
  }, owner, uid, now);
  assert.equal(imported.ok, true);
  assert.equal(imported.applied, 1);
  assert.equal(state.customers.some((item) => item.phone === "0201111222"), true);

  const rolled = rollbackImport(state, imported.job.id, owner, uid, now);
  assert.equal(rolled.ok, true);
  assert.equal(state.customers.some((item) => item.phone === "0201111222"), false);
  assert.equal(state.collections.length, beforeCollections);
});

test("validation errors are downloadable and do not write production data", () => {
  const state = blank();
  const result = validateImport(state, {
    type: "customers",
    format: "csv",
    text: "Full Name,Phone Number\n,0200000001"
  }, owner, uid, now);
  assert.equal(result.ok, false);
  assert.ok(result.errors.length >= 1);
  assert.equal(state.customers.length, 1);
  const badImport = importExchange(state, {
    type: "customers",
    format: "csv",
    apply: true,
    text: "Full Name,Phone Number\nAma,0200000001"
  }, owner, uid, now);
  assert.equal(badImport.ok, false);
  assert.equal(badImport.errorCode, "EX-006");
});

test("export permissions, branch isolation, format policy, and maker-checker", () => {
  const state = blank();
  const denied = exportExchange(state, { type: "customers", format: "zip" }, collector, uid, now);
  assert.equal(denied.ok, false);
  assert.equal(denied.errorCode, "EX-002");

  const cross = exportExchange(state, { type: "customers", format: "zip", branchId: "br-2" }, bm, uid, now);
  assert.equal(cross.ok, false);
  assert.equal(cross.errorCode, "EX-003");

  const restricted = exportExchange(state, { type: "configuration", format: "csv" }, owner, uid, now);
  assert.equal(restricted.ok, false);
  assert.equal(restricted.errorCode, "EX-005");

  const auth = evaluateExportAuthorization(state, cashier, "customers", "zip", { now, uid, branchId: "br-1" });
  assert.equal(auth.ok, true);

  const pending = exportExchange(state, { type: "configuration", format: "zip" }, kba, uid, now);
  assert.equal(pending.ok, true);
  assert.equal(pending.pendingApproval, true);
  const selfApprove = approveExportJob(state, pending.job.id, kba, uid, now);
  assert.equal(selfApprove.ok, false);
  assert.equal(selfApprove.errorCode, "EX-011");
  const approved = approveExportJob(state, pending.job.id, owner, uid, now);
  assert.equal(approved.ok, true);
  assert.ok(String(approved.content).includes("encrypted"));
  assert.ok(state.exportHistory.some((item) => item.jobId === pending.job.id));
});

test("migration dry-run, reconciliation, bulk, jobs, SoD, and contracts stay off the ledger", () => {
  const state = blank();
  const before = state.collections.length;
  const dry = migrateExchange(state, {
    type: "customers",
    source: "spreadsheet",
    dryRun: true,
    format: "csv",
    expectedCount: 1,
    text: "Full Name,Phone Number\nAba,0203333444"
  }, owner, uid, now);
  assert.equal(dry.ok, true);
  assert.equal(dry.job.result, "dry_run");
  assert.equal(dry.reconciliation.matched, true);
  assert.equal(state.customers.some((item) => item.phone === "0203333444"), false);

  const live = migrateExchange(state, {
    type: "customers",
    source: "legacy",
    format: "csv",
    expectedCount: 1,
    text: "Full Name,Phone Number\nAba,0203333444"
  }, owner, uid, now);
  assert.equal(live.ok, true);
  assert.equal(live.posted, false);

  const bulk = bulkExchange(state, { action: "validate", dataset: "customers", ids: ["c-a"] }, owner, uid, now);
  assert.equal(bulk.ok, true);
  const paused = controlExchangeJob(state, live.job.id, "pause", owner, uid, now);
  assert.equal(paused.ok, false);

  const req = requestExportPermissionAssignment(state, { permission: "Export.Backup", reason: "DR drill", targetUserId: kba.id }, md, uid, now);
  assert.equal(req.ok, true);
  const sod = advanceExportPermissionAssignment(state, req.request.id, "business_reviewer", md, uid, now);
  assert.equal(sod.ok, false);
  assert.equal(sod.errorCode, "EX-011");
  const reviewed = advanceExportPermissionAssignment(state, req.request.id, "business_reviewer", bm, uid, now);
  assert.equal(reviewed.ok, true);

  assert.ok(getContract("Exchange.Export.v1"));
  const invoked = invokeContract(state, {
    contractId: "Exchange.Validate.v1",
    fromModule: 20,
    payload: { type: "customers", format: "csv", text: "Full Name,Phone Number\nKofi,0205555666" }
  }, { uid, now, user: owner });
  assert.equal(invoked.ok, true);
  const gateway = dispatchGatewayRequest(state, {
    route: "exchange.statistics",
    version: "v1",
    user: owner
  }, { uid, now, user: owner });
  assert.equal(gateway.ok, true);
  assert.ok(exchangeDashboard(state).imports >= 0);
  assert.equal(state.collections.length, before);
  assert.equal(state.settings.loanInterest, 15);
  assert.equal(state.settings.collectionDays, 31);
});
