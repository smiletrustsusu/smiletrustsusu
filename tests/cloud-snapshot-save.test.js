import test from "node:test";
import assert from "node:assert/strict";

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

function setupState() {
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

test("save stops after a successful update of an existing row", async () => {
  setupState();
  const calls = mockFetch({
    GET: () => ({ body: [existingRow] }),
    PATCH: () => ({ body: [{ id: 7 }] }),
    POST: () => ({ status: 201 })
  });
  await pushCloudBackup(false);
  assert.deepEqual(calls.map((c) => c.method), ["GET", "PATCH"]);
  assert.match(calls[1].url, /select=id/);
});

test("save fails rather than inserting when the update matched no row", async () => {
  setupState();
  const calls = mockFetch({
    GET: () => ({ body: [existingRow] }),
    PATCH: () => ({ body: [] }),
    POST: () => ({ status: 201 })
  });
  await assert.rejects(pushCloudBackup(false), /matched no snapshot row/);
  assert.deepEqual(calls.map((c) => c.method), ["GET", "PATCH"]);
});
