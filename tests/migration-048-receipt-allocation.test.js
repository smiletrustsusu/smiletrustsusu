/**
 * Migration 048 (server-allocated collection receipts) on a disposable local PostgreSQL built the
 * way the live project was (001–045 without supabase/rls.sql, then 046, 047), with legacy receipts
 * already posted before 048 is applied. Concurrency uses real, separate database connections that
 * hold real transactions open; nothing is mocked. Never connects to a remote database.
 */
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { migrationFiles, startLocalSupabase } from "./helpers/supabase-local-db.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LIVE = "SMILE-TRUST";
const OTHER = "st-other-biz";
const ROLES = { john: "SystemOwner", ama: "Admin", kwame: "Collector", yaw: "Collector" };
const ids = { john: "demo-user-john", ama: "demo-user-ama", kwame: "demo-user-kwame", yaw: "u-yaw" };
const authIds = {};
const CUSTOMER = "demo-customer-001";
const YAW_CUSTOMER = "c-yaw-1";
const LEGACY_RECEIPTS = ["ACC-00000041", "KW1-7", "SRV-12", "legacy receipt #9", "RCP-1700000000000"];
const migration = (prefix) => migrationFiles().find((item) => item.name.startsWith(`${prefix}_`));
const ROLLBACK = fs.readFileSync(path.join(root, "supabase", "rollbacks", "048_server_receipt_allocation.rollback.sql"), "utf8");
const FENCE_REMOVAL = fs.readFileSync(path.join(root, "supabase", "rollbacks", "048_write_protocol_fence.emergency-removal.sql"), "utf8");
const nowSec = () => Math.floor(Date.now() / 1000);

let db;
let pgLib;
let biz;
const devices = [];

function session(username, { role, business = LIVE, appUserId } = {}) {
  return {
    role: "authenticated",
    sub: authIds[username],
    iat: nowSec(),
    app_metadata: { business_code: business, app_user_id: appUserId || ids[username], app_role: role || ROLES[username] }
  };
}
const serviceClaims = { role: "service_role" };

function run(claims, sql, params) {
  const role = claims?.role === "anon" ? "anon" : claims?.role === "service_role" ? "service_role" : "authenticated";
  return db.asRole(role, claims, async (client) => {
    await client.query("select set_config('request.headers', $1, true)", [JSON.stringify({"x-smile-write-protocol": "048-v1"})]);
    return client.query(sql, params);
  });
}
const record = async (claims, payload) => (await run(claims, "select public.record_collection_from_client($1) as r", [payload])).rows[0].r;

function payload(key, extra = {}) {
  return {
    business_code: LIVE, idempotency_key: key, client_id: `col-${key}`, amount: "10", amount_pesewas: "1000",
    customer_client_id: CUSTOMER, branch_client_id: "demo-branch-accra", collector_client_id: ids.kwame,
    payment_method: "Cash", collection_date: "2026-10-06", ...extra
  };
}

async function expectDenied(promise, label) {
  await assert.rejects(promise, (error) => {
    assert.ok(
      ["42501", "P0001", "23514", "22023"].includes(error.code) || /permission denied|not authorized|row-level security/i.test(error.message),
      `${label}: unexpected error ${error.code} ${error.message}`
    );
    return true;
  }, `${label} should be denied`);
}

/** A second device: its own connection and its own open transaction under a staff session. */
async function device(claims) {
  const client = new pgLib.Client({ host: db.connection.host, port: db.connection.port, user: "postgres", password: db.connection.password, database: "postgres" });
  await client.connect();
  devices.push(client);
  await client.query("begin");
  await client.query("select set_config('request.headers', $1, true)", [JSON.stringify({"x-smile-write-protocol": "048-v1"})]);
  await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
  await client.query(`set local role ${claims.role === "service_role" ? "service_role" : "authenticated"}`);
  return {
    record: async (p) => (await client.query("select public.record_collection_from_client($1) as r", [p])).rows[0].r,
    commit: () => client.query("commit"),
    rollback: () => client.query("rollback")
  };
}

const counter = async () => Number((await db.query("select last_value from public.receipt_sequences where business_id = $1", [biz])).rows[0].last_value);
const collectionsFor = async (key) => (await db.query("select id, receipt_no from public.collections where business_id = $1 and idempotency_key = $2", [biz, key])).rows;
const creditsFor = async (collectionId) => (await db.query(
  "select receipt_no, amount from public.ledger_entries where reference_id = $1 and reference_type = 'collection' and direction = 'credit'", [collectionId])).rows;
const allReceipts = async () => (await db.query("select id, receipt_no from public.collections where business_id = $1 order by id", [biz])).rows;
const pending = (promise) => Promise.race([promise.then(() => "settled", () => "settled"), new Promise((resolve) => setTimeout(() => resolve("pending"), 300))]);

before(async () => {
  db = await startLocalSupabase({ upTo: "045", withRlsSql: false });
  if (!db) {
    if (process.env.SMILE_SKIP_DB_TESTS === "1") return;
    throw new Error("embedded-postgres is required for migration tests (npm install)");
  }
  ({ default: pgLib } = await import("pg"));
}, { timeout: 240000 });

after(async () => {
  for (const client of devices) await client.end().catch(() => {});
  await db?.stop();
});

const skip = () => !db;

test("048 fixture: live-shaped database through 047 with legacy receipts already posted", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  assert.deepEqual(db.applied.filter((item) => !item.ok), []);
  await db.query(migration("046").sql);
  await db.query(migration("047").sql);
  biz = (await db.query("select id from public.businesses where code = $1 or legacy_code = $1", [LIVE])).rows[0].id;
  await db.query("insert into public.app_users (business_id, client_id, username, name, role, active) values ($1, 'u-yaw', 'yaw', 'Yaw Collector', 'Collector', true)", [biz]);
  for (const username of Object.keys(ids)) {
    authIds[username] = crypto.randomUUID();
    await db.query("insert into public.st_staff_auth_links (business_code, app_user_id, auth_user_id) values ($1, $2, $3)", [LIVE, ids[username], authIds[username]]);
  }
  await db.query("insert into public.businesses (code, name, legacy_code) values ($1, 'Other', $1) on conflict do nothing", [OTHER]);
  const accra = (await db.query("select id from public.branches where business_id = $1 and client_id = 'demo-branch-accra'", [biz])).rows[0].id;
  await db.query("insert into public.branches (business_id, name, client_id, active, collector_code) values ($1, 'Kumasi', 'demo-branch-kumasi', true, 'KSI')", [biz]);
  const yaw = (await db.query("select id from public.app_users where client_id = 'u-yaw'")).rows[0].id;
  const kwame = (await db.query("select id from public.app_users where client_id = 'demo-user-kwame'")).rows[0].id;
  await db.query("insert into public.customers (business_id, branch_id, collector_id, client_id, account_no, name, phone, active) values ($1, $2, $3, $4, 'acc-yaw-1', 'Yaw Member', '', true)", [biz, accra, yaw, YAW_CUSTOMER]);
  const customer = (await db.query("select id from public.customers where client_id = $1", [CUSTOMER])).rows[0].id;
  for (const [i, receipt] of LEGACY_RECEIPTS.entries()) {
    await db.query(`insert into public.collections (business_id, branch_id, customer_id, collector_id, receipt_no, idempotency_key, amount, payment_method, verification_status, collection_date, client_created_at)
      values ($1, $2, $3, $4, $5, $6, 5, 'Cash', 'Verified', '2026-09-01', now())`, [biz, accra, customer, kwame, receipt, `legacy-${i}`]);
  }
  await db.query(`insert into public.ledger_entries (business_id, entry_type, customer_id, amount, direction, reference_type, receipt_no)
    values ($1, 'Withdrawal', $2, 5, 'debit', 'withdrawal', 'WDL-50')`, [biz, customer]);
  assert.equal(await counter(), 0, "044 created the counter at zero; nothing advanced it");
});

test("048: seeding raises the counter past every legacy numeric receipt and renumbers nothing", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const before = await allReceipts();
  await db.query(migration("048").sql);
  assert.equal(await counter(), 50, "max of ACC-00000041, KW1-7, SRV-12 and the ledger's WDL-50; unparseable and 13-digit suffixes are ignored");
  assert.deepEqual(await allReceipts(), before, "no historical receipt changed");
  const other = (await db.query("select rs.last_value from public.receipt_sequences rs join public.businesses b on b.id = rs.business_id where b.code = $1", [OTHER])).rows;
  assert.deepEqual(other.map((r) => Number(r.last_value)), [0], "every business has a counter");
});

test("048: re-applying is idempotent and never lowers a counter", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  await db.query("update public.receipt_sequences set last_value = 60 where business_id = $1", [biz]);
  await db.query(migration("048").sql);
  assert.equal(await counter(), 60, "a counter above the legacy maximum is kept");
  await db.query("update public.receipt_sequences set last_value = 50 where business_id = $1", [biz]);
  await db.query(migration("048").sql);
  assert.equal(await counter(), 50);
});

test("048 contains no secrets or foreign project references and keeps both unique constraints", async (t) => {
  const sql = migration("048").sql;
  assert.doesNotMatch(sql, /pbkdf2:\d|sb_secret_|sb_publishable_|eyJ[A-Za-z0-9_-]{10,}\.|service_role_key/i);
  assert.doesNotMatch(sql, /angoswtgcklnorhlosnf|qouokiqoepjpoksupskb/);
  assert.doesNotMatch(sql, /max\(\s*receipt_no\s*\)\s*\+\s*1/i, "no max()+1 allocation");
  assert.doesNotMatch(sql, /drop (constraint|index)|alter table public\.collections/i);
  assert.doesNotMatch(sql, /create or replace function public\.record_collection_from_client\b/, "the 047 public wrapper is not replaced");
  if (skip()) return t.skip("local database unavailable");
  const constraints = (await db.query("select pg_get_constraintdef(oid) as def from pg_constraint where conrelid = 'public.collections'::regclass and contype = 'u' order by 1")).rows.map((r) => r.def);
  for (const expected of ["UNIQUE (business_id, idempotency_key)", "UNIQUE (business_id, receipt_no)"]) {
    assert.ok(constraints.includes(expected), `${expected} kept`);
  }
  const wrapper = (await db.query("select prosrc from pg_proc where oid = 'public.record_collection_from_client(jsonb)'::regprocedure")).rows[0].prosrc;
  for (const guard of ["st_assert_business", "st_assert_payload_amounts", "st_assert_customer_assignment", "st_scope_staff_payload"]) {
    assert.match(wrapper, new RegExp(guard), `047 wrapper still calls ${guard}`);
  }
});

test("allocator: not callable by clients, and the counter cannot be moved by them", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  for (const claims of [session("kwame"), session("john"), { role: "anon" }]) {
    await expectDenied(run(claims, "select public.st_internal_allocate_receipt_no($1, 'ACC')", [biz]), `${claims.role} ${claims.app_metadata?.app_role || ""} allocator`);
    await expectDenied(run(claims, "select public.st_internal_record_collection_from_client($1)", [payload("direct-internal")]), "internal write");
    await expectDenied(run(claims, "update public.receipt_sequences set last_value = 1 where business_id = $1", [biz]), "counter update");
    await expectDenied(run(claims, "select public.next_receipt_no($1, 'ACC')", [biz]), "legacy next_receipt_no");
  }
  const grants = (await db.query(`select p.proname, r.rolname from pg_proc p cross join (values ('anon'), ('authenticated')) r(rolname)
    where p.pronamespace = 'public'::regnamespace and p.proname in ('st_internal_allocate_receipt_no', 'st_receipt_prefix', 'st_receipt_suffix', 'st_internal_record_collection_from_client')
      and has_function_privilege(r.rolname, p.oid, 'execute')`)).rows;
  assert.deepEqual(grants, []);
  assert.equal(await counter(), 50);
});

test("a signed-in collector gets a server receipt; a compatibility-declared device's receipt is ignored; collection and ledger match", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const r = await record(session("kwame"), payload("k-1", { receipt_no: "ACC-00000001", payment_no: "EVIL-99999999", collector_code: "ZZZ" }));
  assert.deepEqual([r.status, r.receipt_no], ["recorded", "ACC-00000051"]);
  const [row] = await collectionsFor("k-1");
  assert.equal(row.id, r.collection_id);
  assert.equal(row.receipt_no, "ACC-00000051");
  assert.deepEqual((await creditsFor(row.id)).map((c) => [c.receipt_no, Number(c.amount)]), [["ACC-00000051", 10]], "exactly one ledger credit with the same receipt");
  const owner = await record(session("john"), payload("j-1", { receipt_no: "OWNER-CHOSEN-1" }));
  assert.equal(owner.receipt_no, "ACC-00000052", "managers and owners do not choose receipt numbers either");
});

test("the prefix comes from the member's branch in the database, never from the payload", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const r = await record(session("kwame"), payload("k-prefix", { branch_client_id: "demo-branch-kumasi", receipt_no: "KSI-00000001" }));
  assert.match(r.receipt_no, /^ACC-\d{8}$/, "the member's branch (ACC), not the branch the device named (KSI)");
});

test("compatible protocol: a device receipt that belongs to another collection cannot collide, overwrite it or bypass idempotency", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const [original] = await collectionsFor("k-1");
  const originalCredits = await creditsFor(original.id);
  for (const [key, stale] of [["old-collide", original.receipt_no], ["old-legacy", "KW1-7"], ["old-pending", "PENDING-ABC"]]) {
    const r = await record(session("kwame"), payload(key, { receipt_no: stale, payment_no: stale }));
    assert.equal(r.status, "recorded", `${key} is recorded under a server receipt, not refused by the receipt constraint`);
    assert.notEqual(r.receipt_no, stale);
    const [row] = await collectionsFor(key);
    assert.deepEqual((await creditsFor(row.id)).map((c) => c.receipt_no), [r.receipt_no], `${key}: one credit carrying the server receipt`);
  }
  const replay = await record(session("kwame"), payload("k-1", { receipt_no: "ACC-99999999", amount: "500", amount_pesewas: "50000" }));
  assert.deepEqual([replay.status, replay.collection_id, replay.receipt_no], ["duplicate", original.id, original.receipt_no]);
  assert.deepEqual(await collectionsFor("k-1"), [original], "the original collection keeps its receipt");
  assert.deepEqual(await creditsFor(original.id), originalCredits, "and its single ledger credit");
  const receipts = (await allReceipts()).map((r) => r.receipt_no);
  assert.equal(new Set(receipts).size, receipts.length);
});

test("same idempotency key, sequential retry: duplicate with the original collection and receipt, no new allocation", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const first = await record(session("kwame"), payload("k-retry"));
  const used = await counter();
  const again = await record(session("kwame"), payload("k-retry", { receipt_no: "DIFFERENT-1", amount: "999" }));
  assert.deepEqual([again.status, again.collection_id, again.receipt_no], ["duplicate", first.collection_id, first.receipt_no]);
  assert.equal(await counter(), used, "a duplicate allocates nothing");
  const rows = await collectionsFor("k-retry");
  assert.equal(rows.length, 1);
  assert.deepEqual((await creditsFor(rows[0].id)).map((c) => Number(c.amount)), [10], "one ledger credit of the original amount");
});

test("commit, lost reply, retry: one collection, one ledger credit, one receipt", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const lost = await device(session("kwame"));
  const committed = await lost.record(payload("k-lost"));
  await lost.commit();
  // The device never saw `committed`; it retries with the same identity.
  const retry = await record(session("kwame"), payload("k-lost"));
  assert.deepEqual([retry.status, retry.collection_id, retry.receipt_no], ["duplicate", committed.collection_id, committed.receipt_no]);
  const rows = await collectionsFor("k-lost");
  assert.equal(rows.length, 1);
  assert.deepEqual((await creditsFor(rows[0].id)).map((c) => c.receipt_no), [committed.receipt_no]);
});

test("two devices at the same moment: the counter row lock serializes them and the receipts differ", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const a = await device(session("kwame"));
  const b = await device(session("ama"));
  const ra = await a.record(payload("dev-a"));
  const rbPromise = b.record(payload("dev-b"));
  assert.equal(await pending(rbPromise), "pending", "device B waits for device A's open transaction");
  await a.commit();
  const rb = await rbPromise;
  await b.commit();
  assert.notEqual(ra.receipt_no, rb.receipt_no);
  assert.equal(Number(rb.receipt_no.split("-")[1]), Number(ra.receipt_no.split("-")[1]) + 1);
  for (const [key, r] of [["dev-a", ra], ["dev-b", rb]]) {
    const [row] = await collectionsFor(key);
    assert.equal(row.receipt_no, r.receipt_no);
    assert.deepEqual((await creditsFor(row.id)).map((c) => c.receipt_no), [r.receipt_no]);
  }
});

test("many devices concurrently: every receipt unique, every ledger credit carries its collection's receipt", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const sessions = await Promise.all(Array.from({ length: 8 }, (_, i) => device(session(i % 2 ? "ama" : "kwame"))));
  const results = await Promise.all(sessions.map(async (s, i) => {
    const r = await s.record(payload(`burst-${i}`));
    await s.commit();
    return r;
  }));
  assert.ok(results.every((r) => r.status === "recorded"));
  assert.equal(new Set(results.map((r) => r.receipt_no)).size, 8);
  const mismatched = (await db.query(`select c.receipt_no, l.receipt_no as ledger from public.collections c
    join public.ledger_entries l on l.reference_id = c.id and l.reference_type = 'collection' and l.direction = 'credit'
    where c.business_id = $1 and l.receipt_no is distinct from c.receipt_no`, [biz])).rows;
  assert.deepEqual(mismatched, []);
});

test("same submission racing on two connections: the loser resolves to the winner's collection; one ledger effect", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const a = await device(session("kwame"));
  const b = await device(session("kwame"));
  const ra = await a.record(payload("race-1"));
  const rbPromise = b.record(payload("race-1"));
  assert.equal(await pending(rbPromise), "pending");
  await a.commit();
  const rb = await rbPromise;
  await b.commit();
  assert.deepEqual([ra.status, rb.status], ["recorded", "duplicate"]);
  assert.deepEqual([rb.collection_id, rb.receipt_no], [ra.collection_id, ra.receipt_no]);
  const rows = await collectionsFor("race-1");
  assert.equal(rows.length, 1);
  assert.equal((await creditsFor(rows[0].id)).length, 1);

  const racers = await Promise.all(Array.from({ length: 6 }, () => device(session("kwame"))));
  const outcomes = await Promise.all(racers.map(async (s) => {
    const r = await s.record(payload("race-2"));
    await s.commit();
    return r;
  }));
  assert.equal(outcomes.filter((r) => r.status === "recorded").length, 1);
  assert.equal(new Set(outcomes.map((r) => `${r.collection_id}|${r.receipt_no}`)).size, 1, "every racer reports the same collection and receipt");
  const raced = await collectionsFor("race-2");
  assert.equal(raced.length, 1);
  assert.equal((await creditsFor(raced[0].id)).length, 1);
});

test("a rolled-back transaction releases its number; a committed race may leave a gap; numbers are never reused", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const start = await counter();
  const aborted = await device(session("kwame"));
  await aborted.record(payload("rolled-back"));
  await aborted.rollback();
  assert.equal(await counter(), start, "rollback returns the counter");
  assert.deepEqual(await collectionsFor("rolled-back"), []);
  const next = await record(session("kwame"), payload("after-rollback"));
  assert.equal(Number(next.receipt_no.split("-")[1]), start + 1);
  const receipts = (await allReceipts()).map((r) => r.receipt_no);
  assert.equal(new Set(receipts).size, receipts.length, "no receipt appears twice");
});

test("collision skipping: a number already used by a collection is never allocated again", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const next = (await counter()) + 1;
  const taken = `ACC-${String(next).padStart(8, "0")}`;
  const takenToo = `ACC-${String(next + 1).padStart(8, "0")}`;
  await run(serviceClaims, "select public.record_collection_from_client($1)", [payload("svc-taken", { receipt_no: taken })]);
  await db.query("update public.receipt_sequences set last_value = $2 where business_id = $1", [biz, next - 1]);
  await run(serviceClaims, "select public.record_collection_from_client($1)", [payload("svc-taken-2", { receipt_no: takenToo })]);
  await db.query("update public.receipt_sequences set last_value = $2 where business_id = $1", [biz, next - 1]);
  const r = await record(session("kwame"), payload("after-collision"));
  assert.equal(r.receipt_no, `ACC-${String(next + 2).padStart(8, "0")}`, "both taken numbers are skipped");
});

test("trusted sessions and the owner-only historical import keep the receipts they carry and raise the counter", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const svc = await record(serviceClaims, payload("svc-hist", { receipt_no: "ACC-00000900" }));
  assert.equal(svc.receipt_no, "ACC-00000900");
  assert.ok(await counter() >= 900);
  const imported = await run(session("john"), "select public.import_snapshot_batch($1, $2) as r", [LIVE, {
    groups: [], users: [], customers: [],
    collections: [{ id: "hist-1", idempotencyKey: "hist-1", receiptNo: "HIST-00000777", amount: 5, customerId: CUSTOMER, collectorId: ids.kwame, groupId: "demo-branch-accra", date: "2026-08-01" }]
  }]);
  assert.equal(imported.rows[0].r.status, "imported");
  assert.deepEqual((await collectionsFor("hist-1")).map((r) => r.receipt_no), ["HIST-00000777"]);
  const after = await record(session("kwame"), payload("after-import", { receipt_no: "ACC-00000001" }));
  assert.equal(after.receipt_no, "ACC-00000901", "the import flag does not outlive its transaction; the counter stayed ahead");
  await expectDenied(run(session("kwame"), "select public.import_snapshot_batch($1, $2)", [LIVE, { collections: [] }]), "collector import");
  await expectDenied(run(session("ama"), "select public.import_snapshot_batch($1, $2)", [LIVE, { collections: [] }]), "admin import");
});

test("047 controls still hold: invalid collection, other collector's member, other business, tampered role; nothing allocated", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const start = await counter();
  const totalBefore = (await allReceipts()).length;
  await expectDenied(record(session("kwame"), payload("neg", { amount: "-5" })), "negative amount");
  await expectDenied(record(session("kwame"), payload("", {})), "missing idempotency key");
  await expectDenied(record(session("yaw"), payload("yaw-steal")), "collector records another collector's member");
  await expectDenied(record(session("kwame"), payload("cross", { business_code: OTHER })), "payload names another business");
  await expectDenied(record(session("kwame", { business: OTHER }), payload("cross-2", { business_code: OTHER })), "session for a business the staff member does not belong to");
  await expectDenied(record(session("kwame", { role: "SystemOwner" }), payload("tampered")), "tampered role claim");
  await expectDenied(record({ role: "anon" }, payload("anon")), "anon");
  assert.equal(await counter(), start, "refused writes allocate nothing");
  assert.equal((await allReceipts()).length, totalBefore);
  const own = await record(session("yaw"), payload("yaw-own", { customer_client_id: YAW_CUSTOMER, collector_client_id: ids.kwame }));
  assert.equal(own.status, "recorded");
  const collector = (await db.query("select u.client_id from public.collections c join public.app_users u on u.id = c.collector_id where c.idempotency_key = 'yaw-own'")).rows[0].client_id;
  assert.equal(collector, "u-yaw", "the collector is still the caller, not the payload");
});

test("posted receipts are immutable: no client update, and the guard blocks even a direct change", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const [row] = await collectionsFor("k-1");
  for (const claims of [session("kwame"), session("john")]) {
    await expectDenied(run(claims, "update public.collections set receipt_no = 'X-1' where id = $1", [row.id]), "client receipt overwrite");
  }
  await assert.rejects(db.query("update public.collections set receipt_no = 'X-1' where id = $1", [row.id]), /immutable/);
  assert.deepEqual((await collectionsFor("k-1")).map((r) => r.receipt_no), ["ACC-00000051"]);
});

test("re-running 046 and 047 on top of 048 keeps the allocator internal and receipts server-allocated", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  await db.query(migration("046").sql);
  await db.query(migration("047").sql);
  const exposed = (await db.query("select has_function_privilege('authenticated', 'public.st_internal_allocate_receipt_no(uuid, text)', 'execute') as g")).rows[0].g;
  assert.equal(exposed, false, "046's st_internal_% revoke covers the allocator");
  await expectDenied(run(session("kwame"), "select public.st_internal_allocate_receipt_no($1, 'ACC')", [biz]), "allocator after re-run");
  const r = await record(session("kwame"), payload("after-rerun", { receipt_no: "ACC-00000002" }));
  assert.notEqual(r.receipt_no, "ACC-00000002");
  await db.query(migration("048").sql);
});

test("rollback restores 047 behaviour without renumbering or lowering anything; re-applying 048 is clean", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const before = await allReceipts();
  const counted = await counter();
  await db.query(ROLLBACK);
  assert.equal((await db.query("select to_regprocedure('public.st_internal_allocate_receipt_no(uuid, text)') as f")).rows[0].f, null);
  assert.equal(await counter(), counted, "rollback never lowers the counter");
  assert.deepEqual(await allReceipts(), before);
  const legacy = await record(session("kwame"), payload("rolled-back-client", { receipt_no: "ACC-00005000" }));
  assert.equal(legacy.receipt_no, undefined, "047 replies without a receipt");
  assert.deepEqual((await collectionsFor("rolled-back-client")).map((r) => r.receipt_no), ["ACC-00005000"], "047 stores the device receipt");
  const grants = (await db.query("select has_function_privilege('authenticated', 'public.st_internal_record_collection_from_client(jsonb)', 'execute') as g")).rows[0].g;
  assert.equal(grants, false);

  await db.query(migration("048").sql);
  assert.equal(await counter(), 5000, "re-applied seeding covers receipts written while rolled back");
  const r = await record(session("kwame"), payload("reapplied"));
  assert.equal(r.receipt_no, "ACC-00005001");
  assert.deepEqual((await allReceipts()).filter((x) => before.some((b) => b.id === x.id)), before);
});


test("048 protocol fence denies stale clients atomically across all public tables", async (t) => {
  if (skip()) return t.skip();
  const before = await allReceipts();
  const start = await counter();
  for (const headers of ["", "{}", "not-json", '{"x-smile-write-protocol":"047"}', '{"x-smile-write-protocol":"999"}']) {
    await expectDenied(db.asRole("authenticated", session("kwame"), async client => {
      await client.query("select set_config('request.headers', $1, true)", [headers]);
      await client.query("select public.record_collection_from_client($1)", [payload("stale-protocol")]);
    }), "stale collection");
  }
  assert.deepEqual(await allReceipts(), before);
  assert.equal(await counter(), start);
  const tables = (await db.query("select tablename from pg_tables where schemaname = 'public'")).rows;
  for (const {tablename} of tables) {
    const trigger = (await db.query("select 1 from pg_trigger where tgrelid = $1::regclass and tgname = 'st_client_write_protocol' and tgenabled = 'O'", ['public.'+tablename])).rows;
    assert.equal(trigger.length, 1, tablename + " has enabled fence");
  }
  await expectDenied(db.asRole("authenticated", session("john"), async client => {
    await client.query("select set_config('request.headers', '{}', true)");
    await client.query("delete from public.customers where false");
  }), "zero-row direct DELETE");
  await assert.rejects(db.asRole("authenticated", session("john"), async client => {
    await client.query("select set_config('request.headers', '{}', true)");
    await client.query("update public.smile_trust_cloud_snapshots set payload = payload where false");
  }), /unsupported write protocol/);
  // Reads need no protocol declaration.
  const read = await db.asRole("authenticated", session("john"), async client => {
    await client.query("select set_config('request.headers', '{}', true)");
    return client.query("select count(*) from public.customers");
  });
  assert.ok(Number(read.rows[0].count) > 0);
  // A declared compatible protocol still cannot bypass existing authorization.
  await expectDenied(record(session("kwame", {business: OTHER}), payload("protocol-no-auth")), "wrong business");
});

test("emergency fence removal drops only the fence; re-applying 048 reinstalls it", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const fenced = async () => Number((await db.query(`select count(*) from pg_trigger g join pg_class c on c.oid = g.tgrelid
    where c.relnamespace = 'public'::regnamespace and g.tgname = 'st_client_write_protocol' and g.tgenabled = 'O'`)).rows[0].count);
  const unmarked = (claims, key) => db.asRole("authenticated", claims, async (client) => {
    await client.query("select set_config('request.headers', '{}', true)");
    return (await client.query("select public.record_collection_from_client($1) as r", [payload(key)])).rows[0].r;
  });
  const tables = Number((await db.query("select count(*) from pg_tables where schemaname = 'public'")).rows[0].count);
  const before = await allReceipts();
  const counted = await counter();

  await db.query(FENCE_REMOVAL);
  assert.equal(await fenced(), 0);
  assert.equal((await db.query("select to_regprocedure('public.st_guard_client_write_protocol()') as f")).rows[0].f, null);
  assert.notEqual((await db.query("select to_regprocedure('public.st_internal_allocate_receipt_no(uuid, text)') as f")).rows[0].f, null, "receipt allocation kept");
  assert.equal(await counter(), counted);
  assert.deepEqual(await allReceipts(), before, "no receipt changed");
  const r = await unmarked(session("kwame"), "unmarked-after-removal");
  assert.match(r.receipt_no, /^ACC-\d{8}$/, "unmarked writes are accepted again and still get a server receipt");
  await expectDenied(unmarked(session("kwame", { business: OTHER }), "unmarked-wrong-business"), "047 authorization still applies");

  await db.query(migration("048").sql);
  assert.equal(await fenced(), tables, "re-applying 048 fences every public table again");
  await expectDenied(unmarked(session("kwame"), "unmarked-after-reapply"), "fence restored");
});
