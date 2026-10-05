/**
 * First authoritative SMILE-TRUST cloud snapshot after migration 047, end to end: the real client
 * modules (cloud.js, snapshot-bootstrap.js) talk through a minimal local PostgREST bridge to a
 * disposable PostgreSQL built like the live project (001–045 without supabase/rls.sql, then 046,
 * then 047) with no snapshot row — the production starting point. Every request runs as
 * `authenticated` with the claims carried in the caller's bearer token, so row-level security,
 * grants and the snapshot guard trigger all apply. Never connects to a remote database.
 */
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { migrationFiles, startLocalSupabase } from "./helpers/supabase-local-db.mjs";

const memory = new Map();
globalThis.document ??= { querySelector: () => null };
globalThis.localStorage = {
  getItem: (k) => (memory.has(k) ? memory.get(k) : null),
  setItem: (k, v) => memory.set(k, String(v)),
  removeItem: (k) => memory.delete(k)
};
globalThis.sessionStorage = globalThis.localStorage;

const { App } = await import("../src/context.js");
const { pushCloudBackup, cloudUploadsPaused, resumeCloudUploads, CLOUD_READ_FAILED, CLOUD_BOOTSTRAP_REQUIRED } = await import("../src/sync/cloud.js");
const { loadVerifiedBootstrap, createInitialCloudSnapshot, deviceStateAfterBootstrap, BOOTSTRAP_REFUSED } = await import("../src/sync/snapshot-bootstrap.js");
const { SESSION_KEY } = await import("../src/sync/supabase-auth.js");

const LIVE = "SMILE-TRUST";
const CLOUD_URL = "https://local-test.supabase.co";
const ROLES = { john: "SystemOwner", ama: "Admin", kwame: "Collector" };
const SECURITY_TABLES = ["app_users", "st_staff_auth_links", "user_mfa_secrets", "st_staff_activation_codes", "st_staff_sessions_cutoff"];
const RELATIONAL_TABLES = ["customers", "collections", "branches", "ledger_entries", "journal_entries", "journal_lines", "loans", "loan_repayments", "audit_log"];
const nowSec = () => Math.floor(Date.now() / 1000);
const migration = (prefix) => migrationFiles().find((item) => item.name.startsWith(`${prefix}_`));
const ids = {};
const authIds = {};
const restCalls = [];
let failSnapshotReads = false;
let db;
let relationalBaseline;
let securityBaseline;

// ------------------------------------------------------------------------------------------
// Local PostgREST bridge (only the request shapes the client uses)

const ident = (name) => {
  if (!/^[a-z_]+$/.test(name)) throw new Error(`unexpected identifier ${name}`);
  return `"${name}"`;
};
const b64url = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const claimsFrom = (authorization) => {
  const token = String(authorization || "").replace(/^Bearer\s+/i, "");
  const parts = token.split(".");
  return parts.length === 3 ? JSON.parse(Buffer.from(parts[1], "base64url").toString()) : { role: "anon" };
};
const reply = (status, body) => new Response(body == null ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function restToSql(method, url, bodyText) {
  const path = url.pathname.replace("/rest/v1/", "");
  const values = [];
  const bind = (value) => {
    values.push(value !== null && typeof value === "object" ? JSON.stringify(value) : value);
    return `$${values.length}`;
  };
  if (path.startsWith("rpc/")) {
    const body = bodyText ? JSON.parse(bodyText) : {};
    const args = Object.keys(body).map((key) => `${ident(key)} => ${bind(body[key])}`);
    return { sql: `select to_jsonb(public.${ident(path.slice(4))}(${args.join(", ")})) as rows`, values, status: 200 };
  }
  const table = ident(path);
  const where = [];
  for (const [key, value] of url.searchParams) {
    if (["select", "limit", "order"].includes(key)) continue;
    if (!value.startsWith("eq.")) throw new Error(`unsupported filter ${key}=${value}`);
    where.push(`${ident(key)} = ${bind(value.slice(3))}`);
  }
  const whereSql = where.length ? ` where ${where.join(" and ")}` : "";
  if (method === "GET") {
    const columns = (url.searchParams.get("select") || "*").split(",").map((c) => (c === "*" ? "*" : ident(c))).join(", ");
    const limit = url.searchParams.get("limit") ? ` limit ${Number(url.searchParams.get("limit"))}` : "";
    return { sql: `select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) as rows from (select ${columns} from public.${table}${whereSql}${limit}) t`, values, status: 200 };
  }
  const body = bodyText ? JSON.parse(bodyText) : {};
  if (method === "POST") {
    if (url.searchParams.has("on_conflict")) throw new Error("upserts are not expected");
    const columns = Object.keys(body);
    return {
      sql: `with w as (insert into public.${table} (${columns.map(ident).join(", ")}) values (${columns.map((c) => bind(body[c])).join(", ")}) returning id) select coalesce(jsonb_agg(to_jsonb(w)), '[]'::jsonb) as rows from w`,
      values, status: 201
    };
  }
  if (method === "PATCH") {
    const sets = Object.keys(body).map((c) => `${ident(c)} = ${bind(body[c])}`);
    return { sql: `with w as (update public.${table} set ${sets.join(", ")}${whereSql} returning id) select coalesce(jsonb_agg(to_jsonb(w)), '[]'::jsonb) as rows from w`, values, status: 200 };
  }
  throw new Error(`unsupported method ${method}`);
}

async function bridge(input, options = {}) {
  const url = new URL(input);
  const method = options.method || "GET";
  const headers = options.headers || {};
  restCalls.push({ method, path: url.pathname, search: url.search });
  if (!url.pathname.startsWith("/rest/v1/")) return reply(404, { message: "not found" });
  if (failSnapshotReads && method === "GET" && url.pathname.endsWith("/smile_trust_cloud_snapshots")) {
    return reply(503, { message: "upstream unavailable" });
  }
  const claims = claimsFrom(headers.Authorization);
  try {
    const plan = restToSql(method, url, options.body);
    const role = claims.role === "authenticated" ? "authenticated" : "anon";
    const result = await db.asRole(role, claims, (client) => client.query(plan.sql, plan.values));
    return reply(plan.status, result.rows[0].rows);
  } catch (error) {
    const status = error.code === "42501" ? 403 : error.code === "23505" ? 409 : 400;
    return reply(status, { code: error.code, message: error.message });
  }
}

// ------------------------------------------------------------------------------------------
// Sessions and device state

function signIn(username, { sessionId = crypto.randomUUID() } = {}) {
  const claims = {
    role: "authenticated",
    sub: authIds[username],
    iat: nowSec(),
    session_id: sessionId,
    app_metadata: { business_code: LIVE, app_user_id: ids[username], app_role: ROLES[username] }
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify({
    access_token: `${b64url({ alg: "none" })}.${b64url(claims)}.local-test`,
    refresh_token: "local-test-refresh",
    expires_at: Date.now() + 3600_000,
    app_user: { id: ids[username], username, role: ROLES[username] }
  }));
}

const settings = (extra = {}) => ({ cloudMode: "supabase", cloudUrl: CLOUD_URL, cloudKey: "anon-public", businessId: LIVE, ...extra });

/** A reused manager device: old test records, stale settings and a stale tombstone for the real member. */
function staleManagerDevice() {
  return {
    settings: settings({ loanInterest: 99, collectionDays: 7, theme: "midnight" }),
    users: [{ id: "u-owner", username: "JOHN", role: "SystemOwner", passwordHash: "pbkdf2:local-device-hash" }],
    groups: [{ id: "old-test-group", name: "Old test group" }],
    customers: [{ id: "old-test-member", name: "Old Test Member", accountNo: "OLD-1", phone: "0240000000" }],
    collections: [{ id: "old-test-collection", customerId: "old-test-member", amount: 50, amountPesewas: 5000 }],
    loans: [{ id: "old-test-loan", customerId: "old-test-member", principal: 100 }],
    transactions: [{ id: "old-test-tx", customerId: "old-test-member", amount: 50 }],
    messages: [{ id: "old-test-message", body: "hello" }],
    deletedRecords: [{ collection: "customers", id: "demo-customer-001", deletedAt: "2026-01-01T00:00:00Z" }]
  };
}

function useDevice(state) {
  App.state = structuredClone(state);
  App.syncBusy = false;
}

const snapshotRows = async () => (await db.query("select payload from public.smile_trust_cloud_snapshots where business_id = $1", [LIVE])).rows;

async function tableState(tables) {
  const out = {};
  for (const table of tables) {
    if (!(await db.query("select to_regclass($1) as t", [`public.${table}`])).rows[0].t) continue;
    out[table] = (await db.query(`select md5(coalesce(string_agg(t::text, '|' order by t::text), '')) as h, count(*)::int as n from public.${table} t`)).rows[0];
  }
  for (const table of ["users", "sessions", "refresh_tokens"]) {
    out[`auth.${table}`] = (await db.query(`select md5(coalesce(string_agg(t::text, '|' order by t::text), '')) as h from auth.${table} t`)).rows[0];
  }
  return out;
}

const relationalCustomerIds = async () =>
  (await db.query("select c.client_id from public.customers c join public.businesses b on b.id = c.business_id where b.code = $1 order by 1", [LIVE])).rows.map((r) => r.client_id);

const refusedWith = (pattern) => (error) => {
  assert.equal(error.code, BOOTSTRAP_REFUSED, error.message);
  if (pattern) assert.match(error.message, pattern);
  return true;
};

function collectionItem(id, customerId, amount, userId) {
  const collection = { id, customerId, amount, amountPesewas: Math.round(amount * 100), date: "2026-09-30", paymentMethod: "Cash", receiptNo: `R-${id}`, idempotencyKey: `idem-${id}`, userId, collectorId: userId, reversed: false, verificationStatus: "Verified" };
  const credit = { id: `led-${id}-c`, entryType: "Susu Deposit", customerId, amount, amountPesewas: Math.round(amount * 100), direction: "credit", referenceId: id, referenceType: "collection", account: `customer:${customerId}` };
  const debit = { id: `led-${id}-d`, entryType: "Susu Deposit", customerId: "", amount, amountPesewas: Math.round(amount * 100), direction: "debit", referenceId: id, referenceType: "collection", account: "account:cash" };
  const tx = { id: `tx-${id}`, type: "Susu Deposit", customerId, amount, ref: id, ledgerEntryId: credit.id };
  return { collection, ledgerEntries: [credit, debit], transactions: [tx] };
}

before(async () => {
  db = await startLocalSupabase({ upTo: "045", withRlsSql: false });
  if (!db) {
    if (process.env.SMILE_SKIP_DB_TESTS === "1") return;
    throw new Error("embedded-postgres is required for migration tests (npm install)");
  }
  await db.query(migration("046").sql);
  await db.query(migration("047").sql);
  await db.query(`create table if not exists auth.users (id uuid primary key, banned_until timestamptz);
    create table if not exists auth.sessions (id uuid primary key default gen_random_uuid(), user_id uuid);
    create table if not exists auth.refresh_tokens (id bigserial primary key, user_id varchar(255))`);
  const rows = (await db.query("select username, coalesce(client_id, id::text) as app_id from public.app_users where username in ('john','ama','kwame')")).rows;
  for (const row of rows) {
    ids[row.username] = row.app_id;
    authIds[row.username] = crypto.randomUUID();
    await db.query("insert into auth.users (id) values ($1)", [authIds[row.username]]);
    await db.query("insert into public.st_staff_auth_links (business_code, app_user_id, auth_user_id) values ($1, $2, $3)", [LIVE, row.app_id, authIds[row.username]]);
  }
  globalThis.fetch = bridge;
}, { timeout: 240000 });

after(async () => {
  await db?.stop();
});

const skip = () => !db;

test("starting point matches production: 047 applied, staff linked, one relational member, no snapshot", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  assert.deepEqual(db.applied.filter((item) => !item.ok), []);
  assert.deepEqual(Object.keys(ids).sort(), ["ama", "john", "kwame"]);
  assert.deepEqual(await relationalCustomerIds(), ["demo-customer-001"]);
  assert.equal((await snapshotRows()).length, 0);
  securityBaseline = await tableState(SECURITY_TABLES);
});

test("before the first snapshot, a collector can neither create it nor upload collections; queued work stays queued", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const kwame = { role: "authenticated", sub: authIds.kwame, iat: nowSec(), app_metadata: { business_code: LIVE, app_user_id: ids.kwame, app_role: "Collector" } };
  await assert.rejects(db.asRole("authenticated", kwame, (c) => c.query("insert into public.smile_trust_cloud_snapshots (business_id, payload) values ($1, '{}')", [LIVE])), /row-level security|permission denied/i);
  const queued = collectionItem("pre-1", "demo-customer-001", 5, ids.kwame);
  await assert.rejects(db.asRole("authenticated", kwame, (c) => c.query("select public.st_submit_collections($1, $2)", [LIVE, JSON.stringify([queued])])), /no cloud data yet/i);

  signIn("kwame");
  useDevice({ settings: settings(), users: [], customers: [], collections: [queued.collection], ledgerEntries: queued.ledgerEntries, transactions: queued.transactions });
  restCalls.length = 0;
  await assert.rejects(pushCloudBackup(true), (error) => error.code === CLOUD_BOOTSTRAP_REQUIRED);
  assert.equal(restCalls.some((call) => call.method !== "GET"), false, "no snapshot write and no submission");
  assert.equal(App.state.collections[0].cloudSyncStatus, undefined, "the collection stays queued");
  await assert.rejects(loadVerifiedBootstrap(App.state), refusedWith(/Only a manager/));
  await assert.rejects(createInitialCloudSnapshot({ confirmation: LIVE }, App.state), refusedWith(/Only a manager/));
  assert.equal((await snapshotRows()).length, 0);
});

test("a manager's autosave or background sync never creates the first snapshot, from an empty or a stale device", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  signIn("john");
  for (const device of [{ settings: settings(), users: [], customers: [] }, staleManagerDevice()]) {
    useDevice(device);
    restCalls.length = 0;
    await assert.rejects(pushCloudBackup(true), (error) => error.code === CLOUD_BOOTSTRAP_REQUIRED);
    assert.deepEqual(restCalls.map((call) => call.method), ["GET"], "only the read happened");
  }
  assert.equal((await snapshotRows()).length, 0);
});

test("a failed cloud read blocks every snapshot write before the first snapshot exists", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  signIn("john");
  useDevice(staleManagerDevice());
  failSnapshotReads = true;
  try {
    restCalls.length = 0;
    await assert.rejects(pushCloudBackup(true), (error) => error.code === CLOUD_READ_FAILED);
    await assert.rejects(loadVerifiedBootstrap(App.state), (error) => error.code === CLOUD_READ_FAILED);
    assert.equal(restCalls.some((call) => call.method !== "GET"), false);
  } finally {
    failSnapshotReads = false;
  }
  assert.equal((await snapshotRows()).length, 0);
});

test("explicit bootstrap is refused without a successful database load in this session, whatever the device stored", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  signIn("john");
  const device = staleManagerDevice();
  device.loadedFromPostgresAt = new Date().toISOString();
  device.settings.lastSyncedAt = new Date().toISOString();
  useDevice(device);
  localStorage.setItem("smile_trust_bootstrap_verified", "true");
  await assert.rejects(createInitialCloudSnapshot({ confirmation: LIVE }, App.state), refusedWith(/Load the business data/));
  assert.equal((await snapshotRows()).length, 0);
});

test("schema: members and collections cannot lack a branch or collector, so the load's inner joins drop nothing today", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const cols = (await db.query(`select table_name || '.' || column_name as c, is_nullable from information_schema.columns
    where table_schema = 'public' and ((table_name = 'customers' and column_name in ('branch_id', 'collector_id'))
      or (table_name = 'collections' and column_name in ('customer_id', 'branch_id', 'collector_id'))) order by 1`)).rows;
  assert.deepEqual(cols.map((r) => [r.c, r.is_nullable]), [
    ["collections.branch_id", "NO"], ["collections.collector_id", "NO"], ["collections.customer_id", "NO"],
    ["customers.branch_id", "NO"], ["customers.collector_id", "NO"]
  ]);
});

test("a member the relational load cannot identify blocks the bootstrap until repaired; it is never dropped or blanked", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const biz = (await db.query("select id from public.businesses where code = $1", [LIVE])).rows[0].id;
  const branch = (await db.query("select id from public.branches where business_id = $1 and client_id = 'demo-branch-accra'", [biz])).rows[0].id;
  const collector = (await db.query("select id from public.app_users where business_id = $1 and client_id = 'demo-user-kwame'", [biz])).rows[0].id;
  await db.query("insert into public.customers (business_id, branch_id, collector_id, client_id, account_no, name, phone, active) values ($1, $2, $3, null, 'ST-1002', 'Unidentified Member', '233200000002', true)", [biz, branch, collector]);
  const john = { role: "authenticated", sub: authIds.john, iat: nowSec(), app_metadata: { business_code: LIVE, app_user_id: ids.john, app_role: "SystemOwner" } };
  const loaded = (await db.asRole("authenticated", john, (c) => c.query("select public.fetch_business_snapshot($1) as s", [LIVE]))).rows[0].s;
  assert.equal(loaded.customers.filter((c) => c.id === null).length, 1, "the relational load returns it without an id");

  signIn("john");
  useDevice(staleManagerDevice());
  await assert.rejects(loadVerifiedBootstrap(App.state), refusedWith(/integrity check failed: 1 member\(s\) have no app id, branch or collector; 1 loaded record\(s\) have no app id/));
  await assert.rejects(createInitialCloudSnapshot({ confirmation: LIVE }, App.state), refusedWith(/Load the business data/));
  assert.equal((await snapshotRows()).length, 0);

  await db.query("update public.customers set client_id = 'member-repaired' where business_id = $1 and account_no = 'ST-1002'", [biz]);
});

test("explicit bootstrap after a verified load creates exactly one snapshot from database data only", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  relationalBaseline = await tableState(RELATIONAL_TABLES);
  signIn("john");
  useDevice(staleManagerDevice());
  const summary = await loadVerifiedBootstrap(App.state);
  assert.deepEqual(summary, { businessCode: LIVE, members: 2, staff: 3, groups: 1, collections: 0, savingsProducts: summary.savingsProducts });
  await assert.rejects(createInitialCloudSnapshot({ confirmation: "smile-trust" }, App.state), refusedWith(/Type SMILE-TRUST exactly/));

  restCalls.length = 0;
  const result = await createInitialCloudSnapshot({ confirmation: LIVE }, App.state);
  const writes = restCalls.filter((call) => call.method !== "GET" && call.path.endsWith("/smile_trust_cloud_snapshots"));
  assert.deepEqual(writes.map((call) => [call.method, call.search]), [["POST", ""]], "one plain insert, no upsert or update");
  assert.equal(cloudUploadsPaused(), true, "the bootstrapping page uploads nothing more until reopened");

  const rows = await snapshotRows();
  assert.equal(rows.length, 1);
  const payload = rows[0].payload;
  assert.deepEqual(payload.customers.map((c) => c.id).sort(), await relationalCustomerIds(), "every relational member, including the production one");
  assert.deepEqual(payload.groups.map((g) => g.id), ["demo-branch-accra"]);
  assert.deepEqual(payload.users.map((u) => u.username).sort(), ["ama", "john", "kwame"]);
  const stored = JSON.stringify(payload);
  assert.doesNotMatch(stored, /old-test-|u-owner|midnight/, "nothing from the reused device");
  assert.deepEqual([payload.collections, payload.loans, payload.transactions, payload.messages, payload.deletedRecords], [[], [], [], [], []]);
  assert.equal(payload.settings.loanInterest, 15);
  assert.equal(payload.settings.collectionDays, 31);
  assert.equal(payload.settings.businessId, LIVE);
  assert.doesNotMatch(stored, /pbkdf2|mfaSecret|access_token|refresh_token/);
  assert.ok(payload.users.every((u) => u.passwordHash === undefined || u.passwordHash === "[protected]"));

  assert.deepEqual(await tableState(RELATIONAL_TABLES), relationalBaseline, "relational business tables are untouched");
  assert.deepEqual(await tableState(SECURITY_TABLES), securityBaseline, "staff, Auth links, MFA and activation state are untouched");

  const device = deviceStateAfterBootstrap(App.state, result.state);
  assert.equal(device.customers.some((c) => c.id === "old-test-member"), false);
  assert.equal(device.settings.theme, "midnight", "display preference stays on this device");
  assert.equal(device.settings.loanInterest, 15);
});

test("the bootstrap is single use and refused once a snapshot exists", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  signIn("john");
  useDevice(staleManagerDevice());
  await assert.rejects(createInitialCloudSnapshot({ confirmation: LIVE }, App.state), refusedWith(/Load the business data/));
  await assert.rejects(loadVerifiedBootstrap(App.state), refusedWith(/already exists/));
  assert.equal((await snapshotRows()).length, 1);
});

test("with a snapshot: a member held only on this device is never uploaded; a failed read never overwrites the copy", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  signIn("john");
  const cloud = (await snapshotRows())[0].payload;
  useDevice({ ...structuredClone(cloud), settings: settings(), customers: [{ id: "new-local-member", name: "New Member", accountNo: "ST-2001", phone: "0241111111", active: true }] });
  restCalls.length = 0;
  await pushCloudBackup(true);
  assert.deepEqual(restCalls, [], "still the bootstrapping page: nothing is sent");
  assert.deepEqual((await snapshotRows())[0].payload, cloud);
  resumeCloudUploads();
  await pushCloudBackup(true);
  const merged = (await snapshotRows())[0].payload;
  assert.equal(merged.customers.some((c) => c.id === "new-local-member"), false, "a member that is not in the database stays on the device");
  assert.deepEqual(merged.customers.map((c) => c.id).sort(), await relationalCustomerIds(), "the cloud copy holds exactly the database's members");
  assert.equal(App.lastCloudSyncReport.heldOnDevice.customers, 1, "the device is told what it holds that was not uploaded");

  useDevice({ settings: settings(), users: [], customers: [{ id: "lonely-stale-member", name: "Stale", accountNo: "X-1", phone: "0242222222" }] });
  failSnapshotReads = true;
  try {
    restCalls.length = 0;
    await assert.rejects(pushCloudBackup(true), (error) => error.code === CLOUD_READ_FAILED);
    assert.equal(restCalls.some((call) => call.method !== "GET"), false);
  } finally {
    failSnapshotReads = false;
  }
  assert.deepEqual((await snapshotRows())[0].payload, merged);
});

test("collectors still upload through st_submit_collections, and posted history then survives a stale manager upload", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  signIn("kwame");
  const queued = collectionItem("off-1", "demo-customer-001", 10, ids.kwame);
  useDevice({ settings: settings(), users: [], customers: [], collections: [queued.collection], ledgerEntries: queued.ledgerEntries, transactions: queued.transactions });
  restCalls.length = 0;
  await pushCloudBackup(true);
  assert.ok(restCalls.some((call) => call.path.endsWith("/rpc/st_submit_collections")));
  assert.equal(restCalls.some((call) => call.method !== "GET" && call.path.endsWith("/smile_trust_cloud_snapshots")), false, "a collector never writes the snapshot");
  const payload = (await snapshotRows())[0].payload;
  assert.ok(payload.collections.some((c) => c.id === "off-1"));

  const john = { role: "authenticated", sub: authIds.john, iat: nowSec(), app_metadata: { business_code: LIVE, app_user_id: ids.john, app_role: "SystemOwner" } };
  const stale = { ...payload, collections: [], ledgerEntries: [], transactions: [] };
  await assert.rejects(db.asRole("authenticated", john, (c) => c.query("update public.smile_trust_cloud_snapshots set payload = $2 where business_id = $1", [LIVE, JSON.stringify(stale)])));
  assert.ok((await snapshotRows())[0].payload.collections.some((c) => c.id === "off-1"));
});

test("the snapshot is scrubbed, undeletable, collector-proof, and its writes never touched security state", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const john = { role: "authenticated", sub: authIds.john, iat: nowSec(), app_metadata: { business_code: LIVE, app_user_id: ids.john, app_role: "SystemOwner" } };
  const kwame = { role: "authenticated", sub: authIds.kwame, iat: nowSec(), app_metadata: { business_code: LIVE, app_user_id: ids.kwame, app_role: "Collector" } };
  const payload = (await snapshotRows())[0].payload;
  payload.settings = { ...payload.settings, syncToken: "TEST-MARKER-SYNC", momoWebhookSecret: "TEST-MARKER-HOOK" };
  payload.users = payload.users.map((u) => (u.username === "john" ? { ...u, passwordHash: "pbkdf2:TEST-MARKER", mfaSecret: "TEST-MARKER-MFA" } : u));
  await db.asRole("authenticated", john, (c) => c.query("update public.smile_trust_cloud_snapshots set payload = $2 where business_id = $1", [LIVE, JSON.stringify(payload)]));
  assert.doesNotMatch(JSON.stringify((await snapshotRows())[0].payload), /TEST-MARKER/);
  await assert.rejects(db.asRole("authenticated", john, (c) => c.query("delete from public.smile_trust_cloud_snapshots where business_id = $1", [LIVE])), /permission denied/i);
  const collectorUpdate = await db.asRole("authenticated", kwame, (c) => c.query("update public.smile_trust_cloud_snapshots set payload = '{}' where business_id = $1 returning id", [LIVE]));
  assert.equal(collectorUpdate.rowCount, 0);
  assert.equal((await snapshotRows()).length, 1);
  assert.deepEqual(await tableState(SECURITY_TABLES), securityBaseline, "no snapshot write changed staff, Auth, MFA or activation state");
});
