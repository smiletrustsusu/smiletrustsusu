/**
 * supabase/preflight/existing_snapshot_forensics_readonly.sql: statically read-only (no writes,
 * DDL, privilege changes, mutating calls or credential columns), and on a disposable local
 * PostgreSQL built like the live project (001–045 without rls.sql, 046, 047, JOHN activated with
 * MFA, AMA and KWAME not activated) it classifies a SMILE-TRUST snapshot as valid, stale, of
 * unclear origin or a security concern, and never returns a credential, a business record or the
 * payload. Never connects to a remote database.
 */
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { migrationFiles, startLocalSupabase } from "./helpers/supabase-local-db.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILE = fs.readFileSync(path.join(root, "supabase", "preflight", "existing_snapshot_forensics_readonly.sql"), "utf8");
const LIVE = "SMILE-TRUST";
const SAVED_AT = "2026-10-03T13:05:00Z";
const MARKERS = {
  johnHash: "pbkdf2:120000:SALTMARKER01:HASHMARKER01",
  snapshotHash: "pbkdf2:120000:LEAKMARKER01:LEAKMARKER02",
  totp: "MFAMARKERAAAAAAAAAAAAAAAAAAAAAA2",
  jwt: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJUT0tFTk1BUktFUiJ9.c2lnbmF0dXJlbWFya2Vy",
  legacyKey: "LEGACYKEYMARKER01",
  otpauth: "otpauth://totp/SMILE:john?secret=OTPAUTHMARKER",
  codeHash: "CODEHASHMARKER01",
  memberName: "MEMBERNAMEMARKER",
  memberPhone: "0240000999",
  authEmail: "authmarker@example.invalid",
  portalPin: "4729"
};
const FORBIDDEN_WORDS = /\b(insert|update|delete|upsert|merge|truncate|alter|drop|create|grant|revoke|copy|call|do|execute|perform|vacuum|analyze|reindex|cluster|lock|notify|listen|comment|reset|refresh|import|discard|prepare|begin|commit|rollback|savepoint|returning|security|definer|owner|policy|trigger|function|procedure)\b/i;
const WRITE_WORDS = /\b(insert|update|delete|upsert|merge|truncate|alter|drop|create|grant|revoke)\b/i;
const STATEMENT_TEXT = /\b(insert\s+into|update\s+[\w."]+\s+set|delete\s+from|upsert|merge\s+into|truncate\s+|alter\s+|drop\s+|create\s+|grant\s+|revoke\s+|security\s+definer|on\s+conflict)/i;
const ALLOWED_CALLS = new Set([
  "coalesce", "count", "sum", "min", "max", "string_agg", "row_number", "upper", "lower", "btrim", "length", "octet_length",
  "format", "now", "date_trunc", "nullif", "to_regclass", "pg_get_serial_sequence", "pg_column_size", "xpath", "query_to_xml",
  "regexp_matches", "unnest", "jsonb_typeof", "jsonb_array_length", "jsonb_object_keys", "jsonb_array_elements", "jsonb_path_query"
]);
const SQL_WORDS = new Set(["as", "in", "values", "exists", "filter", "not", "and", "or", "on", "then", "else", "when", "lateral",
  "from", "select", "where", "by", "join", "is", "like", "case", "end", "with", "over", "any", "ordinality", "distinct"]);
const ALIASES = new Set(["k", "n", "e", "x", "arr_names", "baseline", "std_top", "fetch_fields", "checks"]);

let db;
let verification;
let johnAuthId;
let staffBefore;
let dbState;
const staff = {};
const migration = (prefix) => migrationFiles().find((item) => item.name.startsWith(`${prefix}_`));

const comments = (sql) => [...sql.matchAll(/--(.*)$/gm)].map((match) => match[1]).join("\n");
const literals = (sql) => [...sql.replace(/--.*$/gm, "").matchAll(/'((?:[^']|'')*)'/g)].map((match) => match[1].replace(/''/g, "'"));
const codeOnly = (sql) => sql.replace(/--.*$/gm, "").replace(/'(?:[^']|'')*'/g, "''");

async function run() {
  const result = await db.query(verification);
  return (Array.isArray(result) ? result.at(-1) : result).rows;
}

async function scenario(setup) {
  await db.query("begin");
  try {
    if (setup) await setup();
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

function assertNoSecrets(rows) {
  const text = JSON.stringify(rows);
  for (const [name, value] of Object.entries(MARKERS)) assert.equal(text.includes(value), false, `${name} value returned`);
  assert.doesNotMatch(text, /pbkdf2:\d|eyJ[A-Za-z0-9_-]{8,}\.|otpauth:|\$2[aby]\$/, "no credential-shaped value is returned");
  assert.equal(text.includes(johnAuthId), false, "no Auth user id is returned");
  for (const item of rows) {
    assert.deepEqual(Object.keys(item), ["section", "ord", "check_name", "status", "detail"]);
    assert.equal(typeof item.detail, "string", `${item.section} / ${item.check_name} has a text detail`);
  }
}

function devicePayload(overrides = {}) {
  return {
    settings: { collectionDays: 31, loanInterest: 15, businessName: "SMILE TRUST SUSU MANAGEMENT SYSTEM", currency: "GHS",
      theme: "emerald", cloudUrl: "", localBackupUrl: "", businessId: LIVE, cloudMode: "auto" },
    groups: [], users: [], customers: [], collections: [], loans: [], transactions: [], messages: [], closings: [],
    deletedUsers: [], deletedRecords: [], audit: [],
    ...overrides
  };
}

function bootstrapPayload(extra = {}) {
  return devicePayload({ ...structuredClone(dbState), updatedAt: SAVED_AT, ...extra });
}

async function storeSnapshot(payload, { savedBy = "john", savedAt = SAVED_AT, bypassGuard = false, accessKey = "", businessId = LIVE } = {}) {
  if (bypassGuard) await db.query("set local session_replication_role = replica");
  await db.query("insert into public.smile_trust_cloud_snapshots (business_id, access_key, payload, saved_by, saved_at) values ($1, $2, $3, $4, $5)",
    [businessId, accessKey, JSON.stringify(payload), savedBy, savedAt]);
  if (bypassGuard) await db.query("set local session_replication_role = origin");
}

async function johnSignedIn() {
  await db.query("insert into public.st_staff_login_attempts (business_code, username_key, succeeded, attempted_at) values ($1, 'john', true, $2)",
    [LIVE, "2026-10-03T13:00:00Z"]);
  await db.query("insert into auth.sessions (id, user_id, created_at, aal) values ($1, $2, $3, 'aal2')",
    [crypto.randomUUID(), johnAuthId, "2026-10-03T13:00:00Z"]);
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
  await db.query("create table if not exists auth.sessions (id uuid primary key, user_id uuid, created_at timestamptz, aal text)");
  await db.query(migration("047").sql);
  for (const item of (await db.query("select id, username, coalesce(client_id, id::text) as app_id from public.app_users")).rows) {
    staff[item.username] = item;
  }

  await db.query("set session_replication_role = replica");
  await db.query("update public.app_users set password_hash = $1, auth_email = $2 where id = $3", [MARKERS.johnHash, MARKERS.authEmail, staff.john.id]);
  await db.query("update public.customers set name = $1, phone = $2", [MARKERS.memberName, MARKERS.memberPhone]);
  await db.query("set session_replication_role = origin");
  johnAuthId = crypto.randomUUID();
  await db.query("insert into auth.users (id, raw_app_meta_data) values ($1, $2)",
    [johnAuthId, { business_code: LIVE, app_user_id: staff.john.app_id, app_role: "SystemOwner" }]);
  await db.query("insert into public.st_staff_auth_links (business_code, app_user_id, auth_user_id, created_at) values ($1, $2, $3, $4)",
    [LIVE, staff.john.app_id, johnAuthId, "2026-10-01T22:30:00Z"]);
  await db.query(`insert into public.user_mfa_secrets (business_id, user_client_id, secret, enabled, confirmed_at)
    select business_id, $1, $2, true, $3 from public.app_users where id = $4`,
  [staff.john.app_id, MARKERS.totp, "2026-10-03T12:58:00Z", staff.john.id]);
  await db.query(`insert into public.st_staff_activation_codes (business_code, app_user_uuid, code_hash, expires_at, used_at)
    values ($1, $2, $3, now() - interval '1 day', now() - interval '2 days')`, [LIVE, staff.john.id, MARKERS.codeHash]);
  await db.query("insert into public.st_staff_security_events (business_code, app_user_id, event, details, created_at) values ($1, $2, 'mfa_enrolled', $3, $4)",
    [LIVE, staff.john.app_id, { note: MARKERS.codeHash }, "2026-10-03T12:58:00Z"]);

  dbState = (await db.query("select public.st_internal_fetch_business_snapshot($1) as s", [LIVE])).rows[0].s;
  staffBefore = await staffState();
  verification = FILE;
}, { timeout: 240000 });

after(async () => {
  await db?.stop();
});

const skip = () => !db;

test("the forensic query is one read-only SELECT: no write, DDL, privilege change or upsert keyword in its code or comments", () => {
  const code = codeOnly(FILE);
  assert.match(code, /^\s*set transaction read only;/, "the transaction is made read-only first");
  assert.equal((code.match(/\bset\b/gi) || []).length, 1, "the only SET is the read-only guard");
  assert.equal((code.match(/;/g) || []).length, 2, "exactly two statements: the guard and one SELECT");
  assert.match(code.slice(code.indexOf(";") + 1).trim(), /^with\b[\s\S]*\bselect\b[\s\S]*;\s*$/i);
  assert.doesNotMatch(code, FORBIDDEN_WORDS, "no forbidden keyword in the SQL itself");
  assert.doesNotMatch(comments(FILE), WRITE_WORDS, "not even the comments name a write or DDL statement");
  assert.doesNotMatch(FILE, /security\s+definer/i);
  for (const text of literals(FILE)) {
    assert.doesNotMatch(text, STATEMENT_TEXT, `string literal holds statement text: ${text}`);
    assert.doesNotMatch(text, WRITE_WORDS, `string literal names a write: ${text}`);
  }
});

test("it calls only read-only built-ins; dynamic SQL is only row counts", () => {
  const code = codeOnly(FILE);
  const called = new Set([...code.matchAll(/\b([a-z_][a-z0-9_]*)\s*\(/gi)].map((match) => match[1].toLowerCase()));
  const unexpected = [...called].filter((name) => !ALLOWED_CALLS.has(name) && !SQL_WORDS.has(name) && !ALIASES.has(name));
  assert.deepEqual(unexpected, [], "every call is an allow-listed read-only built-in");
  assert.doesNotMatch(code, /\b(public|auth|extensions)\s*\.\s*\w+\s*\(/i, "no application function is called");
  assert.doesNotMatch(code, /\b(rpc|st_\w+|fetch_business_snapshot|upsert_\w+|set_config|nextval|setval|pg_terminate_backend|pg_cancel_backend|dblink\w*|pg_read_\w+|lo_\w+)\s*\(/i);

  const dynamic = [...FILE.matchAll(/query_to_xml\(\s*([\s\S]*?),\s*false,\s*false,\s*''\)/g)].map((match) => match[1]);
  assert.equal(dynamic.length, (FILE.match(/query_to_xml\(/g) || []).length, "every query_to_xml runs in table mode");
  assert.equal(dynamic.length, 3);
  for (const text of dynamic) {
    assert.match(text.trim(), /^(format\(\s*)?'select count\(\*\) as n from (public\.(loans|ledger_entries)|auth\.sessions where user_id = %L and created_at between %L and %L)'/);
    assert.doesNotMatch(text, /;/);
  }
});

test("it never selects a credential column, the payload or free-text record fields for output", () => {
  const code = codeOnly(FILE);
  assert.doesNotMatch(code, /\b(password_hash|secret|auth_email|encrypted_password|code_hash|pin_hash|refresh_token|access_token|raw_app_meta_data|raw_user_meta_data|details|metadata|detail_text)\b/i,
    "no credential, Auth metadata or free-text column is referenced");
  assert.doesNotMatch(code, /\bl\.detail\b|\be\.details\b/, "audit and security-event text is never read");
  assert.deepEqual([...code.matchAll(/[^\n]*access_key[^\n]*/g)].map((match) => match[0].trim()),
    ["coalesce(s.access_key, '') <> '' as legacy_key_set,"], "the legacy key is only tested for emptiness");
  const payloadLines = [...code.matchAll(/[^\n]*\bpayload\b[^\n]*/g)].map((match) => match[0].trim());
  assert.ok(payloadLines.length >= 4);
  const start = code.indexOf("candidates as (");
  const end = code.indexOf("win as (");
  for (const match of code.matchAll(/\bpayload\b/g)) {
    assert.ok(match.index > start && match.index < end, "the payload column is only read inside the candidates and pl CTEs");
  }
  assert.doesNotMatch(code.slice(code.indexOf("checks (section")), /\b(p|v|st)\s*->\s*''/, "no raw payload value is output as JSON");
  const fields = new Set([...FILE.matchAll(/->>\s*'([^']+)'/g)].map((match) => match[1]));
  assert.deepEqual([...fields].sort(), ["active", "businessId", "collectorId", "groupId", "id", "memberStatus", "role", "username"].sort(),
    "only identity, status and link fields are extracted; names, phones and emails never are");
  assert.match(FILE, /qouokiqoepjpoksupskb/);
  assert.doesNotMatch(FILE, /angoswtgcklnorhlosnf/);
  assert.doesNotMatch(FILE, /sb_secret_[A-Za-z0-9]{6,}|sb_publishable_[A-Za-z0-9]{6,}|service_role_key\s*[=:]|eyJ[A-Za-z0-9_-]{10,}\.|postgres(ql)?:\/\//i, "no credentials");
});

test("the key list matches migration 047's secret-key rule exactly", () => {
  const sql047 = migration("047").sql;
  const keysIn = (text) => [...text.match(/=\s*any\s*\(array\[([\s\S]*?)\]\)/i)[1].matchAll(/'([^']+)'/g)].map((match) => match[1]).sort();
  const fn047 = sql047.slice(sql047.indexOf("function public.st_is_secret_key"), sql047.indexOf("function public.st_strip_secret_keys"));
  const mine = FILE.slice(FILE.indexOf("secret_keys as"), FILE.indexOf("sensitive_names as"));
  assert.deepEqual(keysIn(mine), keysIn(fn047));
  assert.equal(mine.match(/~\s*'([^']+)'/)[1], fn047.match(/~\s*'([^']+)'/)[1]);
});

test("no SMILE-TRUST row: EXISTING_SNAPSHOT_NOT_FOUND, every detail filled, nothing changed", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const rows = await run();
  assert.equal(rows[0].section, "VERDICT");
  assert.equal(rows[0].status, "EXISTING_SNAPSHOT_NOT_FOUND");
  assert.equal(row(rows, "01 row", "row id").detail, "no row");
  assertNoSecrets(rows);
  assert.deepEqual(await staffState(), staffBefore);
});

test("the forensic query's own transaction refuses writes", async (t) => {
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

test("a snapshot built from the database, saved by JOHN after a server-recorded sign-in, APPEARS_VALID", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const rows = await scenario(async () => {
    await johnSignedIn();
    await storeSnapshot(bootstrapPayload());
  });
  assert.equal(rows[0].status, "EXISTING_SNAPSHOT_APPEARS_VALID", rows[0].detail);
  assert.deepEqual([...byStatus(rows, "CONCERN"), ...byStatus(rows, "STALE"), ...byStatus(rows, "UNCLEAR")], []);
  assert.match(row(rows, "01 row", "row id").detail, /^\d+$/);
  assert.equal(row(rows, "01 row", "business_id").detail, '"SMILE-TRUST"');
  assert.equal(row(rows, "01 row", "saved_by (written by the client)").detail, "john (staff, SystemOwner, active)");
  assert.equal(row(rows, "01 row", "legacy access_key column empty").status, "PASS");
  assert.match(row(rows, "01 row", "payload size").detail, /^\d+ bytes as JSON text, \d+ bytes stored$/);
  for (const [label, n] of [["staff (users)", "3"], ["members (customers)", "1"], ["groups (branches)", "1"], ["collections", "0"],
    ["savings products", "1"], ["loans", "0"], ["transactions", "0"], ["ledger entries", "absent"]]) {
    assert.equal(row(rows, "03 snapshot contents", label).detail, n, label);
  }
  assert.equal(row(rows, "04 vs database", "members: snapshot vs database").detail, "snapshot 1, database 1, recorded baseline 1");
  assert.equal(row(rows, "04 vs database", "staff: snapshot vs database").detail, "snapshot 3, database 3, recorded baseline 3");
  assert.ok(rows.some((item) => item.section === "02 top-level keys" && item.check_name === "savingsProducts"));
  assert.equal(row(rows, "07 format", "structure").detail, "matches the database-load bootstrap format of commit 11be35b (database fields only)");
  assert.match(row(rows, "08 origin", "saved_by signed in shortly before saved_at (server-recorded)").detail, /^1 successful and 0 failed/);
  assert.equal(row(rows, "08 origin", "Auth sessions for saved_by started in that window").detail, "1 session(s)");
  assert.match(row(rows, "08 origin", "staff security events within 24 hours of saved_at").detail, /^mfa_enrolled by john at /);
  assert.equal(row(rows, "09 JOHN timeline", "snapshot saved_at relative to JOHN's MFA confirmation").detail, "saved 00:07:00 after MFA confirmation");
  assertNoSecrets(rows);
  assert.deepEqual(await staffState(), staffBefore);
});

test("an old device-state snapshot that disagrees with the database APPEARS_STALE", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const rows = await scenario(async () => {
    await johnSignedIn();
    await storeSnapshot(devicePayload({
      settings: { businessName: "SMILE TRUST SUSU MANAGEMENT SYSTEM", businessId: "" },
      users: [{ id: staff.john.app_id, username: "john", role: "SystemOwner", active: true, createdAt: "2026-09-01", permissions: ["all"], mfaEnabled: false }],
      customers: [{ id: "c-old-device", name: MARKERS.memberName, phone: MARKERS.memberPhone, portalPin: MARKERS.portalPin, createdAt: "2026-09-01" }],
      audit: [{ action: "login", at: "2026-10-03" }],
      offlineQueue: []
    }));
  });
  assert.equal(rows[0].status, "EXISTING_SNAPSHOT_APPEARS_STALE", rows[0].detail);
  assert.deepEqual(byStatus(rows, "CONCERN"), [], "the 047 guard stripped the portal PIN before storing");
  for (const check of ["04 vs database / staff: snapshot vs database", "04 vs database / groups: snapshot vs database",
    "04 vs database / savings products: snapshot vs database", "05 records / members: ids agree with the database",
    "05 records / staff: ids agree with the database"]) {
    assert.ok(byStatus(rows, "STALE").includes(check), check);
    assert.ok(rows[0].detail.includes(check), `the verdict names ${check}`);
  }
  assert.equal(row(rows, "05 records", "members: ids agree with the database").detail,
    "in snapshot but not in database 1, in database but not in snapshot 1, without id 0, duplicate ids 0");
  assert.equal(row(rows, "05 records", "settings.businessId is SMILE-TRUST").status, "UNCLEAR");
  assert.match(row(rows, "07 format", "structure").detail, /^resembles the older full device-state format: 1 extra top-level key\(s\)/);
  assert.equal(row(rows, "07 format", "extra top-level keys (not in the default device state)").detail, "offlineQueue");
  assert.match(row(rows, "07 format", "device-only fields on staff, member, group and product records (names only)").detail,
    /customers\.createdAt x1.*users\.createdAt x1, users\.mfaEnabled x1, users\.permissions x1/);
  assert.equal(row(rows, "03 snapshot contents", "device audit trail (audit)").detail, "1");
  assertNoSecrets(rows);
});

test("credentials stored without the 047 guard are a SECURITY_CONCERN, reported by name and count only", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const leaky = bootstrapPayload();
  leaky.users[0] = { ...leaky.users[0], passwordHash: MARKERS.snapshotHash, mfaSecret: MARKERS.totp, note: MARKERS.otpauth };
  leaky.settings = { ...leaky.settings, syncToken: MARKERS.jwt, cloudKey: MARKERS.legacyKey };
  leaky.customers[0] = { ...leaky.customers[0], portalPin: MARKERS.portalPin };
  const rows = await scenario(async () => {
    await johnSignedIn();
    await storeSnapshot(leaky, { bypassGuard: true, accessKey: MARKERS.legacyKey });
  });
  assert.equal(rows[0].status, "EXISTING_SNAPSHOT_SECURITY_CONCERN", rows[0].detail);
  assert.deepEqual(byStatus(rows, "CONCERN").sort(), [
    "01 row / legacy access_key column empty",
    "06 credentials / no credential-shaped values (password hashes, JWTs, server keys, authenticator URIs)",
    "06 credentials / no secret keys anywhere in the payload (047 key list)"
  ]);
  assert.match(row(rows, "06 credentials", "no secret keys anywhere in the payload (047 key list)").detail,
    /^cloudKey x1, mfaSecret x1, passwordHash x1, portalPin x1, syncToken x1: /);
  assert.equal(row(rows, "06 credentials", "no credential-shaped values (password hashes, JWTs, server keys, authenticator URIs)").detail,
    "pbkdf2 hashes 1, bcrypt hashes 0, JWTs 1, server secret keys 0, otpauth URIs 1 (counts only)");
  assert.equal(row(rows, "06 credentials", "no strings shaped like an authenticator (TOTP) secret").status, "UNCLEAR");
  assert.match(row(rows, "01 row", "legacy access_key column empty").detail, /value not shown/);
  assertNoSecrets(rows);
});

test("posted records that skipped the 047 guard's history are a concern; guarded ones are not", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const member = dbState.customers[0].id;
  const withCollection = () => bootstrapPayload({ collections: [{ id: "col-forensic", customerId: member, amount: 10, amountPesewas: 1000 }] });

  const bypassed = await scenario(async () => {
    await johnSignedIn();
    await storeSnapshot(withCollection(), { bypassGuard: true });
  });
  assert.equal(bypassed[0].status, "EXISTING_SNAPSHOT_SECURITY_CONCERN");
  assert.deepEqual(byStatus(bypassed, "CONCERN"), ["06 credentials / every posted record in the payload is registered by the 047 guard"]);
  assert.ok(byStatus(bypassed, "STALE").includes("04 vs database / collections: snapshot vs database"));

  const guarded = await scenario(async () => {
    await johnSignedIn();
    await storeSnapshot(withCollection());
  });
  assert.equal(guarded[0].status, "EXISTING_SNAPSHOT_APPEARS_STALE", "a collection missing from the database is stale, not a guard bypass");
  assert.equal(row(guarded, "06 credentials", "every posted record in the payload is registered by the 047 guard").detail, "1 posted record(s), 0 unregistered");
  assert.match(row(guarded, "08 origin", "posted history registered by the 047 guard (server time)").detail, /^1 record\(s\), first seen .*, by /);
  for (const rows of [bypassed, guarded]) assertNoSecrets(rows);
});

test("matching contents without corroborated origin are ORIGIN_UNCLEAR", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const system = await scenario(async () => {
    await johnSignedIn();
    await storeSnapshot(bootstrapPayload(), { savedBy: "system" });
  });
  assert.equal(system[0].status, "EXISTING_SNAPSHOT_ORIGIN_UNCLEAR", system[0].detail);
  assert.deepEqual(byStatus(system, "UNCLEAR").sort(), [
    "01 row / saved_by (written by the client)",
    "08 origin / saved_by is staff of this business with a manager role",
    "08 origin / saved_by signed in shortly before saved_at (server-recorded)"
  ]);
  assert.match(row(system, "01 row", "saved_by (written by the client)").detail, /^system: not a staff member/);

  const noSignIn = await scenario(() => storeSnapshot(bootstrapPayload()));
  assert.deepEqual(byStatus(noSignIn, "UNCLEAR"), ["08 origin / saved_by signed in shortly before saved_at (server-recorded)"]);
  assert.equal(row(noSignIn, "08 origin", "Auth sessions for saved_by started in that window").detail, "0 session(s)");

  const early = await scenario(async () => {
    await johnSignedIn();
    await storeSnapshot(bootstrapPayload(), { savedAt: "2026-09-30T10:00:00Z" });
  });
  assert.ok(byStatus(early, "UNCLEAR").includes("08 origin / saved_at is after the last verification that found no row (2026-10-02 16:15 UTC)"));

  const unknown = await scenario(async () => {
    await johnSignedIn();
    await storeSnapshot(bootstrapPayload(), { savedBy: MARKERS.legacyKey });
  });
  assert.equal(row(unknown, "01 row", "saved_by (written by the client)").detail, `unrecognised value (${MARKERS.legacyKey.length} chars, not shown)`);

  const variant = await scenario(async () => {
    await johnSignedIn();
    await storeSnapshot(bootstrapPayload());
    await storeSnapshot(bootstrapPayload(), { businessId: "smile-trust " });
  });
  assert.equal(row(variant, "01 row", "SMILE-TRUST snapshot rows (expected exactly one)").status, "UNCLEAR");
  assert.match(row(variant, "01 row", "SMILE-TRUST snapshot rows (expected exactly one)").detail, /^1 exact, 1 case\/spacing variant/);
  for (const rows of [system, noSignIn, early, unknown, variant]) assertNoSecrets(rows);
});

test("staff or member details that drifted from the database are stale even when ids match", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const drifted = bootstrapPayload();
  drifted.users = drifted.users.map((user) => user.username === "ama" ? { ...user, role: "SystemOwner" } : user);
  drifted.customers = drifted.customers.map((member) => ({ ...member, memberStatus: "Closed", collectorId: staff.john.app_id }));
  const rows = await scenario(async () => {
    await johnSignedIn();
    await storeSnapshot(drifted);
  });
  assert.equal(rows[0].status, "EXISTING_SNAPSHOT_APPEARS_STALE");
  assert.equal(row(rows, "05 records", "staff role, active flag and username agree with the database").detail,
    "role differs 1, active differs 0, username differs 0");
  assert.equal(row(rows, "05 records", "member status, group and collector agree with the database").detail,
    "status differs 1, group differs 0, collector differs 1");
  assertNoSecrets(rows);
});
