/**
 * Migration 047 (security hardening, blockers B1–B7) on a disposable local PostgreSQL built the
 * way the live project was: migrations 001–045 without supabase/rls.sql, then 046, then 047 —
 * and 047 again (idempotency). Sessions are real staff identities (app_users row + Auth link +
 * server-set claims); attacks use tampered, stale, cross-business and wrong-user claims.
 * Never connects to a remote database.
 */
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { migrationFiles, startLocalSupabase } from "./helpers/supabase-local-db.mjs";

const LIVE = "SMILE-TRUST";
const OTHER = "st-other-biz";
const STAFF_COLUMNS = "id, business_id, client_id, username, name, role, active, branch_id, auth_user_id, password_hash, created_at";
const nowSec = () => Math.floor(Date.now() / 1000);

let db;
let staffBefore;
const ids = {};
const authIds = {};

const migration = (prefix) => migrationFiles().find((item) => item.name.startsWith(`${prefix}_`));

function session(username, { role, iat = nowSec(), business = LIVE, appUserId, sub } = {}) {
  return {
    role: "authenticated",
    sub: sub || authIds[username],
    iat,
    app_metadata: { business_code: business, app_user_id: appUserId || ids[username], app_role: role || ROLES[username] }
  };
}
const ROLES = { john: "SystemOwner", ama: "Admin", kwame: "Collector", yaw: "Collector", esi: "Accountant", kojo: "ManagingDirector", abena: "Cashier", kofi: "KBA" };
const anonClaims = { role: "anon" };

function run(claims, sql, params) {
  const role = claims?.role === "anon" ? "anon" : "authenticated";
  return db.asRole(role, claims, (client) => client.query(sql, params));
}

async function expectDenied(promise, label, pattern) {
  await assert.rejects(promise, (error) => {
    assert.ok(
      ["42501", "P0001", "23514", "22023"].includes(error.code) || /permission denied|row-level security|not authorized/i.test(error.message),
      `${label}: unexpected error ${error.code} ${error.message}`
    );
    if (pattern) assert.match(error.message, pattern, label);
    return true;
  }, `${label} should be denied`);
}

async function staffRows() {
  return (await db.query(`select ${STAFF_COLUMNS} from public.app_users where username in ('john','ama','kwame') order by username`)).rows;
}

async function snapshot() {
  return (await db.query("select payload from public.smile_trust_cloud_snapshots where business_id = $1", [LIVE])).rows[0]?.payload;
}

function customer(id, collectorId, groupId, extra = {}) {
  return { id, name: `Member ${id}`, accountNo: `acc-${id}`, phone: "0241234567", groupId, collectorId, active: true, memberStatus: "Active", ...extra };
}

function collectionItem(id, customerId, amount, { userId, method = "Cash", reversed = false, ledger = true } = {}) {
  const collection = { id, customerId, amount, amountPesewas: Math.round(amount * 100), date: "2026-09-30", paymentMethod: method, receiptNo: `R-${id}`, idempotencyKey: `idem-${id}`, userId, collectorId: userId, reversed, verificationStatus: "Verified" };
  if (!ledger) return { collection };
  const credit = { id: `led-${id}-c`, entryType: "Susu Deposit", customerId, amount, amountPesewas: Math.round(amount * 100), direction: "credit", referenceId: id, referenceType: "collection", account: `customer:${customerId}` };
  const debit = { id: `led-${id}-d`, entryType: "Susu Deposit", customerId: "", amount, amountPesewas: Math.round(amount * 100), direction: "debit", referenceId: id, referenceType: "collection", account: method === "Cash" ? "account:cash" : "account:momo" };
  const tx = { id: `tx-${id}`, type: "Susu Deposit", customerId, amount, ref: id, ledgerEntryId: credit.id };
  return { collection, ledgerEntries: [credit, debit], transactions: [tx] };
}

before(async () => {
  db = await startLocalSupabase({ upTo: "045", withRlsSql: false });
  if (!db) {
    if (process.env.SMILE_SKIP_DB_TESTS === "1") return;
    throw new Error("embedded-postgres is required for migration tests (npm install)");
  }
}, { timeout: 240000 });

after(async () => {
  await db?.stop();
});

const skip = () => !db;

test("001–045 apply, then 046, then 047 apply cleanly on the live-shaped database", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  assert.deepEqual(db.applied.filter((item) => !item.ok), []);
  staffBefore = await staffRows();
  assert.deepEqual(staffBefore.map((row) => [row.username, row.role, row.active]), [
    ["ama", "AssistantManager", true], ["john", "SystemOwner", true], ["kwame", "Collector", true]
  ]);
  await db.query(migration("046").sql);
  await db.query(migration("047").sql);
  assert.deepEqual(await staffRows(), staffBefore, "047 changes no staff uuid, role, status or credential");
});

test("047 contains no secrets, passwords, fake production users or foreign project references", () => {
  const sql = migration("047").sql;
  assert.doesNotMatch(sql, /pbkdf2:\d|sb_secret_|sb_publishable_|eyJ[A-Za-z0-9_-]{10,}\./);
  assert.doesNotMatch(sql, /angoswtgcklnorhlosnf/);
  assert.doesNotMatch(sql, /insert into public\.app_users[^;]*values[^;]*'(john|ama|kwame)'/i, "no staff rows are created");
  assert.doesNotMatch(sql, /bbef5ecc-3bdf-40b6-bf8e-c0e206eed9db/i, "no live identifiers");
});

test("fixture: real staff identities with Auth links (set up by a trusted session)", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const biz = (await db.query("select id from public.businesses where code = $1 or legacy_code = $1", [LIVE])).rows[0].id;
  await db.query(`insert into public.app_users (business_id, client_id, username, name, role, active) values
    ($1, 'u-yaw', 'yaw', 'Yaw Collector', 'Collector', true),
    ($1, 'u-esi', 'esi', 'Esi Accountant', 'Accountant', true),
    ($1, 'u-kojo', 'kojo', 'Kojo MD', 'ManagingDirector', true),
    ($1, 'u-abena', 'abena', 'Abena Cashier', 'Cashier', true)`, [biz]);
  const rows = (await db.query("select username, coalesce(client_id, id::text) as app_id from public.app_users")).rows;
  for (const row of rows) {
    ids[row.username] = row.app_id;
    authIds[row.username] = crypto.randomUUID();
    await db.query("insert into public.st_staff_auth_links (business_code, app_user_id, auth_user_id) values ($1, $2, $3)", [LIVE, row.app_id, authIds[row.username]]);
  }
  await db.query("insert into public.businesses (code, name, legacy_code) values ($1, 'Other', $1) on conflict do nothing", [OTHER]);
  await db.query(`create table if not exists auth.users (id uuid primary key, banned_until timestamptz);
    create table if not exists auth.sessions (id uuid primary key default gen_random_uuid(), user_id uuid);
    create table if not exists auth.refresh_tokens (id bigserial primary key, user_id varchar(255))`);
  for (const username of Object.keys(ids)) {
    await db.query("insert into auth.users (id) values ($1)", [authIds[username]]);
    await db.query("insert into auth.sessions (user_id) values ($1)", [authIds[username]]);
    await db.query("insert into auth.refresh_tokens (user_id) values ($1)", [authIds[username]]);
  }
  await db.query("insert into public.smile_trust_cloud_snapshots (business_id, payload) values ($1, $2)", [LIVE, JSON.stringify({
    settings: { businessName: "Smile Trust" },
    users: [{ id: ids.kwame, username: "kwame", role: "Collector", groupId: "g-kwame" }, { id: ids.yaw, username: "yaw", role: "Collector", groupId: "g-yaw" }],
    groups: [{ id: "g-kwame", name: "Kwame route", collectorId: ids.kwame }, { id: "g-yaw", name: "Yaw route", collectorId: ids.yaw }],
    customers: [customer("c-1", ids.kwame, "g-kwame"), customer("c-2", ids.yaw, "g-yaw"), customer("c-empty", ids.kwame, "g-kwame"), customer("c-closed", ids.kwame, "g-kwame", { memberStatus: "Closed", active: false })],
    collections: [], ledgerEntries: [], transactions: [], loans: []
  })]);
  const live = await run(session("kwame"), "select count(*)::int as n from public.app_users");
  assert.ok(live.rows[0].n >= 7, "an active, linked collector session is authorized");
});

// ------------------------------------------------------------------------------------------
// B1 — role escalation

test("B1: an Admin/AssistantManager cannot promote anyone to an owner role or touch JOHN", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const ama = session("ama");
  for (const role of ["SystemOwner", "Owner", "KBA", "Developer"]) {
    await expectDenied(run(ama, "update public.app_users set role = $1 where username = 'kwame'", [role]), `AMA grants ${role}`);
  }
  await expectDenied(run(ama, "select public.st_upsert_staff_account($1, $2)", [LIVE, { id: ids.kwame, username: "kwame", role: "SystemOwner" }]), "AMA grants SystemOwner via RPC");
  await expectDenied(run(ama, "update public.app_users set active = false where username = 'john'"), "AMA deactivates JOHN");
  await expectDenied(run(ama, "update public.app_users set name = 'x' where username = 'john'"), "AMA edits JOHN");
  await expectDenied(run(ama, "select public.st_upsert_staff_account($1, $2)", [LIVE, { id: ids.john, username: "john", role: "SystemOwner", active: false }]), "AMA deactivates JOHN via RPC");
  await expectDenied(run(ama, "update public.app_users set role = 'Collector' where username = 'esi'"), "AMA changes a manager-level account");
  await expectDenied(run(ama, "select public.st_upsert_staff_account($1, $2)", [LIVE, { id: "u-new-admin", username: "newadmin", role: "Admin" }]), "AMA creates an Admin");
  assert.deepEqual(await staffRows(), staffBefore);
});

test("B1: nobody promotes or re-activates themselves, and collectors never change roles", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  await expectDenied(run(session("ama"), "update public.app_users set role = 'SystemOwner' where username = 'ama'"), "AMA self-promotes");
  await expectDenied(run(session("john"), "update public.app_users set active = false where username = 'john'"), "JOHN deactivates himself");
  await expectDenied(run(session("john"), "update public.app_users set role = 'KBA' where username = 'john'"), "JOHN demotes himself");
  const direct = await run(session("kwame"), "update public.app_users set role = 'SystemOwner' where username = 'kwame' returning id");
  assert.equal(direct.rowCount, 0, "RLS hides staff rows from collector updates");
  await expectDenied(run(session("kwame"), "select public.st_upsert_staff_account($1, $2)", [LIVE, { id: ids.kwame, username: "kwame", role: "SystemOwner" }]), "collector RPC");
  await expectDenied(run(session("esi"), "select public.st_upsert_staff_account($1, $2)", [LIVE, { id: ids.yaw, username: "yaw", role: "Collector", active: false }]), "accountant changes staff");
  const byDirector = await run(session("kojo"), "update public.app_users set active = false where username = 'yaw' returning id");
  assert.equal(byDirector.rowCount, 0, "a managing director cannot change staff rows");
  await expectDenied(run(session("john"), "delete from public.app_users where username = 'john'"), "delete JOHN");
  assert.deepEqual(await staffRows(), staffBefore);
});

test("B1: collection RPCs can no longer create or re-role staff rows from payload fields", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const before = (await db.query("select count(*)::int as n from public.app_users")).rows[0].n;
  const result = await run(session("kwame"), "select public.record_collection_from_client($1) as r", [{
    business_code: LIVE, idempotency_key: "b1-escalate", client_id: "b1-col", amount: "5", customer_client_id: "rel-c-1",
    collector_client_id: "attacker-owner", collector_role: "SystemOwner", collector_username: "evil", branch_client_id: "default"
  }]);
  assert.equal(result.rows[0].r.status, "recorded");
  const after = (await db.query("select count(*)::int as n from public.app_users")).rows[0].n;
  assert.equal(after, before, "no staff row was created");
  const col = await db.query("select u.username from public.collections c join public.app_users u on u.id = c.collector_id where c.idempotency_key = 'b1-escalate'");
  assert.equal(col.rows[0].username, "kwame", "the collector is the caller, not the payload");
  assert.equal((await db.query("select count(*)::int as n from public.app_users where role = 'SystemOwner'")).rows[0].n, 1);
});

test("B1: legitimate staff administration still works", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const ama = session("ama");
  const created = await run(ama, "select public.st_upsert_staff_account($1, $2) as r", [LIVE, { id: "u-kweku", username: "kweku", name: "Kweku", role: "Collector" }]);
  assert.deepEqual([created.rows[0].r.ok, created.rows[0].r.created, created.rows[0].r.has_password], [true, true, false]);
  const off = await run(ama, "select public.st_upsert_staff_account($1, $2) as r", [LIVE, { id: "u-kweku", username: "kweku", role: "Collector", active: false }]);
  assert.equal(off.rows[0].r.ok, true);
  const on = await run(ama, "update public.app_users set active = true where client_id = 'u-kweku' returning active");
  assert.equal(on.rows[0].active, true);
  const kba = await run(session("john"), "select public.st_upsert_staff_account($1, $2) as r", [LIVE, { id: "u-kofi", username: "kofi", name: "Kofi KBA", role: "KBA" }]);
  assert.equal(kba.rows[0].r.created, true, "the System Owner may grant owner-level roles");
  const stored = await db.query("select role, password_hash from public.app_users where client_id = 'u-kofi'");
  assert.deepEqual(stored.rows[0], { role: "Owner", password_hash: null });
  ids.kofi = "u-kofi";
  authIds.kofi = crypto.randomUUID();
  await db.query("insert into public.st_staff_auth_links (business_code, app_user_id, auth_user_id) values ($1, 'u-kofi', $2)", [LIVE, authIds.kofi]);
  await expectDenied(run(session("kofi"), "update public.app_users set role = 'SystemOwner' where username = 'esi'"), "KBA grants SystemOwner");
  const kbaManages = await run(session("kofi"), "update public.app_users set name = 'Kojo M.' where username = 'kojo' returning id");
  assert.equal(kbaManages.rowCount, 1, "a KBA owner manages manager-level accounts");
  const sameRole = await run(ama, "select public.st_upsert_staff_account($1, $2) as r", [LIVE, { id: ids.ama, username: "ama", name: "Ama B.", role: "Admin" }]);
  assert.equal(sameRole.rows[0].r.ok, true, "a self edit that keeps role/status is allowed");
  assert.equal((await db.query("select role from public.app_users where username = 'ama'")).rows[0].role, "AssistantManager", "the stored legacy role is kept");
});

// ------------------------------------------------------------------------------------------
// B4 — deactivated, deleted, stale and tampered sessions

test("B4: tampered, cross-business, wrong-user and unauthenticated sessions fail closed", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const attacks = {
    "tampered role claim": session("kwame", { role: "SystemOwner" }),
    "wrong business": session("kwame", { business: OTHER }),
    "wrong user uuid": session("kwame", { appUserId: ids.john }),
    "unlinked Auth identity": session("kwame", { sub: crypto.randomUUID() }),
    "no app claims": { role: "authenticated", sub: authIds.kwame }
  };
  for (const [label, claims] of Object.entries(attacks)) {
    const customers = await run(claims, "select count(*)::int as n from public.customers");
    assert.equal(customers.rows[0].n, 0, `${label}: no tenant rows`);
    const snap = await run(claims, "select count(*)::int as n from public.smile_trust_cloud_snapshots");
    assert.equal(snap.rows[0].n, 0, `${label}: no snapshot`);
    await expectDenied(run(claims, "select public.fetch_business_snapshot($1)", [LIVE]), `${label}: RPC`);
  }
  await expectDenied(run(anonClaims, "select * from public.customers"), "anon");
  await expectDenied(run(anonClaims, "select public.st_submit_collections($1, '[]'::jsonb)", [LIVE]), "anon submit");
});

test("B4: active collector is authorized → deactivated collector's old session is rejected → reactivation needs a fresh sign-in", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const oldSession = session("yaw", { iat: nowSec() - 120 });
  assert.ok((await run(oldSession, "select count(*)::int as n from public.customers")).rows[0].n >= 1, "active: authorized");

  await run(session("ama"), "update public.app_users set active = false where username = 'yaw'");
  assert.equal((await run(oldSession, "select count(*)::int as n from public.customers")).rows[0].n, 0, "deactivated: tenant rows hidden");
  assert.equal((await run(oldSession, "select count(*)::int as n from public.smile_trust_cloud_snapshots")).rows[0].n, 0);
  await expectDenied(run(oldSession, "select public.fetch_business_snapshot($1)", [LIVE]), "deactivated RPC");
  await expectDenied(run(oldSession, "select public.st_submit_collections($1, $2)", [LIVE, JSON.stringify([collectionItem("yaw-1", "c-2", 5, { userId: ids.yaw })])]), "deactivated submit");
  const auth = await db.query("select banned_until from auth.users where id = $1", [authIds.yaw]);
  assert.ok(auth.rows[0].banned_until, "linked Auth identity banned");
  assert.equal((await db.query("select count(*)::int as n from auth.sessions where user_id = $1", [authIds.yaw])).rows[0].n, 0, "Auth sessions revoked");
  assert.equal((await db.query("select count(*)::int as n from auth.refresh_tokens where user_id = $1", [authIds.yaw])).rows[0].n, 0, "refresh tokens revoked");
  const event = await db.query("select event, actor from public.st_staff_security_events where app_user_id = $1 order by id desc limit 1", [ids.yaw]);
  assert.deepEqual(event.rows[0], { event: "staff_deactivated", actor: ids.ama });

  await run(session("ama"), "update public.app_users set active = true where username = 'yaw'");
  assert.equal((await run(oldSession, "select count(*)::int as n from public.customers")).rows[0].n, 0, "reactivated: the pre-deactivation session stays dead");
  const fresh = session("yaw", { iat: nowSec() + 1 });
  assert.ok((await run(fresh, "select count(*)::int as n from public.customers")).rows[0].n >= 1, "reactivated: a new sign-in works");
});

test("B4: a role change or deleted staff row invalidates existing sessions", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const kwecuOld = { ...session("kweku", { appUserId: "u-kweku", role: "Collector", sub: crypto.randomUUID() }) };
  await db.query("insert into public.st_staff_auth_links (business_code, app_user_id, auth_user_id) values ($1, 'u-kweku', $2)", [LIVE, kwecuOld.sub]);
  assert.ok((await run(kwecuOld, "select count(*)::int as n from public.customers")).rows[0].n >= 1);
  await run(session("john"), "update public.app_users set role = 'Cashier' where client_id = 'u-kweku'");
  assert.equal((await run(kwecuOld, "select count(*)::int as n from public.customers")).rows[0].n, 0, "old Collector claim no longer matches");
  await db.query("delete from public.app_users where client_id = 'u-kweku'");
  const asCashier = { ...kwecuOld, iat: nowSec() + 2, app_metadata: { ...kwecuOld.app_metadata, app_role: "Cashier" } };
  assert.equal((await run(asCashier, "select count(*)::int as n from public.customers")).rows[0].n, 0, "deleted staff are rejected");
});

// ------------------------------------------------------------------------------------------
// B2 — snapshot authority and the collector upload path

test("B2: collectors cannot insert, update or delete the whole snapshot; managers can", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const before = await snapshot();
  const upd = await run(session("kwame"), "update public.smile_trust_cloud_snapshots set payload = '{}'::jsonb where business_id = $1 returning id", [LIVE]);
  assert.equal(upd.rowCount, 0);
  await expectDenied(run(session("kwame"), "insert into public.smile_trust_cloud_snapshots (business_id, payload) values ($1, '{}') on conflict (business_id) do update set payload = excluded.payload", [LIVE]), "collector upsert");
  await expectDenied(run(session("kwame"), "delete from public.smile_trust_cloud_snapshots where business_id = $1", [LIVE]), "collector delete");
  const cashier = await run(session("abena"), "update public.smile_trust_cloud_snapshots set saved_by = 'x' where business_id = $1 returning id", [LIVE]);
  assert.equal(cashier.rowCount, 0, "a cashier cannot write the snapshot");
  assert.deepEqual(await snapshot(), before);
  const read = await run(session("kwame"), "select payload from public.smile_trust_cloud_snapshots where business_id = $1", [LIVE]);
  assert.equal(read.rowCount, 1, "collectors still read the business snapshot to sync");
  const managed = await run(session("ama"), "update public.smile_trust_cloud_snapshots set saved_by = 'ama' where business_id = $1 returning id", [LIVE]);
  assert.equal(managed.rowCount, 1);
});

test("B2: offline-queued collections upload through st_submit_collections, once, with their ledger pair", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const kwame = session("kwame");
  const queued = [
    collectionItem("off-1", "c-1", 10, { userId: ids.kwame }),
    collectionItem("off-2", "c-1", 12.5, { userId: ids.kwame }),
    collectionItem("off-3", "c-1", 7, { userId: ids.kwame, method: "MTN Mobile Money" })
  ];
  const first = (await run(kwame, "select public.st_submit_collections($1, $2) as r", [LIVE, JSON.stringify(queued)])).rows[0].r;
  assert.deepEqual(first.accepted, ["off-1", "off-2", "off-3"]);
  assert.deepEqual(first.rejected, []);
  const retry = (await run(kwame, "select public.st_submit_collections($1, $2) as r", [LIVE, JSON.stringify(queued)])).rows[0].r;
  assert.deepEqual(retry.accepted, [], "a retried upload adds nothing");
  assert.deepEqual(retry.duplicates, ["off-1", "off-2", "off-3"]);
  const payload = await snapshot();
  assert.equal(payload.collections.filter((c) => c.id.startsWith("off-")).length, 3);
  assert.equal(payload.ledgerEntries.filter((e) => e.referenceId?.startsWith("off-")).length, 6);
  assert.equal(payload.transactions.filter((e) => e.ref?.startsWith("off-")).length, 3);
  const momo = payload.collections.find((c) => c.id === "off-3");
  assert.equal(momo.verificationStatus, "Pending Verification", "non-cash collections await verification");
  assert.ok(payload.collections.filter((c) => c.id.startsWith("off-")).every((c) => c.userId === ids.kwame && c.reversed === false && c.submittedBy === ids.kwame));
  const ledger = await db.query("select count(*)::int as n from public.st_snapshot_financial_ledger where business_id = $1 and record_id like 'off-%'", [LIVE]);
  assert.equal(ledger.rows[0].n, 3, "uploaded collections are registered as posted history");
});

test("B2: the collector upload rejects forged, foreign, closed-member, reversed and inconsistent items", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const kwame = session("kwame");
  const badLedger = collectionItem("bad-ledger", "c-1", 9, { userId: ids.kwame });
  badLedger.ledgerEntries[0].amount = 90;
  const items = [
    collectionItem("as-yaw", "c-1", 5, { userId: ids.yaw }),
    collectionItem("foreign", "c-2", 5, { userId: ids.kwame }),
    collectionItem("closed", "c-closed", 5, { userId: ids.kwame }),
    collectionItem("rev", "c-1", 5, { userId: ids.kwame, reversed: true }),
    collectionItem("neg", "c-1", -5, { userId: ids.kwame }),
    collectionItem("ghost", "c-nope", 5, { userId: ids.kwame }),
    badLedger
  ];
  const result = (await run(kwame, "select public.st_submit_collections($1, $2) as r", [LIVE, JSON.stringify(items)])).rows[0].r;
  assert.deepEqual(result.accepted, []);
  assert.deepEqual(Object.fromEntries(result.rejected.map((r) => [r.id, r.reason])), {
    "as-yaw": "collection was recorded by another staff member",
    foreign: "member is assigned to another collector",
    closed: "member is not active",
    rev: "a reversed collection cannot be submitted",
    neg: "invalid amount",
    ghost: "unknown member",
    "bad-ledger": "invalid ledger entry"
  });
  await expectDenied(run(kwame, "select public.st_submit_collections($1, $2)", [OTHER, JSON.stringify([collectionItem("x", "c-1", 5)])]), "other business");
});

// ------------------------------------------------------------------------------------------
// B3 — secrets never stay in the stored snapshot

test("B3: injected secrets are stripped from the stored snapshot and staff PINs are hashed server-side", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const payload = await snapshot();
  const markers = {
    passwordHash: "pbkdf2:120000:feedfacefeedface:deadbeef", password: "PlainPass-123", loginPasswordHint: "hint-PlainPass",
    mfaSecret: "JBSWY3DPEHPK3PXPMFASECRET", totpSecret: "TOTPSECRETVALUE234", activationCode: "ACTV-CODE-9999",
    accessToken: "eyJhbGciOiJIUzI1NiJ9.access.token", refresh_token: "refresh-token-value", recoveryCodes: ["RC-1111", "RC-2222"]
  };
  payload.users = payload.users.map((user) => ({ ...user, ...markers }));
  payload.settings = { ...payload.settings, syncToken: "sync-token-value", syncAccessKey: "sync-access-key", momoWebhookSecret: "momo-webhook-secret", nested: { clientSecret: "nested-client-secret" } };
  payload.customers = payload.customers.map((c) => (c.id === "c-1" ? { ...c, portalPin: "8642", portalPinSetAt: new Date().toISOString(), portalPinSource: "manual" } : c));
  await run(session("ama"), "update public.smile_trust_cloud_snapshots set payload = $2 where business_id = $1", [LIVE, JSON.stringify(payload)]);
  const stored = JSON.stringify(await snapshot());
  for (const value of [...Object.values(markers).flat(), "sync-token-value", "sync-access-key", "momo-webhook-secret", "nested-client-secret"]) {
    assert.equal(stored.includes(value), false, `secret value survived: ${value.slice(0, 6)}…`);
  }
  assert.doesNotMatch(stored, /"(passwordHash|mfaSecret|totpSecret|portalPin|activationCode|accessToken|refresh_token|recoveryCodes)"/);
  const pin = await db.query("select pin_hash from public.st_portal_pins where business_code = $1 and customer_id = 'c-1'", [LIVE]);
  assert.match(pin.rows[0].pin_hash, /^\$2[aby]\$/, "the PIN is stored as a bcrypt hash");
  const login = await run(anonClaims, "select public.portal_login($1, 'acc-c-1', '8642') as r", [LIVE]);
  assert.equal(login.rows[0].r.ok, true, "member portal login keeps working with the staff-set PIN");
  const wrong = await run(anonClaims, "select public.portal_login($1, 'acc-c-1', '4567') as r", [LIVE]);
  assert.equal(wrong.rows[0].r.ok, false, "the phone default no longer works once a PIN is set");
});

// ------------------------------------------------------------------------------------------
// B5 — MFA secrets and resets

test("B5: clients cannot write or read TOTP secrets; resets are owner-only and audited", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  await expectDenied(run(session("john"), "select public.upsert_user_mfa($1, $2, 'JBSWY3DPEHPK3PXP', true)", [LIVE, ids.john]), "owner writes own TOTP");
  await expectDenied(run(session("kwame"), "select public.upsert_user_mfa($1, $2, 'JBSWY3DPEHPK3PXP', false)", [LIVE, ids.kwame]), "collector writes TOTP");
  await expectDenied(run(session("john"), "select * from public.user_mfa_secrets"), "owner reads TOTP");
  const biz = (await db.query("select id from public.businesses where code = $1 or legacy_code = $1", [LIVE])).rows[0].id;
  await db.query("insert into public.user_mfa_secrets (business_id, user_client_id, secret, enabled) values ($1, $2, 'AMATESTSECRETAAAA', true)", [biz, ids.ama]);
  await expectDenied(run(session("ama"), "select public.st_reset_staff_mfa($1, 'esi', 'lost phone')", [LIVE]), "Admin resets MFA");
  await expectDenied(run(session("john"), "select public.st_reset_staff_mfa($1, 'john', 'lost phone')", [LIVE]), "owner resets own MFA");
  await expectDenied(run(session("kofi"), "select public.st_reset_staff_mfa($1, 'john', 'lost phone')", [LIVE]), "KBA resets the System Owner's MFA");
  await assert.rejects(run(session("john"), "select public.st_reset_staff_mfa($1, 'ama', '  ')", [LIVE]), /reason is required/);
  const reset = await run(session("john"), "select public.st_reset_staff_mfa($1, 'ama', 'lost phone') as r", [LIVE]);
  assert.deepEqual(reset.rows[0].r, { ok: true, username: "ama", had_mfa: true });
  assert.equal((await db.query("select count(*)::int as n from public.user_mfa_secrets where user_client_id = $1", [ids.ama])).rows[0].n, 0);
  const audit = await db.query("select actor, details from public.st_staff_security_events where event = 'mfa_reset' and app_user_id = $1", [ids.ama]);
  assert.equal(audit.rows[0].actor, ids.john);
  assert.equal(audit.rows[0].details.reason, "lost phone");
  assert.equal(JSON.stringify(audit.rows).includes("AMATESTSECRET"), false, "the secret is never logged");
  const amaOld = session("ama", { iat: nowSec() - 60 });
  assert.equal((await run(amaOld, "select count(*)::int as n from public.customers")).rows[0].n, 0, "sessions from before the reset must sign in again");
});

// ------------------------------------------------------------------------------------------
// B6 — financial lockdown

test("B6: collectors cannot alter, delete or insert posted relational financial rows", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const kwame = session("kwame");
  await expectDenied(run(kwame, "update public.collections set amount = 1 where idempotency_key = 'b1-escalate'"), "collector edits amount");
  await expectDenied(run(kwame, "delete from public.collections where idempotency_key = 'b1-escalate'"), "collector deletes collection");
  await expectDenied(run(kwame, "update public.ledger_entries set amount = 1"), "collector edits ledger");
  await expectDenied(run(kwame, "insert into public.ledger_entries (business_id, entry_type, amount, direction) select id, 'Susu Deposit', 1, 'credit' from public.businesses limit 1"), "collector inserts ledger");
  await expectDenied(run(session("ama"), "update public.collections set amount = 1 where idempotency_key = 'b1-escalate'"), "manager edits posted amount");
  await assert.rejects(db.query("update public.collections set amount = 1 where idempotency_key = 'b1-escalate'"), /immutable/, "even a direct database session cannot rewrite history by accident");
  await assert.rejects(db.query("delete from public.collections where idempotency_key = 'b1-escalate'"), /cannot be deleted/);
  await db.query("update public.collections set verification_status = 'Verified' where idempotency_key = 'b1-escalate'");
  await db.query("update public.collections set reversed = true where idempotency_key = 'b1-escalate'");
  await assert.rejects(db.query("update public.collections set reversed = false where idempotency_key = 'b1-escalate'"), /reversal cannot be undone/);
  const amount = await db.query("select amount from public.collections where idempotency_key = 'b1-escalate'");
  assert.equal(Number(amount.rows[0].amount), 5);
});

test("B6: collection RPCs are idempotent, use the session role and never trust payload roles", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const kwame = session("kwame");
  const payload = { business_code: LIVE, idempotency_key: "idem-momo-1", client_id: "momo-1", receipt_no: "RCP-MOMO-1", amount: "20", payment_method: "MTN Mobile Money", verification_status: "Verified", customer_client_id: "rel-c-1", branch_client_id: "default" };
  const first = await run(kwame, "select public.record_collection_from_client($1) as r", [payload]);
  const again = await run(kwame, "select public.record_collection_from_client($1) as r", [payload]);
  assert.equal(first.rows[0].r.status, "recorded");
  assert.equal(again.rows[0].r.status, "duplicate", "a duplicate submit is safe");
  const stored = await db.query("select count(*)::int as n, max(verification_status) as v from public.collections where idempotency_key = 'idem-momo-1'");
  assert.deepEqual(stored.rows[0], { n: 1, v: "Pending Verification" }, "a collector cannot self-verify mobile money");
  await expectDenied(run(kwame, "select public.record_collection_from_client($1)", [{ ...payload, idempotency_key: "neg", amount: "-5" }]), "negative amount");
  await expectDenied(run(kwame, "select public.record_withdrawal_from_client($1)", [{ business_code: LIVE, idempotency_key: "wd-1", amount_pesewas: 500, customer_client_id: "rel-c-1", role: "Admin" }]), "collector withdrawal");
  await expectDenied(run(session("abena"), "select public.record_withdrawal_from_client($1)", [{ business_code: LIVE, idempotency_key: "wd-2", amount_pesewas: 150000, customer_client_id: "rel-c-1", role: "Admin" }]), "cashier bypasses float limit with a forged role", /cashier float limit/);
  const ok = await run(session("abena"), "select public.record_withdrawal_from_client($1) as r", [{ business_code: LIVE, idempotency_key: "wd-3", amount_pesewas: 5000, customer_client_id: "rel-c-1", actor_client_id: "someone-else" }]);
  assert.equal(ok.rows[0].r.status, "recorded");
  const actor = await db.query("select u.username from public.ledger_entries l join public.app_users u on u.id = l.created_by where l.idempotency_key = 'wd-3'");
  assert.equal(actor.rows[0].username, "abena", "the recorded actor is the caller");
  await expectDenied(run(kwame, "select public.import_snapshot_batch($1, '{}'::jsonb)", [LIVE]), "collector import");
  await expectDenied(run(session("ama"), "select public.import_snapshot_batch($1, '{}'::jsonb)", [LIVE]), "admin import");
});

test("B6: only managers approve workflow rows", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const biz = (await db.query("select id from public.businesses where code = $1 or legacy_code = $1", [LIVE])).rows[0].id;
  const cust = (await db.query("select id from public.customers where business_id = $1 limit 1", [biz])).rows[0].id;
  const wr = await db.query("insert into public.withdrawal_requests (business_id, customer_id, amount_pesewas, status) values ($1, $2, 1000, 'Pending') returning id", [biz, cust]);
  const id = wr.rows[0].id;
  const byCollector = await run(session("kwame"), "update public.withdrawal_requests set status = 'Approved' where id = $1 returning id", [id]);
  assert.equal(byCollector.rowCount, 0, "a collector cannot approve");
  const byCashier = await run(session("abena"), "update public.withdrawal_requests set status = 'Approved' where id = $1 returning id", [id]);
  assert.equal(byCashier.rowCount, 0, "a cashier cannot approve");
  await expectDenied(run(session("ama"), "delete from public.withdrawal_requests where id = $1", [id]), "manager deletes a request");
  const byManager = await run(session("esi"), "update public.withdrawal_requests set status = 'Approved' where id = $1 returning id", [id]);
  assert.equal(byManager.rowCount, 1);
});

test("B6: posted snapshot history is append-only; reversals and approved adjustments are the corrections", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const ama = session("ama");
  const write = (payload) => run(ama, "update public.smile_trust_cloud_snapshots set payload = $2 where business_id = $1", [LIVE, JSON.stringify(payload)]);
  let payload = await snapshot();
  const edited = structuredClone(payload);
  edited.collections.find((c) => c.id === "off-1").amount = 1;
  await expectDenied(write(edited), "change a posted amount", /amount cannot be changed/);
  const edited2 = structuredClone(payload);
  edited2.collections.find((c) => c.id === "off-1").amountPesewas = 100;
  await expectDenied(write(edited2), "change a posted amountPesewas", /amount cannot be changed/);
  const removed = structuredClone(payload);
  removed.collections = removed.collections.filter((c) => c.id !== "off-2");
  await expectDenied(write(removed), "delete a posted collection", /cannot be removed/);
  const moved = structuredClone(payload);
  moved.ledgerEntries.find((e) => e.id === "led-off-1-c").customerId = "c-2";
  await expectDenied(write(moved), "move a ledger entry", /another member/);
  const txGone = structuredClone(payload);
  txGone.transactions = txGone.transactions.filter((e) => e.id !== "tx-off-1");
  await expectDenied(write(txGone), "delete a transaction", /cannot be removed/);

  const reversed = structuredClone(payload);
  reversed.collections.find((c) => c.id === "off-2").reversed = true;
  reversed.ledgerEntries.filter((e) => e.referenceId === "off-2").forEach((e) => { e.reversed = true; });
  await write(reversed);
  payload = await snapshot();
  const undo = structuredClone(payload);
  undo.collections.find((c) => c.id === "off-2").reversed = false;
  await expectDenied(write(undo), "undo a reversal", /reversal cannot be undone/);

  const adjusted = structuredClone(payload);
  const target = adjusted.collections.find((c) => c.id === "off-1");
  target.amount = 7.5;
  target.amountPesewas = 750;
  target.adjusted = true;
  adjusted.collectionAdjustments = [{ id: "adj-1", collectionId: "off-1", originalAmount: 10, amount: 2.5, reason: "overstated", status: "Approved", approvedBy: ids.ama }];
  await write(adjusted);
  assert.equal((await snapshot()).collections.find((c) => c.id === "off-1").amount, 7.5, "an approved adjustment applies");
  const notApproved = structuredClone(await snapshot());
  notApproved.collections.find((c) => c.id === "off-3").amount = 1;
  notApproved.collections.find((c) => c.id === "off-3").amountPesewas = 100;
  notApproved.collectionAdjustments.push({ id: "adj-2", collectionId: "off-3", originalAmount: 7, amount: 6, status: "Pending" });
  await expectDenied(write(notApproved), "pending adjustment", /amount cannot be changed/);
});

// ------------------------------------------------------------------------------------------
// B7 — member lifecycle

test("B7: members with history are closed, never deleted; status changes are authorized and audited", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const write = (claims, payload) => run(claims, "update public.smile_trust_cloud_snapshots set payload = $2 where business_id = $1", [LIVE, JSON.stringify(payload)]);
  const payload = await snapshot();
  const deleted = structuredClone(payload);
  deleted.customers = deleted.customers.filter((c) => c.id !== "c-1");
  deleted.collections = deleted.collections.filter((c) => c.customerId !== "c-1");
  await expectDenied(write(session("john"), deleted), "delete a member with history", /cannot be deleted|cannot be removed/);

  const closed = structuredClone(payload);
  Object.assign(closed.customers.find((c) => c.id === "c-1"), { memberStatus: "Closed", active: false });
  await expectDenied(write(session("esi"), closed), "accountant closes a member", /member status/);
  await write(session("ama"), closed);
  let events = await db.query("select from_status, to_status, actor, actor_role from public.st_member_lifecycle_events where customer_id = 'c-1' order by id");
  assert.deepEqual(events.rows.at(-1), { from_status: "Active", to_status: "Closed", actor: ids.ama, actor_role: "Admin" });
  const afterClose = await snapshot();
  assert.ok(afterClose.collections.some((c) => c.customerId === "c-1"), "history is retained for reports");

  const reopened = structuredClone(afterClose);
  Object.assign(reopened.customers.find((c) => c.id === "c-1"), { memberStatus: "Active", active: true });
  await write(session("kojo"), reopened);
  events = await db.query("select to_status, actor from public.st_member_lifecycle_events where customer_id = 'c-1' order by id desc limit 1");
  assert.deepEqual(events.rows[0], { to_status: "Active", actor: ids.kojo });

  const dropEmpty = structuredClone(await snapshot());
  dropEmpty.customers = dropEmpty.customers.filter((c) => c.id !== "c-empty");
  await expectDenied(write(session("ama"), dropEmpty), "admin hard-deletes a zero-history member", /only the System Owner/);
  await write(session("john"), dropEmpty);
  assert.equal((await snapshot()).customers.some((c) => c.id === "c-empty"), false, "the System Owner may remove a zero-history member");
});

test("B7: relational members with history cannot be deleted, even by the System Owner; zero-history deletes are owner-only", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const withHistory = (await db.query("select c.id from public.customers c where exists (select 1 from public.collections x where x.customer_id = c.id) limit 1")).rows[0].id;
  await expectDenied(run(session("john"), "delete from public.customers where id = $1", [withHistory]), "owner deletes member with history", /financial history/);
  await assert.rejects(db.query("delete from public.customers where id = $1", [withHistory]), /financial history/, "no cascade from a direct session either");
  assert.equal((await db.query("select count(*)::int as n from public.collections where customer_id = $1", [withHistory])).rows[0].n > 0, true);

  const biz = (await db.query("select id, (select id from public.branches where business_id = b.id limit 1) as branch from public.businesses b where code = $1 or legacy_code = $1", [LIVE])).rows[0];
  const collector = (await db.query("select id from public.app_users where username = 'kwame'")).rows[0].id;
  const empty = (await db.query("insert into public.customers (business_id, branch_id, collector_id, client_id, account_no, name, phone, active) values ($1, $2, $3, 'rel-empty', 'rel-empty', 'Empty', '', true) returning id", [biz.id, biz.branch, collector])).rows[0].id;
  const byAdmin = await run(session("ama"), "delete from public.customers where id = $1 returning id", [empty]);
  assert.equal(byAdmin.rowCount, 0, "only the System Owner may delete");
  await expectDenied(run(session("esi"), "update public.customers set member_status = 'Closed', active = false where id = $1", [empty]), "accountant closes", /member status/);
  await run(session("ama"), "update public.customers set member_status = 'Closed', active = false where id = $1", [empty]);
  const ev = await db.query("select source, to_status, actor from public.st_member_lifecycle_events where customer_id = 'rel-empty' order by id desc limit 1");
  assert.deepEqual(ev.rows[0], { source: "relational", to_status: "Closed", actor: ids.ama });
  const byOwner = await run(session("john"), "delete from public.customers where id = $1 returning id", [empty]);
  assert.equal(byOwner.rowCount, 1);
});

// ------------------------------------------------------------------------------------------
// Idempotency

test("re-applying 047 twice keeps data, staff identities and every guard", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const ledgerBefore = (await db.query("select count(*)::int as n from public.st_snapshot_financial_ledger")).rows[0].n;
  const snapBefore = await snapshot();
  const staff = (await db.query(`select ${STAFF_COLUMNS} from public.app_users order by username`)).rows;
  await db.query(migration("047").sql);
  await db.query(migration("047").sql);
  assert.deepEqual((await db.query(`select ${STAFF_COLUMNS} from public.app_users order by username`)).rows, staff);
  const john = staff.find((row) => row.username === "john");
  assert.deepEqual([john.id, john.role, john.active], [staffBefore.find((r) => r.username === "john").id, "SystemOwner", true]);
  assert.equal((await db.query("select count(*)::int as n from public.st_snapshot_financial_ledger")).rows[0].n, ledgerBefore);
  assert.deepEqual(await snapshot(), snapBefore);
  await expectDenied(run(session("ama"), "update public.app_users set role = 'SystemOwner' where username = 'kwame'"), "B1 after re-apply");
  assert.equal((await run(session("yaw", { iat: nowSec() - 3600 }), "select count(*)::int as n from public.customers")).rows[0].n, 0, "B4 after re-apply");
  const upd = await run(session("kwame"), "update public.smile_trust_cloud_snapshots set payload = '{}' where business_id = $1 returning id", [LIVE]);
  assert.equal(upd.rowCount, 0, "B2 after re-apply");
  await expectDenied(run(session("john"), "select public.upsert_user_mfa($1, $2, 'x', true)", [LIVE, ids.john]), "B5 after re-apply");
  const { rows } = await db.query(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute') order by 1`);
  assert.deepEqual(rows.map((row) => row.proname), ["portal_change_pin", "portal_login", "portal_refresh", "portal_request_withdrawal"]);
});
