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

test("save inserts a snapshot when the update matched no row", async () => {
  setupState();
  const calls = mockFetch({
    GET: () => ({ body: [] }),
    PATCH: () => ({ body: [] }),
    POST: () => ({ status: 201 })
  });
  await pushCloudBackup(false);
  const methods = calls.map((c) => c.method);
  assert.deepEqual(methods, ["GET", "PATCH", "POST"]);
  assert.match(calls[1].url, /select=id/);
  assert.match(calls[2].url, /on_conflict=business_id/);
});

test("save stops after a successful update of an existing row", async () => {
  setupState();
  const calls = mockFetch({
    GET: () => ({ body: [] }),
    PATCH: () => ({ body: [{ id: 7 }] }),
    POST: () => ({ status: 201 })
  });
  await pushCloudBackup(false);
  assert.deepEqual(calls.map((c) => c.method), ["GET", "PATCH"]);
});
