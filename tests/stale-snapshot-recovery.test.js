/**
 * Controlled recovery of the stale SMILE-TRUST cloud snapshot (docs/recovery/STALE-SNAPSHOT-RECOVERY-RUNBOOK.md),
 * rehearsed end to end on a disposable local PostgreSQL built like the live project (001–045 without
 * supabase/rls.sql, 046, 047) holding a stale row shaped like the one found in production: the
 * read-only checkpoint, the evidence export, the fail-closed retirement (dry run and write), the
 * protected Initial Cloud Snapshot through the real client modules, and the post-bootstrap checks.
 * It also pins the client behaviour that currently blocks the runbook: the 11be35b app re-uploads
 * device-normalised state (default savings products, the KBA bootstrap account) 3.5 s after the
 * bootstrap. Never connects to a remote database.
 */
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { migrationFiles, startLocalSupabase } from "./helpers/supabase-local-db.mjs";

const realFetch = globalThis.fetch;
const memory = new Map();
globalThis.document ??= { querySelector: () => null };
globalThis.localStorage = {
  getItem: (k) => (memory.has(k) ? memory.get(k) : null),
  setItem: (k, v) => memory.set(k, String(v)),
  removeItem: (k) => memory.delete(k)
};
globalThis.sessionStorage = globalThis.localStorage;

const { App } = await import("../src/context.js");
const {
  pushCloudBackup, queueCloudBackup, resumeCloudUploads, cloudUploadsPaused, CLOUD_BOOTSTRAP_REQUIRED, CLOUD_READ_FAILED, CLOUD_UPLOADS_PAUSED
} = await import("../src/sync/cloud.js");
const { loadVerifiedBootstrap, createInitialCloudSnapshot, deviceStateAfterBootstrap, BOOTSTRAP_REFUSED } = await import("../src/sync/snapshot-bootstrap.js");
const { SESSION_KEY } = await import("../src/sync/supabase-auth.js");
const { defaultSavingsProducts, ensureSavingsProducts } = await import("../src/core/savings-products.js");
const { ensureDefaultSystemAccounts } = await import("../src/core/system-accounts.js");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");
const CHECKPOINT = read("supabase", "preflight", "stale_snapshot_recovery_checkpoint_readonly.sql");
const FORENSICS = read("supabase", "preflight", "existing_snapshot_forensics_readonly.sql");
const DRY_RUN = read("supabase", "recovery", "retire_stale_snapshot_DRY_RUN.sql");
const WRITE = read("supabase", "recovery", "retire_stale_snapshot_WRITE.sql");
const EXPORT_PS1 = read("scripts", "recovery", "Export-StaleSnapshotEvidence.ps1");
const PSQL = "C:\\Program Files\\PostgreSQL\\16\\bin\\psql.exe";

const LIVE = "SMILE-TRUST";
const CLOUD_URL = "https://local-test.supabase.co";
const STALE_SAVED_AT = "2026-10-03T13:07:46.196Z";
const ROLES = { john: "SystemOwner", ama: "Admin", kwame: "Collector" };
const PLACEHOLDER = "__PASTE_STEP_A_PAYLOAD_FINGERPRINT__";
const MARKERS = { memberName: "STALEMEMBERNAMEMARKER", memberPhone: "0249999111", deviceNote: "DEVICENOTEMARKER" };
const PRIVILEGE_NAMES = new Set(["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE"]);
const FORBIDDEN_WORDS = /\b(insert|update|delete|upsert|merge|truncate|alter|drop|create|grant|revoke|copy|call|do|execute|perform|vacuum|analyze|reindex|cluster|lock|notify|listen|comment|reset|refresh|import|discard|prepare|begin|commit|rollback|savepoint|returning|security|definer|owner|policy|trigger|function|procedure)\b/i;
const WRITE_WORDS = /\b(insert|update|delete|upsert|merge|truncate|alter|drop|create|grant|revoke)\b/i;
const ALLOWED_CALLS = new Set([
  "coalesce", "count", "sum", "string_agg", "row_number", "upper", "lower", "btrim", "length", "octet_length", "left",
  "format", "date_trunc", "to_char", "encode", "sha256", "convert_to", "md5", "quote_ident", "has_table_privilege", "xpath",
  "query_to_xml", "regexp_matches", "unnest", "jsonb_typeof", "jsonb_array_length", "jsonb_object_keys", "jsonb_array_elements",
  "jsonb_path_query"
]);
const SQL_WORDS = new Set(["as", "in", "values", "exists", "filter", "not", "and", "or", "on", "then", "else", "when", "lateral",
  "from", "select", "where", "by", "join", "is", "like", "case", "end", "with", "over", "any", "distinct", "row", "array"]);
const CTE_NAMES = new Set(["checks", "std_top", "fetch_fields", "k", "e", "m", "n", "o"]);

const migration = (prefix) => migrationFiles().find((item) => item.name.startsWith(`${prefix}_`));
const comments = (sql) => [...sql.matchAll(/--(.*)$/gm)].map((match) => match[1]).join("\n");
const literals = (sql) => [...sql.replace(/--.*$/gm, "").matchAll(/'((?:[^']|'')*)'/g)].map((match) => match[1].replace(/''/g, "'"));
const codeOnly = (sql) => sql.replace(/--.*$/gm, "").replace(/'(?:[^']|'')*'/g, "''");
const nowSec = () => Math.floor(Date.now() / 1000);
const b64url = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");

const ids = {};
const authIds = {};
let db;
let staleFingerprint;
let coreFingerprint;
let bootstrapResult;

// ------------------------------------------------------------------------------------------
// Local PostgREST bridge (the request shapes the client uses), as in first-snapshot-bootstrap.test.js

const ident = (name) => {
  if (!/^[a-z_]+$/.test(name)) throw new Error(`unexpected identifier ${name}`);
  return `"${name}"`;
};
const claimsFrom = (authorization) => {
  const parts = String(authorization || "").replace(/^Bearer\s+/i, "").split(".");
  return parts.length === 3 ? JSON.parse(Buffer.from(parts[1], "base64url").toString()) : { role: "anon" };
};
const reply = (status, body) => new Response(body == null ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function restToSql(method, url, bodyText) {
  const route = url.pathname.replace("/rest/v1/", "");
  const values = [];
  const bind = (value) => {
    values.push(value !== null && typeof value === "object" ? JSON.stringify(value) : value);
    return `$${values.length}`;
  };
  if (route.startsWith("rpc/")) {
    const body = bodyText ? JSON.parse(bodyText) : {};
    const args = Object.keys(body).map((key) => `${ident(key)} => ${bind(body[key])}`);
    return { sql: `select to_jsonb(public.${ident(route.slice(4))}(${args.join(", ")})) as rows`, values, status: 200 };
  }
  const table = ident(route);
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

const restCalls = [];
let failSnapshotReads = false;
let snapshotReadDelayMs = 0;
let beforeSnapshotPost = null;
async function bridge(input, options = {}) {
  const url = new URL(input);
  const method = options.method || "GET";
  restCalls.push({ method, path: url.pathname });
  if (!url.pathname.startsWith("/rest/v1/")) return reply(404, { message: "not found" });
  if (url.pathname.endsWith("/smile_trust_cloud_snapshots")) {
    if (method === "GET" && failSnapshotReads) return reply(503, { message: "upstream unavailable" });
    if (method === "GET" && snapshotReadDelayMs) await new Promise((resolve) => setTimeout(resolve, snapshotReadDelayMs));
    if (method === "POST" && beforeSnapshotPost) await beforeSnapshotPost();
  }
  const claims = claimsFrom((options.headers || {}).Authorization);
  try {
    const plan = restToSql(method, url, options.body);
    const result = await db.asRole(claims.role === "authenticated" ? "authenticated" : "anon", claims, (client) => client.query(plan.sql, plan.values));
    return reply(plan.status, result.rows[0].rows);
  } catch (error) {
    return reply(error.code === "42501" ? 403 : error.code === "23505" ? 409 : 400, { code: error.code, message: error.message });
  }
}

function signIn(username) {
  const claims = {
    role: "authenticated", sub: authIds[username], iat: nowSec(), session_id: crypto.randomUUID(),
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
const freshProfile = () => {
  memory.clear();
  App.state = { settings: settings(), users: [], customers: [], groups: [], collections: [] };
  App.syncBusy = false;
};
const writes = () => restCalls.filter((call) => call.method !== "GET" && call.path.endsWith("/smile_trust_cloud_snapshots"));
const queuedErrors = [];
const queuedPush = (silent) => pushCloudBackup(silent).catch((error) => queuedErrors.push(error.code));
const snapshotCount = async () => Number((await db.query("select count(*) from public.smile_trust_cloud_snapshots")).rows[0].count);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** JOHN signs in on the server: a login attempt and an Auth session (sign-in tables, not core). */
async function johnSignsIn() {
  await db.query("insert into public.st_staff_login_attempts (business_code, username_key, succeeded, attempted_at) values ($1, 'john', true, now())", [LIVE]);
  await db.query("insert into auth.sessions (user_id, created_at, aal) values ($1, now(), 'aal2')", [authIds.john]);
  signIn("john");
}

/** The stale row as the old client wrote it: device-normalised state, KBA bootstrap user, 14 default products. */
function stalePayload() {
  const users = ["john", "ama", "kwame"].map((u) => ({ id: ids[u], username: u, name: u.toUpperCase(), role: ROLES[u], active: true, createdAt: "2026-09-01" }));
  users.push({ id: "u-superadmin", username: "KBA", name: "KBA", role: "KBA", systemDeveloper: true, active: true, mustChangePassword: true, createdAt: "2026-10-03" });
  return {
    settings: { businessName: "SMILE TRUST SUSU MANAGEMENT SYSTEM", businessId: LIVE, collectionDays: 31, loanInterest: 15, theme: "emerald" },
    groups: [{ id: "demo-branch-accra", name: "Accra", createdAt: "2026-09-01" }],
    users,
    customers: [{ id: "demo-customer-001", name: MARKERS.memberName, phone: MARKERS.memberPhone, groupId: "demo-branch-accra", createdAt: "2026-09-01" }],
    collections: [], loans: [], transactions: [], messages: [{ id: "m1", body: MARKERS.deviceNote }], closings: [],
    deletedUsers: [], deletedRecords: [], audit: [{ action: "Login", at: "2026-10-03T13:07:42Z" }],
    savingsProducts: defaultSavingsProducts(),
    chartOfAccounts: [], notificationTemplates: {}, updatedAt: STALE_SAVED_AT
  };
}

async function runSql(sql) {
  const result = await db.query(sql);
  return (Array.isArray(result) ? result.at(-1) : result).rows;
}
const checkpoint = () => runSql(CHECKPOINT);
const row = (rows, section, check) => {
  const found = rows.find((item) => item.section === section && item.check_name === check);
  assert.ok(found, `missing check ${section} / ${check}`);
  return found;
};
const fails = (rows) => rows.filter((item) => item.section !== "VERDICT" && item.status === "FAIL").map((item) => `${item.section} / ${item.check_name}`);
const coreOf = (rows) => row(rows, "06 relational", "CORE RELATIONAL FINGERPRINT (must be identical at every checkpoint)").detail;
const withFingerprint = (sql, fp) => sql.replace(PLACEHOLDER, fp);
const snapshotRows = async () => (await db.query("select id, saved_by, payload, encode(sha256(convert_to(payload::text, 'UTF8')), 'hex') as fp from public.smile_trust_cloud_snapshots order by id")).rows;

function assertNoLeak(rows) {
  const text = JSON.stringify(rows);
  for (const [name, value] of Object.entries(MARKERS)) assert.equal(text.includes(value), false, `${name} returned`);
  assert.doesNotMatch(text, /pbkdf2:\d|eyJ[A-Za-z0-9_-]{8,}\.|otpauth:/);
  for (const item of rows) assert.deepEqual(Object.keys(item), ["section", "ord", "check_name", "status", "detail"]);
}

before(async () => {
  db = await startLocalSupabase({ upTo: "045", withRlsSql: false });
  if (!db) {
    if (process.env.SMILE_SKIP_DB_TESTS === "1") return;
    throw new Error("embedded-postgres is required for migration tests (npm install)");
  }
  await db.query(migration("046").sql);
  await db.query(`create table if not exists auth.users (id uuid primary key, raw_app_meta_data jsonb, banned_until timestamptz);
    create table if not exists auth.sessions (id uuid primary key default gen_random_uuid(), user_id uuid, created_at timestamptz default now(), aal text);
    create table if not exists auth.refresh_tokens (id bigserial primary key, user_id varchar(255))`);
  await db.query(migration("047").sql);
  for (const item of (await db.query("select username, coalesce(client_id, id::text) as app_id from public.app_users where username in ('john','ama','kwame')")).rows) {
    ids[item.username] = item.app_id;
    authIds[item.username] = crypto.randomUUID();
    await db.query("insert into auth.users (id, raw_app_meta_data) values ($1, $2)",
      [authIds[item.username], { business_code: LIVE, app_user_id: item.app_id, app_role: ROLES[item.username] }]);
    await db.query("insert into public.st_staff_auth_links (business_code, app_user_id, auth_user_id) values ($1, $2, $3)", [LIVE, item.app_id, authIds[item.username]]);
  }
  await db.query("insert into public.smile_trust_cloud_snapshots (business_id, payload, saved_by, saved_at) values ($1, $2, 'john', $3)",
    [LIVE, JSON.stringify(stalePayload()), STALE_SAVED_AT]);
  for (let i = 0; i < 4; i += 1) {
    await db.query("update public.smile_trust_cloud_snapshots set saved_at = saved_at where business_id = $1", [LIVE]);
  }
  globalThis.fetch = bridge;
}, { timeout: 240000 });

after(async () => {
  await db?.stop();
});

const skip = () => !db;

// ------------------------------------------------------------------------------------------
// Static safety of the artifacts

test("the checkpoint is one read-only SELECT with no write, DDL or privilege keyword", () => {
  const code = codeOnly(CHECKPOINT);
  assert.match(code, /^\s*set transaction read only;/);
  assert.equal((code.match(/\bset\b/gi) || []).length, 1);
  assert.equal((code.match(/;/g) || []).length, 2, "the guard and one SELECT");
  assert.doesNotMatch(code, FORBIDDEN_WORDS);
  assert.doesNotMatch(comments(CHECKPOINT), WRITE_WORDS);
  for (const text of literals(CHECKPOINT)) {
    if (PRIVILEGE_NAMES.has(text)) continue;
    assert.doesNotMatch(text, WRITE_WORDS, `literal names a write: ${text}`);
  }
  assert.match(CHECKPOINT, /qouokiqoepjpoksupskb/);
  assert.doesNotMatch(CHECKPOINT, /angoswtgcklnorhlosnf/);
});

test("the checkpoint calls only read-only built-ins; its only dynamic SQL is a count-and-digest of one table", () => {
  const code = codeOnly(CHECKPOINT);
  const called = new Set([...code.matchAll(/\b([a-z_][a-z0-9_]*)\s*\(/gi)].map((match) => match[1].toLowerCase()));
  const unexpected = [...called].filter((name) => !ALLOWED_CALLS.has(name) && !SQL_WORDS.has(name) && !CTE_NAMES.has(name));
  assert.deepEqual(unexpected, []);
  assert.doesNotMatch(code, /\b(public|auth|extensions)\s*\.\s*\w+\s*\(/i, "no application function is called");
  const dynamic = [...CHECKPOINT.matchAll(/query_to_xml\(format\(\s*'([^']*(?:''[^']*)*)'/g)].map((match) => match[1]);
  assert.equal(dynamic.length, 1);
  assert.equal((CHECKPOINT.match(/query_to_xml\(/g) || []).length, 1);
  assert.equal(dynamic[0], "select count(*) as n, coalesce(md5(string_agg(x, chr(10) order by x collate \"C\")), ''none'') as d from (select row(%s)::text as x from public.%I) q");
  assert.match(CHECKPOINT, /false, false, ''\) as q/);
});

test("the checkpoint never outputs the payload or a credential column; credential-like columns are left out of the digest", () => {
  const code = codeOnly(CHECKPOINT);
  assert.doesNotMatch(code, /\b(password_hash|secret|auth_email|code_hash|pin_hash|portal_pin_hash|refresh_token_hash|raw_app_meta_data|details|metadata)\b/i);
  const payloadUses = [...code.matchAll(/\bpayload\b/g)].length;
  const snapStart = code.indexOf("snap as (");
  const snapEnd = code.indexOf("table_activity as (");
  for (const match of code.matchAll(/\bpayload\b/g)) assert.ok(match.index > snapStart && match.index < snapEnd, "payload is only read inside the snap CTE");
  assert.ok(payloadUses >= 3);
  assert.match(CHECKPOINT, /\(secret\|token\|hash\|passw\|otp\|mfa\|api_\?key\|private\|signature\|\^pin\|_pin\|pin_\)/);
  const sql047 = migration("047").sql;
  const keysIn = (text) => [...text.match(/=\s*any\s*\(array\[([\s\S]*?)\]\)/i)[1].matchAll(/'([^']+)'/g)].map((match) => match[1]).sort();
  const fn047 = sql047.slice(sql047.indexOf("function public.st_is_secret_key"), sql047.indexOf("function public.st_strip_secret_keys"));
  assert.deepEqual(keysIn(CHECKPOINT.slice(CHECKPOINT.indexOf("secret_keys as"))), keysIn(fn047), "same secret-key list as 047");
});

test("dry run and write are the same statement except for the mode; the removal is guarded and fails closed", () => {
  const body = (sql) => sql.slice(sql.indexOf("do $retire$"));
  assert.equal(body(WRITE), body(DRY_RUN).replace("constant text := 'DRY_RUN';", "constant text := 'WRITE';"));
  assert.match(DRY_RUN, /c_mode {8}constant text := 'DRY_RUN';/);
  assert.match(WRITE, /c_mode {8}constant text := 'WRITE';/);
  assert.match(WRITE, /^-- PRODUCTION WRITE: .* REQUIRES EXPLICIT HUMAN APPROVAL\./);
  for (const sql of [DRY_RUN, WRITE]) {
    const code = codeOnly(sql).replace(/\bfor update;/g, "");
    assert.equal((code.match(/\bdelete\s+from\b/gi) || []).length, 1, "exactly one removal");
    assert.doesNotMatch(code, /\b(truncate|drop|alter|create|grant|revoke|insert|update|upsert|merge)\b/i);
    const removal = sql.slice(sql.indexOf("delete from"), sql.indexOf("get diagnostics"));
    for (const guard of [/id = 1/, /business_id = 'SMILE-TRUST'/, /saved_by/, /date_trunc\('milliseconds', saved_at\) = c_saved_at/, /sha256\(convert_to\(payload::text, 'UTF8'\)\), 'hex'\) = c_fingerprint/]) {
      assert.match(removal, guard);
    }
    assert.match(sql, /if v_removed <> 1 then\s+raise exception/);
    assert.match(sql, /lock table public\.smile_trust_cloud_snapshots in exclusive mode/);
    assert.ok(sql.includes(`'${PLACEHOLDER}'`), "ships with the placeholder, never a real fingerprint");
    assert.equal(sql.split(PLACEHOLDER).length, 2, "the placeholder appears once, so one edit fills it");
    assert.doesNotMatch(sql, /'[0-9a-f]{64}'/);
    assert.doesNotMatch(sql, /angoswtgcklnorhlosnf/);
  }
});

test("the evidence export is read-only, prompts for the password itself, and never prints the payload", () => {
  assert.match(EXPORT_PS1, /begin transaction read only;/);
  assert.match(EXPORT_PS1, /\nrollback;\n/);
  assert.doesNotMatch(EXPORT_PS1.replace(/^#.*$/gm, ""), /\b(insert|update|delete|truncate|drop|alter|create|grant)\s/i);
  assert.match(EXPORT_PS1, /Remove-Item Env:PGPASSWORD/);
  assert.doesNotMatch(EXPORT_PS1, /\$env:PGPASSWORD\s*=/);
  assert.doesNotMatch(EXPORT_PS1, /-W\b|--password/);
  assert.match(EXPORT_PS1, /\$ForbiddenRef = "angoswtgcklnorhlosnf"/);
  assert.match(EXPORT_PS1, /\$ProjectRef = "qouokiqoepjpoksupskb"/);
  assert.match(EXPORT_PS1, /icacls\.exe \$runDir \/inheritance:r/);
  assert.match(EXPORT_PS1, /STALE-DO-NOT-RESTORE/);
  const printing = EXPORT_PS1.split("\n").filter((line) => /Write-(Host|Output)|Out-Host|\becho\b/i.test(line));
  for (const line of printing) assert.doesNotMatch(line, /\$bytes(?!\.Length)|\$payload|Get-Content/, `prints payload content: ${line}`);
  assert.doesNotMatch(EXPORT_PS1, /Get-Content[^\n]*payloadFile/, "the payload file is never read as text");
});

test("step F: the recovery server serves only www/ on 127.0.0.1, never caches, withholds the service worker and blocks traversal", async () => {
  const { createServer, preflight } = await import("../scripts/recovery/serve-recovery-client.mjs");
  const source = read("scripts", "recovery", "serve-recovery-client.mjs");
  assert.match(source, /\.listen\(port, "127\.0\.0\.1"/);
  assert.match(source, /merge-base", "--is-ancestor", REQUIRED_COMMIT, "HEAD"/);
  assert.match(source, /const REQUIRED_COMMIT = "11be35b";/);
  assert.doesNotMatch(source, /console\.log\([^)]*config(?!\.json is)/i, "config.json is never printed");
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const index = await realFetch(`${base}/`);
    assert.equal(index.status, 200);
    assert.equal(index.headers.get("cache-control"), "no-store, max-age=0");
    assert.equal(await index.text(), read("www", "index.html"));
    assert.equal((await realFetch(`${base}/service-worker.js`)).status, 404);
    assert.equal((await realFetch(`${base}/..%2fpackage.json`)).status, 403);
    assert.equal((await realFetch(`${base}/..%5cpackage.json`)).status, 403);
    // Send the exact request target: fetch would normalize raw dot segments before sending.
    for (const target of ["/../package.json", "/..\\package.json", "/%2e%2e/package.json", "/%2E.%5Cpackage.json", "/src/../../package.json"]) {
      const response = await new Promise((resolve, reject) => {
        http.get(base, { path: target }, (res) => {
          res.resume();
          res.on("end", () => resolve(res));
        }).on("error", reject);
      });
      assert.equal(response.statusCode, 403, target);
      assert.equal(response.headers["cache-control"], "no-store, max-age=0");
    }
    assert.equal((await realFetch(`${base}/app.js`, { method: "POST" })).status, 405);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
  assert.match(source, /lacks the upload pause after the initial cloud snapshot/, "a client without the post-bootstrap pause is refused");
  const servedDirty = spawnSync("git", ["status", "--porcelain", "--untracked-files=no", "--", "www", "src", "app.js", "index.html"], { cwd: root, encoding: "utf8" }).stdout.trim();
  if (servedDirty) {
    assert.throws(preflight, /STOP: served files have uncommitted changes/, "an uncommitted client is never served");
  } else if (fs.existsSync(path.join(root, "www", "config.json"))) {
    assert.match(preflight(), /^[0-9a-f]{12}$/, "this checkout passes the commit, mirror, pause and config checks");
  }
});

// ------------------------------------------------------------------------------------------
// Step A: the stale row is identified exactly

test("step A: the checkpoint identifies the stale row, prints its fingerprint and the relational fingerprint, and leaks nothing", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const rows = await checkpoint();
  assert.equal(rows[0].status, "STALE_SNAPSHOT_READY_TO_RETIRE", rows[0].detail);
  assert.deepEqual(fails(rows), []);
  const stored = (await db.query("select payload::text as t from public.smile_trust_cloud_snapshots")).rows[0].t;
  staleFingerprint = crypto.createHash("sha256").update(Buffer.from(stored, "utf8")).digest("hex");
  assert.equal(row(rows, "02 row", "PAYLOAD FINGERPRINT (SHA-256 of the stored JSON text)").detail, staleFingerprint);
  assert.equal(row(rows, "02 row", "row id").detail, "1");
  assert.equal(row(rows, "02 row", "saved_by (written by the client)").detail, "john (staff, SystemOwner, active)");
  assert.equal(row(rows, "02 row", "saved_at (written by the client, UTC, milliseconds)").detail, "2026-10-03 13:07:46.196");
  assert.equal(row(rows, "02 row", "contents: members, staff, groups, collections, savings products").detail,
    "members 1, staff 4, groups 1, collections 0, savings products 14");
  assert.match(row(rows, "02 row", "format").detail, /^older full device-state format: 2 extra top-level key\(s\)/);
  assert.equal(row(rows, "06 relational", "database counts are members 1, staff 3, groups 1, collections 0, savings products 1").status, "PASS");
  assert.match(row(rows, "01 phase", "snapshot table activity counters (server statistics; compare between checkpoints)").detail, /^new rows \d+, changed rows \d+/);
  for (const check of ["row id is 1", "saved_by is john", "saved_at is 2026-10-03 13:07:46.196 UTC",
    "contents: staff 4, members 1, groups 1, collections 0, savings products 14", "older full device-state format"]) {
    assert.equal(row(rows, "03 stale identity", check).status, "PASS", check);
  }
  assert.ok(rows.filter((item) => item.section === "04 initial snapshot").every((item) => item.status === "INFO"));
  coreFingerprint = coreOf(rows);
  assert.match(coreFingerprint, /^[0-9a-f]{32} \(\d+ tables, \d+ rows\)$/);
  assert.ok(rows.some((item) => item.section === "07 sign-in tables" && item.check_name === "st_staff_login_attempts"));
  assertNoLeak(rows);
});

test("the checkpoint's own transaction refuses writes, and sign-in activity does not move the core fingerprint", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  await db.query("begin");
  try {
    await checkpoint();
    await assert.rejects(db.query("insert into public.st_portal_pins (business_code, customer_id, pin_hash) values ('x', 'y', 'z')"), /read-only transaction/);
  } finally {
    await db.query("rollback");
  }
  await db.query("begin");
  try {
    await db.query("insert into public.st_staff_login_attempts (business_code, username_key, succeeded, attempted_at) values ($1, 'john', true, now())", [LIVE]);
    await db.query("insert into public.st_staff_security_events (business_code, app_user_id, event) values ($1, $2, 'staff_login')", [LIVE, ids.john]);
    await db.query("update public.user_mfa_secrets set last_used_step = coalesce(last_used_step, 0) + 1");
    assert.equal(coreOf(await checkpoint()), coreFingerprint);
  } finally {
    await db.query("rollback");
  }
  await db.query("begin");
  try {
    await db.query("update public.customers set phone = '0240000001'");
    assert.notEqual(coreOf(await checkpoint()), coreFingerprint, "a business-record change moves it");
  } finally {
    await db.query("rollback");
  }
});

// ------------------------------------------------------------------------------------------
// Step C: retirement fails closed

async function expectRefusal(sql, pattern, setup) {
  await db.query("begin");
  try {
    if (setup) await setup();
    await assert.rejects(db.query(sql), pattern);
  } finally {
    await db.query("rollback");
  }
  const rows = await snapshotRows();
  assert.equal(rows.length, 1, "the stale row is still there");
  assert.equal(rows[0].fp, staleFingerprint, "and unchanged");
}

test("step C guards: placeholder, wrong fingerprint, extra row, changed row, history or side effects all refuse and change nothing", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  await expectRefusal(WRITE, /STOP: paste the 64-character/);
  await expectRefusal(withFingerprint(WRITE, "0".repeat(64)), /STOP: the payload fingerprint differs from step A/);
  await expectRefusal(withFingerprint(WRITE, staleFingerprint.toUpperCase()), /STOP: paste the 64-character/);
  await expectRefusal(withFingerprint(WRITE, staleFingerprint), /STOP: expected exactly one snapshot row \(SMILE-TRUST\); found total 2, SMILE-TRUST 1, variants 1/,
    () => db.query("insert into public.smile_trust_cloud_snapshots (business_id, payload, saved_by) values ('smile-trust ', '{}', 'john')"));
  await expectRefusal(withFingerprint(WRITE, staleFingerprint), /STOP: saved_at is .* \(the row changed since inspection\)/,
    () => db.query("update public.smile_trust_cloud_snapshots set saved_at = now()"));
  await expectRefusal(withFingerprint(WRITE, staleFingerprint), /STOP: the payload fingerprint differs from step A/,
    () => db.query("update public.smile_trust_cloud_snapshots set payload = payload || '{\"offlineQueue\": []}'::jsonb"));
  await expectRefusal(withFingerprint(WRITE, staleFingerprint), /STOP: saved_by is not john/,
    () => db.query("update public.smile_trust_cloud_snapshots set saved_by = 'ama'"));
  await expectRefusal(withFingerprint(WRITE, staleFingerprint), /STOP: snapshot history exists \(posted ledger 1, lifecycle events 0\)/,
    () => db.query("insert into public.st_snapshot_financial_ledger (business_id, kind, record_id, customer_id, amount_from_amount) values ($1, 'collections', 'c-x', 'demo-customer-001', 100)", [LIVE]));
  await expectRefusal(withFingerprint(WRITE, staleFingerprint), /STOP: removal would have side effects \(foreign keys 1, removal handlers 0\)/,
    () => db.query("create table public.tmp_snapshot_ref (snapshot_id bigint references public.smile_trust_cloud_snapshots(id))"));
  await expectRefusal(withFingerprint(WRITE, staleFingerprint), /STOP: business SMILE-TRUST not found/,
    () => db.query("update public.businesses set code = 'OTHER-BIZ', legacy_code = null where code = $1 or legacy_code = $1", [LIVE]));
});

test("step C1: the dry run passes every guard, reports DRY RUN PASSED as an error, and keeps the row", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  await assert.rejects(db.query(withFingerprint(DRY_RUN, staleFingerprint)),
    new RegExp(`DRY RUN PASSED: the stale row \\(id 1, fingerprint ${staleFingerprint}\\) matched every guard and would be removed; this dry run was rolled back`));
  const rows = await snapshotRows();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].fp, staleFingerprint);
  assert.equal((await checkpoint())[0].status, "STALE_SNAPSHOT_READY_TO_RETIRE");
});

// ------------------------------------------------------------------------------------------
// Step B: evidence export (needs PostgreSQL 16 psql and Windows PowerShell)

test("step B: the export writes the exact stored payload to a private STALE-DO-NOT-RESTORE file and prints only its fingerprint", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  if (process.platform !== "win32" || !fs.existsSync(PSQL)) return t.skip("PostgreSQL 16 psql on Windows is not available");
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "st-evidence-"));
  const passFile = path.join(outDir, "pgpass.conf");
  fs.writeFileSync(passFile, `127.0.0.1:${db.connection.port}:postgres:postgres:${db.connection.password}\n`);
  try {
    const run = (fingerprint) => spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File",
      path.join(root, "scripts", "recovery", "Export-StaleSnapshotEvidence.ps1"),
      "-DbHost", "127.0.0.1", "-Port", String(db.connection.port), "-ExpectedFingerprint", fingerprint,
      "-OutDir", path.join(outDir, "evidence"), "-LocalTestOnly"], { encoding: "utf8", env: { ...process.env, PGPASSFILE: passFile }, timeout: 120000 });

    const ok = run(staleFingerprint);
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    const printed = ok.stdout + ok.stderr;
    for (const value of Object.values(MARKERS)) assert.equal(printed.includes(value), false, "no payload content printed");
    assert.match(printed, new RegExp(`SHA-256        : ${staleFingerprint}`));
    assert.match(printed, /matches step A : yes/);
    const [folder] = fs.readdirSync(path.join(outDir, "evidence"));
    assert.match(folder, /^STALE-DO-NOT-RESTORE_SMILE-TRUST_snapshot-id1_\d{8}T\d{6}Z$/);
    const dir = path.join(outDir, "evidence", folder);
    assert.deepEqual(fs.readdirSync(dir).sort(), ["SHA256SUMS.txt", "STALE-DO-NOT-RESTORE_metadata.json", "STALE-DO-NOT-RESTORE_payload.json"]);
    const payload = fs.readFileSync(path.join(dir, "STALE-DO-NOT-RESTORE_payload.json"));
    assert.equal(crypto.createHash("sha256").update(payload).digest("hex"), staleFingerprint, "the file is byte-for-byte the stored JSON text");
    const meta = JSON.parse(fs.readFileSync(path.join(dir, "STALE-DO-NOT-RESTORE_metadata.json"), "utf8"));
    assert.equal(meta.row_id, 1);
    assert.equal(meta.saved_by, "john");
    assert.equal(meta.saved_at, "2026-10-03T13:07:46.196000Z");
    assert.match(meta.warning, /DO NOT RESTORE/);
    const acl = spawnSync("icacls.exe", [dir], { encoding: "utf8" }).stdout;
    assert.doesNotMatch(acl, /BUILTIN\\Users|Everyone|Authenticated Users/i, "only the current user can read it");

    const changed = run("f".repeat(64));
    assert.equal(changed.status, 1);
    assert.match(changed.stdout + changed.stderr, /STOP: the row's fingerprint differs from step A/);
    assert.equal((await snapshotRows())[0].fp, staleFingerprint, "the export changed nothing");
  } finally {
    spawnSync("cmd.exe", ["/c", "attrib", "-R", path.join(outDir, "*"), "/S", "/D"]);
    for (const entry of fs.readdirSync(path.join(outDir, "evidence"), { withFileTypes: true }).filter((e) => e.isDirectory())) {
      spawnSync("icacls.exe", [path.join(outDir, "evidence", entry.name), "/reset", "/T", "/Q"]);
    }
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

// ------------------------------------------------------------------------------------------
// Step C2 and E: retirement and post-removal verification

test("step C2/E: the write removes exactly the stale row; the checkpoint then finds no row and an unchanged database", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const result = await runSql(withFingerprint(WRITE, staleFingerprint));
  assert.deepEqual(result, [{ result: "RETIRED: 0 snapshot rows remain" }]);
  assert.equal((await snapshotRows()).length, 0);
  const rows = await checkpoint();
  assert.equal(rows[0].status, "SNAPSHOT_RETIRED_READY_FOR_BOOTSTRAP", rows[0].detail);
  assert.deepEqual(fails(rows), []);
  assert.equal(coreOf(rows), coreFingerprint, "relational rows and counts unchanged");
  assert.equal(row(rows, "02 row", "PAYLOAD FINGERPRINT (SHA-256 of the stored JSON text)").detail, "no row");
  assertNoLeak(rows);
  await assert.rejects(db.query(withFingerprint(WRITE, staleFingerprint)), /STOP: expected exactly one snapshot row \(SMILE-TRUST\); found total 0/, "a second run refuses");
});

test("section J: a snapshot that appears before the bootstrap is UNKNOWN_SNAPSHOT_STOP, and the bootstrap refuses rather than overwrite it", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  await db.query("insert into public.smile_trust_cloud_snapshots (business_id, payload, saved_by, saved_at) values ($1, $2, 'john', now())",
    [LIVE, JSON.stringify({ ...stalePayload(), updatedAt: new Date().toISOString() })]);
  try {
    const rows = await checkpoint();
    assert.equal(rows[0].status, "UNKNOWN_SNAPSHOT_STOP", rows[0].detail);
    assert.equal(coreOf(rows), coreFingerprint);
    freshProfile();
    await johnSignsIn();
    await assert.rejects(loadVerifiedBootstrap(App.state), (error) => error.code === BOOTSTRAP_REFUSED && /already exists/.test(error.message));
  } finally {
    await db.query("delete from public.smile_trust_cloud_snapshots where business_id = $1", [LIVE]);
  }

  freshProfile();
  await johnSignsIn();
  await loadVerifiedBootstrap(App.state);
  await db.query("insert into public.smile_trust_cloud_snapshots (business_id, payload, saved_by) values ($1, '{}', 'system')", [LIVE]);
  try {
    restCalls.length = 0;
    await assert.rejects(createInitialCloudSnapshot({ confirmation: LIVE }, App.state), (error) => error.code === BOOTSTRAP_REFUSED && /already exists/.test(error.message));
    assert.equal(restCalls.some((call) => call.method !== "GET"), false, "nothing was written over it");
  } finally {
    await db.query("delete from public.smile_trust_cloud_snapshots where business_id = $1", [LIVE]);
  }
  assert.equal((await checkpoint())[0].status, "SNAPSHOT_RETIRED_READY_FOR_BOOTSTRAP");
});

// ------------------------------------------------------------------------------------------
// Auto-upload audit: with the stale row gone, nothing but the explicit workflow can create a row

test("no snapshot: JOHN's login, startup, saveState's autosave timer, manual backup, a reload and a failed read all leave 0 rows", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  assert.equal(await snapshotCount(), 0);
  freshProfile();
  App.state = { ...stalePayload(), settings: settings() };
  App.localSavePending = true;
  await johnSignsIn();
  restCalls.length = 0;
  queuedErrors.length = 0;

  await assert.rejects(pushCloudBackup(true), (error) => error.code === CLOUD_BOOTSTRAP_REQUIRED, "startup / background merge push");
  assert.equal(await snapshotCount(), 0);
  queueCloudBackup(queuedPush);
  await sleep(3800);
  assert.deepEqual(queuedErrors, [CLOUD_BOOTSTRAP_REQUIRED], "the saveState autosave timer fired and refused");
  assert.equal(await snapshotCount(), 0);
  await assert.rejects(pushCloudBackup(false), (error) => error.code === CLOUD_BOOTSTRAP_REQUIRED, "manual Back up to cloud");
  assert.equal(await snapshotCount(), 0);

  const reloaded = await import("../src/sync/snapshot-bootstrap.js?reload=audit");
  await assert.rejects(reloaded.createInitialCloudSnapshot({ confirmation: LIVE }, App.state), (error) => error.code === BOOTSTRAP_REFUSED && /Load the business data/.test(error.message));
  await assert.rejects(pushCloudBackup(true), (error) => error.code === CLOUD_BOOTSTRAP_REQUIRED, "startup push after the reload");
  assert.equal(await snapshotCount(), 0);

  await loadVerifiedBootstrap(App.state);
  failSnapshotReads = true;
  try {
    await assert.rejects(pushCloudBackup(true), (error) => error.code === CLOUD_READ_FAILED);
    await assert.rejects(pushCloudBackup(false), (error) => error.code === CLOUD_READ_FAILED);
    await assert.rejects(loadVerifiedBootstrap(App.state), (error) => error.code === CLOUD_READ_FAILED);
  } finally {
    failSnapshotReads = false;
  }
  await loadVerifiedBootstrap(App.state);
  failSnapshotReads = true;
  try {
    await assert.rejects(createInitialCloudSnapshot({ confirmation: LIVE }, App.state), (error) => error.code === CLOUD_READ_FAILED, "the final missing-row check failing refuses the insert");
  } finally {
    failSnapshotReads = false;
  }
  assert.equal(cloudUploadsPaused(), false, "a refusal before the insert leaves ordinary sync as it was");
  assert.deepEqual(writes(), [], "no snapshot INSERT, PATCH or DELETE was ever sent");
  assert.equal(await snapshotCount(), 0);
  assert.equal((await checkpoint())[0].status, "SNAPSHOT_RETIRED_READY_FOR_BOOTSTRAP");
});

test("no snapshot: only a fresh load in this session plus the exact typed SMILE-TRUST may insert; every refusal leaves 0 rows", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  freshProfile();
  await johnSignsIn();
  restCalls.length = 0;
  await assert.rejects(createInitialCloudSnapshot({ confirmation: LIVE }, App.state), (error) => error.code === BOOTSTRAP_REFUSED);
  await loadVerifiedBootstrap(App.state);
  for (const typed of ["smile-trust", " SMILE-TRUST", "SMILE-TRUST ", "SMILE TRUST", "", undefined]) {
    await assert.rejects(createInitialCloudSnapshot({ confirmation: typed }, App.state), (error) => error.code === BOOTSTRAP_REFUSED && /Type SMILE-TRUST exactly/.test(error.message), String(typed));
  }
  signIn("john");
  await assert.rejects(createInitialCloudSnapshot({ confirmation: LIVE }, App.state), (error) => /Load the business data/.test(error.message), "a different session cannot use the load");
  await loadVerifiedBootstrap(App.state);
  const realNow = Date.now;
  Date.now = () => realNow() + 11 * 60 * 1000;
  try {
    await assert.rejects(createInitialCloudSnapshot({ confirmation: LIVE }, App.state), (error) => /too old/.test(error.message));
  } finally {
    Date.now = realNow;
  }
  await assert.rejects(createInitialCloudSnapshot({ confirmation: LIVE }, App.state), (error) => /Load the business data/.test(error.message), "an expired load is discarded");
  assert.equal(cloudUploadsPaused(), false);
  assert.deepEqual(writes(), []);
  assert.equal(await snapshotCount(), 0);
});

test("no snapshot: the insert waits for an in-flight upload, and a row that appears before it is refused (409), never overwritten", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  freshProfile();
  await johnSignsIn();
  await loadVerifiedBootstrap(App.state);
  let pushSettled = false;
  let postSawPushSettled = null;
  snapshotReadDelayMs = 300;
  beforeSnapshotPost = async () => {
    postSawPushSettled = pushSettled;
    await db.query("insert into public.smile_trust_cloud_snapshots (business_id, payload, saved_by) values ($1, '{}', 'race')", [LIVE]);
  };
  try {
    restCalls.length = 0;
    const push = pushCloudBackup(true).catch((error) => error).finally(() => { pushSettled = true; });
    await assert.rejects(createInitialCloudSnapshot({ confirmation: LIVE }, App.state), /409|duplicate|unique|already/i);
    assert.equal((await push).code, CLOUD_BOOTSTRAP_REQUIRED, "the concurrent push refused on its own");
    assert.equal(postSawPushSettled, true, "the final check and the insert ran only after that push finished");
    assert.deepEqual(writes().map((call) => call.method), ["POST"], "a plain insert, no PATCH");
    const rows = await snapshotRows();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].saved_by, "race", "the row that won the race is untouched");
    assert.equal(cloudUploadsPaused(), true, "once the insert is sent this page never uploads again");
    restCalls.length = 0;
    await pushCloudBackup(true);
    assert.deepEqual(restCalls, []);
  } finally {
    snapshotReadDelayMs = 0;
    beforeSnapshotPost = null;
    await db.query("delete from public.smile_trust_cloud_snapshots where business_id = $1", [LIVE]);
    resumeCloudUploads();
  }
  await assert.rejects(createInitialCloudSnapshot({ confirmation: LIVE }, App.state), /Load the business data/, "single use even when the insert failed");
  assert.equal((await checkpoint())[0].status, "SNAPSHOT_RETIRED_READY_FOR_BOOTSTRAP");
});

// ------------------------------------------------------------------------------------------
// Steps G–I: the protected Initial Cloud Snapshot from a fresh profile, then verification

test("steps G–I: JOHN's bootstrap from a fresh profile shows 1/3/1/0/1 and the checkpoint and forensics verify the new row", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  freshProfile();
  await johnSignsIn();
  const summary = await loadVerifiedBootstrap(App.state);
  assert.deepEqual(summary, { businessCode: LIVE, members: 1, staff: 3, groups: 1, collections: 0, savingsProducts: 1 }, "the confirmation dialog numbers");
  restCalls.length = 0;
  queuedErrors.length = 0;
  queueCloudBackup(queuedPush);
  bootstrapResult = await createInitialCloudSnapshot({ confirmation: LIVE }, App.state);
  assert.deepEqual(restCalls.filter((call) => call.method !== "GET").map((call) => call.method), ["POST"]);
  assert.equal(cloudUploadsPaused(), true);

  const rows = await checkpoint();
  assert.equal(rows[0].status, "INITIAL_SNAPSHOT_VERIFIED", rows[0].detail);
  assert.deepEqual(fails(rows), []);
  assert.equal(coreOf(rows), coreFingerprint, "relational rows and counts unchanged by the bootstrap");
  assert.equal(row(rows, "02 row", "format").detail, "database-bootstrap format of commit 11be35b");
  assert.equal(row(rows, "02 row", "contents: members, staff, groups, collections, savings products").detail,
    "members 1, staff 3, groups 1, collections 0, savings products 1");
  assert.equal(row(rows, "04 initial snapshot", "saved_by is JOHN (staff, SystemOwner, active)").status, "PASS");
  assert.equal(row(rows, "05 safety", "no secret keys anywhere in the payload (047 key list)").detail, "none");
  assert.ok(Number(row(rows, "02 row", "row id").detail) > 1);
  assertNoLeak(rows);

  const forensic = await runSql(FORENSICS);
  assert.equal(forensic[0].status, "EXISTING_SNAPSHOT_APPEARS_VALID", forensic[0].detail);
});

// ------------------------------------------------------------------------------------------
// After the bootstrap: the device-normalised copy (default products, KBA account) must not be uploaded

const MIRRORED_SYNC_FILES = [["app.js"], ["src", "sync", "cloud.js"], ["src", "sync", "snapshot-bootstrap.js"]];

test("static: every app upload path stops once the insert is sent, and www/ carries the same code", () => {
  const app = read("app.js");
  const flowStart = app.indexOf("async function createInitialCloudSnapshotFlow");
  const flow = app.slice(flowStart, flowStart + 3200);
  assert.match(flow, /createInitialCloudSnapshot\([\s\S]*state = normalizeState\(deviceStateAfterBootstrap\([\s\S]*clearTimeout\(syncTimer\);\s*saveState\(\);\s*localSavePending = false;\s*syncToApp\(\);/,
    "the flow cancels the pending autosave and leaves no upload pending");
  assert.match(app, /function queueCloudBackup\(\) \{\s*clearTimeout\(syncTimer\);\s*if \(cloudUploadsPaused\(\)\) return;/, "saveState's autosave timer is never armed while paused");
  assert.match(app, /async function pushCloudBackup\(silent = false\) \{\s*if \(cloudUploadsPaused\(\)\) \{/, "startup, background merge, manual and every action push stop first");
  assert.equal((app.match(/pushRemoteBackup\(/g) || []).length, 1, "the app reaches the cloud push through that one wrapper");

  const cloud = read("src", "sync", "cloud.js");
  assert.match(cloud, /export async function pushCloudBackup\(silent = false\) \{\s*if \(cloudUploadsPaused\(\)\) \{/, "the module push, including its busy reschedule, stops first");
  assert.equal((cloud.match(/await saveCloudSnapshot\(/g) || []).length, 1, "the snapshot is written only from pushCloudBackup");

  const bootstrap = read("src", "sync", "snapshot-bootstrap.js");
  assert.match(bootstrap, /pauseCloudUploads\(\);\s*try \{\s*if \(!\(await waitForCloudUploadsIdle\(\)\)\)[\s\S]*?await requireNoCloudCopy\(\);\s*\} catch \(error\) \{\s*resumeCloudUploads\(\);\s*throw error;\s*\}\s*verifiedLoad = null;[\s\S]*?method: "POST",\s*prefer: "return=minimal"/,
    "paused, idle, missing-row re-check, single use, then a plain insert");
  assert.equal((bootstrap.match(/resumeCloudUploads\(\)/g) || []).length, 1, "uploads resume only when the insert was never sent");
  assert.doesNotMatch(bootstrap, /on_conflict|resolution=merge|method: "PATCH"/);

  for (const parts of MIRRORED_SYNC_FILES) {
    assert.equal(read("www", ...parts), read(...parts), `www/${parts.join("/")} matches the source`);
  }
});

test("after the bootstrap the device uploads nothing until reopened: the queued timer, autosave, manual and busy reschedule all write nothing", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  const before = await snapshotRows();
  const device = deviceStateAfterBootstrap(App.state, bootstrapResult.state);
  ensureSavingsProducts(device);
  ensureDefaultSystemAccounts(device);
  assert.equal(device.savingsProducts.length, 15, "the app's normaliser adds the 14 default products to SUSU-DAILY");
  assert.equal(device.users.length, 4, "and the KBA bootstrap account to JOHN, AMA, KWAME");
  App.state = { ...device, settings: settings() };
  App.localSavePending = true;
  App.syncBusy = false;
  restCalls.length = 0;

  await sleep(3800);
  assert.deepEqual(queuedErrors, [], "the autosave queued before the insert was cancelled, not run");
  assert.equal(await pushCloudBackup(true), undefined);
  await assert.rejects(pushCloudBackup(false), (error) => error.code === CLOUD_UPLOADS_PAUSED, "manual Back up to cloud explains why");
  App.syncBusy = true;
  await pushCloudBackup(true);
  App.syncBusy = false;
  queueCloudBackup(queuedPush);
  await sleep(3800);
  assert.deepEqual(queuedErrors, []);
  assert.deepEqual(restCalls, [], "no request reached the server at all");

  const after = await snapshotRows();
  assert.deepEqual(after.map((item) => [item.id, item.fp]), before.map((item) => [item.id, item.fp]), "the new row is byte-for-byte unchanged");
  const rows = await checkpoint();
  assert.equal(rows[0].status, "INITIAL_SNAPSHOT_VERIFIED", rows[0].detail);
  assert.equal(row(rows, "02 row", "contents: members, staff, groups, collections, savings products").detail,
    "members 1, staff 3, groups 1, collections 0, savings products 1");
  assert.equal(coreOf(rows), coreFingerprint);
});

test("once the app is reopened, ordinary manager sync resumes and writes the device format, so step I must run before reopening", async (t) => {
  if (skip()) return t.skip("local database unavailable");
  resumeCloudUploads();
  App.syncBusy = false;
  await pushCloudBackup(true);
  const rows = await checkpoint();
  assert.notEqual(rows[0].status, "INITIAL_SNAPSHOT_VERIFIED");
  assert.equal(row(rows, "02 row", "contents: members, staff, groups, collections, savings products").detail,
    "members 1, staff 4, groups 1, collections 0, savings products 15");
  assert.equal(await snapshotCount(), 1, "an update of the same row, never a second row");
  assert.equal(coreOf(rows), coreFingerprint, "relational tables are still untouched");
});
