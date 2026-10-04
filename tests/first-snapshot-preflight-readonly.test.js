/**
 * supabase/preflight/first_snapshot_bootstrap_readonly.sql: statically read-only (no writes, DDL,
 * privilege changes, mutating calls or secret columns), and on a disposable local PostgreSQL built
 * like the live project (001–045 without rls.sql, 046, 047, JOHN activated with MFA, AMA and KWAME
 * not activated) it reports READY_FOR_INITIAL_SNAPSHOT, catches each blocking condition and never
 * returns a secret value. Never connects to a remote database.
 */
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { migrationFiles, startLocalSupabase } from "./helpers/supabase-local-db.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILE = fs.readFileSync(path.join(root, "supabase", "preflight", "first_snapshot_bootstrap_readonly.sql"), "utf8");
const LIVE = "SMILE-TRUST";
const PROD_UUIDS = {
  john: "bbef5ecc-3bdf-40b6-bf8e-c0e206eed9db",
  ama: "6e6667ac-72ce-4f30-9c8e-2fd838988590",
  kwame: "3d156d98-3b4a-4024-8a46-1450df386672"
};
const MARKERS = {
  johnHash: "pbkdf2:120000:SALTMARKER01:HASHMARKER01",
  amaHash: "pbkdf2:120000:SALTMARKER02:HASHMARKER02",
  mfa: "MFAMARKERAAAAAAAAAAAAAAAAAAAAAAA",
  codeHash: "CODEHASHMARKER01"
};
const FORBIDDEN_WORDS = /\b(insert|update|delete|upsert|merge|truncate|alter|drop|create|grant|revoke|copy|call|do|execute|perform|vacuum|analyze|reindex|cluster|lock|notify|listen|comment|reset|refresh|import|discard|prepare|begin|commit|rollback|savepoint|returning|security|definer|owner|policy|trigger|function|procedure)\b/i;
const STATEMENT_TEXT = /\b(insert\s+into|update\s+[\w."]+\s+set|delete\s+from|upsert|merge\s+into|truncate\s+|alter\s+|drop\s+|create\s+|grant\s+|revoke\s+|security\s+definer|on\s+conflict)/i;
const PRIVILEGE_NAMES = new Set(["INSERT", "UPDATE", "DELETE", "TRUNCATE"]);
const ALLOWED_CALLS = new Set([
  "coalesce", "count", "sum", "max", "lower", "bool_or", "bool_and", "string_agg", "position", "upper", "btrim", "format", "now",
  "to_regclass", "to_regprocedure", "has_table_privilege", "has_column_privilege", "has_function_privilege",
  "pg_backend_pid", "xpath", "query_to_xml"
]);
const SQL_WORDS = new Set(["as", "in", "values", "exists", "filter", "not", "and", "or", "on", "then", "else", "when", "lateral", "from",
  "select", "where", "by", "join", "is", "like", "case", "end", "with"]);
const CTE_COLUMN_LISTS = new Set(["req_fns", "table_names", "scope_staff", "checks"]);

let db;
let verification;
let johnAuthId;
let staffBefore;
const staff = {};
const migration = (prefix) => migrationFiles().find((item) => item.name.startsWith(`${prefix}_`));

const comments = (sql) => [...sql.matchAll(/--(.*)$/gm)].map((match) => match[1]).join("\n");
const literals = (sql) => [...sql.replace(/--.*$/gm, "").matchAll(/'((?:[^']|'')*)'/g)].map((match) => match[1].replace(/''/g, "'"));
const codeOnly = (sql) => sql.replace(/--.*$/gm, "").replace(/'(?:[^']|'')*'/g, "''");

async function run(sql = verification) {
  const result = await db.query(sql);
  return (Array.isArray(result) ? result.at(-1) : result).rows;
}

async function scenario(setup) {
  await db.query("begin");
  try {
    await db.query("set local session_replication_role = replica");
    if (setup) await setup();
    await db.query("set local session_replication_role = origin");
    return await run();
  } finally {
    await db.query("rollback");
  }
}

const row = (rows, section, check) => {
  const found = rows.find((item) => item.section === section && item.check_name === check);
  assert.ok(found, `missing check ${section} / ${check}`);
  return found;
};
const byStatus = (rows, status) => rows.filter((item) => item.section !== "VERDICT" && item.status === status)
  .map((item) => `${item.section} / ${item.check_name}`);
const failed = (rows) => byStatus(rows, "FAIL");

function assertNotReady(rows, ...checks) {
  assert.equal(rows[0].section, "VERDICT");
  assert.equal(rows[0].status, "NOT_READY_FOR_INITIAL_SNAPSHOT");
  for (const check of checks) {
    assert.ok(failed(rows).includes(check), `expected FAIL: ${check}; got ${failed(rows).join(" | ")}`);
    assert.ok(rows[0].detail.includes(check), `the verdict names ${check}`);
  }
  assertNoSecrets(rows);
}

function assertNoSecrets(rows) {
  const text = JSON.stringify(rows);
  for (const [name, value] of Object.entries(MARKERS)) assert.equal(text.includes(value), false, `${name} value returned`);
  assert.doesNotMatch(text, /pbkdf2:\d/, "no password hash is returned");
  assert.equal(text.includes(johnAuthId), false, "no Auth user id is returned");
  for (const item of rows) assert.deepEqual(Object.keys(item), ["section", "ord", "check_name", "status", "detail"]);
}

async function staffState() {
  return (await db.query("select id, username, role, active, password_hash, client_id from public.app_users order by username")).rows;
}

before(async () => {
  db = await startLocalSupabase({ upTo: "045", withRlsSql: false });
  if (!db) {
    if (process.env.SMILE_SKIP_DB_TESTS === "1") return;
    throw new Error("embedded-postgres is required for migration tests (npm install)");
  }
  await db.query(migration("046").sql);
  await db.query("create table if not exists auth.users (id uuid primary key, raw_app_meta_data jsonb, banned_until timestamptz)");
  await db.query(migration("047").sql);
  for (const item of (await db.query("select id, username, coalesce(client_id, id::text) as app_id from public.app_users")).rows) {
    staff[item.username] = item;
  }

  // Production's state before the bootstrap: JOHN activated and MFA-enrolled, AMA and KWAME not activated.
  await db.query("set session_replication_role = replica");
  await db.query("update public.app_users set password_hash = $1 where id = $2", [MARKERS.johnHash, staff.john.id]);
  await db.query("set session_replication_role = origin");
  johnAuthId = crypto.randomUUID();
  await db.query("insert into auth.users (id, raw_app_meta_data) values ($1, $2)",
    [johnAuthId, { business_code: LIVE, app_user_id: staff.john.app_id, app_role: "SystemOwner", provider: "email" }]);
  await db.query("insert into public.st_staff_auth_links (business_code, app_user_id, auth_user_id) values ($1, $2, $3)",
    [LIVE, staff.john.app_id, johnAuthId]);
  await db.query(`insert into public.user_mfa_secrets (business_id, user_client_id, secret, enabled, confirmed_at)
    select business_id, $1, $2, true, now() - interval '1 hour' from public.app_users where id = $3`,
  [staff.john.app_id, MARKERS.mfa, staff.john.id]);
  await db.query(`insert into public.st_staff_activation_codes (business_code, app_user_uuid, code_hash, expires_at, used_at) values
    ($1, $2, $5, now() - interval '1 day', now() - interval '2 days'),
    ($1, $3, $5, now() - interval '1 day', null),
    ($1, $4, $5, now() - interval '1 day', null)`,
  [LIVE, staff.john.id, staff.ama.id, staff.kwame.id, MARKERS.codeHash]);
  await db.query("insert into public.st_staff_login_attempts (business_code, username_key, succeeded) values ($1, 'john', true), ($1, 'john', false)", [LIVE]);

  staffBefore = await staffState();
  let sql = FILE;
  for (const name of Object.keys(PROD_UUIDS)) sql = sql.replaceAll(PROD_UUIDS[name], staff[name].id);
  verification = sql;
}, { timeout: 240000 });

after(async () => {
  await db?.stop();
});

const skip = () => !db;

test("the preflight is one read-only SELECT: no write, DDL, privilege change or upsert keyword anywhere in its code or comments", () => {
  const code = codeOnly(FILE);
  assert.match(code, /^\s*set transaction read only;/, "the transaction is made read-only first");
  assert.equal((code.match(/\bset\b/gi) || []).length, 1, "the only SET is the read-only guard");
  assert.equal((code.match(/;/g) || []).length, 2, "exactly two statements: the guard and one SELECT");
  assert.match(code.slice(code.indexOf(";") + 1).trim(), /^with\b[\s\S]*\bselect\b[\s\S]*;\s*$/i, "the second statement is a SELECT");
  assert.doesNotMatch(code, FORBIDDEN_WORDS, "no forbidden keyword in the SQL itself");
  assert.doesNotMatch(comments(FILE), /\b(insert|update|delete|upsert|merge|truncate|alter|drop|create|grant|revoke)\b|security\s+definer/i,
    "not even the comments mention a write or DDL keyword");
  assert.doesNotMatch(FILE, /security\s+definer/i, "no SECURITY DEFINER text anywhere");
  for (const text of literals(FILE)) {
    assert.doesNotMatch(text, STATEMENT_TEXT, `string literal holds statement text: ${text}`);
    if (/\b(insert|update|delete|upsert|merge|truncate|alter|drop|create|grant|revoke)\b/i.test(text)) {
      assert.ok(PRIVILEGE_NAMES.has(text), `only a bare privilege or policy-command name may name a write: ${text}`);
    }
  }
});

test("the preflight calls only read-only catalog and built-in functions (no RPC, no mutating or session-changing call)", () => {
  const code = codeOnly(FILE);
  const called = new Set([...code.matchAll(/\b([a-z_][a-z0-9_]*)\s*\(/gi)].map((match) => match[1].toLowerCase()));
  const unexpected = [...called].filter((name) => !ALLOWED_CALLS.has(name) && !SQL_WORDS.has(name) && !CTE_COLUMN_LISTS.has(name));
  assert.deepEqual(unexpected, [], "every call is an allow-listed read-only built-in");
  assert.doesNotMatch(code, /\b(public|auth|extensions)\s*\.\s*\w+\s*\(/i, "no schema-qualified (application) function is called");
  assert.doesNotMatch(code, /\b(rpc|st_submit_collections|fetch_business_snapshot|st_internal_\w+|st_issue_\w+|st_reset_\w+|upsert_\w+|set_config|nextval|setval|pg_terminate_backend|pg_cancel_backend|dblink\w*|pg_read_\w+|lo_\w+)\s*\(/i);

  const dynamic = [...FILE.matchAll(/query_to_xml\(\s*([\s\S]*?),\s*false,\s*false,\s*''\)/g)].map((match) => match[1]);
  assert.equal(dynamic.length, (FILE.match(/query_to_xml\(/g) || []).length, "every query_to_xml runs in table mode (an empty forest raises 2200M)");
  assert.equal(dynamic.length, 4);
  for (const text of dynamic) {
    assert.match(text.trim(), /^(format\(\s*)?'select count\(\*\) as n from public\.(%I|st_\w+)( where [^;]*)?'/, "dynamic SQL is only a row count");
    assert.doesNotMatch(text, STATEMENT_TEXT);
    assert.doesNotMatch(text, /;/);
  }
});

test("the preflight never reads a secret column or returns credentials", () => {
  const code = codeOnly(FILE);
  assert.doesNotMatch(code, /\b(secret|auth_email|email|encrypted_password|code_hash|pin_hash|access_key|payload|refresh_token|access_token|token|raw_user_meta_data|phone)\b/i,
    "no secret, credential, contact or snapshot-payload column is referenced");
  const hashUses = [...code.matchAll(/[^\n]*password_hash[^\n]*/g)].map((match) => match[0].trim());
  assert.deepEqual(hashUses, [
    "coalesce(u.password_hash, '') = '' as no_password,",
    "coalesce(u.password_hash, '') like '' as pbkdf2_password"
  ], "the password hash is only tested for presence and format");
  const meta = [...FILE.matchAll(/raw_app_meta_data\s*->>\s*'([^']+)'/g)].map((match) => match[1]).sort();
  assert.deepEqual(meta, ["app_role", "app_user_id", "business_code"]);
  assert.equal((FILE.match(/raw_app_meta_data/g) || []).length, 3, "Auth metadata is only read for the three session claims");
  assert.match(FILE, /qouokiqoepjpoksupskb/, "names the SMILE-TRUST production project");
  assert.doesNotMatch(FILE, /angoswtgcklnorhlosnf/, "never mentions the other system's project");
  assert.doesNotMatch(FILE, /sb_secret_|sb_publishable_|service_role|eyJ[A-Za-z0-9_-]{10,}\.|postgres(ql)?:\/\//i, "no credentials or connection strings");
  for (const uuid of Object.values(PROD_UUIDS)) assert.ok(FILE.includes(uuid), `expected uuid ${uuid}`);
});

test("on a production-like database before the bootstrap it reports READY_FOR_INITIAL_SNAPSHOT and changes nothing", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const rows = await run();
  assert.equal(rows[0].section, "VERDICT");
  assert.equal(rows[0].status, "READY_FOR_INITIAL_SNAPSHOT", rows[0].detail);
  assert.deepEqual(failed(rows), []);
  assert.deepEqual(byStatus(rows, "WARN"), []);
  for (const [section, n] of [["01 business", 1], ["02 047 protections", 15], ["03 snapshot state", 6], ["05 app ids", 6],
    ["06 relationships", 6], ["07 JOHN", 10], ["08 AMA", 3], ["08 KWAME", 3]]) {
    assert.equal(rows.filter((item) => item.section === section).length, n, section);
  }
  assert.ok(rows.filter((item) => ["02 047 protections", "05 app ids", "06 relationships", "07 JOHN", "08 AMA", "08 KWAME"].includes(item.section))
    .every((item) => item.status === "PASS"));
  assert.equal(row(rows, "03 snapshot state", "no SMILE-TRUST cloud snapshot yet (expected 0)").detail, "0 row(s)");
  assert.equal(row(rows, "03 snapshot state", "no registered posted history for SMILE-TRUST (expected 0)").detail, "none");
  assert.equal(row(rows, "04 counts", "members (SMILE-TRUST)").detail, "1 (Active=1)");
  assert.equal(row(rows, "04 counts", "collections (SMILE-TRUST)").detail, "0");
  assert.equal(row(rows, "04 counts", "staff (SMILE-TRUST app_users)").detail, "3 (AssistantManager=1, Collector=1, SystemOwner=1)");
  assert.equal(row(rows, "04 counts", "expected bootstrap confirmation summary").detail,
    "members 1, staff 3, groups 1, collections 0, savings products 1");
  assert.equal(row(rows, "04 counts", "all rows: user_mfa_secrets").detail, "1");
  assert.equal(row(rows, "04 counts", "all rows: st_snapshot_financial_ledger").detail, "0");
  assert.equal(row(rows, "07 JOHN", "MFA enabled and confirmed").detail, "enabled and confirmed (secret not read)");
  assert.equal(row(rows, "07 JOHN", "not locked out").detail, "1 failed sign-in(s) in the last 15 minutes (lockout at 5)");
  assertNoSecrets(rows);
  assert.deepEqual(await staffState(), staffBefore, "the preflight changed nothing");
});

test("the preflight's own transaction refuses writes", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  await db.query("begin");
  try {
    await run();
    await assert.rejects(db.query("insert into public.st_portal_pins (business_code, customer_id, pin_hash) values ('x', 'y', 'z')"),
      /read-only transaction/);
  } finally {
    await db.query("rollback");
  }
});

test("an existing snapshot, leftover history or a variant business key blocks the first snapshot", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const exists = await scenario(() => db.query("insert into public.smile_trust_cloud_snapshots (business_id, payload) values ($1, '{}')", [LIVE]));
  assertNotReady(exists, "03 snapshot state / no SMILE-TRUST cloud snapshot yet (expected 0)");
  assert.match(row(exists, "03 snapshot state", "no SMILE-TRUST cloud snapshot yet (expected 0)").detail, /already exists; the bootstrap refuses/);

  const variant = await scenario(() => db.query("insert into public.smile_trust_cloud_snapshots (business_id, payload) values ('smile-trust ', '{}')"));
  assert.deepEqual(failed(variant), ["03 snapshot state / no snapshot row under a case or spacing variant of SMILE-TRUST"]);
  assertNotReady(variant);

  const history = await scenario(() => db.query(
    "insert into public.st_snapshot_financial_ledger (business_id, kind, record_id, customer_id) values ($1, 'collections', 'col-ghost', 'c-gone')", [LIVE]));
  assert.deepEqual(failed(history), ["03 snapshot state / no registered posted history for SMILE-TRUST (expected 0)"]);

  const lifecycle = await scenario(() => db.query(
    "insert into public.st_member_lifecycle_events (business_code, customer_id, source, to_status) values ($1, 'c-1', 'snapshot', 'Active')", [LIVE]));
  assert.equal(lifecycle[0].status, "READY_FOR_INITIAL_SNAPSHOT");
  assert.deepEqual(byStatus(lifecycle, "WARN"), ["03 snapshot state / no member lifecycle events recorded from a snapshot"]);
  assert.match(lifecycle[0].detail, /review: 03 snapshot state \/ no member lifecycle events recorded from a snapshot/);

  const other = await scenario(() => db.query("insert into public.smile_trust_cloud_snapshots (business_id, payload) values ('OTHER-BIZ', '{}')"));
  assert.deepEqual(byStatus(other, "WARN"), ["03 snapshot state / snapshot rows for other businesses in this project"]);
  for (const rows of [history, lifecycle, other]) assertNoSecrets(rows);
});

test("missing app ids, duplicates and broken relationships block the first snapshot", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  assertNotReady(await scenario(() => db.query("update public.customers set client_id = null")),
    "05 app ids / members with NULL or empty client_id (expected 0)");
  assertNotReady(await scenario(() => db.query("update public.customers set client_id = ''")),
    "05 app ids / members with NULL or empty client_id (expected 0)");

  const branch = await scenario(() => db.query("update public.branches set client_id = null"));
  assertNotReady(branch, "05 app ids / branches (groups) with NULL or empty client_id (expected 0)",
    "06 relationships / every member has a branch of this business with an id");

  const user = await scenario(() => db.query("update public.app_users set client_id = null where id = $1", [staff.kwame.id]));
  assertNotReady(user, "05 app ids / app_users with NULL or empty client_id (expected 0)",
    "06 relationships / every member has a collector of this business with an id");

  const duplicate = await scenario(async () => {
    for (const item of (await db.query("select conname from pg_constraint where conrelid = 'public.customers'::regclass and contype = 'u'")).rows) {
      await db.query(`alter table public.customers drop constraint "${item.conname}"`);
    }
    for (const item of (await db.query(`select indexrelid::regclass::text as name from pg_index
      where indrelid = 'public.customers'::regclass and indisunique and not indisprimary`)).rows) {
      await db.query(`drop index ${item.name}`);
    }
    await db.query(`insert into public.customers
      select (jsonb_populate_record(null::public.customers, to_jsonb(c) || jsonb_build_object('id', gen_random_uuid(), 'account_no', 'ACC-DUP'))).*
      from public.customers c limit 1`);
  });
  assertNotReady(duplicate, "05 app ids / duplicate client_id values (expected 0)");

  const otherBiz = await scenario(async () => {
    const other = (await db.query("insert into public.businesses (code, name, legacy_code) values ('OTHER-BIZ', 'Other', 'OTHER-BIZ') returning id")).rows[0].id;
    await db.query("insert into public.branches (business_id, client_id, name) values ($1, 'other-branch', 'Other')", [other]);
    await db.query("update public.customers set branch_id = (select id from public.branches where client_id = 'other-branch')");
  });
  assertNotReady(otherBiz, "06 relationships / every member has a branch of this business with an id");
  assert.match(row(otherBiz, "06 relationships", "every member has a branch of this business with an id").detail, /branch in another business 1/);

  const collection = await scenario(async () => {
    const member = (await db.query("select id, business_id, branch_id, collector_id from public.customers limit 1")).rows[0];
    await db.query(`insert into public.collections (business_id, customer_id, branch_id, collector_id, client_id, amount, collection_date,
      receipt_no, idempotency_key, payment_method, client_created_at)
      values ($1, $2, $3, $4, null, 10, current_date, 'R-PREFLIGHT', 'IDEM-PREFLIGHT', 'Cash', now())`,
    [member.business_id, member.id, member.branch_id, member.collector_id]);
  });
  assertNotReady(collection, "05 app ids / collections with NULL or empty client_id (expected 0)");
  assert.equal(row(collection, "04 counts", "collections (SMILE-TRUST)").status, "WARN");

  const inactiveCollector = await scenario(() => db.query("update public.app_users set active = false where id = $1", [staff.kwame.id]));
  assertNotReady(inactiveCollector, "08 KWAME / role Collector and active (unchanged)");
  assert.equal(row(inactiveCollector, "06 relationships", "members assigned to an inactive collector").status, "WARN");
});

test("a JOHN that cannot sign in with MFA as SystemOwner blocks the first snapshot", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const cases = [
    ["update public.user_mfa_secrets set enabled = false, confirmed_at = null", [], ["07 JOHN / MFA enabled and confirmed"]],
    ["delete from public.user_mfa_secrets", [], ["07 JOHN / MFA enabled and confirmed"]],
    ["update auth.users set banned_until = now() + interval '1 day' where id = $1", [johnAuthId], ["07 JOHN / Auth user exists and is not banned"]],
    ["update public.app_users set active = false where id = $1", [staff.john.id], ["07 JOHN / role SystemOwner and active"]],
    ["update auth.users set raw_app_meta_data = raw_app_meta_data || '{\"app_role\":\"Collector\"}' where id = $1", [johnAuthId],
      ["07 JOHN / session claims: SMILE-TRUST, SystemOwner, this staff row"]],
    ["delete from public.st_staff_auth_links where auth_user_id = $1", [johnAuthId],
      ["07 JOHN / exactly one Auth link", "07 JOHN / Auth user exists and is not banned", "07 JOHN / session claims: SMILE-TRUST, SystemOwner, this staff row"]],
    ["update public.st_staff_auth_links set sessions_not_before = now() + interval '1 hour' where auth_user_id = $1", [johnAuthId],
      ["07 JOHN / session cutoff not in the future"]],
    [`insert into public.st_staff_login_attempts (business_code, username_key, succeeded)
      select 'SMILE-TRUST', 'john', false from generate_series(1, 5)`, [], ["07 JOHN / not locked out"]],
    ["update public.app_users set password_hash = null where id = $1", [staff.john.id], ["07 JOHN / password set (activated)"]]
  ];
  for (const [sql, params, checks] of cases) {
    const rows = await scenario(() => db.query(sql, params));
    assertNotReady(rows, ...checks);
    assert.deepEqual(failed(rows).sort(), [...checks].sort(), sql);
  }
  const demoted = await scenario(() => db.query("update public.app_users set role = 'Owner' where id = $1", [staff.john.id]));
  assertNotReady(demoted, "07 JOHN / role SystemOwner and active");
  assert.equal(row(demoted, "04 counts", "staff (SMILE-TRUST app_users)").status, "WARN");
});

test("an activated or changed AMA or KWAME blocks the first snapshot", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const amaPassword = await scenario(() => db.query("update public.app_users set password_hash = $1 where id = $2", [MARKERS.amaHash, staff.ama.id]));
  assert.deepEqual(failed(amaPassword), ["08 AMA / still not activated (no password, no Auth link, no MFA)"]);
  assertNotReady(amaPassword);
  assert.match(row(amaPassword, "08 AMA", "still not activated (no password, no Auth link, no MFA)").detail, /PASSWORD SET/);

  const kwameLink = await scenario(() => db.query("insert into public.st_staff_auth_links (business_code, app_user_id, auth_user_id) values ($1, $2, $3)",
    [LIVE, staff.kwame.app_id, crypto.randomUUID()]));
  assert.deepEqual(failed(kwameLink), ["08 KWAME / still not activated (no password, no Auth link, no MFA)"]);

  const kwameMfa = await scenario(() => db.query(`insert into public.user_mfa_secrets (business_id, user_client_id, secret, enabled)
    select business_id, $1, $2, false from public.app_users where id = $3`, [staff.kwame.app_id, MARKERS.mfa, staff.kwame.id]));
  assert.deepEqual(failed(kwameMfa), ["08 KWAME / still not activated (no password, no Auth link, no MFA)"]);

  const amaPromoted = await scenario(() => db.query("update public.app_users set role = 'SystemOwner' where id = $1", [staff.ama.id]));
  assert.deepEqual(failed(amaPromoted), ["08 AMA / role AssistantManager and active (unchanged)"]);
  for (const rows of [kwameLink, kwameMfa, amaPromoted]) assertNoSecrets(rows);
});

test("weakened or missing 047 snapshot protections block the first snapshot", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const snap = "public.smile_trust_cloud_snapshots";
  const cases = [
    [`alter table ${snap} disable trigger st_guard_cloud_snapshot`, ["02 047 protections / snapshot guard trigger exists, is enabled and runs before every new or changed row"]],
    [`drop trigger st_guard_cloud_snapshot on ${snap}`, ["02 047 protections / snapshot guard trigger exists, is enabled and runs before every new or changed row"]],
    [`alter table ${snap} disable row level security`, ["02 047 protections / row-level security enabled on the snapshot table"]],
    [`alter table ${snap} drop constraint smile_trust_cloud_snapshots_business_id_key`, ["02 047 protections / one snapshot per business (unique business_id)"]],
    [`drop policy st_snapshots_insert on ${snap};
      create policy st_snapshots_insert on ${snap} for insert to authenticated with check (business_id = public.st_jwt_business_code())`,
    ["02 047 protections / first write and later writes require the business, a manager role and a live staff identity"]],
    [`drop policy st_snapshots_select on ${snap};
      create policy st_snapshots_select on ${snap} for select to authenticated using (business_id = public.st_jwt_business_code())`,
    ["02 047 protections / reads limited to active linked staff of this business"]],
    [`grant delete on ${snap} to authenticated;
      create policy st_snapshots_delete on ${snap} for delete to authenticated using (true)`,
    ["02 047 protections / only the three 047 snapshot policies exist, all for signed-in staff",
      "02 047 protections / no row-removal or catch-all policy on the snapshot",
      "02 047 protections / signed-in staff: read, first write and later writes only (cannot remove rows or empty the table)"]],
    [`grant select on ${snap} to anon`, ["02 047 protections / anonymous clients hold no snapshot privilege"]],
    [`revoke insert on ${snap} from authenticated`, ["02 047 protections / signed-in staff: read, first write and later writes only (cannot remove rows or empty the table)"]],
    ["revoke select on public.customers from authenticated", ["02 047 protections / bootstrap integrity reads: signed-in staff can read the member and collection id columns"]],
    ["drop policy tenant_select on public.collections", ["02 047 protections / bootstrap integrity reads: signed-in staff can read the member and collection id columns"]],
    ["grant execute on function public.st_internal_fetch_business_snapshot(text) to authenticated",
      ["02 047 protections / internal load and guard functions are not client-callable; anonymous clients cannot load or submit"]],
    ["revoke execute on function public.st_submit_collections(text, jsonb) from authenticated",
      ["02 047 protections / signed-in staff can call the load, the collector submit and the policy helpers"]]
  ];
  for (const [sql, checks] of cases) {
    const rows = await scenario(() => db.query(sql));
    assertNotReady(rows, ...checks);
    assert.deepEqual(failed(rows).sort(), [...checks].sort(), sql);
  }
  const noFetch = await scenario(() => db.query("drop function public.fetch_business_snapshot(text)"));
  assertNotReady(noFetch, "02 047 protections / required 046/047 functions exist",
    "02 047 protections / fetch_business_snapshot is the 046 guarded wrapper",
    "02 047 protections / signed-in staff can call the load, the collector submit and the policy helpers");
  assert.match(row(noFetch, "02 047 protections", "required 046/047 functions exist").detail, /missing: fetch_business_snapshot\(text\)/);
});

test("a project without the SMILE-TRUST business is not ready (wrong project or renamed business)", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const rows = await scenario(() => db.query("update public.businesses set code = 'OTHER-BIZ', legacy_code = 'OTHER-BIZ'"));
  assertNotReady(rows, "01 business / exactly one SMILE-TRUST business (code or legacy_code)",
    "07 JOHN / exactly one app_users row", "08 AMA / exactly one row, UUID unchanged");
  assert.match(row(rows, "01 business", "exactly one SMILE-TRUST business (code or legacy_code)").detail, /^0 matching business row\(s\)/);
});
