import test from "node:test";
import assert from "node:assert/strict";
import { canonicalPayload, relationalLoad, staffSession, tableRows } from "./helpers/sync-fixtures.mjs";

const memory = new Map();
globalThis.document ??= { querySelector: () => null };
globalThis.localStorage ??= {
  getItem: (k) => (memory.has(k) ? memory.get(k) : null),
  setItem: (k, v) => memory.set(k, String(v)),
  removeItem: (k) => memory.delete(k)
};
globalThis.sessionStorage ??= globalThis.localStorage;

const { App } = await import("../src/context.js");
const { pushCloudBackup } = await import("../src/sync/cloud.js");
const { SESSION_KEY } = await import("../src/sync/supabase-auth.js");

function setupState() {
  memory.clear();
  App.state = {
    settings: {
      cloudMode: "supabase",
      cloudUrl: "https://example.supabase.co",
      cloudKey: "anon",
      syncAccessKey: "key",
      businessId: "biz-1"
    },
    users: [],
    customers: [{ id: "c1", name: "Ama", accountNo: "c13000001", phone: "0241234567" }]
  };
  App.syncBusy = false;
}

function mockFetch(handlers) {
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    const method = options.method || "GET";
    calls.push({ method, url });
    const handler = handlers[method];
    const { status = 200, body = [] } = handler ? handler(url, options) : {};
    return new Response(status === 204 ? null : JSON.stringify(body), { status });
  };
  return calls;
}

const existingRow = { business_id: "biz-1", payload: { customers: [] }, saved_at: "2026-10-01T00:00:00Z" };

test("save never creates the first snapshot when the cloud has no row", async () => {
  setupState();
  const calls = mockFetch({
    GET: () => ({ body: [] }),
    PATCH: () => ({ body: [] }),
    POST: () => ({ status: 201 })
  });
  await assert.rejects(pushCloudBackup(false), /No cloud copy exists yet/);
  assert.deepEqual(calls.map((c) => c.method), ["GET"]);
});

/** A manager session, a canonical cloud row, and a database with one member more than the cloud copy. */
function setupManagerSync() {
  setupState();
  localStorage.setItem(SESSION_KEY, JSON.stringify(staffSession({ business: "biz-1" })));
  const load = relationalLoad();
  load.customers.push({ ...load.customers[0], id: "db-member-002", accountNo: "ST-1002" });
  const canonicalRow = { id: 7, business_id: "biz-1", payload: canonicalPayload(relationalLoad(), "biz-1"), saved_at: "2026-10-01T00:00:00Z" };
  const database = (url) => {
    if (url.includes("/rpc/fetch_business_snapshot")) return { body: load };
    if (url.includes("/rest/v1/customers?")) return { body: tableRows(load).customers };
    if (url.includes("/rest/v1/collections?")) return { body: tableRows(load).collections };
    return null;
  };
  return { canonicalRow, database };
}
const snapshotCalls = (calls) => calls.filter((c) => String(c.url).includes("/smile_trust_cloud_snapshots")).map((c) => c.method);

test("save stops after a successful update of an existing row", async () => {
  const { canonicalRow, database } = setupManagerSync();
  const calls = mockFetch({
    GET: (url) => database(url) || { body: [canonicalRow] },
    POST: (url) => database(url) || { status: 201 },
    PATCH: () => ({ body: [{ id: 7 }] })
  });
  await pushCloudBackup(false);
  assert.deepEqual(snapshotCalls(calls), ["GET", "PATCH"]);
  assert.match(calls.find((c) => c.method === "PATCH").url, /select=id/);
});

test("save fails rather than inserting when the update matched no row", async () => {
  const { canonicalRow, database } = setupManagerSync();
  const calls = mockFetch({
    GET: (url) => database(url) || { body: [canonicalRow] },
    POST: (url) => database(url) || { status: 201 },
    PATCH: () => ({ body: [] })
  });
  await assert.rejects(pushCloudBackup(false), /matched no snapshot row/);
  assert.deepEqual(snapshotCalls(calls), ["GET", "PATCH"]);
});

test("a device holding only the legacy access key never writes the snapshot", async () => {
  setupState();
  const calls = mockFetch({
    GET: () => ({ body: [existingRow] }),
    PATCH: () => ({ body: [{ id: 7 }] }),
    POST: () => ({ status: 201 })
  });
  await assert.rejects(pushCloudBackup(false), /Sign in online as a manager/);
  assert.deepEqual(calls.map((c) => c.method), ["GET"]);
});
