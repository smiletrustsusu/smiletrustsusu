/**
 * Client side of the first cloud snapshot: the three cloud read states, no automatic first
 * snapshot, and the explicit, session-bound, integrity-checked manager bootstrap. Network is mocked.
 */
import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { canonicalPayload, relationalLoad, tableRows } from "./helpers/sync-fixtures.mjs";

const memory = new Map();
globalThis.document ??= { querySelector: () => null };
globalThis.localStorage = {
  getItem: (k) => (memory.has(k) ? memory.get(k) : null),
  setItem: (k, v) => memory.set(k, String(v)),
  removeItem: (k) => memory.delete(k)
};
globalThis.sessionStorage = globalThis.localStorage;

const { App } = await import("../src/context.js");
const { pushCloudBackup, readCloudSnapshotState, CLOUD_READ_FAILED, CLOUD_BOOTSTRAP_REQUIRED } = await import("../src/sync/cloud.js");
const bootstrap = await import("../src/sync/snapshot-bootstrap.js");
const { SESSION_KEY } = await import("../src/sync/supabase-auth.js");
const { LEGACY_SYNC_KEY_STORAGE } = await import("../src/config.js");

const BIZ = "SMILE-TRUST";
const b64url = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");

const RELATIONAL = {
  groups: [{ id: "demo-branch-accra", name: "Accra Main", active: true }],
  customers: [{ id: "demo-customer-001", accountNo: "ST-1001", name: "Demo Member", phone: "233200000001", groupId: "demo-branch-accra", collectorId: "demo-user-kwame", active: true, memberStatus: "Active" }],
  collections: [],
  users: [
    { id: "demo-user-john", username: "john", name: "System Owner", role: "SystemOwner", active: true, mfaSecret: "TEST-MARKER-MFA" },
    { id: "demo-user-kwame", username: "kwame", name: "Kwame Collector", role: "Collector", active: true }
  ],
  savingsProducts: [{ id: "SUSU-DAILY", code: "SUSU-DAILY", name: "Daily Susu" }]
};
const TABLE_ROWS = {
  customers: [{ client_id: "demo-customer-001", branch_id: "b-uuid", collector_id: "u-uuid" }],
  collections: []
};

function signIn({ role = "SystemOwner", appUserId = "demo-user-john", username = "john", business = BIZ, sessionId = "session-1" } = {}) {
  const claims = { role: "authenticated", sub: `auth-${appUserId}`, session_id: sessionId, app_metadata: { business_code: business, app_user_id: appUserId, app_role: role } };
  localStorage.setItem(SESSION_KEY, JSON.stringify({
    access_token: `${b64url({ alg: "none" })}.${b64url(claims)}.sig`,
    refresh_token: "refresh",
    expires_at: Date.now() + 3600_000,
    app_user: { id: appUserId, username, role }
  }));
}

function staleDevice(extra = {}) {
  return {
    settings: { cloudMode: "supabase", cloudUrl: "https://example.supabase.co", cloudKey: "anon", businessId: BIZ, loanInterest: 99, theme: "midnight" },
    users: [{ id: "u-owner", username: "JOHN", role: "SystemOwner", passwordHash: "pbkdf2:device-hash" }],
    customers: [{ id: "old-test-member", name: "Old", accountNo: "OLD-1", phone: "0240000000" }],
    collections: [{ id: "old-test-collection", customerId: "old-test-member", amount: 5 }],
    loans: [{ id: "old-test-loan", customerId: "old-test-member", principal: 100 }],
    transactions: [{ id: "old-test-tx", amount: 5 }],
    messages: [{ id: "old-test-message" }],
    deletedRecords: [{ collection: "customers", id: "demo-customer-001" }],
    ...extra
  };
}

/** routes: { snapshotGet: {status, body}, patch, post, rpc, customers, collections, submit } */
function mockNetwork(routes = {}) {
  const calls = [];
  globalThis.fetch = async (input, options = {}) => {
    const url = String(input);
    const method = options.method || "GET";
    calls.push({ method, url, body: options.body ? JSON.parse(options.body) : null, prefer: options.headers?.Prefer || "" });
    const pick = () => {
      if (url.includes("/rpc/fetch_business_snapshot")) return routes.rpc || { body: RELATIONAL };
      if (url.includes("/rpc/st_submit_collections")) return routes.submit || { body: { accepted: [], duplicates: [], rejected: [] } };
      if (url.includes("/rest/v1/customers?")) return routes.customers || { body: TABLE_ROWS.customers };
      if (url.includes("/rest/v1/collections?")) return routes.collections || { body: TABLE_ROWS.collections };
      if (url.includes("/smile_trust_cloud_snapshots")) {
        if (method === "GET") return routes.snapshotGet || { body: [] };
        if (method === "PATCH") return routes.patch || { body: [{ id: 1 }] };
        if (method === "POST") return routes.post || { status: 201, body: null };
      }
      return { status: 404, body: { message: "unexpected" } };
    };
    const { status = 200, body = null } = pick();
    return new Response(status === 201 || status === 204 || body === null ? null : JSON.stringify(body), { status });
  };
  return calls;
}

const writes = (calls) => calls.filter((c) => c.method !== "GET" && c.url.includes("/smile_trust_cloud_snapshots"));
const existing = (payload) => ({ body: [{ business_id: BIZ, payload, saved_at: "2026-10-01T00:00:00Z" }] });
const canonicalRow = () => ({ body: [{ id: 2, business_id: BIZ, payload: canonicalPayload(relationalLoad(), BIZ), saved_at: "2026-10-05T10:44:18.728+00:00" }] });
const refused = (pattern) => (error) => {
  assert.equal(error.code, bootstrap.BOOTSTRAP_REFUSED, error.message);
  if (pattern) assert.match(error.message, pattern);
  return true;
};

beforeEach(() => {
  memory.clear();
  bootstrap.discardVerifiedBootstrap();
  App.state = staleDevice();
  App.syncBusy = false;
});

// ------------------------------------------------------------------------------------------
// Cloud read states

test("the three cloud states are distinct: exists, missing, and a thrown read failure", async () => {
  signIn();
  mockNetwork({ snapshotGet: existing({ customers: [] }) });
  assert.equal((await readCloudSnapshotState()).status, "exists");
  mockNetwork({ snapshotGet: { body: [] } });
  assert.deepEqual(await readCloudSnapshotState(), { status: "missing", snapshot: null });
  mockNetwork({ snapshotGet: { status: 503, body: { message: "down" } } });
  await assert.rejects(readCloudSnapshotState(), (error) => error.code === CLOUD_READ_FAILED && /Nothing was uploaded/.test(error.message));
});

test("a failed cloud read stops a manager's sync: no insert, no update, local state untouched", async () => {
  signIn();
  const before = structuredClone(App.state);
  const calls = mockNetwork({ snapshotGet: { status: 500, body: { message: "boom" } } });
  await assert.rejects(pushCloudBackup(true), (error) => error.code === CLOUD_READ_FAILED);
  assert.deepEqual(writes(calls), []);
  assert.deepEqual(App.state, before);
});

test("a failed cloud read stops a collector's sync: nothing submitted, queued collections stay queued", async () => {
  signIn({ role: "Collector", appUserId: "demo-user-kwame", username: "kwame" });
  App.state = staleDevice({ collections: [{ id: "queued-1", customerId: "demo-customer-001", userId: "demo-user-kwame", amount: 5 }] });
  const calls = mockNetwork({ snapshotGet: { status: 503, body: {} } });
  await assert.rejects(pushCloudBackup(true), (error) => error.code === CLOUD_READ_FAILED);
  assert.equal(calls.some((c) => c.method !== "GET"), false);
  assert.equal(App.state.collections[0].cloudSyncStatus, undefined);
});

test("no cloud row: autosave never creates the first snapshot, from an empty, a stale or a legacy-key device", async () => {
  for (const [label, setup] of [
    ["empty manager", () => { signIn(); App.state = { settings: staleDevice().settings, users: [], customers: [] }; }],
    ["stale manager", () => { signIn(); App.state = staleDevice(); }],
    ["legacy key, no session", () => { memory.clear(); localStorage.setItem(LEGACY_SYNC_KEY_STORAGE, "legacy-device-key-0123456789abcdef"); App.state = staleDevice(); }],
    ["collector", () => { signIn({ role: "Collector", appUserId: "demo-user-kwame", username: "kwame" }); App.state = staleDevice(); }]
  ]) {
    setup();
    const calls = mockNetwork({ snapshotGet: { body: [] } });
    await assert.rejects(pushCloudBackup(true), (error) => error.code === CLOUD_BOOTSTRAP_REQUIRED, label);
    assert.deepEqual(calls.map((c) => c.method), ["GET"], `${label}: only the read`);
  }
});

test("with a canonical cloud row, a manager updates it in place from the database, never from this device", async () => {
  signIn();
  const load = relationalLoad();
  load.customers.push({ ...load.customers[0], id: "db-member-002", accountNo: "ST-1002" });
  const calls = mockNetwork({ rpc: { body: load }, customers: { body: tableRows(load).customers }, snapshotGet: canonicalRow() });
  await pushCloudBackup(true);
  assert.deepEqual(writes(calls).map((c) => c.method), ["PATCH"]);
  const { payload } = writes(calls)[0].body;
  assert.deepEqual(payload.customers.map((c) => c.id), ["demo-customer-001", "db-member-002"], "the stale device member is not uploaded");
  assert.doesNotMatch(JSON.stringify(payload), /old-test-|u-owner|midnight|pbkdf2/);
});

test("a non-canonical (older device-format) cloud row is never merged into or overwritten by ordinary sync", async () => {
  signIn();
  const olderFormat = existing({ customers: [{ id: "cloud-member", name: "Cloud", accountNo: "C-1", phone: "0241234568" }] });
  olderFormat.body[0].id = 1;
  const calls = mockNetwork({ snapshotGet: olderFormat });
  await assert.rejects(pushCloudBackup(false), /not in the canonical database format/);
  assert.deepEqual(writes(calls), []);
});

test("an update that matches no row fails instead of falling back to an insert", async () => {
  signIn();
  const load = relationalLoad();
  load.customers.push({ ...load.customers[0], id: "db-member-002", accountNo: "ST-1002" });
  const calls = mockNetwork({ rpc: { body: load }, customers: { body: tableRows(load).customers }, snapshotGet: canonicalRow(), patch: { body: [] } });
  await assert.rejects(pushCloudBackup(false), /matched no snapshot row/);
  assert.deepEqual(writes(calls).map((c) => c.method), ["PATCH"]);
});

test("a collector with a cloud row still submits through st_submit_collections and never writes the snapshot", async () => {
  signIn({ role: "Collector", appUserId: "demo-user-kwame", username: "kwame" });
  App.state = staleDevice({
    collections: [{ id: "queued-1", customerId: "demo-customer-001", userId: "demo-user-kwame", amount: 5, amountPesewas: 500, paymentMethod: "Cash", idempotencyKey: "k1" }],
    ledgerEntries: [
      { id: "led-q1-c", referenceId: "queued-1", referenceType: "collection", customerId: "demo-customer-001", amount: 5, direction: "credit", account: "customer:demo-customer-001" },
      { id: "led-q1-d", referenceId: "queued-1", referenceType: "collection", customerId: "", amount: 5, direction: "debit", account: "account:cash" }
    ],
    transactions: [{ id: "tx-q1", type: "Susu Deposit", customerId: "demo-customer-001", amount: 5, ref: "queued-1", ledgerEntryId: "led-q1-c" }]
  });
  const calls = mockNetwork({ snapshotGet: existing({ collections: [] }), submit: { body: { accepted: ["queued-1"], duplicates: [], rejected: [] } } });
  await pushCloudBackup(true);
  assert.ok(calls.some((c) => c.url.includes("/rpc/st_submit_collections")));
  assert.deepEqual(writes(calls), []);
});

// ------------------------------------------------------------------------------------------
// Explicit bootstrap

test("bootstrap without a verified database load in this session is refused", async () => {
  signIn();
  const calls = mockNetwork();
  await assert.rejects(bootstrap.createInitialCloudSnapshot({ confirmation: BIZ }), refused(/Load the business data/));
  assert.deepEqual(writes(calls), []);
});

test("stored markers from an earlier session never authorize the bootstrap; a reload needs a fresh load", async () => {
  signIn();
  App.state = staleDevice({ loadedFromPostgresAt: new Date().toISOString() });
  ["smile_trust_bootstrap_verified", "smile_trust_authoritative_load", "verifiedLoad"].forEach((key) => localStorage.setItem(key, "true"));
  mockNetwork();
  await bootstrap.loadVerifiedBootstrap();
  const reloaded = await import(`../src/sync/snapshot-bootstrap.js?reload=${Date.now()}`);
  const calls = mockNetwork();
  await assert.rejects(reloaded.createInitialCloudSnapshot({ confirmation: BIZ }), (error) => /Load the business data/.test(error.message));
  assert.deepEqual(writes(calls), []);
});

test("a load made under another session, user or after expiry cannot be used", async () => {
  signIn({ sessionId: "session-1" });
  mockNetwork();
  await bootstrap.loadVerifiedBootstrap();
  signIn({ sessionId: "session-2" });
  await assert.rejects(bootstrap.createInitialCloudSnapshot({ confirmation: BIZ }), refused(/Load the business data/));

  signIn({ sessionId: "session-3" });
  await bootstrap.loadVerifiedBootstrap();
  signIn({ sessionId: "session-3", appUserId: "demo-user-other", username: "other", role: "Admin" });
  await assert.rejects(bootstrap.createInitialCloudSnapshot({ confirmation: BIZ }), refused(/Load the business data/));

  signIn();
  await bootstrap.loadVerifiedBootstrap();
  const realNow = Date.now;
  Date.now = () => realNow() + bootstrap.BOOTSTRAP_MAX_AGE_MS + 1000;
  try {
    const calls = mockNetwork();
    await assert.rejects(bootstrap.createInitialCloudSnapshot({ confirmation: BIZ }), refused(/too old/));
    assert.deepEqual(writes(calls), []);
  } finally {
    Date.now = realNow;
  }
});

test("a failed or empty database load refuses the bootstrap", async () => {
  signIn();
  mockNetwork({ rpc: { status: 500, body: { message: "db down" } } });
  await assert.rejects(bootstrap.loadVerifiedBootstrap(), refused(/database load failed/));
  mockNetwork({ customers: { status: 403, body: { message: "denied" } } });
  await assert.rejects(bootstrap.loadVerifiedBootstrap(), refused(/database load failed/));
  mockNetwork({ rpc: { body: { groups: [] } } });
  await assert.rejects(bootstrap.loadVerifiedBootstrap(), refused(/did not return customers, collections, users, savingsProducts/));
  const calls = mockNetwork();
  await assert.rejects(bootstrap.createInitialCloudSnapshot({ confirmation: BIZ }), refused(/Load the business data/));
  assert.deepEqual(writes(calls), []);
});

test("a member left out of the load by a missing branch or collector, or loaded without one, is never silently dropped", async () => {
  signIn();
  mockNetwork({ customers: { body: [...TABLE_ROWS.customers, { client_id: "orphan", branch_id: null, collector_id: "u-uuid" }] } });
  await assert.rejects(bootstrap.loadVerifiedBootstrap(), refused(/1 member\(s\) have no app id, branch or collector; the database has 2 member\(s\) but the load returned 1/));
  const unlinked = { ...RELATIONAL, customers: [{ ...RELATIONAL.customers[0], collectorId: null }] };
  mockNetwork({ rpc: { body: unlinked } });
  await assert.rejects(bootstrap.loadVerifiedBootstrap(), refused(/1 member\(s\) load without a branch or collector id/));
  mockNetwork({ collections: { body: [{ client_id: "col-x", customer_id: "c", branch_id: "b", collector_id: "u" }] } });
  await assert.rejects(bootstrap.loadVerifiedBootstrap(), refused(/the database has 1 collection\(s\) but the load returned 0/));
});

test("collectors, cashiers and other businesses cannot use the bootstrap", async () => {
  for (const [session, pattern] of [
    [{ role: "Collector", appUserId: "demo-user-kwame", username: "kwame" }, /Only a manager/],
    [{ role: "Cashier", appUserId: "demo-user-abena", username: "abena" }, /Only a manager/],
    [{ business: "st-other-biz" }, /different business/]
  ]) {
    signIn(session);
    const calls = mockNetwork();
    await assert.rejects(bootstrap.loadVerifiedBootstrap(), refused(pattern));
    await assert.rejects(bootstrap.createInitialCloudSnapshot({ confirmation: BIZ }), refused(pattern));
    assert.deepEqual(calls.filter((c) => !c.url.includes("/smile_trust_cloud_snapshots") || c.method !== "GET"), [], "no database load and no write");
  }
  memory.clear();
  mockNetwork();
  await assert.rejects(bootstrap.loadVerifiedBootstrap(), refused(/Sign in online as a manager/));
});

test("bootstrap is refused when a cloud copy exists or the cloud cannot be read", async () => {
  signIn();
  mockNetwork({ snapshotGet: existing({ customers: [] }) });
  await assert.rejects(bootstrap.loadVerifiedBootstrap(), refused(/already exists/));
  const calls = mockNetwork({ snapshotGet: { status: 503, body: {} } });
  await assert.rejects(bootstrap.loadVerifiedBootstrap(), (error) => error.code === CLOUD_READ_FAILED);
  assert.equal(calls.some((c) => c.url.includes("fetch_business_snapshot")), false);
});

test("confirmed bootstrap after a verified load makes one plain insert from database data only", async () => {
  signIn();
  mockNetwork();
  const summary = await bootstrap.loadVerifiedBootstrap();
  assert.deepEqual(summary, { businessCode: BIZ, members: 1, staff: 2, groups: 1, collections: 0, savingsProducts: 1 });
  await assert.rejects(bootstrap.createInitialCloudSnapshot({ confirmation: "yes" }), refused(/Type SMILE-TRUST exactly/));

  const calls = mockNetwork();
  const result = await bootstrap.createInitialCloudSnapshot({ confirmation: BIZ });
  const inserts = writes(calls);
  assert.equal(inserts.length, 1);
  assert.equal(inserts[0].method, "POST");
  assert.doesNotMatch(inserts[0].url, /on_conflict/);
  assert.doesNotMatch(inserts[0].prefer, /merge-duplicates/);
  const { business_id: businessId, payload } = inserts[0].body;
  assert.equal(businessId, BIZ);
  assert.deepEqual(payload.customers.map((c) => c.id), ["demo-customer-001"]);
  assert.deepEqual([payload.collections, payload.loans, payload.transactions, payload.messages, payload.deletedRecords], [[], [], [], [], []]);
  const text = JSON.stringify(payload);
  assert.doesNotMatch(text, /old-test-|u-owner|midnight|pbkdf2|TEST-MARKER/);
  assert.equal(payload.settings.loanInterest, 15);
  assert.ok(payload.users.every((u) => u.passwordHash === "[protected]"));

  const device = bootstrap.deviceStateAfterBootstrap(App.state, result.state);
  assert.deepEqual(device.customers.map((c) => c.id), ["demo-customer-001"]);
  assert.equal(device.settings.theme, "midnight");
  assert.equal(device.settings.loanInterest, 15);

  await assert.rejects(bootstrap.createInitialCloudSnapshot({ confirmation: BIZ }), refused(/Load the business data/), "single use");
});

test("the app runs the bootstrap only from the manager-only button, with an explanation and a typed confirmation", async () => {
  const fs = await import("node:fs");
  const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const body = (name) => {
    const start = source.indexOf(`function ${name}(`);
    assert.ok(start >= 0, name);
    const next = source.indexOf("\nfunction ", start + 10);
    const nextAsync = source.indexOf("\nasync function ", start + 10);
    return source.slice(start, Math.min(...[next, nextAsync].filter((i) => i > 0)));
  };
  assert.equal(source.match(/createInitialCloudSnapshot\(/g).length, 1, "one call site");
  assert.equal(source.match(/loadVerifiedBootstrap\(/g).length, 1, "one call site");
  const flow = body("createInitialCloudSnapshotFlow");
  assert.match(flow, /createInitialCloudSnapshot\(\{ confirmation: typed\.trim\(\) \}/);
  assert.match(flow, /if \(!canWriteSnapshot\(currentUser\(\)\?\.role\)\)/);
  assert.match(flow, /confirm\(explanation\)/);
  assert.match(flow, /prompt\(`Type \$\{summary\.businessCode\}/);
  assert.match(flow, /first authoritative cloud copy/);
  assert.equal(source.match(/(?<!function )createInitialCloudSnapshotFlow\(\)/g).length, 1, "started only by its button");
  assert.match(source, /querySelector\("#createInitialCloudSnapshot"\)\?\.addEventListener\("click", \(\) => \{ void createInitialCloudSnapshotFlow\(\); \}\)/);
  assert.match(body("renderInitialCloudSnapshotPanel"), /if \(getSyncMode\(state\) !== "supabase" \|\| !canWriteSnapshot\(currentUser\(\)\?\.role\)\) return "";/);
});

test("if a cloud copy appears between load and insert, the server's conflict stops it without an overwrite", async () => {
  signIn();
  mockNetwork();
  await bootstrap.loadVerifiedBootstrap();
  const raced = mockNetwork({ snapshotGet: existing({ customers: [] }) });
  await assert.rejects(bootstrap.createInitialCloudSnapshot({ confirmation: BIZ }), refused(/already exists/));
  assert.deepEqual(writes(raced), []);

  mockNetwork();
  await bootstrap.loadVerifiedBootstrap();
  const conflict = mockNetwork({ post: { status: 409, body: { code: "23505", message: "duplicate key" } } });
  await assert.rejects(bootstrap.createInitialCloudSnapshot({ confirmation: BIZ }), /409/);
  assert.deepEqual(writes(conflict).map((c) => c.method), ["POST"]);
});
