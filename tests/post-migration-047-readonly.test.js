/**
 * supabase/preflight/047_post_migration_readonly.sql on a disposable local PostgreSQL built like
 * the live project (001–045 without rls.sql, then 046, the activated JOHN, then 047). Proves the
 * file is read-only, reports POST_047_VERIFIED only when 047 is complete and the data unchanged,
 * catches each failure, and never returns a secret value. Never connects to a remote database.
 */
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { migrationFiles, startLocalSupabase } from "./helpers/supabase-local-db.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILE = fs.readFileSync(path.join(root, "supabase", "preflight", "047_post_migration_readonly.sql"), "utf8");
const LIVE = "SMILE-TRUST";
const PROD_UUIDS = {
  john: "bbef5ecc-3bdf-40b6-bf8e-c0e206eed9db",
  ama: "6e6667ac-72ce-4f30-9c8e-2fd838988590",
  kwame: "3d156d98-3b4a-4024-8a46-1450df386672"
};
const PROD_BASELINE = {
  customers: 1, collections: 0, ledger_entries: 0, journal_entries: 0, journal_lines: 0, loans: 0, loan_repayments: 0,
  loan_disbursements: 0, reversals: 0, group_distributions: 0, withdrawal_requests: 0, savings_accounts: 0,
  personal_savings_accounts: 0, expenses: 0, audit_log: 2, momo_webhook_events: 0, receipt_sequences: 1,
  st_portal_pins: 0, st_portal_requests: 0, user_mfa_secrets: 0, st_staff_activation_codes: 4
};
const MARKERS = {
  johnHash: "pbkdf2:120000:SALTMARKER01:HASHMARKER01",
  amaHash: "pbkdf2:120000:SALTMARKER02:HASHMARKER02",
  snapshotHash: "pbkdf2:1:LEAKMARKER01:LEAKMARKER02",
  mfa: "MFAMARKER01",
  codeHash: "CODEHASHMARKER01",
  token: "TOKENMARKER01",
  sync: "SYNCMARKER01"
};

let db;
let verification;
let johnAuthId;
let staffBefore;
const staff = {};
const migration = (prefix) => migrationFiles().find((item) => item.name.startsWith(`${prefix}_`));

function codeOnly(sql) {
  return sql.replace(/--.*$/gm, "").replace(/'(?:[^']|'')*'/g, "''");
}

async function run(sql = verification) {
  const result = await db.query(sql);
  return (Array.isArray(result) ? result.at(-1) : result).rows;
}

async function scenario(setup, sql) {
  await db.query("begin");
  try {
    if (setup) await setup();
    return await run(sql);
  } finally {
    await db.query("rollback");
  }
}

const row = (rows, section, check) => {
  const found = rows.find((item) => item.section === section && item.check_name === check);
  assert.ok(found, `missing check ${section} / ${check}`);
  return found;
};
const failed = (rows) => rows.filter((item) => item.status === "FAIL").map((item) => `${item.section} / ${item.check_name}`);

function assertNoSecrets(rows) {
  const text = JSON.stringify(rows);
  for (const [name, value] of Object.entries(MARKERS)) assert.equal(text.includes(value), false, `${name} value returned`);
  assert.doesNotMatch(text, /pbkdf2:\d/, "no password hash is returned");
  for (const item of rows) assert.deepEqual(Object.keys(item), ["section", "ord", "check_name", "status", "detail"]);
}

async function staffSnapshot() {
  return (await db.query("select id, username, role, active, password_hash, client_id from public.app_users order by username")).rows;
}

async function countTables() {
  const counts = {};
  for (const name of Object.keys(PROD_BASELINE)) {
    const present = (await db.query("select to_regclass($1) is not null as p", [`public.${name}`])).rows[0].p;
    counts[name] = present ? (await db.query(`select count(*)::int as n from public.${name}`)).rows[0].n : 0;
  }
  return counts;
}

function withBaseline(sql, counts) {
  const values = Object.entries(counts).map(([name, n]) => `('${name}', ${n})`).join(", ");
  return sql.replace(/-- BASELINE START[\s\S]*?-- BASELINE END/, `-- BASELINE START\n  values ${values}\n  -- BASELINE END`);
}

before(async () => {
  db = await startLocalSupabase({ upTo: "045", withRlsSql: false });
  if (!db) {
    if (process.env.SMILE_SKIP_DB_TESTS === "1") return;
    throw new Error("embedded-postgres is required for migration tests (npm install)");
  }
  await db.query(migration("046").sql);
  for (const item of (await db.query("select id, username, coalesce(client_id, id::text) as app_id from public.app_users")).rows) {
    staff[item.username] = item;
  }

  // Production's pre-047 state: JOHN activated through staff-login, AMA and KWAME not activated.
  await db.query("create table if not exists auth.users (id uuid primary key, raw_app_meta_data jsonb, banned_until timestamptz)");
  await db.query("update public.app_users set password_hash = $1 where id = $2", [MARKERS.johnHash, staff.john.id]);
  johnAuthId = crypto.randomUUID();
  await db.query("insert into auth.users (id, raw_app_meta_data) values ($1, $2)",
    [johnAuthId, { business_code: LIVE, app_user_id: staff.john.app_id, app_role: "SystemOwner", provider: "email" }]);
  await db.query("insert into public.st_staff_auth_links (business_code, app_user_id, auth_user_id) values ($1, $2, $3)",
    [LIVE, staff.john.app_id, johnAuthId]);
  await db.query(`insert into public.st_staff_activation_codes (business_code, app_user_uuid, code_hash, expires_at, used_at) values
    ($1, $2, $5, now() - interval '1 day', now() - interval '2 days'),
    ($1, $3, $5, now() - interval '1 day', null),
    ($1, $3, $5, now() - interval '1 day', null),
    ($1, $4, $5, now() - interval '1 day', null)`,
  [LIVE, staff.john.id, staff.ama.id, staff.kwame.id, MARKERS.codeHash]);
  const member = (await db.query("select coalesce(client_id, id::text) as id from public.customers limit 1")).rows[0].id;
  await db.query("insert into public.smile_trust_cloud_snapshots (business_id, payload) values ($1, $2)", [LIVE, JSON.stringify({
    settings: { businessName: "Smile Trust", security: { syncToken: MARKERS.sync } },
    users: [
      { id: staff.john.app_id, username: "john", role: "SystemOwner", passwordHash: MARKERS.snapshotHash, mfaSecret: MARKERS.mfa },
      { id: staff.kwame.app_id, username: "kwame", role: "Collector" }
    ],
    customers: [{ id: member, name: "Member One", memberStatus: "Active" }],
    collections: [{ id: "col-1", customerId: member, amount: 10, amountPesewas: 1000 }],
    ledgerEntries: [{ id: "led-1c", customerId: member, amount: 10 }, { id: "led-1d", customerId: "", amount: 10 }],
    transactions: [{ id: "tx-1", customerId: member, amount: 10 }],
    offlineQueue: [[{ op: "sync", accessToken: MARKERS.token }]]
  })]);

  staffBefore = await staffSnapshot();
  let sql = withBaseline(FILE, await countTables());
  for (const name of Object.keys(PROD_UUIDS)) sql = sql.replaceAll(PROD_UUIDS[name], staff[name].id);
  verification = sql;
}, { timeout: 240000 });

after(async () => {
  await db?.stop();
});

const skip = () => !db;

test("the verification is a single read-only query: no writes, DDL or mutating calls, and dynamic SQL only reads", () => {
  const code = codeOnly(FILE);
  assert.match(code, /^\s*set transaction read only;/, "the transaction is made read-only first");
  assert.equal((code.match(/\bset\b/gi) || []).length, 1, "the only SET is the read-only guard");
  assert.equal((code.match(/;/g) || []).length, 2, "exactly two statements: the guard and one SELECT");
  assert.doesNotMatch(code,
    /\b(insert|update|delete|truncate|drop|alter|create|grant|revoke|merge|copy|call|do|execute|vacuum|analyze|reindex|cluster|lock|notify|listen|comment|reset|refresh|import|discard|prepare|begin|commit|rollback)\b/i,
    "only SELECT statements");
  assert.doesNotMatch(code,
    /\b(st_issue_staff_activation|st_reset_staff_mfa|st_upsert_staff_account|st_submit_collections|upsert_user_mfa|st_register_snapshot_history|st_check_snapshot_members|st_store_portal_pin|st_scrub_snapshot_payload|set_config|pg_terminate_backend|pg_cancel_backend|nextval|setval|dblink\w*|pg_read_\w+|lo_\w+|portal_\w+)\s*\(/i,
    "no mutating or file-reading function is called");

  const dynamic = [...FILE.matchAll(/query_to_xml\(([\s\S]*?),\s*(?:true|false),\s*false,\s*''\)/g)].map((match) => match[1]);
  assert.equal(dynamic.length, (FILE.match(/query_to_xml\(/g) || []).length, "every query_to_xml runs in table mode");
  assert.ok(dynamic.length >= 7);
  for (const text of dynamic) {
    const literals = [...text.matchAll(/'((?:[^']|'')*)'/g)].map((match) => match[1].replace(/''/g, "'")).join(" ");
    assert.match(text.trim(), /^(format\()?\s*'select /, "dynamic SQL is a SELECT");
    assert.doesNotMatch(literals, /\b(insert|update|delete|truncate|drop|alter|create|grant|revoke|copy|call|perform)\b/i);
    assert.doesNotMatch(literals, /st_register_snapshot_history|st_check_snapshot_members|st_store_portal_pin|st_scrub_snapshot_payload/);
  }
  assert.doesNotMatch(FILE, /sb_secret_|sb_publishable_|eyJ[A-Za-z0-9_-]{10,}\.|service_role_key\s*=/i, "no credentials");
  for (const uuid of Object.values(PROD_UUIDS)) assert.ok(FILE.includes(uuid), `expected uuid ${uuid}`);
});

test("the baseline block is exactly the recorded production pre-047 baseline", () => {
  const block = FILE.match(/-- BASELINE START([\s\S]*?)-- BASELINE END/)[1];
  const parsed = Object.fromEntries([...block.matchAll(/\('([a-z_]+)', (\d+)\)/g)].map((match) => [match[1], Number(match[2])]));
  assert.deepEqual(parsed, PROD_BASELINE);
  assert.match(FILE, /baseline_staff \(role, expected\) as \(\s*values \('SystemOwner', 1\), \('AssistantManager', 1\), \('Collector', 1\)\s*\)/);
  assert.match(FILE, /baseline_members \(status, expected\) as \(\s*values \('Active', 1\)\s*\)/);
});

test("the verification checks for secrets with exactly the key list and suffix rule 047 strips", () => {
  const sql047 = migration("047").sql;
  const keysIn = (text) => [...text.match(/=\s*any\s*\(array\[([\s\S]*?)\]\)/i)[1].matchAll(/'([^']+)'/g)].map((match) => match[1]).sort();
  const fn047 = sql047.slice(sql047.indexOf("function public.st_is_secret_key"), sql047.indexOf("function public.st_strip_secret_keys"));
  const mine = FILE.slice(FILE.indexOf("secret_hits as"), FILE.indexOf("-- Read-only probes"));
  assert.deepEqual(keysIn(mine), keysIn(fn047));
  assert.equal(mine.match(/~\s*'([^']+)'/)[1], fn047.match(/~\s*'([^']+)'/)[1]);
});

test("before 047 it reports POST_047_FAILED (not applied) instead of stopping", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const rows = await scenario();
  assert.equal(rows[0].section, "00 VERDICT");
  assert.equal(rows[0].status, "POST_047_FAILED");
  assert.equal(row(rows, "01 047 objects", "all objects created by 047 exist").status, "FAIL");
  assert.equal(row(rows, "01 047 objects", "no partial application").detail, "047 does not appear to be applied at all");
  assert.equal(row(rows, "24 snapshot secrets", "no authentication keys in any stored snapshot").status, "FAIL");
  assertNoSecrets(rows);
});

test("after 047 everything verifies, data is unchanged and no secret value is returned", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  await db.query(migration("047").sql);
  assert.deepEqual(await staffSnapshot(), staffBefore, "047 changed no staff row");
  const rows = await run();
  assert.equal(rows[0].status, "POST_047_VERIFIED", rows[0].detail);
  assert.deepEqual(failed(rows), []);
  assert.deepEqual(rows.filter((item) => item.status === "WARN").map((item) => `${item.section} / ${item.check_name}`), []);
  assert.match(row(rows, "01 047 objects", "all objects created by 047 exist").detail, /^(\d+)\/\1 present$/);
  for (const check of ["exists exactly once", "UUID unchanged", "role = SystemOwner", "active = true", "password format = pbkdf2",
    "Auth link exactly one", "Auth user exists", "Auth user not banned", "Auth claim role = SystemOwner",
    "Auth claim business = SMILE-TRUST", "Auth claim app user = this staff row", "Auth identity linked to this staff row only",
    "session cutoff not moved (existing sessions stay valid)"]) {
    assert.equal(row(rows, "03 JOHN", check).status, "PASS", check);
  }
  for (const label of ["11 AMA", "12 KWAME"]) {
    for (const check of ["exists exactly once", "UUID unchanged", "active = true", "still not activated (no password)", "still no Auth link"]) {
      assert.equal(row(rows, label, check).status, "PASS", `${label} ${check}`);
    }
  }
  assert.equal(row(rows, "13 staff counts", "staff by role = baseline (SystemOwner 1, AssistantManager 1, Collector 1)").detail,
    "AssistantManager=1, Collector=1, SystemOwner=1");
  assert.equal(row(rows, "14 members", "members (SMILE-TRUST) by status = baseline (1 Active)").detail, "Active=1");
  assert.equal(rows.filter((item) => item.section === "15 row counts").length, 21);
  assert.equal(row(rows, "16 data retention", "snapshot history registered for every posted record").detail,
    "4 registered, 4 posted records in the snapshot");
  assert.equal(row(rows, "24 snapshot secrets", "no authentication keys in any stored snapshot").detail, "none");
  assert.equal(row(rows, "23 snapshot scrubbing", "secret-key detection works (pure function probe)").detail, "probe returned true");
  assert.equal(row(rows, "31 duplicates and orphans", "the stored snapshot passes the posted-history rules (next manager sync accepted)").detail, "none");
  assertNoSecrets(rows);
  assert.deepEqual(await staffSnapshot(), staffBefore, "the verification changed nothing");
});

test("the verification's own transaction refuses writes", async (t) => {
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

test("a missing or disabled 047 guard is a partial application", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const dropped = await scenario(() => db.query("drop trigger st_guard_app_users on public.app_users"));
  assert.equal(dropped[0].status, "POST_047_FAILED");
  assert.ok(failed(dropped).includes("01 047 objects / no partial application"));
  assert.ok(failed(dropped).includes("17 app_users trigger / app_users.st_guard_app_users exists and is enabled"));
  assert.ok(failed(dropped).includes("18 role escalation / guard covers insert, update and delete before the write"));

  const noSubmit = await scenario(() => db.query("drop function public.st_submit_collections(text, jsonb)"));
  assert.ok(failed(noSubmit).includes("21 collector submit RPC / st_submit_collections exists with definer rights"));
  assert.match(row(noSubmit, "01 047 objects", "all objects created by 047 exist").detail, /function st_submit_collections\(text, jsonb\)/);

  const scrubOff = await scenario(async () => {
    await db.query("alter table public.smile_trust_cloud_snapshots disable trigger st_guard_cloud_snapshot");
    await db.query("update public.smile_trust_cloud_snapshots set payload = jsonb_set(payload, '{users,0,passwordHash}', to_jsonb($1::text))",
      [MARKERS.snapshotHash]);
  });
  assert.ok(failed(scrubOff).includes("23 snapshot scrubbing / scrub trigger runs before every snapshot insert and update"));
  assert.ok(failed(scrubOff).includes("24 snapshot secrets / no authentication keys in any stored snapshot"));
  assert.ok(failed(scrubOff).includes("24 snapshot secrets / no password-hash or private-key text anywhere in stored snapshots"));
  for (const rows of [dropped, noSubmit, scrubOff]) assertNoSecrets(rows);
});

test("re-opened client privileges fail the verification", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const mfa = await scenario(() => db.query("grant execute on function public.upsert_user_mfa(text, text, text, boolean) to authenticated"));
  assert.deepEqual(failed(mfa), ["29 upsert_user_mfa / not callable by signed-in or anonymous clients"]);

  const ledger = await scenario(() => db.query("grant insert on public.collections to authenticated"));
  assert.deepEqual(failed(ledger), ["26 financial client writes / signed-in and anonymous clients cannot write ledger tables"]);

  const snapDelete = await scenario(async () => {
    await db.query("grant delete on public.smile_trust_cloud_snapshots to authenticated");
    await db.query("create policy st_snapshots_delete on public.smile_trust_cloud_snapshots for delete to authenticated using (true)");
  });
  assert.deepEqual(failed(snapDelete).sort(), [
    "19 snapshot writes / only the three 047 snapshot policies exist",
    "20 snapshot delete / no delete or catch-all policy on the snapshot",
    "20 snapshot delete / signed-in and anonymous clients hold no delete or truncate privilege"
  ]);

  const collectorWrites = await scenario(async () => {
    await db.query("drop policy st_snapshots_update on public.smile_trust_cloud_snapshots");
    await db.query("create policy st_snapshots_update on public.smile_trust_cloud_snapshots for update to authenticated using (public.st_caller_staff_ok()) with check (public.st_caller_staff_ok())");
  });
  assert.deepEqual(failed(collectorWrites), ["19 snapshot writes / insert and update require a manager role and a live staff identity"]);

  const submitRevoked = await scenario(() => db.query("revoke execute on function public.st_submit_collections(text, jsonb) from authenticated"));
  assert.deepEqual(failed(submitRevoked).sort(), [
    "01 047 objects / staff RPCs and policy helpers are callable by signed-in clients",
    "21 collector submit RPC / callable by signed-in staff only (not anonymous)"
  ]);
});

test("changes to JOHN, AMA, KWAME, members or posted history fail the verification", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const banned = await scenario(() => db.query("update auth.users set banned_until = now() + interval '1 day' where id = $1", [johnAuthId]));
  assert.deepEqual(failed(banned), ["03 JOHN / Auth user not banned"]);

  const demoted = await scenario(() => db.query("update public.app_users set role = 'Owner' where id = $1", [staff.john.id]));
  assert.deepEqual(failed(demoted).sort(), ["03 JOHN / role = SystemOwner",
    "13 staff counts / staff by role = baseline (SystemOwner 1, AssistantManager 1, Collector 1)"]);
  assert.equal(row(demoted, "03 JOHN", "session cutoff not moved (existing sessions stay valid)").status, "WARN");
  assert.equal(row(demoted, "16 data retention", "staff security events since 047").status, "WARN");

  const amaActivated = await scenario(() => db.query("update public.app_users set password_hash = $1 where id = $2", [MARKERS.amaHash, staff.ama.id]));
  assert.deepEqual(failed(amaActivated), ["11 AMA / still not activated (no password)"]);

  const kwameOff = await scenario(() => db.query("update public.app_users set active = false where id = $1", [staff.kwame.id]));
  assert.deepEqual(failed(kwameOff).sort(), ["12 KWAME / active = true", "13 staff counts / no inactive staff"]);

  const memberGone = await scenario(async () => {
    await db.query("delete from public.customers");
  });
  assert.ok(failed(memberGone).includes("15 row counts / customers"));
  assert.ok(failed(memberGone).includes("14 members / members (SMILE-TRUST) by status = baseline (1 Active)"));
  assert.match(row(memberGone, "15 row counts", "customers").detail, /ROWS MISSING/);

  const orphanHistory = await scenario(() => db.query(
    "insert into public.st_snapshot_financial_ledger (business_id, kind, record_id, customer_id) values ($1, 'collections', 'col-ghost', 'c-gone')", [LIVE]));
  assert.ok(failed(orphanHistory).includes("31 duplicates and orphans / registered history pointing at a member missing from the snapshot"));
  assert.match(row(orphanHistory, "31 duplicates and orphans", "the stored snapshot passes the posted-history rules (next manager sync accepted)").detail,
    /posted collections record col-ghost cannot be removed/);

  const lostCode = await scenario(() => db.query("delete from public.st_staff_activation_codes where app_user_uuid = $1", [staff.kwame.id]));
  assert.deepEqual(failed(lostCode), ["15 row counts / st_staff_activation_codes"]);

  for (const rows of [banned, demoted, amaActivated, kwameOff, memberGone, orphanHistory, lostCode]) assertNoSecrets(rows);
});

test("regression 2200M: no SMILE-TRUST snapshot row is reported, not a 'Document is empty' crash", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  await assert.rejects(
    db.query("select xpath('/row/v/text()', query_to_xml('select 1 as v where false', false, true, ''))"),
    (error) => error.code === "2200M" && /could not parse XML document/.test(error.message),
    "the PostgreSQL behaviour behind the production error: an empty table forest is not an XML document"
  );
  if (!(await db.query("select to_regclass('public.st_snapshot_financial_ledger') is not null as p")).rows[0].p) {
    await db.query(migration("047").sql);
  }

  const missing = await scenario(() => db.query("delete from public.smile_trust_cloud_snapshots"));
  assert.equal(missing[0].section, "00 VERDICT");
  assert.equal(row(missing, "16 data retention", "SMILE-TRUST snapshot still present").status, "WARN");
  assert.match(row(missing, "16 data retention", "SMILE-TRUST snapshot still present").detail, /no SMILE-TRUST snapshot row; stored snapshot rows: none/);
  const rule = row(missing, "31 duplicates and orphans", "the stored snapshot passes the posted-history rules (next manager sync accepted)");
  assert.equal(rule.status, "INFO");
  assert.equal(rule.detail, "no SMILE-TRUST snapshot stored: nothing to check");
  assert.equal(row(missing, "16 data retention", "snapshot history registered for every posted record").status, "WARN",
    "history registered for records that are no longer in any snapshot is surfaced");
  assert.equal(row(missing, "31 duplicates and orphans", "registered history pointing at a member missing from the snapshot").status, "FAIL",
    "a snapshot removed after 047 registered its history is data loss that would block the next manager sync");
  assert.equal(missing[0].status, "POST_047_FAILED");
  assertNoSecrets(missing);

  const otherKey = await scenario(() => db.query("update public.smile_trust_cloud_snapshots set business_id = 'smile-trust'"));
  assert.match(row(otherKey, "16 data retention", "SMILE-TRUST snapshot still present").detail, /stored snapshot rows: smile-trust/);
  assert.equal(row(otherKey, "31 duplicates and orphans", "the stored snapshot passes the posted-history rules (next manager sync accepted)").status, "INFO");

  const emptyHistory = await scenario(async () => {
    await db.query("delete from public.smile_trust_cloud_snapshots");
    await db.query("delete from public.st_snapshot_financial_ledger");
  });
  assert.deepEqual(failed(emptyHistory), []);
  assert.equal(emptyHistory[0].status, "POST_047_VERIFIED", "a business that never stored a snapshot still verifies (with warnings)");

  assert.doesNotMatch(FILE.replace(/\s+/g, " "), /, (true|false), true, ''\)/, "no table-forest query_to_xml remains");
});

test("new activity since the baseline is a warning, not a silent pass", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const rows = await scenario(() => db.query("insert into public.st_portal_requests (business_code, customer_id, amount_pesewas) values ($1, 'c-x', 500)", [LIVE]));
  assert.equal(rows[0].status, "POST_047_VERIFIED");
  assert.equal(row(rows, "15 row counts", "st_portal_requests").status, "WARN");
  assert.match(row(rows, "15 row counts", "st_portal_requests").detail, /new rows since the baseline/);
});
