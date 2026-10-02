/**
 * Migration 046 must be self-contained on top of 001–045.
 * Builds a disposable local database from migrations 001–045 WITHOUT supabase/rls.sql
 * (the state of a project where the snapshot table was never created), then applies 046
 * and proves it succeeds, installs the snapshot table locked down, and is re-runnable.
 * Never connects to a remote database.
 */
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { migrationFiles, startLocalSupabase } from "./helpers/supabase-local-db.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const BIZ = "st-mig-a";
const OTHER = "st-mig-b";
const LIVE = "SMILE-TRUST";
const staff = { role: "authenticated", sub: "00000000-0000-0000-0000-0000000000c1", app_metadata: { business_code: BIZ, app_user_id: "u-c1", app_role: "Collector" } };
const anonClaims = { role: "anon" };
const liveClaims = (appUserId, appRole) => ({
  role: "authenticated",
  sub: crypto.randomUUID(),
  app_metadata: { business_code: LIVE, app_user_id: appUserId, app_role: appRole }
});
const johnSession = liveClaims("demo-user-john", "SystemOwner");
const amaSession = liveClaims("demo-user-ama", "Admin");
const kwameSession = liveClaims("demo-user-kwame", "Collector");

const STAFF_COLUMNS = "id, business_id, client_id, username, name, role, active, branch_id, auth_user_id, password_hash, created_at";
let db;
let staffBefore;
const migration046 = () => migrationFiles().find((item) => item.name.startsWith("046_"));

function run(claims, sql, params) {
  const role = claims?.role === "anon" ? "anon" : "authenticated";
  return db.asRole(role, claims, (client) => client.query(sql, params));
}

async function expectDenied(promise, label) {
  await assert.rejects(promise, (error) => {
    assert.ok(
      ["42501", "P0001"].includes(error.code) || /permission denied|row-level security|not authorized/i.test(error.message),
      `${label}: unexpected error ${error.code} ${error.message}`
    );
    return true;
  }, `${label} should be denied`);
}

async function snapshotTableExists() {
  const { rows } = await db.query("select to_regclass('public.smile_trust_cloud_snapshots') is not null as present");
  return rows[0].present;
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

test("migrations 001–045 apply cleanly without rls.sql and leave no snapshot table", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const failed = db.applied.filter((item) => !item.ok);
  assert.deepEqual(failed, [], `migrations failed: ${JSON.stringify(failed)}`);
  assert.equal(db.applied.length, 45);
  assert.equal(db.applied.at(-1).name.slice(0, 3), "045");
  assert.equal(await snapshotTableExists(), false, "baseline must match a project that never ran rls.sql");
});

test("the 001–045 baseline has the live project's staff: JOHN, AMA and KWAME with no credentials", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const counts = await db.query(`select
    (select count(*)::int from public.businesses) as businesses,
    (select count(*)::int from public.app_users) as app_users,
    (select count(*)::int from public.customers) as customers,
    (select count(*)::int from public.collections) as collections`);
  assert.deepEqual(counts.rows[0], { businesses: 1, app_users: 3, customers: 1, collections: 0 });
  const staffRows = await db.query(`select ${STAFF_COLUMNS} from public.app_users order by username`);
  staffBefore = staffRows.rows;
  assert.deepEqual(staffBefore.map((row) => [row.username, row.role, row.active]), [
    ["ama", "AssistantManager", true],
    ["john", "SystemOwner", true],
    ["kwame", "Collector", true]
  ]);
  assert.ok(staffBefore.every((row) => row.password_hash == null && row.auth_user_id == null), "seeded staff have no password and no Auth identity");
  const mfa = await db.query("select count(*)::int as n from public.user_mfa_secrets");
  assert.equal(mfa.rows[0].n, 0, "no MFA configured");
});

test("the read-only staff preflight reports credential status without exposing any secret", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const file = fs.readFileSync(path.join(root, "supabase", "preflight", "046_existing_staff_readonly.sql"), "utf8");
  const [portable] = file.split("-- @supabase-only");
  assert.doesNotMatch(file.replace(/--.*$/gm, ""), /\b(insert|update|delete|truncate|drop|alter|create|grant|revoke)\b/i, "preflight is read-only");
  const { rows } = await db.query(portable);
  assert.deepEqual(rows.map((row) => [row.username, row.password_format, row.has_auth_user_id, row.mfa_enabled, row.seeded_by_migration_044]), [
    ["ama", "none", false, false, true],
    ["john", "none", false, false, true],
    ["kwame", "none", false, false, true]
  ]);
  assert.ok(rows.every((row) => !("password_hash" in row) && !("secret" in row)));
});

test("migration 046 applies on 001–045 alone and installs a locked-down snapshot table", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  await db.query(migration046().sql);
  assert.equal(await snapshotTableExists(), true);

  const rls = await db.query("select relrowsecurity from pg_class where oid = 'public.smile_trust_cloud_snapshots'::regclass");
  assert.equal(rls.rows[0].relrowsecurity, true);

  const policies = await db.query("select policyname from pg_policies where schemaname = 'public' and tablename = 'smile_trust_cloud_snapshots' order by 1");
  assert.deepEqual(policies.rows.map((row) => row.policyname), ["st_snapshots_insert", "st_snapshots_select", "st_snapshots_update"]);

  const unique = await db.query(`select 1 from pg_constraint where conrelid = 'public.smile_trust_cloud_snapshots'::regclass and contype = 'u'`);
  assert.equal(unique.rowCount, 1, "business_id must be unique for snapshot upserts");

  const anonPriv = await db.query(`select has_table_privilege('anon', 'public.smile_trust_cloud_snapshots', 'select,insert,update,delete') as any`);
  assert.equal(anonPriv.rows[0].any, false);
});

test("046 leaves every existing staff row, uuid and relationship exactly as it was", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const after046 = await db.query(`select ${STAFF_COLUMNS} from public.app_users order by username`);
  assert.deepEqual(after046.rows, staffBefore);
  const refs = await db.query(`select count(*)::int as n from public.customers c
    join public.app_users u on u.id = c.collector_id where u.username = 'kwame'`);
  assert.equal(refs.rows[0].n, 1, "the member stays assigned to KWAME");
  const counts = await db.query("select (select count(*)::int from public.businesses) as b, (select count(*)::int from public.customers) as c, (select count(*)::int from public.collections) as col");
  assert.deepEqual(counts.rows[0], { b: 1, c: 1, col: 0 });
});

test("staff sessions cannot read password hashes, and only owners/managers can change staff rows", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  await expectDenied(run(kwameSession, "select password_hash from public.app_users"), "collector reads hashes");
  await expectDenied(run(johnSession, "select password_hash from public.app_users"), "owner reads hashes");
  await expectDenied(run(johnSession, "update public.app_users set password_hash = 'pbkdf2:1:00:00' where username = 'kwame'"), "owner writes a hash");
  const visible = await run(kwameSession, "select id, username, role from public.app_users order by username");
  assert.deepEqual(visible.rows.map((row) => row.username), ["ama", "john", "kwame"]);
  const escalate = await run(kwameSession, "update public.app_users set role = 'SystemOwner' where username = 'kwame' returning id");
  assert.equal(escalate.rowCount, 0, "a collector cannot promote themselves");
  const managed = await run(johnSession, "update public.app_users set name = name where username = 'kwame' returning id");
  assert.equal(managed.rowCount, 1, "the owner can still manage staff records");
  const unchanged = await db.query("select role from public.app_users where username = 'kwame'");
  assert.equal(unchanged.rows[0].role, "Collector");
});

test("activation codes are issued without touching app_users and stored only as a hash", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const first = await db.query("select public.st_issue_staff_activation($1, 'JOHN', 60) as r", [LIVE]);
  const issued = first.rows[0].r;
  assert.equal(issued.ok, true);
  assert.equal(issued.username, "john");
  assert.match(issued.activation_code, /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  const john = staffBefore.find((row) => row.username === "john");
  const stored = await db.query("select code_hash, issued_by, used_at from public.st_staff_activation_codes where app_user_uuid = $1", [john.id]);
  assert.equal(stored.rowCount, 1);
  const expected = crypto.createHash("sha256").update(`${john.id}:${issued.activation_code.replace(/-/g, "")}`).digest("hex");
  assert.equal(stored.rows[0].code_hash, expected, "matches staff-login's activationCodeHash");
  assert.equal(stored.rows[0].issued_by, "database");
  const raw = await db.query("select count(*)::int as n from public.st_staff_activation_codes where code_hash like $1", [`%${issued.activation_code.replace(/-/g, "")}%`]);
  assert.equal(raw.rows[0].n, 0, "the code itself is never stored");

  await db.query("select public.st_issue_staff_activation($1, 'john', 60)", [LIVE]);
  const live = await db.query("select count(*)::int as n from public.st_staff_activation_codes where app_user_uuid = $1 and used_at is null and expires_at > now()", [john.id]);
  assert.equal(live.rows[0].n, 1, "a new code replaces the previous one");

  const after = await db.query(`select ${STAFF_COLUMNS} from public.app_users order by username`);
  assert.deepEqual(after.rows, staffBefore, "issuing codes never modifies staff rows");
});

test("activation codes cannot reset an existing password or be issued by the wrong people", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  await db.query("begin");
  try {
    await db.query("update public.app_users set password_hash = 'pbkdf2:1:00:00' where username = 'ama'");
    await assert.rejects(db.query("select public.st_issue_staff_activation($1, 'ama')", [LIVE]), /already has a password/);
  } finally {
    await db.query("rollback");
  }
  await assert.rejects(db.query("select public.st_issue_staff_activation($1, 'nobody')", [LIVE]), /no active staff account/);
  await expectDenied(run(anonClaims, "select public.st_issue_staff_activation($1, 'john')", [LIVE]), "anon issues a code");
  await expectDenied(run(kwameSession, "select public.st_issue_staff_activation($1, 'ama')", [LIVE]), "collector issues a code");
  await expectDenied(run(amaSession, "select public.st_issue_staff_activation($1, 'john')", [LIVE]), "manager issues an owner code");
  await expectDenied(run(johnSession, "select public.st_issue_staff_activation($1, 'john')", [LIVE]), "owner issues a code for themselves");
  await expectDenied(run(staff, "select public.st_issue_staff_activation($1, 'kwame')", [LIVE]), "another business issues a code");
  const byManager = await run(amaSession, "select public.st_issue_staff_activation($1, 'kwame') as r", [LIVE]);
  assert.equal(byManager.rows[0].r.ok, true);
  const byOwner = await run(johnSession, "select public.st_issue_staff_activation($1, 'ama') as r", [LIVE]);
  assert.equal(byOwner.rows[0].r.ok, true);
  await expectDenied(run(johnSession, "select * from public.st_staff_activation_codes"), "owner reads code hashes");
});

test("after 046 anon is denied and staff sessions reach only their own business snapshot", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  await db.query(
    "insert into public.smile_trust_cloud_snapshots (business_id, payload) values ($1, '{}'), ($2, '{}')",
    [BIZ, OTHER]
  );
  await expectDenied(run(anonClaims, "select * from public.smile_trust_cloud_snapshots"), "anon select");
  await expectDenied(run(anonClaims, "insert into public.smile_trust_cloud_snapshots (business_id, payload) values ('x', '{}')"), "anon insert");
  const own = await run(staff, "select business_id from public.smile_trust_cloud_snapshots");
  assert.deepEqual(own.rows.map((row) => row.business_id), [BIZ]);
  await expectDenied(run(staff, "insert into public.smile_trust_cloud_snapshots (business_id, payload) values ($1, '{}')", [OTHER]), "cross-business insert");
  await expectDenied(run(staff, "delete from public.smile_trust_cloud_snapshots where business_id = $1", [BIZ]), "snapshot delete");
});

test("after 046 anon has no table privileges and every public table has RLS", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const { rows } = await db.query(`
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r','p','v','m')
      and (has_table_privilege('anon', c.oid, 'select') or has_table_privilege('anon', c.oid, 'insert')
           or has_table_privilege('anon', c.oid, 'update') or has_table_privilege('anon', c.oid, 'delete'))`);
  assert.deepEqual(rows.map((row) => row.relname), []);
  const rls = await db.query(`
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`);
  assert.deepEqual(rls.rows.map((row) => row.relname), []);
});

test("re-applying 046 on the migrations-only database is idempotent and keeps rows", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  await db.query(migration046().sql);
  const count = await db.query("select count(*)::int as n from public.smile_trust_cloud_snapshots");
  assert.equal(count.rows[0].n, 2);
  await expectDenied(run(anonClaims, "select * from public.smile_trust_cloud_snapshots"), "anon select after re-apply");
  await expectDenied(run(kwameSession, "select password_hash from public.app_users"), "hash lockdown survives re-apply");
  const escalate = await run(kwameSession, "update public.app_users set role = 'SystemOwner' where username = 'kwame' returning id");
  assert.equal(escalate.rowCount, 0, "staff-row lockdown survives re-apply");
  const staffAfter = await db.query(`select ${STAFF_COLUMNS} from public.app_users order by username`);
  assert.deepEqual(staffAfter.rows, staffBefore, "re-applying 046 leaves staff rows unchanged");
  const codes = await db.query("select count(*)::int as n from public.st_staff_activation_codes");
  assert.ok(codes.rows[0].n >= 3, "re-applying 046 keeps issued activation codes");
  const own = await run(staff, "select public.fetch_business_snapshot($1) as s", [BIZ]);
  assert.equal(typeof own.rows[0].s, "object");
});

test("the read-only post-activation check reports JOHN's state before and after activation without exposing secrets", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const file = fs.readFileSync(path.join(root, "supabase", "preflight", "046_post_activation_readonly.sql"), "utf8");
  assert.doesNotMatch(file.replace(/--.*$/gm, ""), /\b(insert|update|delete|truncate|drop|alter|create|grant|revoke)\b/i, "check is read-only");
  const john = staffBefore.find((row) => row.username === "john");
  const sql = file.replaceAll("bbef5ecc-3bdf-40b6-bf8e-c0e206eed9db", john.id);
  const forbiddenColumns = ["password_hash", "code_hash", "email", "secret", "encrypted_password"];

  await db.query("begin");
  try {
    await db.query("create table if not exists auth.users (id uuid primary key, raw_app_meta_data jsonb, banned_until timestamptz)");
    const before = (await db.query(sql)).rows;
    assert.equal(before.length, 1);
    assert.deepEqual(
      [before[0].matching_rows, before[0].uuid_unchanged, before[0].role_unchanged, before[0].password_format, before[0].auth_link_present, before[0].auth_users_total, before[0].codes_still_redeemable],
      [1, true, true, "none", false, 0, 1]
    );

    const authId = crypto.randomUUID();
    await db.query("update public.app_users set password_hash = 'pbkdf2:120000:00:00' where id = $1", [john.id]);
    await db.query("update public.st_staff_activation_codes set used_at = now() where app_user_uuid = $1 and used_at is null and expires_at > now()", [john.id]);
    await db.query("insert into auth.users (id, raw_app_meta_data) values ($1, $2)", [authId, { business_code: LIVE, app_user_id: "demo-user-john", app_role: "SystemOwner" }]);
    await db.query("insert into public.st_staff_auth_links (business_code, app_user_id, auth_user_id) values ($1, 'demo-user-john', $2)", [LIVE, authId]);

    const [after] = (await db.query(sql)).rows;
    assert.deepEqual(
      {
        matching_rows: after.matching_rows, uuid_unchanged: after.uuid_unchanged, role: after.role, role_unchanged: after.role_unchanged,
        active: after.active, password_format: after.password_format, auth_link_present: after.auth_link_present,
        auth_user_exists: after.auth_user_exists, auth_claim_role: after.auth_claim_role, auth_claim_user_matches: after.auth_claim_user_matches,
        auth_claim_business: after.auth_claim_business, auth_user_not_banned: after.auth_user_not_banned, auth_users_total: after.auth_users_total,
        codes_still_redeemable: after.codes_still_redeemable, app_users_auth_user_id_set: after.app_users_auth_user_id_set
      },
      {
        matching_rows: 1, uuid_unchanged: true, role: "SystemOwner", role_unchanged: true, active: true, password_format: "pbkdf2",
        auth_link_present: true, auth_user_exists: true, auth_claim_role: "SystemOwner", auth_claim_user_matches: true,
        auth_claim_business: LIVE, auth_user_not_banned: true, auth_users_total: 1, codes_still_redeemable: 0, app_users_auth_user_id_set: false
      }
    );
    assert.ok(after.codes_used >= 1 && after.last_code_used_at);
    for (const row of [...before, after]) {
      assert.ok(Object.keys(row).every((key) => !forbiddenColumns.some((name) => key.includes(name) && key !== "app_users_auth_email_set")), "no secret-bearing column is returned");
      assert.equal(JSON.stringify(row).includes("pbkdf2:120000"), false, "the hash value is never returned");
    }
  } finally {
    await db.query("rollback");
  }
});
