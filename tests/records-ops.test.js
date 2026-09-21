import test from "node:test";
import assert from "node:assert/strict";
import { canAction } from "../src/core/rbac.js";
import { canTransitionRecord, assertRecordsLifecycleBoundary } from "../src/core/records-lifecycle.js";
import {
  ensureRecordsState,
  uploadRecord,
  versionRecord,
  compareRecordVersions,
  rollbackRecordVersion,
  archiveRecord,
  restoreRecord,
  deleteRecord,
  placeLegalHold,
  releaseLegalHold,
  searchRecords,
  previewRecord,
  createDownloadLink,
  downloadRecord,
  applyRetention,
  recordsDashboard,
  assertRecordsBoundary
} from "../src/core/records-ops.js";
import "../src/core/records-api.js";
import { invokeContract, getContract } from "../src/core/module-contracts.js";
import { dispatchGatewayRequest, ensureGatewayState } from "../src/core/api-gateway-ops.js";

const uid = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 7)}`;
const owner = { id: "u-owner", role: "SystemOwner", systemOwner: true, username: "john" };
const bm = { id: "u-bm", role: "Admin", username: "ama", branchId: "br-1" };
const collector = { id: "u-col", role: "Collector", username: "yaw", branchId: "br-1" };
const now = "2026-09-11T08:00:00.000Z";

function blank() {
  const state = {
    settings: { currency: "GHS", loanInterest: 15, collectionDays: 31 },
    collections: [{ id: "col-1", customerId: "c-a", date: "2026-09-11", amount: 20, branchId: "br-1" }],
    customers: [{ id: "c-a", name: "Ama", phone: "0200000001", active: true, branchId: "br-1" }],
    documents: [{
      id: "doc-1",
      type: "savings_collection_receipt",
      category: "financial",
      receiptNo: "R-100",
      customerId: "c-a",
      branchId: "br-1",
      status: "issued",
      contentHash: "hash-1",
      createdAt: now
    }],
    loans: [],
    audit: [],
    notifications: [],
    featureFlags: [{ id: "enableDigitalRecords", enabled: true }]
  };
  ensureGatewayState(state);
  ensureRecordsState(state);
  return state;
}

test("only documented record transitions are permitted and engines stay off the ledger", () => {
  assert.equal(canTransitionRecord("uploaded", "validated"), true);
  assert.equal(canTransitionRecord("active", "archived"), true);
  assert.equal(canTransitionRecord("archived", "active"), true);
  assert.equal(canTransitionRecord("retired", "active"), false);
  assert.equal(assertRecordsLifecycleBoundary().postsCollections, false);
  assert.equal(assertRecordsLifecycleBoundary().generatesReceipts, false);
  assert.equal(assertRecordsBoundary().legalHold, true);
  assert.equal(canAction(owner, "Records.Upload"), true);
  assert.equal(canAction(collector, "Records.Upload"), true);
  assert.equal(canAction(collector, "Records.Delete"), false);
  assert.equal(canAction(bm, "Records.Archive"), true);
});

test("upload, version, compare, rollback, and malware scan do not post collections", () => {
  const state = blank();
  const before = state.collections.length;
  const blocked = uploadRecord(state, {
    type: "national_id",
    fileName: "id.txt",
    mimeType: "text/plain",
    content: "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*",
    ownerId: "c-a",
    branchId: "br-1"
  }, owner, uid, now);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.errorCode, "REC-007");

  const uploaded = uploadRecord(state, {
    type: "national_id",
    fileName: "ama-id.txt",
    mimeType: "text/plain",
    content: "Ghana Card GHA-123",
    ownerId: "c-a",
    tags: ["kyc"],
    branchId: "br-1"
  }, owner, uid, now);
  assert.equal(uploaded.ok, true);
  assert.equal(uploaded.record.status, "active");
  assert.equal(uploaded.record.version, "1.0");

  const next = versionRecord(state, {
    recordId: uploaded.record.id,
    content: "Ghana Card GHA-123-UPDATED",
    bump: "minor"
  }, owner, uid, now);
  assert.equal(next.ok, true);
  assert.equal(next.record.version, "1.1");
  assert.equal(state.digitalRecordVersions.filter((item) => item.recordId === uploaded.record.id).length, 2);

  const compared = compareRecordVersions(state, uploaded.record.id, uploaded.version.id, next.version.id, owner);
  assert.equal(compared.ok, true);
  assert.equal(compared.identical, false);

  const rolled = rollbackRecordVersion(state, uploaded.record.id, uploaded.version.id, owner, uid, now);
  assert.equal(rolled.ok, true);
  assert.equal(rolled.record.version, "1.2");
  assert.equal(state.collections.length, before);
  assert.equal(state.collections[0].amount, 20);
});

test("search, preview, download links, archive, restore, and generated receipt indexing", () => {
  const state = blank();
  uploadRecord(state, {
    type: "customer_photograph",
    fileName: "ama.jpg",
    mimeType: "image/jpeg",
    content: "photo-bytes",
    ownerId: "c-a",
    tags: ["photo"]
  }, owner, uid, now);
  const found = searchRecords(state, { customerId: "c-a", tag: "photo" }, owner);
  assert.equal(found.ok, true);
  assert.ok(found.rows.some((item) => item.type === "customer_photograph"));
  const indexed = searchRecords(state, { customerId: "c-a" }, owner);
  assert.ok(indexed.rows.some((item) => item.sourceModule === 17 && item.documentNumber === "R-100"));

  const record = found.rows.find((item) => item.type === "customer_photograph");
  const preview = previewRecord(state, record.id, owner, uid, now);
  assert.equal(preview.ok, true);
  assert.equal(preview.integrity, "valid");

  const link = createDownloadLink(state, record.id, owner, uid, now);
  assert.equal(link.ok, true);
  const expired = downloadRecord(state, record.id, link.link.token, owner, uid, Date.parse(now) + 400000);
  assert.equal(expired.ok, false);
  assert.equal(expired.errorCode, "REC-009");
  const fresh = createDownloadLink(state, record.id, owner, uid, now);
  const downloaded = downloadRecord(state, record.id, fresh.link.token, owner, uid, now);
  assert.equal(downloaded.ok, true);
  assert.equal(downloaded.content, "photo-bytes");

  const archived = archiveRecord(state, record.id, owner, uid, now);
  assert.equal(archived.ok, true);
  const restored = restoreRecord(state, record.id, owner, uid, now);
  assert.equal(restored.ok, true);
  assert.equal(restored.record.status, "active");
});

test("legal hold, retention, branch isolation, contracts, and gateway stay centralized", () => {
  const state = blank();
  const uploaded = uploadRecord(state, {
    type: "audit_report",
    fileName: "audit.txt",
    mimeType: "text/plain",
    content: "audit-evidence",
    branchId: "br-1"
  }, owner, uid, now);
  const hold = placeLegalHold(state, { recordId: uploaded.record.id, reason: "Investigation" }, owner, uid, now);
  assert.equal(hold.ok, true);
  const blocked = deleteRecord(state, uploaded.record.id, owner, uid, now);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.errorCode, "REC-005");
  releaseLegalHold(state, hold.hold.id, owner, uid, now);

  const other = { id: "u-bm2", role: "Admin", username: "kofi", branchId: "br-2" };
  const denied = searchRecords(state, { type: "audit_report" }, other);
  assert.equal(denied.ok, true);
  assert.equal(denied.rows.length, 0);
  const cross = uploadRecord(state, {
    type: "branch_document",
    content: "secret",
    mimeType: "text/plain",
    branchId: "br-1"
  }, other, uid, now);
  assert.equal(cross.ok, false);
  assert.equal(cross.errorCode, "REC-003");

  uploaded.record.uploadedAt = "2020-01-01T00:00:00.000Z";
  const retention = applyRetention(state, owner, uid, now);
  assert.equal(retention.ok, true);
  assert.ok(retention.archived >= 1);

  assert.ok(getContract("Records.Upload.v1"));
  const invoked = invokeContract(state, {
    contractId: "Records.Search.v1",
    fromModule: 20,
    payload: { type: "audit_report" }
  }, { uid, now, user: owner });
  assert.equal(invoked.ok, true);
  const gateway = dispatchGatewayRequest(state, {
    route: "records.statistics",
    version: "v1",
    user: owner
  }, { uid, now, user: owner });
  assert.equal(gateway.ok, true);
  assert.ok(recordsDashboard(state, owner).total >= 1);
  assert.equal(state.settings.loanInterest, 15);
  assert.equal(state.settings.collectionDays, 31);
  assert.equal(state.collections[0].amount, 20);
});
