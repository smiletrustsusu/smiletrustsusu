/**
 * Production Blocker #1 — server-side authorization regression tests.
 * Applies every migration (including 046 and 047) to a disposable local PostgreSQL that mimics
 * Supabase roles, auth.jwt() and default grants, then proves:
 *   - anon (the public key shipped in apps) can no longer read/write snapshots, tables or RPCs;
 *   - staff sessions (active app_users row + Auth link) only reach their own business;
 *   - privileged RPCs need an elevated role;
 *   - the member portal verifies PINs server-side and returns only that member's data.
 * Never connects to a remote database.
 */
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { migrationFiles, startLocalSupabase } from "./helpers/supabase-local-db.mjs";

const BIZ_A = "st-test-a";
const BIZ_B = "st-test-b";
const staffA = { role: "authenticated", sub: "00000000-0000-0000-0000-00000000000a", app_metadata: { business_code: BIZ_A, app_user_id: "u-collector-a", app_role: "Collector" } };
const ownerA = { role: "authenticated", sub: "00000000-0000-0000-0000-0000000000a1", app_metadata: { business_code: BIZ_A, app_user_id: "u-owner", app_role: "SystemOwner" } };
const staffB = { role: "authenticated", sub: "00000000-0000-0000-0000-00000000000b", app_metadata: { business_code: BIZ_B, app_user_id: "u-collector-b", app_role: "Collector" } };
const strangerUser = { role: "authenticated", sub: "00000000-0000-0000-0000-0000000000ff", user_metadata: { business_code: BIZ_A } };
const anonClaims = { role: "anon" };

const snapshotA = {
  settings: { businessName: "Alpha Susu", currency: "GHS" },
  users: [{ id: "u-owner", username: "JOHN", passwordHash: "pbkdf2:1:aa:bb" }],
  customers: [
    { id: "c-ama", name: "Ama", accountNo: "c13000001", phone: "0241234567", active: true },
    { id: "c-kofi", name: "Kofi", accountNo: "c13000002", phone: "0209876543", active: true, portalPin: "2468", portalPinSetAt: "2026-01-01T00:00:00.000Z", portalPinSource: "manual" }
  ],
  collections: [
    { id: "col-1", customerId: "c-ama", amount: 50, date: "2026-09-01" },
    { id: "col-2", customerId: "c-kofi", amount: 70, date: "2026-09-01" }
  ],
  ledgerEntries: [
    { id: "led-1", customerId: "c-ama", amount: 50, direction: "credit" },
    { id: "led-2", customerId: "c-kofi", amount: 70, direction: "credit" }
  ],
  transactions: [],
  loans: [],
  withdrawalRequests: []
};

let db;

async function expectDenied(promise, label) {
  await assert.rejects(promise, (error) => {
    assert.ok(
      ["42501", "P0001"].includes(error.code) || /permission denied|not authorized|row-level security|elevated role/i.test(error.message),
      `${label}: unexpected error ${error.code} ${error.message}`
    );
    return true;
  }, `${label} should be denied`);
}

function run(claims, sql, params) {
  const role = claims?.role === "anon" ? "anon" : "authenticated";
  return db.asRole(role, claims, (client) => client.query(sql, params));
}

before(async () => {
  db = await startLocalSupabase();
  if (!db) {
    if (process.env.SMILE_SKIP_DB_TESTS === "1") return;
    throw new Error("embedded-postgres is required for server authorization tests (npm install)");
  }
  const failed = db.applied.filter((item) => !item.ok);
  assert.deepEqual(failed, [], `migrations failed: ${JSON.stringify(failed)}`);
  await db.query(
    `insert into public.smile_trust_cloud_snapshots (business_id, access_key, payload) values ($1, 'legacy-key-a', $2), ($3, 'legacy-key-b', $4)`,
    [BIZ_A, JSON.stringify(snapshotA), BIZ_B, JSON.stringify({ customers: [{ id: "c-b", name: "Other", accountNo: "c99", phone: "0551112222" }] })]
  );
  await db.query(`insert into public.businesses (code, name, legacy_code) values ($1, 'Alpha', $1), ($2, 'Beta', $2) on conflict do nothing`, [BIZ_A, BIZ_B]);
  for (const [claims, name, role] of [[staffA, "Collector A", "Collector"], [ownerA, "Owner A", "SystemOwner"], [staffB, "Collector B", "Collector"]]) {
    const { business_code: code, app_user_id: appUserId } = claims.app_metadata;
    await db.query(
      `insert into public.app_users (business_id, client_id, username, name, role, active)
       select id, $2, $2, $3, $4, true from public.businesses where code = $1`,
      [code, appUserId, name, role]
    );
    await db.query("insert into public.st_staff_auth_links (business_code, app_user_id, auth_user_id) values ($1, $2, $3)", [code, appUserId, claims.sub]);
  }
  await db.query(
    `insert into public.user_mfa_secrets (business_id, user_client_id, secret, enabled)
     select id, 'u-owner', 'mfa-secret-a', true from public.businesses where code = $1`,
    [BIZ_A]
  );
}, { timeout: 240000 });

after(async () => {
  await db?.stop();
});

const skip = () => !db;

test("migration 046 applied on top of every earlier migration", (t) => {
  if (skip()) return t.skip("local database unavailable");
  assert.ok(db.applied.some((item) => item.name.startsWith("046_") && item.ok));
});

test("anon cannot read, insert, update or delete cloud snapshots", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  await expectDenied(run(anonClaims, "select * from public.smile_trust_cloud_snapshots"), "anon select");
  await expectDenied(run(anonClaims, "select * from public.smile_trust_cloud_snapshots where business_id = $1 and access_key = 'legacy-key-a'", [BIZ_A]), "anon select with legacy key");
  await expectDenied(run(anonClaims, "insert into public.smile_trust_cloud_snapshots (business_id, access_key, payload) values ('evil', 'k', '{}')"), "anon insert");
  await expectDenied(run(anonClaims, "update public.smile_trust_cloud_snapshots set payload = '{}' where business_id = $1", [BIZ_A]), "anon update");
  await expectDenied(run(anonClaims, "delete from public.smile_trust_cloud_snapshots"), "anon delete");
});

test("anon has no privilege on any public table", async (t) => {
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

test("anon cannot call privileged RPCs; only portal entry points are public", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const calls = [
    ["select public.fetch_business_snapshot($1)", [BIZ_A]],
    ["select public.import_snapshot_batch($1, '{}'::jsonb)", [BIZ_A]],
    ["select public.upsert_user_mfa($1, 'u-owner', 'x', true)", [BIZ_A]],
    ["select public.record_momo_webhook($1, '{}'::jsonb)", [BIZ_A]],
    ["select public.list_app_users($1)", [BIZ_A]],
    ["select public.record_collection_from_client(jsonb_build_object('business_code', $1::text, 'idempotency_key', 'x'))", [BIZ_A]],
    ["select public.portal_pending_requests($1)", [BIZ_A]],
    ["select public.st_snapshot_payload($1)", [BIZ_A]],
    ["select public.st_internal_fetch_business_snapshot($1)", [BIZ_A]]
  ];
  for (const [sql, params] of calls) await expectDenied(run(anonClaims, sql, params), `anon ${sql}`);
  const { rows } = await db.query(`
    select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute') order by 1`);
  assert.deepEqual(rows.map((row) => row.proname), ["portal_change_pin", "portal_login", "portal_refresh", "portal_request_withdrawal"]);
});

test("anon cannot read MFA secrets or other tenant tables", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  await expectDenied(run(anonClaims, "select * from public.user_mfa_secrets"), "anon mfa secrets");
  await expectDenied(run(anonClaims, "select * from public.customers"), "anon customers");
});

test("staff session reads and writes only its own business snapshot", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const own = await run(staffA, "select business_id from public.smile_trust_cloud_snapshots");
  assert.deepEqual(own.rows.map((row) => row.business_id), [BIZ_A]);
  const byCollector = await run(staffA, "update public.smile_trust_cloud_snapshots set saved_by = 'collector-a' where business_id = $1 returning id", [BIZ_A]);
  assert.equal(byCollector.rowCount, 0, "collectors submit collections through st_submit_collections, never the whole snapshot");
  const updated = await run(ownerA, "update public.smile_trust_cloud_snapshots set saved_by = 'owner-a' where business_id = $1 returning id", [BIZ_A]);
  assert.equal(updated.rowCount, 1);
  const crossUpdate = await run(ownerA, "update public.smile_trust_cloud_snapshots set payload = '{}' where business_id = $1 returning id", [BIZ_B]);
  assert.equal(crossUpdate.rowCount, 0);
  await expectDenied(run(staffA, "insert into public.smile_trust_cloud_snapshots (business_id, payload) values ($1, '{}')", [BIZ_B]), "cross-business insert");
  await expectDenied(run(ownerA, "update public.smile_trust_cloud_snapshots set business_id = $1 where business_id = $2", [BIZ_B, BIZ_A]), "move row to other business");
  const collectorMove = await run(staffA, "update public.smile_trust_cloud_snapshots set business_id = $1 where business_id = $2 returning id", [BIZ_B, BIZ_A]);
  assert.equal(collectorMove.rowCount, 0);
  await expectDenied(run(ownerA, "delete from public.smile_trust_cloud_snapshots where business_id = $1", [BIZ_A]), "snapshot delete");
  const other = await run(staffB, "select business_id from public.smile_trust_cloud_snapshots");
  assert.deepEqual(other.rows.map((row) => row.business_id), [BIZ_B]);
});

test("signed-in users without a server-set business claim see nothing", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const rows = await run(strangerUser, "select * from public.smile_trust_cloud_snapshots");
  assert.equal(rows.rowCount, 0);
  const branches = await run(strangerUser, "select * from public.branches");
  assert.equal(branches.rowCount, 0);
  await expectDenied(run(strangerUser, "select public.fetch_business_snapshot($1)", [BIZ_A]), "stranger fetch snapshot");
});

test("business-scoped RPCs enforce the caller's business and role", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const ok = await run(staffA, "select public.fetch_business_snapshot($1) as s", [BIZ_A]);
  assert.equal(typeof ok.rows[0].s, "object");
  await expectDenied(run(staffA, "select public.fetch_business_snapshot($1)", [BIZ_B]), "cross-business fetch");
  await expectDenied(run(staffA, "select public.import_snapshot_batch($1, '{}'::jsonb)", [BIZ_A]), "collector import");
  await expectDenied(run(staffA, "select public.record_momo_webhook($1, '{}'::jsonb)", [BIZ_A]), "collector momo");
  await expectDenied(run(staffA, "select public.list_app_users($1)", [BIZ_A]), "collector list users");
  await expectDenied(run(staffA, "select public.upsert_user_mfa($1, 'u-owner', 'x', true)", [BIZ_A]), "collector changes owner MFA");
  await expectDenied(run(staffA, "select public.upsert_user_mfa($1, 'u-collector-a', 'x', false)", [BIZ_A]), "TOTP secrets are written only by staff-login");
  const users = await run(ownerA, "select public.list_app_users($1) as r", [BIZ_A]);
  assert.ok(Array.isArray(users.rows[0].r));
  await expectDenied(run(staffA, "select public.st_internal_fetch_business_snapshot($1)", [BIZ_B]), "authenticated calls internal");
});

test("tenant tables are isolated by the server-set business claim", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const bizA = await db.query("select id from public.businesses where code = $1", [BIZ_A]);
  await db.query("insert into public.branches (business_id, name, client_id, active) values ($1, 'Alpha HQ', 'g-alpha', true)", [bizA.rows[0].id]);
  const own = await run(staffA, "select client_id from public.branches");
  assert.deepEqual(own.rows.map((row) => row.client_id), ["g-alpha"]);
  const other = await run(staffB, "select * from public.branches");
  assert.equal(other.rowCount, 0);
  await expectDenied(run(staffB, "insert into public.branches (business_id, name, client_id, active) values ($1, 'Hijack', 'g-x', true)", [bizA.rows[0].id]), "cross-tenant insert");
});

test("TOTP secrets are never readable by any client session", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  await expectDenied(run(ownerA, "select * from public.user_mfa_secrets"), "owner reads MFA secrets");
  await expectDenied(run(staffA, "select * from public.user_mfa_secrets"), "collector reads MFA secrets");
  const stored = await db.query("select count(*)::int as n from public.user_mfa_secrets where user_client_id = 'u-owner'");
  assert.equal(stored.rows[0].n, 1);
});

test("stored snapshots never keep password hashes or plaintext portal PINs", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const { rows } = await db.query("select payload::text as p from public.smile_trust_cloud_snapshots where business_id = $1", [BIZ_A]);
  assert.doesNotMatch(rows[0].p, /pbkdf2:|passwordHash|"portalPin"/);
});

test("portal login verifies the PIN server-side and returns only that member's records", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const wrong = await run(anonClaims, "select public.portal_login($1, 'c13000001', '0000') as r", [BIZ_A]);
  assert.equal(wrong.rows[0].r.ok, false);
  const good = await run(anonClaims, "select public.portal_login($1, 'c13000001', '4567') as r", [BIZ_A]);
  const result = good.rows[0].r;
  assert.equal(result.ok, true);
  assert.match(result.token, /^[0-9a-f]{64}$/);
  assert.equal(result.bundle.customer.id, "c-ama");
  assert.deepEqual(result.bundle.collections.map((row) => row.id), ["col-1"]);
  assert.equal(result.bundle.balancePesewas, 5000);
  assert.equal("users" in result.bundle, false);
  assert.equal("customers" in result.bundle, false);
  assert.equal(result.bundle.customer.portalPin, undefined);
  const byPhone = await run(anonClaims, "select public.portal_login($1, '+233 24 123 4567', '4567') as r", [BIZ_A]);
  assert.equal(byPhone.rows[0].r.ok, true);
  const otherBusiness = await run(anonClaims, "select public.portal_login($1, 'c13000001', '4567') as r", [BIZ_B]);
  assert.equal(otherBusiness.rows[0].r.ok, false);
  const stored = await db.query("select token_hash from public.st_portal_sessions");
  assert.ok(stored.rows.every((row) => row.token_hash !== result.token), "raw portal token must not be stored");
});

test("portal login locks after repeated wrong PINs", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  for (let i = 0; i < 5; i += 1) {
    await run(anonClaims, "select public.portal_login($1, 'c13000002', '1111')", [BIZ_A]);
  }
  const locked = await run(anonClaims, "select public.portal_login($1, 'c13000002', '2468') as r", [BIZ_A]);
  assert.equal(locked.rows[0].r.ok, false);
  assert.match(locked.rows[0].r.error, /too many/i);
  await db.query("delete from public.st_portal_attempts where login_key = 'c13000002'");
  const unlocked = await run(anonClaims, "select public.portal_login($1, 'c13000002', '2468') as r", [BIZ_A]);
  assert.equal(unlocked.rows[0].r.ok, true);
});

test("portal PIN change and withdrawal requests are server-validated and reach staff", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const login = await run(anonClaims, "select public.portal_login($1, 'c13000001', '4567') as r", [BIZ_A]);
  const token = login.rows[0].r.token;
  const badCurrent = await run(anonClaims, "select public.portal_change_pin($1, '9999', '1357') as r", [token]);
  assert.equal(badCurrent.rows[0].r.ok, false);
  const changed = await run(anonClaims, "select public.portal_change_pin($1, '4567', '1357') as r", [token]);
  assert.equal(changed.rows[0].r.ok, true);
  const oldPin = await run(anonClaims, "select public.portal_login($1, 'c13000001', '4567') as r", [BIZ_A]);
  assert.equal(oldPin.rows[0].r.ok, false, "phone default must stop working after a portal PIN change");
  const newPin = await run(anonClaims, "select public.portal_login($1, 'c13000001', '1357') as r", [BIZ_A]);
  assert.equal(newPin.rows[0].r.ok, true);
  const pinRow = await db.query("select pin_hash from public.st_portal_pins where customer_id = 'c-ama'");
  assert.notEqual(pinRow.rows[0].pin_hash, "1357");

  const tooMuch = await run(anonClaims, "select public.portal_request_withdrawal($1, 60, 'school fees') as r", [token]);
  assert.equal(tooMuch.rows[0].r.ok, false);
  const request = await run(anonClaims, "select public.portal_request_withdrawal($1, 20, 'school fees') as r", [token]);
  assert.equal(request.rows[0].r.ok, true);
  const badToken = await run(anonClaims, "select public.portal_request_withdrawal($1, 5, 'x') as r", ["f".repeat(64)]);
  assert.equal(badToken.rows[0].r.ok, false);

  await expectDenied(run(staffB, "select public.portal_pending_requests($1)", [BIZ_A]), "other business reads portal requests");
  const pending = await run(staffA, "select public.portal_pending_requests($1) as r", [BIZ_A]);
  assert.equal(pending.rows[0].r.length, 1);
  assert.equal(pending.rows[0].r[0].customer_id, "c-ama");
  assert.equal(Number(pending.rows[0].r[0].amount_pesewas), 2000);
  const marked = await run(staffA, "select public.portal_mark_requests_ingested($1, array[$2::uuid]) as r", [BIZ_A, pending.rows[0].r[0].id]);
  assert.equal(marked.rows[0].r.ingested, 1);
  const after = await run(staffA, "select public.portal_pending_requests($1) as r", [BIZ_A]);
  assert.equal(after.rows[0].r.length, 0);
  await expectDenied(run(anonClaims, "select * from public.st_portal_requests"), "anon reads portal request table");
});

test("re-applying migrations 046 then 047 is idempotent and keeps every guard", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  for (const prefix of ["046_", "047_"]) {
    await db.query(migrationFiles().find((item) => item.name.startsWith(prefix)).sql);
  }
  await expectDenied(run(staffA, "select public.upsert_user_mfa($1, 'u-collector-a', 'x', false)", [BIZ_A]), "047 guards restored after 046");
  await expectDenied(run(anonClaims, "select * from public.smile_trust_cloud_snapshots"), "anon select after re-apply");
  await expectDenied(run(staffA, "select public.fetch_business_snapshot($1)", [BIZ_B]), "cross-business after re-apply");
  const own = await run(staffA, "select public.fetch_business_snapshot($1) as s", [BIZ_A]);
  assert.equal(typeof own.rows[0].s, "object");
  const count = await db.query("select count(*)::int as n from public.smile_trust_cloud_snapshots");
  assert.equal(count.rows[0].n, 2, "migration must not add or remove snapshot rows");
});

test("a staff PIN reset in the app overrides an older portal PIN", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const payload = structuredClone(snapshotA);
  payload.customers[0].portalPin = "8642";
  payload.customers[0].portalPinSetAt = new Date(Date.now() + 60000).toISOString();
  await db.query("update public.smile_trust_cloud_snapshots set payload = $2, saved_at = now() where business_id = $1", [BIZ_A, JSON.stringify(payload)]);
  const reset = await run(anonClaims, "select public.portal_login($1, 'c13000001', '8642') as r", [BIZ_A]);
  assert.equal(reset.rows[0].r.ok, true);
});
