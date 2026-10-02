/**
 * supabase/preflight/047_production_preflight_readonly.sql on a disposable local PostgreSQL built
 * like the live project (001–045 without rls.sql, then 046). Proves the file is read-only, reports
 * READY_FOR_047 only for the expected pre-047 state, catches each blocking condition, and never
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
const FILE = fs.readFileSync(path.join(root, "supabase", "preflight", "047_production_preflight_readonly.sql"), "utf8");
const LIVE = "SMILE-TRUST";
const PROD_UUIDS = {
  john: "bbef5ecc-3bdf-40b6-bf8e-c0e206eed9db",
  ama: "6e6667ac-72ce-4f30-9c8e-2fd838988590",
  kwame: "3d156d98-3b4a-4024-8a46-1450df386672"
};
const MARKERS = {
  johnHash: "pbkdf2:120000:SALTMARKER01:HASHMARKER01",
  amaHash: "pbkdf2:120000:SALTMARKER02:HASHMARKER02",
  snapshotHash: "pbkdf2:1:LEAKMARKER01:LEAKMARKER02",
  mfa: "MFAMARKER01",
  totp: "TOTPMARKER01",
  codeHash: "CODEHASHMARKER01",
  token: "TOKENMARKER01",
  sync: "SYNCMARKER01",
  pin: "9137"
};

let db;
let preflight;
const staff = {};
const migration = (prefix) => migrationFiles().find((item) => item.name.startsWith(`${prefix}_`));

function codeOnly(sql) {
  return sql.replace(/--.*$/gm, "").replace(/'(?:[^']|'')*'/g, "''");
}

async function runPreflight(sql = preflight) {
  const result = await db.query(sql);
  return (Array.isArray(result) ? result.at(-1) : result).rows;
}

async function scenario(setup, sql) {
  await db.query("begin");
  try {
    if (setup) await setup();
    return await runPreflight(sql);
  } finally {
    await db.query("rollback");
  }
}

const row = (rows, section, check) => {
  const found = rows.find((item) => item.section === section && item.check_name === check);
  assert.ok(found, `missing check ${section} / ${check}`);
  return found;
};
const verdict = (rows) => rows[0];
const failed = (rows) => rows.filter((item) => item.status === "FAIL").map((item) => `${item.section} / ${item.check_name}`);

function assertNoSecrets(rows) {
  const text = JSON.stringify(rows);
  for (const [name, value] of Object.entries(MARKERS)) {
    if (name === "pin") assert.equal(text.includes(`"${value}"`) || text.includes(` ${value}`), false, "portal PIN value returned");
    else assert.equal(text.includes(value), false, `${name} value returned`);
  }
  assert.doesNotMatch(text, /pbkdf2:\d/, "no password hash is returned");
  for (const item of rows) assert.deepEqual(Object.keys(item), ["section", "ord", "check_name", "status", "detail"]);
}

async function activateJohn() {
  await db.query("update public.app_users set password_hash = $1 where id = $2", [MARKERS.johnHash, staff.john.id]);
  const authId = crypto.randomUUID();
  await db.query("insert into auth.users (id, raw_app_meta_data) values ($1, $2)",
    [authId, { business_code: LIVE, app_user_id: staff.john.app_id, app_role: "SystemOwner", provider: "email" }]);
  await db.query("insert into public.st_staff_auth_links (business_code, app_user_id, auth_user_id) values ($1, $2, $3)",
    [LIVE, staff.john.app_id, authId]);
  return authId;
}

function healthyPayload() {
  return {
    settings: { businessName: "Smile Trust", security: { syncToken: MARKERS.sync } },
    users: [
      { id: staff.john.app_id, username: "john", role: "SystemOwner", passwordHash: MARKERS.snapshotHash, mfaSecret: MARKERS.mfa },
      { id: staff.kwame.app_id, username: "kwame", role: "Collector" }
    ],
    customers: [
      { id: "c-1", name: "Member One", memberStatus: "Active", portalPin: MARKERS.pin },
      { id: "c-2", name: "Member Two", memberStatus: "Closed", active: false },
      { id: "c-3", name: "No history" }
    ],
    collections: [
      { id: "col-1", customerId: "c-1", amount: 10, amountPesewas: 1000 },
      { id: "col-2", customerId: "c-2", amount: 5 },
      { id: "col-1", customerId: "c-1", amount: 10, amountPesewas: 1000 }
    ],
    ledgerEntries: [{ id: "led-1c", customerId: "c-1", amount: 10 }, { id: "led-1d", customerId: "", amount: 10 }],
    transactions: [{ id: "tx-1", customerId: "c-1", amount: 10 }, { amount: 3 }],
    offlineQueue: [[{ op: "sync", accessToken: MARKERS.token }]]
  };
}

async function healthy(payload = healthyPayload()) {
  const authId = await activateJohn();
  const biz = (await db.query("select id from public.businesses where code = $1 or legacy_code = $1", [LIVE])).rows[0].id;
  await db.query("insert into public.user_mfa_secrets (business_id, user_client_id, secret, enabled) values ($1, $2, $3, false)",
    [biz, staff.ama.app_id, MARKERS.totp]);
  await db.query("insert into public.st_staff_activation_codes (business_code, app_user_uuid, code_hash, expires_at) values ($1, $2, $3, now() + interval '1 day')",
    [LIVE, staff.kwame.id, MARKERS.codeHash]);
  await db.query("insert into public.smile_trust_cloud_snapshots (business_id, payload) values ($1, $2)", [LIVE, JSON.stringify(payload)]);
  return authId;
}

before(async () => {
  db = await startLocalSupabase({ upTo: "045", withRlsSql: false });
  if (!db) {
    if (process.env.SMILE_SKIP_DB_TESTS === "1") return;
    throw new Error("embedded-postgres is required for migration tests (npm install)");
  }
  const rows = (await db.query("select id, username, coalesce(client_id, id::text) as app_id from public.app_users")).rows;
  for (const item of rows) staff[item.username] = item;
  preflight = FILE;
  for (const name of Object.keys(PROD_UUIDS)) preflight = preflight.replaceAll(PROD_UUIDS[name], staff[name].id);
}, { timeout: 240000 });

after(async () => {
  await db?.stop();
});

const skip = () => !db;

test("the preflight is a single read-only query with no writes, DDL, dynamic writes or mutating RPCs", () => {
  const code = codeOnly(FILE);
  assert.match(code, /^\s*set transaction read only;/, "the transaction is made read-only first");
  assert.equal((code.match(/\bset\b/gi) || []).length, 1, "the only SET is the read-only guard");
  assert.doesNotMatch(code,
    /\b(insert|update|delete|truncate|drop|alter|create|grant|revoke|merge|copy|call|do|execute|vacuum|analyze|reindex|cluster|lock|notify|listen|comment|reset|refresh|import|discard|prepare|begin|commit|rollback)\b/i,
    "only SELECT statements");
  assert.doesNotMatch(code,
    /\b(st_issue_staff_activation|st_reset_staff_mfa|st_upsert_staff_account|st_submit_collections|upsert_user_mfa|set_config|pg_terminate_backend|pg_cancel_backend|nextval|setval|dblink\w*|pg_read_\w+|lo_\w+|portal_\w+|st_portal_\w+|st_store_portal_pin)\s*\(/i,
    "no mutating or file-reading function is called");
  assert.equal((code.match(/;/g) || []).length, 2, "exactly two statements: the guard and one SELECT");
  assert.doesNotMatch(FILE.replace(/\s+/g, " "), /, (true|false), true, ''\)/,
    "query_to_xml runs in table mode: table-forest mode is empty for zero rows and xpath() cannot parse it (2200M)");
  const dynamic = [...FILE.matchAll(/query_to_xml\(format\('([^']*)'/g)].map((match) => match[1]);
  assert.ok(dynamic.length >= 1);
  for (const sql of dynamic) assert.match(sql, /^select count\(\*\) as n from public\.%I$/, "dynamic SQL only counts rows");
  assert.doesNotMatch(FILE, /sb_secret_|sb_publishable_|eyJ[A-Za-z0-9_-]{10,}\.|pbkdf2:\d|service_role_key\s*=|:\s*\\(set|i|copy)\b/i, "no credentials or psql meta-commands");
  for (const uuid of Object.values(PROD_UUIDS)) assert.ok(FILE.includes(uuid), `expected uuid ${uuid}`);
  assert.doesNotMatch(code, /\bpassword_hash\b(?![^\n]*(like|= ''|''\) = ''))/i, "password_hash is only classified, never selected");
});

test("the preflight detects secrets with exactly the key list and suffix rule 047 strips", () => {
  const sql047 = migration("047").sql;
  const keysIn = (text) => {
    const body = text.match(/=\s*any\s*\(array\[([\s\S]*?)\]\)/i)[1];
    return [...body.matchAll(/'([^']+)'/g)].map((match) => match[1]).sort();
  };
  const fn047 = sql047.slice(sql047.indexOf("function public.st_is_secret_key"), sql047.indexOf("function public.st_strip_secret_keys"));
  const pre = FILE.slice(FILE.indexOf("secret_hits as"), FILE.indexOf("prereq_tables"));
  assert.deepEqual(keysIn(pre), keysIn(fn047));
  const suffix = (text) => text.match(/~\s*'([^']+)'/)[1];
  assert.equal(suffix(pre), suffix(fn047));
});

test("without migration 046 the preflight stops instead of reporting ready", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  await db.query("begin");
  try {
    await assert.rejects(runPreflight(), /does not exist/);
  } finally {
    await db.query("rollback");
  }
  await db.query(migration("046").sql);
  await db.query("create table if not exists auth.users (id uuid primary key, raw_app_meta_data jsonb, banned_until timestamptz)");
});

test("before JOHN's activation it fails on his password, Auth link and claims, and passes the rest", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const rows = await scenario();
  assert.equal(verdict(rows).section, "00 VERDICT");
  assert.equal(verdict(rows).status, "PREFLIGHT_FAILED");
  const fails = failed(rows);
  for (const check of ["password format = pbkdf2", "Auth link exactly one", "Auth user exists", "Auth claim role = SystemOwner"]) {
    assert.ok(fails.includes(`04 JOHN / ${check}`), `expected FAIL: ${check}`);
  }
  assert.ok(fails.every((item) => item.startsWith("04 JOHN /")), `only JOHN's activation fails: ${fails.join("; ")}`);
  assert.equal(row(rows, "02 046 prerequisites", "046 tables present").status, "PASS");
  assert.equal(row(rows, "02 046 prerequisites", "046 functions present").status, "PASS");
  assert.equal(row(rows, "03 047 not yet applied", "047 objects absent").status, "PASS");
  assert.equal(row(rows, "04 JOHN", "UUID unchanged").status, "PASS");
  assert.equal(row(rows, "13 AMA", "not activated (no password yet)").status, "PASS");
  assert.equal(row(rows, "14 KWAME", "no Auth link yet").status, "PASS");
  assertNoSecrets(rows);
});

test("the expected pre-047 state is READY_FOR_047, counts are recorded and no secret value is returned", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const staffBefore = (await db.query("select id, username, role, active, password_hash from public.app_users order by username")).rows;
  const rows = await scenario(() => healthy());
  assert.equal(verdict(rows).status, "READY_FOR_047", verdict(rows).detail);
  assert.deepEqual(failed(rows), []);
  for (const check of ["exists exactly once", "UUID unchanged", "role = SystemOwner", "active = true", "password format = pbkdf2",
    "Auth link exactly one", "Auth user exists", "Auth user not banned", "Auth claim role = SystemOwner",
    "Auth claim business = SMILE-TRUST", "Auth claim app user = this staff row", "Auth identity linked to this staff row only"]) {
    assert.equal(row(rows, "04 JOHN", check).status, "PASS", check);
  }
  assert.equal(row(rows, "13 AMA", "role = AssistantManager").status, "PASS");
  assert.equal(row(rows, "13 AMA", "server MFA record").detail, "an unconfirmed (pending) authenticator row exists");
  assert.equal(row(rows, "14 KWAME", "role = Collector").status, "PASS");
  assert.equal(row(rows, "14 KWAME", "open activation codes").detail, "1 unused, unexpired code(s)");

  const secrets = row(rows, "23 snapshot secrets", "authentication keys stored in snapshots (047 strips them)");
  assert.equal(secrets.status, "WARN");
  assert.equal(secrets.detail, "5 occurrence(s): accessToken x1, mfaSecret x1, passwordHash x1, portalPin x1, syncToken x1");
  assert.equal(row(rows, "23 snapshot secrets", "plaintext member portal PINs (047 moves them to hashed storage)").detail, "1");
  assert.equal(row(rows, "15 snapshot", "posted records 047 will register as history").detail,
    "5 (collections=2, ledgerEntries=2, transactions=1)");
  assert.equal(row(rows, "15 snapshot", "financial entries without an id (047 cannot protect them)").status, "WARN");
  assert.equal(row(rows, "22 orphans", "snapshot records repeated with identical values").detail, "1");
  assert.equal(row(rows, "24 members with history", "snapshot members with posted history").detail, "2 member(s); 1 of them not Active");
  assert.equal(row(rows, "18 members", "snapshot members by status").detail, "3 (Active=2, Closed=1)");
  assert.equal(row(rows, "12 auth counts", "auth.users total").detail, "1");
  assert.equal(row(rows, "17 relational counts", "collections").detail, "0 rows");
  assert.equal(row(rows, "17 relational counts", "customers").detail, "1 rows");
  const relational = rows.filter((item) => item.section === "17 relational counts");
  assert.equal(relational.length, 21);
  for (const item of relational) assert.match(item.detail, /^(\d+ rows|table not present)$/, item.check_name);
  assertNoSecrets(rows);

  const staffAfter = (await db.query("select id, username, role, active, password_hash from public.app_users order by username")).rows;
  assert.deepEqual(staffAfter, staffBefore, "the preflight changed nothing");
});

test("a counted table that does not exist is reported, not an error", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const rows = await scenario(async () => {
    await healthy();
    await db.query("alter table public.receipt_sequences rename to receipt_sequences_hidden");
  });
  assert.equal(row(rows, "17 relational counts", "receipt_sequences").detail, "table not present");
  assert.equal(verdict(rows).status, "READY_FOR_047");
});

test("the preflight's own transaction refuses writes", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  await db.query("begin");
  try {
    await runPreflight();
    await assert.rejects(db.query("insert into public.st_portal_pins (business_code, customer_id, pin_hash) values ('x', 'y', 'z')"),
      /read-only transaction/);
  } finally {
    await db.query("rollback");
  }
});

test("a banned JOHN, wrong claims, a changed role or a changed uuid fail the preflight", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const banned = await scenario(async () => {
    const authId = await healthy();
    await db.query("update auth.users set banned_until = now() + interval '1 day' where id = $1", [authId]);
  });
  assert.equal(verdict(banned).status, "PREFLIGHT_FAILED");
  assert.deepEqual(failed(banned), ["04 JOHN / Auth user not banned"]);

  const claims = await scenario(async () => {
    const authId = await healthy();
    await db.query("update auth.users set raw_app_meta_data = $2 where id = $1",
      [authId, { business_code: "OTHER-BIZ", app_user_id: "someone-else", app_role: "Admin" }]);
  });
  assert.deepEqual(failed(claims).sort(), [
    "04 JOHN / Auth claim app user = this staff row", "04 JOHN / Auth claim business = SMILE-TRUST", "04 JOHN / Auth claim role = SystemOwner"
  ]);

  const role = await scenario(async () => {
    await healthy();
    await db.query("update public.app_users set role = 'Owner' where id = $1", [staff.john.id]);
  });
  assert.deepEqual(failed(role), ["04 JOHN / role = SystemOwner"]);

  const otherUuid = await scenario(() => healthy(), preflight.replaceAll(staff.john.id, crypto.randomUUID()));
  assert.deepEqual(failed(otherUuid), ["04 JOHN / UUID unchanged"]);
  for (const rows of [banned, claims, role, otherUuid]) assertNoSecrets(rows);
});

test("snapshot history that would block every manager sync after 047 fails the preflight", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const payload = healthyPayload();
  payload.collections.push({ id: "col-9", customerId: "c-gone", amount: 7 });
  payload.collections.push({ id: "col-2", customerId: "c-2", amount: 50 });
  const rows = await scenario(() => healthy(payload));
  assert.equal(verdict(rows).status, "PREFLIGHT_FAILED");
  assert.deepEqual(failed(rows), [
    "22 orphans / snapshot history pointing at a member missing from the snapshot",
    "22 orphans / snapshot records with one id but conflicting values"
  ]);
  assert.match(row(rows, "22 orphans", "snapshot history pointing at a member missing from the snapshot").detail, /collections:col-9 -> member c-gone/);
  assert.match(row(rows, "22 orphans", "snapshot records with one id but conflicting values").detail, /collections:col-2/);
  assertNoSecrets(rows);
});

test("an unexpectedly activated AMA is a warning for a human, not a silent pass", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const rows = await scenario(async () => {
    await healthy();
    await db.query("update public.app_users set password_hash = $1 where id = $2", [MARKERS.amaHash, staff.ama.id]);
    await db.query("insert into public.st_staff_auth_links (business_code, app_user_id, auth_user_id) values ($1, $2, $3)",
      [LIVE, staff.ama.app_id, crypto.randomUUID()]);
  });
  assert.equal(row(rows, "13 AMA", "not activated (no password yet)").status, "WARN");
  assert.match(row(rows, "13 AMA", "not activated (no password yet)").detail, /recorded state says NOT activated/);
  assert.equal(row(rows, "13 AMA", "no Auth link yet").status, "WARN");
  assert.equal(row(rows, "12 auth counts", "links whose Auth user is missing").status, "WARN");
  assertNoSecrets(rows);
});

test("a snapshot mentioning the out-of-scope project fails the preflight", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const payload = healthyPayload();
  payload.settings.supabaseUrl = "https://angoswtgcklnorhlosnf.supabase.co";
  const rows = await scenario(() => healthy(payload));
  assert.deepEqual(failed(rows), ["01 identity / no reference to the out-of-scope project in stored snapshots"]);
});

test("a partially or fully applied 047 fails the preflight", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const partial = await scenario(async () => {
    await healthy();
    await db.query("create table public.st_staff_security_events (id bigint)");
  });
  assert.deepEqual(failed(partial), ["03 047 not yet applied / 047 objects absent"]);
  assert.match(row(partial, "03 047 not yet applied", "047 objects absent").detail, /PARTIALLY applied.*st_staff_security_events/);

  const full = await scenario(async () => {
    await healthy();
    await db.query(migration("047").sql);
  });
  assert.equal(verdict(full).status, "PREFLIGHT_FAILED");
  assert.ok(failed(full).includes("03 047 not yet applied / 047 objects absent"));
  assert.match(row(full, "03 047 not yet applied", "047 objects absent").detail, /objects already exist: 047 is applied/);
  assert.equal(row(full, "23 snapshot secrets", "authentication keys stored in snapshots (047 strips them)").status, "PASS",
    "after 047 the stored snapshot holds no secrets");
  assertNoSecrets(full);
});
