/**
 * The staff-login deployment / JOHN MFA enrollment runbook, rehearsed against a disposable local
 * PostgreSQL built like the live project after migration 047 (001–045 without rls.sql, 046, JOHN
 * activated, 047; no snapshot). Both handler versions run unchanged through a small PostgREST
 * stand-in that executes every REST call as the service role, so 047's triggers, grants and
 * column types apply:
 *   - the current handler: 403 before enrollment, enroll start/confirm, replay rejection,
 *     owner reset recovery, and supabase/preflight/047_john_mfa_enrollment_readonly.sql;
 *   - the pre-047 handler (commit 6843234, the rollback artifact): no database errors on a 047
 *     database, but it issues password-only sessions to privileged roles that have not enrolled
 *     and has no replay protection.
 * Never connects to a remote database. The password and TOTP secret here are local test values.
 */
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { migrationFiles, startLocalSupabase } from "./helpers/supabase-local-db.mjs";
import { createStaffLoginHandler } from "../supabase/functions/staff-login/handler.js";
import { hashPasswordPbkdf2 } from "../supabase/functions/staff-login/auth-core.js";
import { generateTotpCode } from "../src/core/totp.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VERIFY_FILE = fs.readFileSync(path.join(root, "supabase", "preflight", "047_john_mfa_enrollment_readonly.sql"), "utf8");
const ROLLBACK_COMMIT = "6843234";
const LIVE = "SMILE-TRUST";
const BASE = "https://local-test.supabase.co";
const ENV = { SUPABASE_URL: BASE, SUPABASE_SERVICE_ROLE_KEY: "service-test-value", SUPABASE_ANON_KEY: "anon-test-value" };
const PROD_UUIDS = {
  john: "bbef5ecc-3bdf-40b6-bf8e-c0e206eed9db",
  ama: "6e6667ac-72ce-4f30-9c8e-2fd838988590",
  kwame: "3d156d98-3b4a-4024-8a46-1450df386672"
};
const JOHN_PASSWORD = "Local-test-only-9";

let db;
let verifySql;
let oldModuleDir;
let createOldHandler;
const staff = {};
const dbErrors = [];
const authPasswords = new Map();
const migration = (prefix) => migrationFiles().find((item) => item.name.startsWith(`${prefix}_`));
const skip = () => !db;

const ident = (name) => {
  if (!/^[a-z_]+$/.test(name)) throw new Error(`unexpected identifier ${name}`);
  return `"${name}"`;
};

/** Minimal PostgREST: the filter/insert/update/delete forms staff-login uses, run as service_role. */
function restToSql(method, url, bodyText, prefer) {
  const table = ident(url.pathname.replace("/rest/v1/", ""));
  const params = url.searchParams;
  const values = [];
  const bind = (value) => {
    values.push(value !== null && typeof value === "object" ? JSON.stringify(value) : value);
    return `$${values.length}`;
  };
  const condition = (column, expression) => {
    const dot = expression.indexOf(".");
    const op = expression.slice(0, dot);
    const value = expression.slice(dot + 1);
    const col = ident(column);
    if (op === "eq") return `${col} = ${bind(value)}`;
    if (op === "ilike") return `${col} ilike ${bind(value.replace(/\*/g, "%"))}`;
    if (op === "gte") return `${col} >= ${bind(value)}`;
    if (op === "gt") return `${col} > ${bind(value)}`;
    if (op === "lt") return `${col} < ${bind(value)}`;
    if (op === "is" && ["null", "true", "false"].includes(value)) return `${col} is ${value}`;
    throw new Error(`unsupported filter ${column}=${expression}`);
  };
  const where = [];
  for (const [key, value] of params) {
    if (["select", "limit", "order", "on_conflict"].includes(key)) continue;
    if (key === "or") {
      const parts = value.replace(/^\(|\)$/g, "").split(",").map((part) => {
        const dot = part.indexOf(".");
        return condition(part.slice(0, dot), part.slice(dot + 1));
      });
      where.push(`(${parts.join(" or ")})`);
    } else {
      where.push(condition(key, value));
    }
  }
  const whereSql = where.length ? ` where ${where.join(" and ")}` : "";
  const wantRows = /return=representation/.test(prefer || "");
  if (method === "GET") {
    const columns = (params.get("select") || "*").split(",").map((c) => (c === "*" ? "*" : ident(c))).join(", ");
    const order = params.get("order") ? ` order by ${params.get("order").split(".").map((p, i) => (i === 0 ? ident(p) : p === "desc" ? "desc" : "asc")).join(" ")}` : "";
    const limit = params.get("limit") ? ` limit ${Number(params.get("limit"))}` : "";
    return { sql: `select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) as rows from (select ${columns} from public.${table}${whereSql}${order}${limit}) t`, values, status: 200, wantRows: true };
  }
  const body = bodyText ? JSON.parse(bodyText) : {};
  if (method === "POST") {
    const columns = Object.keys(body);
    const placeholders = columns.map((c) => bind(body[c]));
    let conflict = "";
    if (/merge-duplicates/.test(prefer || "")) {
      const target = params.get("on_conflict");
      const targetSql = target ? `(${target.split(",").map(ident).join(", ")})` : `on constraint ${ident(`${url.pathname.replace("/rest/v1/", "")}_pkey`)}`;
      const keys = new Set((target || "business_code,app_user_id").split(","));
      conflict = ` on conflict ${targetSql} do update set ${columns.filter((c) => !keys.has(c)).map((c) => `${ident(c)} = excluded.${ident(c)}`).join(", ")}`;
    }
    return {
      sql: `with w as (insert into public.${table} (${columns.map(ident).join(", ")}) values (${placeholders.join(", ")})${conflict} returning *) select coalesce(jsonb_agg(to_jsonb(w)), '[]'::jsonb) as rows from w`,
      values, status: 201, wantRows
    };
  }
  if (method === "PATCH") {
    const sets = Object.keys(body).map((c) => `${ident(c)} = ${bind(body[c])}`);
    return { sql: `with w as (update public.${table} set ${sets.join(", ")}${whereSql} returning *) select coalesce(jsonb_agg(to_jsonb(w)), '[]'::jsonb) as rows from w`, values, status: 200, wantRows };
  }
  if (method === "DELETE") {
    return { sql: `with w as (delete from public.${table}${whereSql} returning *) select count(*) as rows from w`, values, status: 204, wantRows: false };
  }
  throw new Error(`unsupported method ${method}`);
}

const reply = (status, body) => new Response(body == null ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function fetchImpl(input, options = {}) {
  const url = new URL(input);
  const method = options.method || "GET";
  const headers = options.headers || {};
  if (url.pathname.startsWith("/rest/v1/")) {
    let plan;
    try {
      plan = restToSql(method, url, options.body, headers.Prefer);
      const result = await db.asRole("service_role", { role: "service_role" }, (client) => client.query(plan.sql, plan.values));
      const rows = result.rows[0].rows;
      return plan.wantRows ? reply(plan.status, rows) : new Response(null, { status: plan.status === 200 ? 204 : plan.status });
    } catch (error) {
      dbErrors.push(`${method} ${url.pathname}: ${error.code || ""} ${error.message}`);
      return reply(400, { code: error.code, message: error.message });
    }
  }
  const body = options.body ? JSON.parse(options.body) : {};
  if (url.pathname === "/auth/v1/admin/users" && method === "POST") {
    const id = crypto.randomUUID();
    await db.query("insert into auth.users (id, email, raw_app_meta_data) values ($1, $2, $3)", [id, body.email, body.app_metadata]);
    authPasswords.set(id, body.password);
    return reply(200, { id, email: body.email });
  }
  const userPath = /^\/auth\/v1\/admin\/users\/([0-9a-f-]{36})$/.exec(url.pathname);
  if (userPath && method === "PUT") {
    const found = (await db.query("select email from auth.users where id = $1", [userPath[1]])).rows[0];
    if (!found) return reply(404, {});
    if (body.app_metadata) await db.query("update auth.users set raw_app_meta_data = $2 where id = $1", [userPath[1], body.app_metadata]);
    if (body.ban_duration === "none") await db.query("update auth.users set banned_until = null where id = $1", [userPath[1]]);
    else if (body.ban_duration) await db.query("update auth.users set banned_until = now() + interval '100 years' where id = $1", [userPath[1]]);
    if (body.password) authPasswords.set(userPath[1], body.password);
    return reply(200, { id: userPath[1], email: found.email });
  }
  if (url.pathname === "/auth/v1/token" && method === "POST") {
    const user = (await db.query("select id, banned_until from auth.users where email = $1", [body.email])).rows[0];
    if (!user || user.banned_until || authPasswords.get(user.id) !== body.password) return reply(400, { error: "invalid_grant" });
    return reply(200, { access_token: `local-access-${user.id}`, refresh_token: "local-refresh", expires_in: 3600, token_type: "bearer" });
  }
  return reply(404, {});
}

function post(body) {
  return new Request(`${BASE}/functions/v1/staff-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ business_code: LIVE, ...body })
  });
}

async function call(handler, body) {
  const response = await handler(post(body));
  return { status: response.status, data: await response.json() };
}

async function verify() {
  const result = await db.query(verifySql);
  return (Array.isArray(result) ? result.at(-1) : result).rows;
}

const check = (rows, section, name) => {
  const found = rows.find((item) => item.section === section && item.check_name === name);
  assert.ok(found, `missing check ${section} / ${name}`);
  return found;
};
const failures = (rows) => rows.filter((item) => item.status === "FAIL").map((item) => `${item.section} / ${item.check_name}`);

async function mfaRow() {
  return (await db.query("select secret, enabled, confirmed_at, last_used_step, updated_at from public.user_mfa_secrets where user_client_id = $1", [staff.john.app_id])).rows[0];
}

async function events() {
  return (await db.query("select event from public.st_staff_security_events where app_user_id = $1 order by id", [staff.john.app_id])).rows.map((row) => row.event);
}

async function johnRow() {
  return (await db.query("select id, username, role, active, password_hash, client_id from public.app_users where id = $1", [staff.john.id])).rows[0];
}

async function cutoff() {
  return (await db.query("select sessions_not_before = 'epoch'::timestamptz as untouched from public.st_staff_auth_links where app_user_id = $1", [staff.john.app_id])).rows[0].untouched;
}

const totp = (secret, at) => generateTotpCode(secret, { now: at });

/** Failed attempts count toward the 15-minute lockout across steps; each rehearsal step starts clean. */
async function clearAttempts() {
  await db.query("delete from public.st_staff_login_attempts where username_key = 'john'");
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
  // Production before this gate: JOHN activated (pbkdf2, one Auth link, claims), AMA/KWAME not, 047 applied.
  await db.query("create table if not exists auth.users (id uuid primary key, email text, raw_app_meta_data jsonb, banned_until timestamptz)");
  const johnHash = await hashPasswordPbkdf2(JOHN_PASSWORD);
  await db.query("update public.app_users set password_hash = $1 where id = $2", [johnHash, staff.john.id]);
  const johnAuth = crypto.randomUUID();
  const email = `${crypto.createHash("sha256").update(`${LIVE}:${staff.john.app_id}`).digest("hex").slice(0, 32)}@staff.smile-trust.invalid`;
  await db.query("insert into auth.users (id, email, raw_app_meta_data) values ($1, $2, $3)",
    [johnAuth, email, { business_code: LIVE, app_user_id: staff.john.app_id, app_role: "SystemOwner", provider: "email" }]);
  await db.query("insert into public.st_staff_auth_links (business_code, app_user_id, auth_user_id) values ($1, $2, $3)", [LIVE, staff.john.app_id, johnAuth]);
  await db.query(migration("047").sql);

  verifySql = VERIFY_FILE;
  for (const name of Object.keys(PROD_UUIDS)) verifySql = verifySql.replaceAll(PROD_UUIDS[name], staff[name].id);

  oldModuleDir = fs.mkdtempSync(path.join(os.tmpdir(), "st-staff-login-rollback-"));
  fs.writeFileSync(path.join(oldModuleDir, "package.json"), JSON.stringify({ type: "module" }));
  for (const file of ["handler.js", "auth-core.js"]) {
    const source = execFileSync("git", ["show", `${ROLLBACK_COMMIT}:supabase/functions/staff-login/${file}`], { cwd: root, encoding: "utf8" });
    fs.writeFileSync(path.join(oldModuleDir, file), source);
  }
  ({ createStaffLoginHandler: createOldHandler } = await import(pathToFileURL(path.join(oldModuleDir, "handler.js")).href));
}, { timeout: 240000 });

after(async () => {
  await db?.stop();
  if (oldModuleDir) fs.rmSync(oldModuleDir, { recursive: true, force: true });
});

test("the post-enrollment verification file is a single read-only SELECT that never returns the secret", () => {
  const code = VERIFY_FILE.replace(/--.*$/gm, "").replace(/'(?:[^']|'')*'/g, "''");
  assert.match(code, /^\s*set transaction read only;/);
  assert.doesNotMatch(code, /\b(insert|update|delete|truncate|drop|alter|create|grant|revoke|execute|copy|call|perform)\b/i);
  assert.equal(code.split(";").filter((part) => part.trim()).length, 2, "one guard statement and one SELECT");
  assert.match(code, /select section, ord, check_name, status, detail\s+from result/, "only the five report columns are returned");
  assert.doesNotMatch(VERIFY_FILE, /angoswtgcklnorhlosnf|sb_secret_|sb_publishable_|eyJ[A-Za-z0-9_-]{10,}\./);
  for (const uuid of Object.values(PROD_UUIDS)) assert.ok(VERIFY_FILE.includes(uuid), `expected uuid ${uuid}`);
});

test("rollback artifact: staff-login at 6843234 is what HEAD holds (the currently deployed pre-047 source)", () => {
  execFileSync("git", ["diff", "--quiet", ROLLBACK_COMMIT, "HEAD", "--", "supabase/functions/staff-login"], { cwd: root });
});

test("before enrollment: JOHN gets 403 mfa_enrollment_required, no session, nothing changes", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const handler = createStaffLoginHandler({ env: ENV, fetchImpl });
  const before = await johnRow();
  const pre = await verify();
  assert.equal(pre[0].status, "JOHN_MFA_NOT_VERIFIED");
  assert.equal(check(pre, "04 MFA", "enrollment state").detail, "not enrolled");
  assert.equal(check(pre, "02 JOHN", "uuid preserved").status, "PASS");
  assert.equal(check(pre, "03 JOHN Auth", "session claims").status, "PASS");
  assert.equal(check(pre, "08 scope", "AMA still not activated").status, "PASS");

  const login = await call(handler, { username: "john", password: JOHN_PASSWORD });
  assert.equal(login.status, 403);
  assert.equal(login.data.mfa_enrollment_required, true);
  assert.equal(login.data.access_token, undefined);
  const withCode = await call(handler, { username: "john", password: JOHN_PASSWORD, mfa_code: "123456" });
  assert.equal(withCode.status, 403, "a code cannot bypass enrollment");
  const wrong = await call(handler, { username: "john", password: "not-the-password" });
  assert.equal(wrong.status, 401);
  assert.equal(wrong.data.mfa_enrollment_required, undefined, "a wrong password reveals nothing about MFA");

  assert.equal(await mfaRow(), undefined);
  assert.deepEqual(await johnRow(), before);
  assert.equal(await cutoff(), true);
  assert.deepEqual(dbErrors, []);
});

test("pre-047 handler on the 047 database: no database errors, but JOHN gets a password-only session (MFA not enforced)", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const old = createOldHandler({ env: ENV, fetchImpl });
  const before = await johnRow();
  const login = await call(old, { username: "john", password: JOHN_PASSWORD });
  assert.equal(login.status, 200, "rollback before enrollment restores password-only owner sign-in");
  assert.ok(login.data.access_token);
  const newAction = await call(old, { action: "mfa_enroll_start", username: "john", password: JOHN_PASSWORD });
  assert.equal(newAction.status, 400, "the old function does not know the enrollment actions");
  assert.deepEqual(await johnRow(), before);
  assert.equal(await mfaRow(), undefined);
  assert.deepEqual(dbErrors, []);
});

test("enrollment: start stores a pending secret, wrong codes fail, the right code enables MFA and signs in", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  await clearAttempts();
  const clock = { now: Date.now() };
  const handler = createStaffLoginHandler({ env: ENV, fetchImpl, now: () => clock.now });

  const badPassword = await call(handler, { action: "mfa_enroll_start", username: "john", password: "not-the-password" });
  assert.equal(badPassword.status, 401);
  assert.equal(await mfaRow(), undefined);

  const start = await call(handler, { action: "mfa_enroll_start", username: "john", password: JOHN_PASSWORD });
  assert.equal(start.status, 200);
  assert.equal(start.data.mfa_enrollment_pending, true);
  assert.match(start.data.secret, /^[A-Z2-7]{32}$/);
  assert.match(start.data.otpauth_uri, /^otpauth:\/\/totp\//);
  assert.equal(start.data.access_token, undefined, "starting enrollment issues no session");
  const pending = await mfaRow();
  assert.equal(pending.enabled, false);
  assert.equal(pending.secret, start.data.secret);

  const pendingView = await verify();
  assert.equal(pendingView[0].status, "JOHN_MFA_NOT_VERIFIED");
  assert.match(check(pendingView, "04 MFA", "enrollment state").detail, /^pending/);
  assert.equal(JSON.stringify(pendingView).includes(start.data.secret), false, "verification never returns the secret");

  const pendingLogin = await call(handler, { username: "john", password: JOHN_PASSWORD, mfa_code: await totp(start.data.secret, clock.now) });
  assert.equal(pendingLogin.status, 403, "a pending secret does not satisfy MFA");

  // Restarting before confirming replaces the pending secret (the recovery for a lost setup screen).
  const restart = await call(handler, { action: "mfa_enroll_start", username: "john", password: JOHN_PASSWORD });
  assert.equal(restart.status, 200);
  assert.notEqual(restart.data.secret, start.data.secret);
  const stale = await call(handler, { action: "mfa_enroll_confirm", username: "john", password: JOHN_PASSWORD, mfa_code: await totp(start.data.secret, clock.now) });
  assert.equal(stale.status, 401, "a code from the abandoned setup no longer works");
  const secret = restart.data.secret;

  const wrong = await call(handler, { action: "mfa_enroll_confirm", username: "john", password: JOHN_PASSWORD, mfa_code: "000000" });
  assert.equal(wrong.status, 401);
  assert.equal((await mfaRow()).enabled, false);

  const confirmCode = await totp(secret, clock.now);
  const confirm = await call(handler, { action: "mfa_enroll_confirm", username: "john", password: JOHN_PASSWORD, mfa_code: confirmCode });
  assert.equal(confirm.status, 200, `confirm failed: ${JSON.stringify(confirm.data.error)} ${dbErrors.join("; ")}`);
  assert.ok(confirm.data.access_token);
  assert.deepEqual(confirm.data.app_user, { id: staff.john.app_id, username: "john", role: "SystemOwner" });
  const enabled = await mfaRow();
  assert.equal(enabled.enabled, true);
  assert.ok(enabled.confirmed_at);
  assert.equal(Number(enabled.last_used_step), Math.floor(clock.now / 30000));
  const failedSoFar = (await db.query("select count(*)::int as n from public.st_staff_login_attempts where username_key = 'john' and not succeeded")).rows[0].n;
  assert.equal(failedSoFar, 3, "wrong password, abandoned-setup code and wrong code each count toward the lockout");
  await clearAttempts();

  // Replay: the confirmation code cannot sign in again; the next code can, once.
  const replayConfirm = await call(handler, { username: "john", password: JOHN_PASSWORD, mfa_code: confirmCode });
  assert.equal(replayConfirm.status, 401);
  assert.equal(replayConfirm.data.error, "That MFA code was already used. Wait for the next code.");
  const noCode = await call(handler, { username: "john", password: JOHN_PASSWORD });
  assert.equal(noCode.status, 401);
  assert.equal(noCode.data.mfa_required, true);
  clock.now += 30000;
  const nextCode = await totp(secret, clock.now);
  const next = await call(handler, { username: "john", password: JOHN_PASSWORD, mfa_code: nextCode });
  assert.equal(next.status, 200);
  const replay = await call(handler, { username: "john", password: JOHN_PASSWORD, mfa_code: nextCode });
  assert.equal(replay.status, 401);
  assert.equal(replay.data.error, "That MFA code was already used. Wait for the next code.");
  const reEnroll = await call(handler, { action: "mfa_enroll_start", username: "john", password: JOHN_PASSWORD });
  assert.equal(reEnroll.status, 409, "an enabled authenticator cannot be replaced with only a password");
  assert.equal((await mfaRow()).secret, secret);

  const verified = await verify();
  assert.deepEqual(failures(verified), []);
  assert.equal(verified[0].status, "JOHN_MFA_VERIFIED");
  assert.equal(check(verified, "04 MFA", "replay marker (last used code step)").status, "PASS");
  assert.equal(check(verified, "05 events", "enrollment confirmed logged").status, "PASS");
  assert.equal(check(verified, "06 secret hygiene", "secret absent from logs and snapshots").status, "PASS");
  assert.equal(check(verified, "03 JOHN Auth", "session cutoff").status, "PASS");
  assert.equal(check(verified, "08 scope", "KWAME still not activated").status, "PASS");
  assert.equal(JSON.stringify(verified).includes(secret), false);
  assert.doesNotMatch(JSON.stringify(verified), /pbkdf2:\d/);
  assert.deepEqual((await events()).filter((e) => e.startsWith("mfa_")), ["mfa_enroll_started", "mfa_enroll_started", "mfa_enrolled"]);
  assert.equal(await cutoff(), true);
  assert.deepEqual(dbErrors, []);
});

test("pre-047 handler after enrollment: still demands the code, but accepts a replayed one and ignores last_used_step", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  await clearAttempts();
  const old = createOldHandler({ env: ENV, fetchImpl });
  const { secret, last_used_step: stepBefore } = await mfaRow();
  const noCode = await call(old, { username: "john", password: JOHN_PASSWORD });
  assert.equal(noCode.status, 401);
  assert.equal(noCode.data.mfa_required, true);
  const code = await totp(secret, Date.now());
  const first = await call(old, { username: "john", password: JOHN_PASSWORD, mfa_code: code });
  const second = await call(old, { username: "john", password: JOHN_PASSWORD, mfa_code: code });
  assert.equal(first.status, 200);
  assert.equal(second.status, 200, "no replay protection in the pre-047 handler");
  assert.equal((await mfaRow()).last_used_step, stepBefore);
  assert.deepEqual(dbErrors, []);
});

test("lockout: five failed codes lock sign-in for 15 minutes; the correct code is refused meanwhile", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  await clearAttempts();
  const handler = createStaffLoginHandler({ env: ENV, fetchImpl });
  for (let i = 0; i < 5; i += 1) {
    const bad = await call(handler, { username: "john", password: JOHN_PASSWORD, mfa_code: "000000" });
    assert.equal(bad.status, 401);
  }
  const { secret } = await mfaRow();
  const locked = await call(handler, { username: "john", password: JOHN_PASSWORD, mfa_code: await totp(secret, Date.now() + 30000) });
  assert.equal(locked.status, 429);
  const view = await verify();
  assert.equal(check(view, "07 sign-in", "lockout").status, "WARN");
  assert.equal(view[0].status, "JOHN_MFA_VERIFIED", "a lockout is a warning, not an enrollment failure");
  await clearAttempts();
});

test("recovery: an owner reset from the SQL editor removes the authenticator, moves the cutoff, and enrollment starts over", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  await clearAttempts();
  const handler = createStaffLoginHandler({ env: ENV, fetchImpl });
  await assert.rejects(db.query("select public.st_reset_staff_mfa($1, $2, $3)", [LIVE, "john", " "]), /reason is required/);
  const reset = (await db.query("select public.st_reset_staff_mfa($1, $2, $3) as r", [LIVE, "john", "lost authenticator during enrollment"])).rows[0].r;
  assert.deepEqual(reset, { ok: true, username: "john", had_mfa: true });
  assert.equal(await mfaRow(), undefined);
  assert.equal(await cutoff(), false, "sessions issued before the reset are cut off");
  const view = await verify();
  assert.equal(view[0].status, "JOHN_MFA_NOT_VERIFIED");
  assert.equal(check(view, "03 JOHN Auth", "session cutoff").status, "WARN");
  const login = await call(handler, { username: "john", password: JOHN_PASSWORD });
  assert.equal(login.status, 403);
  assert.equal(login.data.mfa_enrollment_required, true);

  const clock = { now: Date.now() };
  const reEnroll = createStaffLoginHandler({ env: ENV, fetchImpl, now: () => clock.now });
  const start = await call(reEnroll, { action: "mfa_enroll_start", username: "john", password: JOHN_PASSWORD });
  assert.equal(start.status, 200);
  const confirm = await call(reEnroll, { action: "mfa_enroll_confirm", username: "john", password: JOHN_PASSWORD, mfa_code: await totp(start.data.secret, clock.now) });
  assert.equal(confirm.status, 200);
  const after = await verify();
  assert.deepEqual(failures(after), [], "re-enrollment after a reset verifies");
  assert.equal(check(after, "05 events", "enrollment confirmed logged").status, "WARN");
  assert.equal(check(after, "05 events", "MFA resets").status, "WARN");
  assert.equal(check(after, "03 JOHN Auth", "session cutoff").status, "WARN");
  assert.deepEqual(dbErrors, []);
});

test("clients cannot reach the MFA table or the reset function", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const claims = { role: "authenticated", sub: crypto.randomUUID(), iat: Math.floor(Date.now() / 1000), app_metadata: { business_code: LIVE, app_user_id: staff.kwame.app_id, app_role: "Collector" } };
  await assert.rejects(db.asRole("authenticated", claims, (c) => c.query("select secret from public.user_mfa_secrets")), /permission denied/);
  await assert.rejects(db.asRole("anon", { role: "anon" }, (c) => c.query("select secret from public.user_mfa_secrets")), /permission denied/);
  await assert.rejects(db.asRole("authenticated", claims, (c) => c.query("select public.st_reset_staff_mfa($1, 'john', 'x')", [LIVE])));
});
