import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { canHardDeleteCustomers } from "../src/core/customer-crm.js";

globalThis.document ??= { querySelector: () => null };
const memory = new Map();
globalThis.localStorage ??= {
  getItem: (k) => (memory.has(k) ? memory.get(k) : null),
  setItem: (k, v) => memory.set(k, String(v)),
  removeItem: (k) => memory.delete(k)
};
const { mergeStates } = await import("../src/core/state.js");

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const app = readFileSync(join(root, "app.js"), "utf8");

function functionBody(name) {
  const start = app.search(new RegExp(`\\n(async )?function ${name}\\(`));
  assert.ok(start >= 0, `${name} not found in app.js`);
  const next = app.slice(start + 1).search(/\n(async )?function \w+\(/);
  return next < 0 ? app.slice(start) : app.slice(start, start + 1 + next);
}

function handlerBlock(selector) {
  const start = app.indexOf(`document.querySelectorAll("[${selector}]")`);
  assert.ok(start >= 0, `${selector} handler not found`);
  return app.slice(start, start + 400);
}

test("only the system owner can permanently delete members", () => {
  assert.equal(canHardDeleteCustomers({ role: "SystemOwner" }), true);
  assert.equal(canHardDeleteCustomers({ role: "Collector", systemOwner: true }), true);
  for (const role of ["KBA", "Admin", "Collector", "Accountant", "CustomerService", "ManagingDirector"]) {
    assert.equal(canHardDeleteCustomers({ role }), false, role);
  }
  assert.equal(canHardDeleteCustomers(null), false);
});

test("non-owners can only close a member, keeping its financial history", () => {
  const body = functionBody("deleteCustomer");
  assert.match(body, /if \(!canHardDeleteCustomers\(currentUser\(\)\)\) \{[\s\S]*setCustomerStatus\(customer, "Closed"/);
  assert.match(body, /toast\("You cannot delete this member"\)/);
  assert.match(body, /logAudit\("Member deleted"/);
});

test("a member deleted on one device stays deleted after merging with another device", () => {
  const createdAt = "2026-09-27T07:18:31.273Z";
  const otherDevice = {
    customers: [{ id: "c1", name: "Two Device Member", createdAt, updatedAt: createdAt }],
    collections: [{ id: "col1", customerId: "c1", amount: 500, createdAt }]
  };
  const deletingDevice = {
    customers: [],
    collections: [],
    deletedRecords: [
      { id: "t1", collection: "customers", recordId: "c1", deletedAt: "2026-09-28T15:00:00.000Z" },
      { id: "t2", collection: "collections", recordId: "col1", deletedAt: "2026-09-28T15:00:00.000Z" }
    ]
  };
  for (const merged of [mergeStates(otherDevice, deletingDevice), mergeStates(deletingDevice, otherDevice)]) {
    assert.deepEqual(merged.customers, []);
    assert.deepEqual(merged.collections, []);
    assert.equal(merged.deletedRecords.length, 2);
  }
});

test("a member edited after the delete is kept rather than silently lost", () => {
  const merged = mergeStates(
    { customers: [{ id: "c1", name: "Edited later", updatedAt: "2026-09-28T16:00:00.000Z" }] },
    { customers: [], deletedRecords: [{ id: "t1", collection: "customers", recordId: "c1", deletedAt: "2026-09-28T15:00:00.000Z" }] }
  );
  assert.equal(merged.customers.length, 1);
});

test("deleting customers uploads the tombstone straight away", () => {
  assert.match(functionBody("deleteCustomer"), /saveState\(\);\s*pushCloudBackup\(false\);/);
  assert.match(functionBody("handleBulkCustomerDelete"), /tombstoneRecord\("customers", customer\)[\s\S]*saveState\(\);\s*pushCloudBackup\(false\);/);
});

test("admin accounts with money records or locations cannot be deleted", () => {
  const body = functionBody("deleteUser");
  assert.match(body, /canDeleteUserAccount\(actor, user\)/);
  assert.match(body, /if \(ownsGroup \|\| hasTransactions\) \{[\s\S]*Disable instead of deleting/);
  assert.match(body, /state\.deletedUsers\.push\(/);
});

test("customer card actions stop the click reaching the card", () => {
  for (const selector of ["data-edit-customer", "data-delete-customer", "data-reassign-customer", "data-member-detail"]) {
    assert.match(handlerBlock(selector), /addEventListener\("click", \(event\) => \{\s*event\.stopPropagation\(\);/, selector);
  }
});

test("camera and signature handlers bind only once per form", () => {
  assert.match(functionBody("attachPassportPhotoHandlers"), /if \(!root \|\| root\.dataset\.passportHandlersBound === "1"\) return;\s*root\.dataset\.passportHandlersBound = "1";/);
  assert.match(functionBody("initMemberSignaturePad"), /canvas\.dataset\.padReady === "1"\) return;\s*canvas\.dataset\.padReady = "1";/);
});

test("member registration ignores a second Save tap while the first is still saving", () => {
  const body = functionBody("handleCustomer");
  const guard = body.indexOf('if (form.dataset.submitting === "1") return;');
  const work = body.indexOf("resolvePassportPhotoFromForm(form)");
  assert.ok(guard > 0 && guard < work, "in-flight guard must run before async media work starts");
  assert.match(body, /\.finally\(\(\) => \{\s*delete form\.dataset\.submitting;/);
});

test("uploads never overlap and keep edits made while an upload is running", () => {
  const body = functionBody("pushCloudBackup");
  assert.match(body, /if \(cloudPushInFlight \|\| syncBusy\) \{/);
  assert.match(body, /const merged = mergeStates\(localState, state\);/);
  assert.match(functionBody("autoCloudMerge"), /if \(syncBusy \|\| cloudPushInFlight \|\|/);
});
