import test from "node:test";
import assert from "node:assert/strict";
import { canAction } from "../src/core/rbac.js";
import {
  generateTechnicalId,
  isTechnicalId,
  isBusinessId,
  formatBusinessId,
  nextBusinessSequence,
  describePrimaryAggregate,
  describeSecondaryAggregates,
  validateDependencyGraph,
  acquireAggregateLock,
  releaseAggregateLock,
  bumpAggregateVersion,
  currentAggregateVersion,
  ensureIdentifierState,
  canGenerateDelegated,
  requestDelegation,
  advanceDelegation,
  createEmergencyDelegation,
  expireDelegations,
  registerIdentifier,
  linkExternalReference,
  IDENTIFIER_OWNERS,
  BUSINESS_PREFIXES
} from "../src/core/identifiers.js";
import { enqueueSyncItem, processSyncQueue, detectConflicts } from "../src/core/sync-ops.js";

const uid = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 7)}`;
const owner = { id: "u-owner", role: "SystemOwner", systemOwner: true, username: "john" };
const kba = { id: "u-kba", role: "KBA", username: "kba" };
const maker = { id: "u-md", role: "ManagingDirector", username: "ama" };

function blank() {
  return {
    settings: { currency: "GHS" },
    customers: [{ id: "c-a", name: "Ama", active: true }],
    devices: [{ id: "dev-1", fingerprint: "fp-1", active: true, localSequence: 0 }],
    offlineQueue: []
  };
}

test("technical ids are unique uuid-shaped values and legacy ids remain valid", () => {
  const a = generateTechnicalId();
  const b = generateTechnicalId(Date.now() + 1);
  assert.notEqual(a, b);
  assert.equal(isTechnicalId(a), true);
  assert.equal(isTechnicalId("col-abc123"), true);
  assert.equal(isTechnicalId("u-owner"), true);
  assert.equal(isBusinessId(formatBusinessId("COL", "KSI", 2026, 1245)), true);
  assert.equal(isBusinessId("RCP-00000001"), true);
  assert.equal(isBusinessId("TMP-RCP-00000001"), true);
});

test("business sequences are branch-year scoped and never reused in-process", () => {
  const state = blank();
  const first = nextBusinessSequence(state, "COL", "KSI");
  const second = nextBusinessSequence(state, "COL", "KSI");
  assert.equal(first.sequence, 1);
  assert.equal(second.sequence, 2);
  assert.match(first.value, /^COL-KSI-\d{4}-00000001$/);
});

test("collections use savings account as the primary aggregate", () => {
  const primary = describePrimaryAggregate("collection", { customerId: "c-a", groupId: "g-1", userId: "u-1" });
  assert.equal(primary.type, "SAVINGS_ACCOUNT");
  assert.equal(primary.id, "c-a");
  const secondary = describeSecondaryAggregates("collection", { customerId: "c-a", groupId: "g-1", userId: "u-1" });
  assert.ok(secondary.some((item) => item.type === "CUSTOMER"));
  assert.ok(secondary.some((item) => item.type === "USER"));
});

test("hard dependencies block; soft dependencies do not; cycles are rejected", () => {
  assert.equal(validateDependencyGraph([
    { id: "a", dependsOn: ["b"] },
    { id: "b", dependsOn: ["a"] }
  ]).ok, false);
  assert.equal(validateDependencyGraph([
    { id: "a" },
    { id: "b", dependsOn: ["a"] }
  ]).ok, true);
  const state = blank();
  enqueueSyncItem(state, {
    kind: "collection",
    idempotencyKey: "soft",
    payload: { customerId: "c-a", id: "col-s" },
    deviceId: "dev-1",
    dependencies: [{ id: "missing-note", type: "soft" }]
  }, uid);
  processSyncQueue(state, () => true, { deviceId: "dev-1", uid });
  assert.equal(state.offlineQueue.find((item) => item.idempotencyKey === "soft").status, "applied");
  enqueueSyncItem(state, {
    kind: "collection",
    id: "tx-a",
    idempotencyKey: "cyc-a",
    payload: { customerId: "c-a", id: "col-a" },
    deviceId: "dev-1",
    dependsOn: ["tx-b"]
  }, uid);
  const cyclic = enqueueSyncItem(state, {
    kind: "collection",
    id: "tx-b",
    idempotencyKey: "cyc-b",
    payload: { customerId: "c-a", id: "col-b" },
    deviceId: "dev-1",
    dependsOn: ["tx-a"]
  }, uid);
  assert.match(cyclic.error || "", /Circular/i);
});

test("missing hard dependency and cross-device version mismatch are conflicts", () => {
  const state = blank();
  enqueueSyncItem(state, {
    kind: "collection",
    idempotencyKey: "hard-miss",
    payload: { customerId: "c-a", id: "col-h" },
    deviceId: "dev-1",
    dependsOn: ["does-not-exist"]
  }, uid);
  const reasons = detectConflicts(state, state.offlineQueue[0]);
  assert.ok(reasons.includes("missing_hard_dependency"));
  bumpAggregateVersion(state, "SAVINGS_ACCOUNT", "c-a", "other-device");
  state.offlineQueue[0].expectedVersion = 1;
  state.offlineQueue[0].dependsOn = [];
  state.offlineQueue[0].primaryAggregateType = "SAVINGS_ACCOUNT";
  state.offlineQueue[0].primaryAggregateId = "c-a";
  const versionReasons = detectConflicts(state, state.offlineQueue[0]);
  assert.ok(versionReasons.includes("version_mismatch"));
  assert.equal(currentAggregateVersion(state, "SAVINGS_ACCOUNT", "c-a") > 1, true);
});

test("aggregate locks prevent concurrent writers", () => {
  const state = blank();
  const first = acquireAggregateLock(state, "SAVINGS_ACCOUNT", "c-a", "txn-1");
  assert.equal(first.ok, true);
  const second = acquireAggregateLock(state, "SAVINGS_ACCOUNT", "c-a", "txn-2");
  assert.match(second.error, /locked/i);
  releaseAggregateLock(state, "SAVINGS_ACCOUNT", "c-a", "txn-1");
  assert.equal(acquireAggregateLock(state, "SAVINGS_ACCOUNT", "c-a", "txn-2").ok, true);
});

test("offline clients cannot generate journal numbers; receipts are delegated", () => {
  const state = blank();
  ensureIdentifierState(state);
  assert.equal(canGenerateDelegated(state, "journal_number", { online: false }).ok, false);
  assert.equal(canGenerateDelegated(state, "temporary_receipt", { component: "Authorized Android Agent Application", deviceId: "dev-1", online: false }).ok, true);
  const xref = linkExternalReference(state, { system: "momo", value: "MTN-99", internalId: "col-1", internalType: "transaction_id" }, uid);
  assert.equal(xref.value, "MTN-99");
});

test("delegation uses maker-checker and emergency expiry", () => {
  const state = blank();
  const created = requestDelegation(state, {
    identifierType: "import_batch",
    component: "Import utility",
    justification: "Year-end migration",
    risk: "Low"
  }, maker, uid);
  assert.equal(created.ok, true);
  assert.equal(advanceDelegation(state, created.delegation.id, "approved", maker, uid).error !== undefined, true);
  ["submitted", "risk_assessment", "pending_approval"].forEach((step) => {
    assert.equal(advanceDelegation(state, created.delegation.id, step, maker, uid).ok, true);
  });
  assert.equal(advanceDelegation(state, created.delegation.id, "approved", owner, uid).ok, true);
  assert.equal(advanceDelegation(state, created.delegation.id, "activated", owner, uid).ok, true);
  const emergency = createEmergencyDelegation(state, {
    identifierType: "local_sync_session",
    component: "Field tablet",
    justification: "Outage"
  }, owner, uid, { hours: 0 });
  expireDelegations(state, Date.now() + 1000);
  assert.equal(state.identifierDelegations.find((item) => item.id === emergency.delegation.id).status, "revoked");
});

test("financial identifiers are never reused and ownership is catalogued", () => {
  const state = blank();
  assert.equal(registerIdentifier(state, { type: "receipt_number", value: "RCP-00000001" }, uid).ok, true);
  assert.match(registerIdentifier(state, { type: "receipt_number", value: "RCP-00000001" }, uid).error, /already assigned/);
  assert.equal(IDENTIFIER_OWNERS.audit_id, "Audit Engine");
  assert.equal(IDENTIFIER_OWNERS.job_id, "Scheduler Engine");
  assert.equal(BUSINESS_PREFIXES.Receipt, "RCP");
  assert.equal(canAction({ role: "Auditor" }, "Identifier.View"), true);
  assert.equal(canAction({ role: "Collector" }, "Identifier.Approve"), false);
  assert.equal(canAction(owner, "Identifier.Approve"), true);
});
