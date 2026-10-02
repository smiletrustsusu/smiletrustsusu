/**
 * Client side of migration 047 (blockers B1, B2, B4, B6, B7): collectors upload offline
 * collections through st_submit_collections, members with financial history are closed (never
 * deleted), posted loan disbursements are not rewritten, and staff changes are mirrored to the
 * server's app_users authority. Server enforcement is covered by
 * migration-047-security-hardening.test.js.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  SNAPSHOT_WRITER_ROLES,
  applySubmissionResult,
  canWriteSnapshot,
  pendingCollectionSubmissions,
  submissionBatches
} from "../src/sync/collection-submit.js";
import { customerHasFinancialHistory } from "../src/core/customer-crm.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const app = readFileSync(join(root, "app.js"), "utf8");
const legacyHandlers = readFileSync(join(root, "src/ui/handlers.js"), "utf8");
const migration = readFileSync(join(root, "supabase/migrations/047_security_hardening.sql"), "utf8");

function functionBody(source, name) {
  const start = source.search(new RegExp(`\\n(export )?(async )?function ${name}\\(`));
  assert.ok(start >= 0, `${name} not found`);
  const next = source.slice(start + 1).search(/\n(export )?(async )?function \w+\(/);
  return next < 0 ? source.slice(start) : source.slice(start, start + 1 + next);
}

test("snapshot writers match the server's manager roles exactly", () => {
  const server = /st_jwt_is_manager\(\)[\s\S]*?in \(([^)]*)\)/.exec(migration)[1].match(/'([A-Za-z]+)'/g).map((item) => item.slice(1, -1));
  assert.deepEqual([...SNAPSHOT_WRITER_ROLES].sort(), server.sort());
  for (const role of ["Collector", "Cashier", "CustomerService", "FieldSupervisor", "Auditor", "", undefined]) {
    assert.equal(canWriteSnapshot(role), false, String(role));
  }
});

test("pending submissions: own, unsynced, not refused; each with its ledger pair and mirrored transaction", () => {
  const state = {
    collections: [
      { id: "a", userId: "me", customerId: "c1" },
      { id: "b", userId: "me", customerId: "c1" },
      { id: "c", userId: "other", customerId: "c1" },
      { id: "d", userId: "me", customerId: "c1", cloudSyncStatus: "Rejected" }
    ],
    ledgerEntries: [
      { id: "la1", referenceId: "a", referenceType: "collection" },
      { id: "la2", referenceId: "a", referenceType: "collection" },
      { id: "lx", referenceId: "a", referenceType: "loan" },
      { id: "lb1", referenceId: "b", referenceType: "collection" }
    ],
    transactions: [{ id: "ta", ledgerEntryId: "la1" }, { id: "tz", ledgerEntryId: "unrelated" }]
  };
  const items = pendingCollectionSubmissions(state, { userId: "me", serverCollectionIds: ["b"] });
  assert.deepEqual(items.map((item) => item.collection.id), ["a"]);
  assert.deepEqual(items[0].ledgerEntries.map((entry) => entry.id), ["la1", "la2"]);
  assert.deepEqual(items[0].transactions.map((tx) => tx.id), ["ta"]);
  assert.deepEqual(pendingCollectionSubmissions(state, { userId: "" }), [], "no identity, nothing to submit");
});

test("submissions are batched within the server limit and results mark refused collections", () => {
  const items = Array.from({ length: 450 }, (_, i) => ({ collection: { id: `c${i}` } }));
  assert.deepEqual(submissionBatches(items).map((batch) => batch.length), [200, 200, 50]);
  const state = { collections: [{ id: "ok" }, { id: "bad" }] };
  const counts = applySubmissionResult(state, { accepted: ["ok"], duplicates: ["x"], rejected: [{ id: "bad", reason: "member is not active" }] }, "2026-09-30T00:00:00Z");
  assert.deepEqual(counts, { accepted: 1, duplicates: 1, rejected: 1 });
  assert.equal(state.collections[1].cloudSyncStatus, "Rejected");
  assert.equal(state.collections[1].cloudSyncError, "member is not active");
  assert.equal(state.collections[0].cloudSyncStatus, undefined);
});

test("financial history is detected across every money collection", () => {
  for (const key of ["collections", "transactions", "ledgerEntries", "loans", "withdrawalRequests", "collectionAdjustments"]) {
    assert.equal(customerHasFinancialHistory({ [key]: [{ customerId: "c1" }] }, "c1"), true, key);
  }
  assert.equal(customerHasFinancialHistory({ collections: [{ customerId: "c2" }], messages: [{ customerId: "c1" }] }, "c1"), false);
  assert.equal(customerHasFinancialHistory({}, ""), false);
});

test("members with financial history are closed, never deleted, even by the System Owner", () => {
  const body = functionBody(app, "deleteCustomer");
  assert.match(body, /const hasHistory = customerHasFinancialHistory\(state, customerId\);\s*if \(!canHardDeleteCustomers\(currentUser\(\)\) \|\| hasHistory\) \{/);
  assert.match(body, /setCustomerStatus\(customer, "Closed"/);
  for (const forbidden of ['tombstoneRecords("collections"', 'tombstoneRecords("loans"', 'tombstoneRecords("transactions"', "state.collections = state.collections.filter"]) {
    assert.equal(body.includes(forbidden), false, `no cascade: ${forbidden}`);
  }
  const bulk = functionBody(app, "handleBulkCustomerDelete");
  assert.match(bulk, /if \(!customer \|\| customerHasFinancialHistory\(state, id\)\) return;/);
  const legacy = functionBody(legacyHandlers, "deleteCustomer");
  assert.match(legacy, /if \(hasHistory\) \{\s*toast\(/);
  assert.equal(legacy.includes('tombstoneRecords("collections"'), false);
  assert.doesNotMatch(functionBody(legacyHandlers, "deleteCollection"), /tombstone|filter/);
});

test("a disbursed loan's member, principal and date cannot be rewritten; the posted transaction is never edited", () => {
  const body = functionBody(app, "handleLoan");
  assert.match(body, /const disbursed = state\.transactions\.some\(\(item\) => item\.ref === loan\.id && item\.type === "Loan Disbursement" && !item\.reversed\);/);
  assert.match(body, /if \(disbursed && \(Number\(loan\.principal\) !== principal \|\| loan\.customerId !== data\.customerId \|\| loan\.date !== loanDate\)\) \{/);
  assert.doesNotMatch(body, /tx\.amount = principal/);
});

test("staff create, edit, activate and disable are mirrored to the server's app_users", () => {
  const toggle = app.slice(app.indexOf('document.querySelectorAll("[data-toggle-user]")'), app.indexOf('document.querySelectorAll("[data-edit-user]")'));
  assert.match(toggle, /mirrorStaffAccount\(user\);/);
  const save = functionBody(app, "handleUser");
  assert.equal((save.match(/mirrorStaffAccount\(user\);/g) || []).length, 3, "edit, new collector and other new staff");
  const mirror = functionBody(app, "mirrorStaffAccount");
  assert.match(mirror, /pushStaffAccountToServer\(state, user\)/);
  assert.doesNotMatch(mirror, /password/i, "passwords are never mirrored");
});
