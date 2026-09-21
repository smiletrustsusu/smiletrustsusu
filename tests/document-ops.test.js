import test from "node:test";
import assert from "node:assert/strict";
import { canAction } from "../src/core/rbac.js";
import { canPerformOffline, enqueueSyncItem, processSyncQueue, promoteReceipt } from "../src/core/sync-ops.js";
import { buildReceiptNo } from "../src/core/receipts.js";
import {
  ensureDocumentState,
  generateDocument,
  registerBusinessDocument,
  generateStatement,
  verifyDocumentQr,
  signDocument,
  issueDocument,
  searchDocuments,
  reconcileOfflineReceipt,
  rejectTemporaryReceipt,
  cancelTemporaryReceipt,
  createRefundReceipt,
  createReversalReceipt,
  requestReceiptAction,
  decideReceiptApproval,
  canTransitionDocument,
  assertDocumentEngineBoundary,
  documentReports,
  exportDocumentCsv,
  publishTemplate,
  upsertTemplate,
  processDocumentQueue
} from "../src/core/document-ops.js";

const uid = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 7)}`;
const owner = { id: "u-owner", role: "SystemOwner", systemOwner: true, username: "john" };
const accountant = { id: "u-acc", role: "Accountant", username: "ama" };
const checker = { id: "u-chk", role: "Accountant", username: "kofi" };
const collector = { id: "u-col", role: "Collector", username: "yaw" };
const now = "2026-09-10T16:00:00.000Z";

function blank() {
  const state = {
    settings: { currency: "GHS", loanInterest: 15, businessName: "Smile Trust" },
    customers: [{ id: "c-a", name: "Ama", active: true, accountNo: "ST-0001" }],
    collections: [],
    loans: [],
    documents: []
  };
  ensureDocumentState(state);
  return state;
}

test("document engine is centralized and never stores customer PINs", () => {
  const boundary = assertDocumentEngineBoundary();
  assert.equal(boundary.centralized, true);
  assert.equal(boundary.restApi, false);
  assert.equal(boundary.graphql, false);
  assert.equal(boundary.wrapsBuildReceiptNo, true);
  const state = blank();
  const rejected = generateDocument(state, {
    type: "savings_collection_receipt",
    amount: 10,
    customerId: "c-a",
    pin: "1234",
    accountingPosted: true
  }, owner, uid, now);
  assert.equal(rejected.ok, false);
  assert.match(rejected.error, /never request or store/i);
});

test("collection receipts reuse buildReceiptNo and do not create a second number", () => {
  const state = blank();
  const receiptNo = buildReceiptNo(state, "RCP");
  const first = registerBusinessDocument(state, {
    type: "savings_collection_receipt",
    receiptNo,
    amount: 20,
    customerId: "c-a",
    customerName: "Ama",
    businessType: "collection",
    businessId: "col-1",
    accountingAlreadyPosted: true
  }, owner, uid, now);
  const again = registerBusinessDocument(state, {
    type: "savings_collection_receipt",
    receiptNo,
    amount: 20,
    customerId: "c-a",
    businessType: "collection",
    businessId: "col-1",
    accountingAlreadyPosted: true
  }, owner, uid, now);
  assert.equal(first.ok, true);
  assert.equal(first.document.receiptNo, receiptNo);
  assert.equal(first.document.status, "issued");
  assert.equal(again.duplicate, true);
  assert.equal(state.documents.length, 1);
});

test("offline receipts map to exactly one permanent number and duplicates return the original", () => {
  const state = blank();
  const created = generateDocument(state, {
    type: "savings_collection_receipt",
    amount: 15,
    customerId: "c-a",
    customerName: "Ama",
    offline: true,
    temporaryReceiptNo: "TMP-RCP-0001",
    localTransactionId: "col-off",
    businessType: "collection",
    businessId: "col-off",
    deviceId: "dev-1",
    accountingPosted: true,
    businessCommitted: true
  }, owner, uid, now);
  assert.equal(created.document.status, "generated");
  assert.equal(created.document.offline, true);
  const first = reconcileOfflineReceipt(state, {
    temporaryReceiptNo: "TMP-RCP-0001",
    permanentReceiptNo: "RCP-BRH01-2026-004582",
    localTransactionId: "col-off",
    serverTransactionId: "col-off",
    user: owner,
    uid,
    now
  });
  const second = reconcileOfflineReceipt(state, {
    temporaryReceiptNo: "TMP-RCP-0001",
    permanentReceiptNo: "RCP-BRH01-2026-999999",
    user: owner,
    uid,
    now
  });
  assert.equal(first.ok, true);
  assert.equal(second.duplicate, true);
  assert.equal(second.permanentReceiptNo, "RCP-BRH01-2026-004582");
  assert.equal(state.receiptReconciliation.length, 1);
  assert.equal(created.document.permanentReceiptNo, "RCP-BRH01-2026-004582");
  assert.equal(searchDocuments(state, { q: "TMP-RCP-0001" }).length, 1);
  assert.equal(searchDocuments(state, { q: "RCP-BRH01-2026-004582" }).length, 1);
});

test("rejected and cancelled transactions never receive a permanent receipt", () => {
  const state = blank();
  generateDocument(state, {
    type: "savings_collection_receipt",
    amount: 8,
    offline: true,
    temporaryReceiptNo: "TMP-REJ-1",
    businessType: "collection",
    businessId: "col-rej",
    accountingPosted: false,
    businessCommitted: false
  }, owner, uid, now);
  const rejected = rejectTemporaryReceipt(state, "TMP-REJ-1", { user: owner, uid, now, reason: "validation" });
  assert.equal(rejected.document.outcome, "rejected");
  assert.equal(rejected.document.permanentReceiptNo, "");
  generateDocument(state, {
    type: "savings_collection_receipt",
    amount: 8,
    offline: true,
    temporaryReceiptNo: "TMP-CAN-1",
    businessType: "collection",
    businessId: "col-can"
  }, owner, uid, now);
  const cancelled = cancelTemporaryReceipt(state, "TMP-CAN-1", { user: owner, uid, now, reason: "customer cancelled" });
  assert.equal(cancelled.document.outcome, "cancelled");
  const issued = issueDocument(state, cancelled.document.id, { user: owner, uid, now });
  assert.equal(issued.ok, false);
});

test("refunds and reversals create linked documents and leave the original immutable", () => {
  const state = blank();
  const original = registerBusinessDocument(state, {
    type: "savings_collection_receipt",
    receiptNo: "RCP-00000010",
    amount: 80,
    customerId: "c-a",
    businessType: "collection",
    businessId: "col-r",
    accountingAlreadyPosted: true
  }, owner, uid, now);
  const hash = original.document.contentHash;
  const partial = createRefundReceipt(state, original.document.id, { amount: 20, partial: true, user: owner, uid, now });
  assert.equal(partial.ok, true);
  assert.equal(original.document.amount, 80);
  assert.equal(original.document.receiptNo, "RCP-00000010");
  assert.equal(original.document.contentHash, hash);
  assert.equal(original.document.outcome, "partially_refunded");
  const full = createRefundReceipt(state, original.document.id, { user: owner, uid, now });
  assert.equal(full.ok, true);
  assert.equal(original.document.outcome, "fully_refunded");
  const overflow = createRefundReceipt(state, original.document.id, { amount: 1, partial: true, user: owner, uid, now });
  assert.equal(overflow.ok, false);
  const other = registerBusinessDocument(state, {
    type: "savings_collection_receipt",
    receiptNo: "RCP-00000011",
    amount: 50,
    customerId: "c-a",
    businessType: "collection",
    businessId: "col-rev",
    accountingAlreadyPosted: true
  }, owner, uid, now);
  const reversal = createReversalReceipt(state, other.document.id, { user: owner, uid, now });
  assert.equal(reversal.ok, true);
  assert.equal(other.document.outcome, "fully_reversed");
  assert.equal(other.document.amount, 50);
});

test("QR verification and signed documents stay authentic and immutable", () => {
  const state = blank();
  const issued = registerBusinessDocument(state, {
    type: "savings_collection_receipt",
    receiptNo: "RCP-QR-1",
    amount: 12,
    customerId: "c-a",
    customerName: "Ama",
    businessType: "collection",
    businessId: "col-qr",
    accountingAlreadyPosted: true
  }, owner, uid, now);
  const signed = signDocument(state, issued.document.id, { user: owner, uid, now });
  assert.equal(signed.ok, true);
  const verify = verifyDocumentQr(state, issued.document.qrToken);
  assert.equal(verify.authentic, true);
  assert.equal(verify.receiptNo, "RCP-QR-1");
  const illegal = createRefundReceipt(state, issued.document.id, { user: owner, uid, now });
  assert.equal(illegal.ok, true);
  assert.equal(issued.document.receiptNo, "RCP-QR-1");
  assert.equal(canTransitionDocument("failed", "completed"), false);
});

test("maker-checker blocks self-approval and collectors cannot refund", () => {
  const state = blank();
  const issued = registerBusinessDocument(state, {
    type: "savings_collection_receipt",
    receiptNo: "RCP-AP-1",
    amount: 30,
    customerId: "c-a",
    businessType: "collection",
    businessId: "col-ap",
    accountingAlreadyPosted: true
  }, owner, uid, now);
  assert.equal(canAction(collector, "Document.View"), true);
  assert.equal(canAction(collector, "Document.Refund"), false);
  const denied = requestReceiptAction(state, issued.document.id, "refund", { user: collector, uid, now });
  assert.equal(denied.ok, false);
  const pending = requestReceiptAction(state, issued.document.id, "refund", { user: accountant, uid, now });
  assert.equal(pending.pending, true);
  const self = decideReceiptApproval(state, pending.approval.id, { user: accountant, uid, now, approved: true });
  assert.equal(self.ok, false);
  const approved = decideReceiptApproval(state, pending.approval.id, { user: checker, uid, now, approved: true });
  assert.equal(approved.ok, true);
  assert.equal(canPerformOffline(state, "document.refund", { online: false }).ok, false);
});

test("statements, templates, and document reports stay on the engine", () => {
  const state = blank();
  state.collections.push({ id: "col-s", customerId: "c-a", amount: 5, date: "2026-09-01", receiptNo: "RCP-S", reversed: false });
  const statement = generateStatement(state, { customerId: "c-a", from: "2026-09-01", to: "2026-09-30", user: owner, uid, now });
  assert.equal(statement.ok, true);
  const edited = upsertTemplate(state, { id: "tpl-receipt", body: "<p>Updated {{receiptNo}}</p>" }, owner, uid, now);
  assert.equal(edited.pendingPublish, true);
  const published = publishTemplate(state, "tpl-receipt", { user: owner, uid, now, checker });
  assert.equal(published.ok, true);
  processDocumentQueue(state, { uid, now, user: owner });
  const report = documentReports(state, "documents_issued", { from: "2026-01-01", to: "2026-12-31" });
  assert.ok(exportDocumentCsv(report).includes("receiptNo"));
});

test("sync still maps temporary receipts without duplicating SRV numbers", () => {
  const state = blank();
  state.devices = [{ id: "dev-1", fingerprint: "fp-1", active: true, localSequence: 0 }];
  state.offlineQueue = [];
  enqueueSyncItem(state, {
    kind: "collection",
    idempotencyKey: "doc-sync",
    payload: { customerId: "c-a", id: "col-1", receiptNo: "RCP-00000001", temporaryReceiptNo: "RCP-00000001" },
    deviceId: "dev-1"
  }, uid);
  processSyncQueue(state, () => true, { deviceId: "dev-1", uid });
  assert.match(state.localReceipts[0].permanentReceiptNo, /^SRV-/);
  const again = promoteReceipt(state, "RCP-00000001", "SRV-99999999");
  assert.equal(again.duplicate, true);
  assert.match(state.localReceipts[0].permanentReceiptNo, /^SRV-/);
  assert.notEqual(state.localReceipts[0].permanentReceiptNo, "SRV-99999999");
});
