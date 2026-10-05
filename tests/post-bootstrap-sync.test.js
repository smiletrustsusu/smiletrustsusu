/**
 * Post-bootstrap synchronization: once the authoritative database-bootstrap snapshot exists, an
 * ordinary manager sync rebuilds it from a fresh database load and the cloud copy it just read,
 * validates it, and writes it only if the row is unchanged since that read. A device's own state
 * (stale members, staff, products, device fields, settings, secrets) never becomes authoritative.
 * Network is mocked; the end-to-end versions run against PostgreSQL in
 * first-snapshot-bootstrap.test.js and stale-snapshot-recovery.test.js.
 */
import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { CANONICAL_KEYS, canonicalPayload, relationalLoad, staffSession, tableRows } from "./helpers/sync-fixtures.mjs";

const memory = new Map();
globalThis.document ??= { querySelector: () => null };
globalThis.localStorage = {
  getItem: (k) => (memory.has(k) ? memory.get(k) : null),
  setItem: (k, v) => memory.set(k, String(v)),
  removeItem: (k) => memory.delete(k)
};
globalThis.sessionStorage = globalThis.localStorage;

const { App } = await import("../src/context.js");
const cloud = await import("../src/sync/cloud.js");
const canonical = await import("../src/sync/canonical-snapshot.js");
const bootstrap = await import("../src/sync/snapshot-bootstrap.js");
const { SESSION_KEY } = await import("../src/sync/supabase-auth.js");
const { LEGACY_SYNC_KEY_STORAGE } = await import("../src/config.js");
const { pushCloudBackup, CLOUD_BOOTSTRAP_REQUIRED, CLOUD_READ_FAILED, CLOUD_UPDATE_REFUSED, CLOUD_UPDATE_CONFLICT } = cloud;

const BIZ = "SMILE-TRUST";
const SAVED_AT = "2026-10-05T10:44:18.728+00:00";
const MARKERS = /old-test-|u-owner|u-superadmin|TEST-MARKER|pbkdf2|eyJ|midnight|default-product|device edit/;

const signIn = (options = {}) => localStorage.setItem(SESSION_KEY, JSON.stringify(staffSession({ business: BIZ, ...options })));

/** A reused manager device: stale records, device-only fields and modules, local settings and secrets. */
function staleDevice() {
  const products = Array.from({ length: 15 }, (_, i) => ({ id: `default-product-${i}`, code: `DEF-${i}`, name: `Default ${i}` }));
  return {
    settings: { cloudMode: "supabase", cloudUrl: "https://example.supabase.co", cloudKey: "anon", businessId: BIZ, loanInterest: 99, theme: "midnight",
      syncToken: "TEST-MARKER-SYNC", momoWebhookSecret: "TEST-MARKER-HOOK", lastSyncedAt: "2026-10-01T00:00:00Z" },
    users: [
      { id: "demo-user-john", username: "JOHN", role: "SystemOwner", passwordHash: "pbkdf2:600000:TEST-MARKER", mfaSecret: "TEST-MARKER-MFA", loginPasswordHint: "TEST-MARKER-HINT" },
      { id: "u-owner", username: "oldowner", role: "SystemOwner", active: true },
      { id: "u-superadmin", username: "KBA", role: "KBA", systemDeveloper: true, active: true }
    ],
    customers: [
      { id: "demo-customer-001", name: "Demo Member (device edit)", accountNo: "ST-1001", phone: "233200000001", passportPhoto: "data:image/png;base64,TEST-MARKER", balance: 999, createdAt: "2026-09-01" },
      { id: "old-test-member", name: "Old", accountNo: "OLD-1", phone: "0240000000" }
    ],
    groups: [{ id: "demo-branch-accra", name: "Accra (device)" }, { id: "old-test-group", name: "Old group" }],
    collections: [{ id: "old-test-collection", customerId: "old-test-member", amount: 5, userId: "demo-user-john" }],
    savingsProducts: products,
    loans: [{ id: "old-test-loan", customerId: "old-test-member", principal: 100 }],
    transactions: [{ id: "old-test-tx", amount: 5 }],
    messages: [{ id: "old-test-message" }],
    audit: [{ id: "old-test-audit", action: "Login" }],
    chartOfAccounts: [{ id: "old-test-account" }],
    offlineQueue: [{ id: "old-test-queue", payload: { token: "eyJabcdefghijk.eyJabcdefghijk.sig" } }],
    accessToken: "TEST-MARKER-TOKEN"
  };
}

/** routes: { snapshotGet, patch, rpc, customers, collections, submit } -> { status, body } */
function mockNetwork(routes = {}) {
  const calls = [];
  globalThis.fetch = async (input, options = {}) => {
    const url = String(input);
    const method = options.method || "GET";
    calls.push({ method, url, body: options.body ? JSON.parse(options.body) : null, headers: options.headers || {} });
    const pick = () => {
      if (url.includes("/rpc/fetch_business_snapshot")) return routes.rpc || { body: routes.load || relationalLoad() };
      if (url.includes("/rpc/st_submit_collections")) return routes.submit || { body: { accepted: [], duplicates: [], rejected: [] } };
      if (url.includes("/rest/v1/customers?")) return routes.customers || { body: tableRows(routes.load || relationalLoad()).customers };
      if (url.includes("/rest/v1/collections?")) return routes.collections || { body: tableRows(routes.load || relationalLoad()).collections };
      if (url.includes("/smile_trust_cloud_snapshots")) {
        if (method === "GET") return routes.snapshotGet || { body: [] };
        if (method === "PATCH") return routes.patch || { body: [{ id: 2 }] };
        if (method === "POST") return { status: 201, body: null };
      }
      return { status: 404, body: { message: "unexpected" } };
    };
    const { status = 200, body = null } = pick();
    return new Response(status === 201 || status === 204 || body === null ? null : JSON.stringify(body), { status });
  };
  return calls;
}

const row = (payload, extra = {}) => ({ body: [{ id: 2, business_id: BIZ, payload, saved_at: SAVED_AT, saved_by: "demo-user-john", ...extra }] });
const cloudCopy = (extra) => canonicalPayload(relationalLoad(), BIZ, extra);
const writes = (calls) => calls.filter((c) => c.method !== "GET" && c.url.includes("/smile_trust_cloud_snapshots"));
const dbLoads = (calls) => calls.filter((c) => c.url.includes("/rpc/fetch_business_snapshot"));
/** The database now has one more member than the cloud copy, so a valid sync has something to write. */
function grownLoad() {
  const load = relationalLoad();
  load.customers.push({ id: "db-member-002", accountNo: "ST-1002", name: "Second Member", phone: "233200000002", groupId: "demo-branch-accra", collectorId: "demo-user-kwame", active: true, memberStatus: "Active", accountType: "personal" });
  return load;
}
const refusedWith = (pattern) => (error) => {
  assert.equal(error.code, CLOUD_UPDATE_REFUSED, error.message);
  if (pattern) assert.match(error.message, pattern);
  assert.match(error.message, /nothing was uploaded/);
  return true;
};

beforeEach(() => {
  memory.clear();
  bootstrap.discardVerifiedBootstrap();
  cloud.resumeCloudUploads();
  App.state = staleDevice();
  App.syncBusy = false;
  App.lastCloudSyncReport = null;
  App.lastCloudSyncError = null;
});

// ------------------------------------------------------------------------------------------

test("A: ordinary sync never creates the first snapshot, even for a valid SystemOwner session", async () => {
  signIn();
  for (const silent of [true, false]) {
    const calls = mockNetwork({ snapshotGet: { body: [] } });
    await assert.rejects(pushCloudBackup(silent), (error) => error.code === CLOUD_BOOTSTRAP_REQUIRED);
    assert.deepEqual(calls.map((c) => c.method), ["GET"], "only the read: no database load, no insert, no update");
  }
});

test("N/B/C/D/E/F/G/O: a valid JOHN sync writes the database's records only, in the canonical format, and nothing from the device", async () => {
  signIn({ username: "JOHN" });
  const load = grownLoad();
  const calls = mockNetwork({ load, snapshotGet: row(cloudCopy()) });
  await pushCloudBackup(false);

  const [patch] = writes(calls);
  assert.equal(writes(calls).length, 1);
  assert.equal(patch.method, "PATCH");
  const { payload, saved_by: savedBy, saved_at: savedAt } = patch.body;
  assert.equal(savedBy, "john", "the saver's username comes from the database, not this device");
  assert.equal(payload.updatedAt, savedAt);
  assert.deepEqual(Object.keys(payload).sort(), CANONICAL_KEYS, "E/O: exactly the canonical top-level keys");
  assert.deepEqual(payload.customers.map((c) => c.id), ["demo-customer-001", "db-member-002"], "B: the stale member is not resurrected");
  assert.deepEqual(payload.users.map((u) => u.id), ["demo-user-john", "demo-user-ama", "demo-user-kwame"], "C: stale staff are not resurrected");
  assert.deepEqual(payload.savingsProducts.map((p) => p.id), ["SUSU-DAILY"], "D: stale/default products are not resurrected");
  assert.deepEqual(payload.groups.map((g) => g.id), ["demo-branch-accra"]);
  assert.deepEqual(payload.customers, load.customers, "F: records exactly as the database returns them; device edits and fields are dropped");
  assert.deepEqual(payload.users, load.users);
  assert.deepEqual([payload.collections, payload.loans, payload.transactions, payload.messages, payload.audit], [[], [], [], [], []]);
  assert.deepEqual(payload.settings, cloudCopy().settings, "local settings, device secrets and display preferences never upload");
  const text = JSON.stringify(payload);
  assert.doesNotMatch(text, MARKERS, "G: no stale record, device setting, password hash, MFA secret or token");
  assert.doesNotMatch(text, /passwordHash|mfaSecret|syncToken|cloudKey|accessToken|loginPasswordHint/);
  assert.deepEqual(canonical.canonicalSnapshotProblems(payload, { database: load, cloudPayload: cloudCopy(), businessCode: BIZ }), []);

  assert.match(patch.url, /[?&]id=eq\.2(&|$)/, "M: bound to the row that was read");
  assert.match(patch.url, /business_id=eq\.SMILE-TRUST/);
  assert.ok(patch.url.includes(`saved_at=eq.${encodeURIComponent(SAVED_AT)}`), "M: and to the saved_at it was read with");
  assert.equal(calls.some((c) => c.method === "POST" && c.url.includes("/smile_trust_cloud_snapshots")), false);
  assert.equal(App.state.customers.some((c) => c.id === "old-test-member"), true, "local data stays on the device");
  assert.equal(App.lastCloudSyncReport.heldOnDevice.customers, 1, "the device is told what it holds that was not uploaded");
});

test("N: when the database matches the cloud copy the sync writes nothing at all", async () => {
  signIn();
  const calls = mockNetwork({ snapshotGet: row(cloudCopy()) });
  await pushCloudBackup(true);
  assert.equal(dbLoads(calls).length, 1, "a fresh database load is still made");
  assert.deepEqual(writes(calls), [], "no PATCH: the authoritative copy is untouched");
});

test("N: the database returning the same records in another order is not a change, so nothing is written", async () => {
  signIn();
  const shuffled = relationalLoad();
  shuffled.users.reverse();
  const calls = mockNetwork({ load: shuffled, snapshotGet: row(cloudCopy()) });
  await pushCloudBackup(true);
  assert.deepEqual(writes(calls), [], "a reordered load leaves the authoritative copy untouched");
  assert.equal(canonical.sameSnapshotContent(cloudCopy({ users: shuffled.users }), cloudCopy()), true);
  const renamed = relationalLoad();
  renamed.users[1].name = "Ama Renamed";
  assert.equal(canonical.sameSnapshotContent(cloudCopy({ users: renamed.users }), cloudCopy()), false, "a real change still counts");
});

test("O: server-accepted collections and records with no database source are carried unchanged; device versions never replace them", async () => {
  signIn();
  const submitted = { id: "srv-col-1", customerId: "demo-customer-001", amount: 10, userId: "demo-user-kwame", collectorId: "demo-user-kwame", submittedBy: "demo-user-kwame", serverReceivedAt: "2026-10-06T08:00:00Z", syncStatus: "Synced" };
  const ledgerEntries = [{ id: "led-srv-1", referenceId: "srv-col-1", referenceType: "collection", amount: 10 }];
  const fromCloud = cloudCopy({ collections: [submitted], transactions: [{ id: "tx-srv-1", ref: "srv-col-1", amount: 10 }], loans: [{ id: "cloud-loan-1", customerId: "demo-customer-001" }], ledgerEntries });
  const load = grownLoad();
  load.collections.push({ id: "db-col-1", customerId: "demo-customer-001", groupId: "demo-branch-accra", userId: "demo-user-john", collectorId: "demo-user-kwame", amount: 5, amountPesewas: 500, date: "2026-10-06", reversed: false, deviceNote: "TEST-MARKER" });
  App.state.loans = [{ id: "cloud-loan-1", customerId: "demo-customer-001", principal: 999999 }, { id: "device-loan-2" }];
  App.state.collections.push({ id: "srv-col-1", customerId: "demo-customer-001", amount: 99999 });
  const calls = mockNetwork({ load, snapshotGet: row(fromCloud) });
  await pushCloudBackup(true);
  const { payload } = writes(calls)[0].body;
  assert.deepEqual(payload.collections.map((c) => c.id), ["srv-col-1", "db-col-1"]);
  assert.deepEqual(payload.collections[0], submitted, "the server-accepted collection is unchanged");
  assert.equal(payload.collections[1].deviceNote, undefined, "database records carry only the fields the database function returns");
  assert.deepEqual(payload.loans, fromCloud.loans, "a device cannot change, add or remove records with no database source");
  assert.deepEqual(payload.transactions, fromCloud.transactions);
  assert.deepEqual(payload.ledgerEntries, ledgerEntries, "the server-appended ledger is carried, never dropped");
});

test("an older full device-state cloud copy is never converted or overwritten by ordinary sync", async () => {
  signIn();
  for (const payload of [{ ...cloudCopy(), chartOfAccounts: [] }, (() => { const p = cloudCopy(); delete p.savingsProducts; return p; })(),
    cloudCopy({ settings: { ...cloudCopy().settings, lastSyncedAt: "x" } }), { customers: [] }, null]) {
    const calls = mockNetwork({ load: grownLoad(), snapshotGet: row(payload) });
    await assert.rejects(pushCloudBackup(false), refusedWith(/not in the canonical database format/));
    assert.deepEqual(writes(calls), []);
    assert.deepEqual(dbLoads(calls), [], "refused before loading the database");
  }
});

test("H: a failed, empty or inconsistent database load stops the update", async () => {
  signIn();
  for (const [routes, pattern] of [
    [{ rpc: { status: 500, body: { message: "db down" } } }, /database load failed/],
    [{ customers: { status: 403, body: { message: "denied" } } }, /database load failed/],
    [{ collections: { status: 503, body: {} } }, /database load failed/],
    [{ rpc: { body: null } }, /no usable data/],
    [{ rpc: { body: { groups: [] } } }, /did not return customers, collections, users, savingsProducts/],
    [{ customers: { body: [...tableRows(relationalLoad()).customers, { client_id: "orphan", branch_id: null, collector_id: "u" }] } }, /integrity check failed/],
    [{ load: { ...relationalLoad(), customers: [{ ...relationalLoad().customers[0], id: "" }] } }, /integrity check failed/]
  ]) {
    const calls = mockNetwork({ snapshotGet: row(cloudCopy()), ...routes });
    await assert.rejects(pushCloudBackup(false), refusedWith(pattern));
    assert.deepEqual(writes(calls), []);
  }
});

test("I: a failed cloud read stops the sync before any database load or write; it is never treated as no snapshot", async () => {
  signIn();
  for (const status of [500, 503, 401]) {
    const before = structuredClone(App.state);
    const calls = mockNetwork({ snapshotGet: { status, body: { message: "down" } } });
    await assert.rejects(pushCloudBackup(true), (error) => error.code === CLOUD_READ_FAILED);
    assert.deepEqual(calls.map((c) => c.method), ["GET"]);
    assert.deepEqual(App.state, before, "local data untouched");
  }
});

test("J: another business on the session, the device or the cloud row stops the update", async () => {
  for (const [setup, routes] of [
    [() => signIn({ business: "OTHER-BIZ" }), {}],
    [() => { signIn(); App.state.settings.businessId = "OTHER-BIZ"; }, {}],
    [() => signIn(), { snapshotGet: row(cloudCopy(), { business_id: "OTHER-BIZ" }) }]
  ]) {
    App.state = staleDevice();
    setup();
    const calls = mockNetwork({ load: grownLoad(), snapshotGet: row(cloudCopy()), ...routes });
    await assert.rejects(pushCloudBackup(false), (error) => error.code === CLOUD_UPDATE_REFUSED || error.code === CLOUD_READ_FAILED);
    assert.deepEqual(writes(calls), []);
  }
  signIn();
  const foreign = grownLoad();
  foreign.customers[1].businessId = "OTHER-BIZ";
  const problems = canonical.canonicalSnapshotProblems({ ...cloudCopy(), customers: [...cloudCopy().customers, { id: "x", businessId: "OTHER-BIZ" }] }, { database: foreign, cloudPayload: cloudCopy(), businessCode: BIZ });
  assert.ok(problems.some((p) => /another business/.test(p)), problems.join("; "));
});

test("K: a deactivated, missing or role-changed staff account in the database stops the update, whatever the session claims", async () => {
  for (const [mutate, pattern] of [
    [(load) => { load.users[0].active = false; }, /deactivated/],
    [(load) => { load.users[0].active = undefined; }, /deactivated/],
    [(load) => { load.users.shift(); }, /not in the database load/],
    [(load) => { load.users.push({ ...load.users[0] }); }, /not in the database load/],
    [(load) => { load.users[0].role = "Admin"; }, /role differs/]
  ]) {
    signIn();
    const load = grownLoad();
    mutate(load);
    const calls = mockNetwork({ load, snapshotGet: row(cloudCopy()) });
    await assert.rejects(pushCloudBackup(false), refusedWith(pattern));
    assert.deepEqual(writes(calls), []);
  }
});

test("L: collectors, cashiers, legacy-key devices and sessions without claims never write the snapshot", async () => {
  for (const [label, setup] of [
    ["collector", () => signIn({ role: "Collector", appUserId: "demo-user-kwame", username: "kwame" })],
    ["cashier", () => signIn({ role: "Cashier", appUserId: "demo-user-abena", username: "abena" })]
  ]) {
    setup();
    const calls = mockNetwork({ load: grownLoad(), snapshotGet: row(cloudCopy()) });
    await pushCloudBackup(true);
    assert.deepEqual(writes(calls), [], `${label}: no snapshot write`);
    assert.deepEqual(dbLoads(calls), [], `${label}: uses st_submit_collections only`);
  }
  memory.clear();
  localStorage.setItem(LEGACY_SYNC_KEY_STORAGE, "legacy-device-key-0123456789abcdef");
  let calls = mockNetwork({ load: grownLoad(), snapshotGet: row(cloudCopy()) });
  await assert.rejects(pushCloudBackup(false), refusedWith(/Sign in online as a manager/));
  assert.deepEqual(writes(calls), [], "legacy key device");

  memory.clear();
  localStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: "opaque-token", refresh_token: "r", expires_at: Date.now() + 3600_000, app_user: { id: "demo-user-john", username: "john", role: "SystemOwner" } }));
  calls = mockNetwork({ load: grownLoad(), snapshotGet: row(cloudCopy()) });
  await assert.rejects(pushCloudBackup(false), refusedWith(/Sign in online as a manager/));
  assert.deepEqual(writes(calls), [], "a locally stored SystemOwner role without server claims is not trusted");
});

test("M: a cloud copy that changed after it was read is reported, never overwritten or retried as an insert", async () => {
  signIn();
  const calls = mockNetwork({ load: grownLoad(), snapshotGet: row(cloudCopy()), patch: { body: [] } });
  await assert.rejects(pushCloudBackup(false), (error) => error.code === CLOUD_UPDATE_CONFLICT && /matched no snapshot row/.test(error.message) && /Nothing was overwritten/.test(error.message));
  assert.deepEqual(writes(calls).map((c) => c.method), ["PATCH"]);
  for (const missing of [{ id: null }, { saved_at: null }, { id: undefined }]) {
    const noVersion = mockNetwork({ load: grownLoad(), snapshotGet: row(cloudCopy(), missing) });
    await assert.rejects(pushCloudBackup(false), refusedWith(/concurrent change could not be detected/));
    assert.deepEqual(writes(noVersion), []);
  }
});

test("a server refusal of the update (RLS, MFA session, 047 guard) surfaces as an error and nothing else is tried", async () => {
  signIn();
  const calls = mockNetwork({ load: grownLoad(), snapshotGet: row(cloudCopy()), patch: { status: 403, body: { message: "new row violates row-level security policy" } } });
  await assert.rejects(pushCloudBackup(false), /Cloud update failed \(403\)/);
  assert.deepEqual(writes(calls).map((c) => c.method), ["PATCH"]);
});

// ------------------------------------------------------------------------------------------
// The validator on its own (independent of the builder)

test("E/F/G/10: the validator rejects unknown keys, device fields, secrets, credential values and ids not in the database", () => {
  const load = relationalLoad();
  const ok = cloudCopy();
  const ctx = { database: load, cloudPayload: cloudCopy(), businessCode: BIZ };
  assert.deepEqual(canonical.canonicalSnapshotProblems(ok, ctx), []);
  const cases = [
    [{ ...ok, chartOfAccounts: [] }, /unknown top-level key/],
    [{ ...ok, offlineQueue: [] }, /unknown top-level key/],
    [{ ...ok, ledgerEntries: [] }, /unknown top-level key/],
    [(() => { const p = structuredClone(ok); delete p.audit; return p; })(), /missing top-level key/],
    [{ ...ok, customers: [...ok.customers, { id: "old-test-member", name: "Old" }] }, /customers: 1 record\(s\) not in the database/],
    [{ ...ok, users: [...ok.users, { id: "u-superadmin", username: "KBA", role: "KBA" }] }, /users: 1 record\(s\) not in the database/],
    [{ ...ok, savingsProducts: [...ok.savingsProducts, { id: "DEF-1", code: "DEF-1" }] }, /savingsProducts: 1 record\(s\) not in the database/],
    [{ ...ok, groups: [...ok.groups, { id: "old-test-group" }] }, /groups: 1 record\(s\) not in the database/],
    [{ ...ok, customers: [] }, /customers: 1 database record\(s\) missing/],
    [{ ...ok, customers: [{ ...ok.customers[0], passportPhoto: "data:" }] }, /fields the database does not provide/],
    [{ ...ok, customers: [{ ...ok.customers[0], name: "Edited on a device" }] }, /differ from the database/],
    [{ ...ok, collections: [{ id: "device-col", customerId: "demo-customer-001", amount: 5 }] }, /neither in the database nor accepted/],
    [{ ...ok, loans: [{ id: "device-loan" }] }, /loans: differs from the cloud copy/],
    [{ ...ok, settings: { ...ok.settings, syncToken: "x" } }, /device-only or unknown setting|secret or credential key/],
    [{ ...ok, settings: { ...ok.settings, businessId: "OTHER-BIZ" } }, /settings.businessId/],
    [{ ...ok, users: ok.users.map((u, i) => (i ? u : { ...u, passwordHash: "[protected]" })) }, /secret or credential key\(s\): passwordHash/],
    [{ ...ok, users: ok.users.map((u, i) => (i ? u : { ...u, mfaSecret: "JBSWY3DPEHPK3PXP" })) }, /secret or credential key\(s\): mfaSecret/],
    [{ ...ok, users: ok.users.map((u, i) => (i ? u : { ...u, name: "pbkdf2:600000:salt:hash" })) }, /credential-shaped/],
    [{ ...ok, customers: [{ ...ok.customers[0], name: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.sig" }] }, /credential-shaped/],
    [{ ...ok, customers: [{ ...ok.customers[0], phone: "sb_secret_abc" }] }, /credential-shaped/],
    [{ ...ok, customers: [{ ...ok.customers[0], name: "otpauth://totp/x" }] }, /credential-shaped/],
    [{ ...ok, customers: [{ ...ok.customers[0], id: "" }] }, /without an id/],
    [{ ...ok, customers: [ok.customers[0], ok.customers[0]] }, /duplicate id/],
    [null, /not an object/]
  ];
  for (const [payload, pattern] of cases) {
    const problems = canonical.canonicalSnapshotProblems(payload, ctx);
    assert.ok(problems.some((p) => pattern.test(p)), `${pattern}: ${problems.join("; ")}`);
  }
});

test("P: the Initial Cloud Snapshot builds through the same canonical path and is validated before its insert", async () => {
  signIn();
  mockNetwork();
  const summary = await bootstrap.loadVerifiedBootstrap();
  assert.deepEqual(summary, { businessCode: BIZ, members: 1, staff: 3, groups: 1, collections: 0, savingsProducts: 1 });
  const calls = mockNetwork();
  const result = await bootstrap.createInitialCloudSnapshot({ confirmation: BIZ });
  const [insert] = writes(calls);
  assert.equal(insert.method, "POST");
  const { passwordHash, ...withoutHash } = insert.body.payload.users[0];
  assert.equal(passwordHash, "[protected]", "unchanged: the server strips the placeholder");
  assert.deepEqual(withoutHash, relationalLoad().users[0]);
  assert.deepEqual(Object.keys(result.state).sort(), CANONICAL_KEYS);
  assert.deepEqual(result.state.settings, cloudCopy().settings, "the same settings a later update keeps");
  assert.deepEqual(canonical.canonicalSnapshotProblems(result.state, { database: relationalLoad(), businessCode: BIZ }), []);

  bootstrap.discardVerifiedBootstrap();
  const tainted = relationalLoad();
  tainted.customers[0].name = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.sig";
  mockNetwork({ load: tainted });
  await assert.rejects(bootstrap.loadVerifiedBootstrap(), (error) => error.code === bootstrap.BOOTSTRAP_REFUSED && /credential-shaped/.test(error.message));
});

test("Q: the upload pause after the initial snapshot still stops the new update path before any request", async () => {
  signIn();
  cloud.pauseCloudUploads();
  try {
    const calls = mockNetwork({ load: grownLoad(), snapshotGet: row(cloudCopy()) });
    assert.equal(await pushCloudBackup(true), undefined);
    await assert.rejects(pushCloudBackup(false), (error) => error.code === cloud.CLOUD_UPLOADS_PAUSED);
    assert.deepEqual(calls, []);
  } finally {
    cloud.resumeCloudUploads();
  }
});

test("14: a refused or conflicting background sync is shown to the user once, not swallowed", async () => {
  const fs = await import("node:fs");
  const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const start = app.indexOf("async function pushCloudBackup(silent = false)");
  const body = app.slice(start, app.indexOf("\n}\n", start));
  assert.match(body, /else if \(\(error\.code === CLOUD_UPDATE_REFUSED \|\| error\.code === CLOUD_UPDATE_CONFLICT\) && error\.message !== lastBackgroundSyncNotice\) \{\s*lastBackgroundSyncNotice = error\.message;\s*toast\(`Cloud sync stopped: \$\{error\.message\}`\);/);
  assert.match(body, /syncFromApp\(\);\s*lastBackgroundSyncNotice = "";/, "a successful sync re-arms the notice");
});

test("T: the www/ mirrors carry the same sync modules", async () => {
  const fs = await import("node:fs");
  for (const file of ["app.js", "src/sync/cloud.js", "src/sync/snapshot-bootstrap.js", "src/sync/canonical-snapshot.js", "src/sync/snapshot-security.js"]) {
    assert.equal(fs.readFileSync(new URL(`../www/${file}`, import.meta.url), "utf8"), fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), file);
  }
});
