/**
 * Production Blocker #1 regression: nothing privileged ships in the client, and the client only
 * holds per-user session material. Database-side authorization is covered by
 * security-server-authorization.test.js.
 */
import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const scanner = require("../scripts/lib/client-secret-scan.js");

const memory = new Map();
const session = new Map();
const storage = (map) => ({
  getItem: (k) => (map.has(k) ? map.get(k) : null),
  setItem: (k, v) => map.set(k, String(v)),
  removeItem: (k) => map.delete(k)
});
globalThis.document ??= { querySelector: () => null };
globalThis.localStorage = storage(memory);
globalThis.sessionStorage = storage(session);

const { App } = await import("../src/context.js");
const { pickClientConfig, CLIENT_CONFIG_ALLOWED_KEYS, captureLegacySyncKey, LEGACY_SYNC_KEY_STORAGE } = await import("../src/config.js");
const { forbiddenClientConfigKeys, CLIENT_FORBIDDEN_CONFIG_KEYS } = await import("../src/core/production-guards.js");
const { DEFAULT_SYSTEM_OWNER, DEFAULT_SUPER_ADMIN, ensureDefaultSystemAccounts, hasUsableLocalLogin } = await import("../src/core/system-accounts.js");
const passwordModule = await import("../src/password.js");
const { hashPassword, verifyPassword } = passwordModule;
const { sanitizeStateForCloud } = await import("../src/sync/snapshot-security.js");
const { encryptOfflinePayload, decryptOfflinePayload, deviceQueueSecret } = await import("../src/sync/offline-crypto.js");
const { SESSION_KEY } = await import("../src/sync/supabase-auth.js");
const { staffCloudLogin, hasStaffCloudSession } = await import("../src/sync/staff-session.js");
const portal = await import("../src/sync/portal-remote.js");
const { latestCloudSnapshot, pushCloudBackup } = await import("../src/sync/cloud.js");
const { evaluateStaffLogin, findStaffUser, verifyPasswordHash, verifyTotp } = await import("../supabase/functions/staff-login/auth-core.js");
const { createStaffLoginHandler } = await import("../supabase/functions/staff-login/handler.js");
const { generateTotpCode, generateTotpSecret } = await import("../src/core/totp.js");

const SUPABASE_URL = "https://example.supabase.co";
const ANON = "anon-public-key";
const SERVICE = "service-role-test-value-never-shipped";

beforeEach(() => {
  memory.clear();
  session.clear();
});

function cloudState(extra = {}) {
  return {
    settings: { cloudMode: "supabase", cloudUrl: SUPABASE_URL, cloudKey: ANON, businessId: "biz-1", ...extra },
    users: [],
    customers: []
  };
}

function textFilesUnder(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...textFilesUnder(full));
    else out.push(full);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Distributables

test("client source and www/ contain no privileged key, default password or forbidden config", () => {
  const secretValues = scanner.localSecretValues(root);
  const targets = [
    "app.js", "index.html", "config.example.json", "service-worker.js", "sync-server.js",
    ...textFilesUnder(path.join(root, "src")).map((f) => path.relative(root, f)),
    ...textFilesUnder(path.join(root, "electron")).map((f) => path.relative(root, f)),
    ...textFilesUnder(path.join(root, "www")).map((f) => path.relative(root, f))
  ].filter((rel) => fs.existsSync(path.join(root, rel)));
  const findings = targets.flatMap((rel) => scanner.scanBuffer(rel, fs.readFileSync(path.join(root, rel)), { secretValues }));
  assert.deepEqual(findings, [], `secrets found: ${findings.map((f) => `${f.rule} ${f.file}`).join("; ")}`);
  assert.ok(targets.length > 50, "scanned the client tree");
});

test("scanner detects each kind of privileged secret without echoing it", () => {
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const serviceJwt = `${b64({ alg: "HS256" })}.${b64({ role: "service_role", iss: "supabase" })}.c2lnbmF0dXJlLXRlc3Q`;
  const anonJwt = `${b64({ alg: "HS256" })}.${b64({ role: "anon", iss: "supabase" })}.c2lnbmF0dXJlLXRlc3Q`;
  const fixtureDefault = "fixture-default-pw";
  const digest = crypto.createHash("sha256").update(fixtureDefault).digest("hex");
  const cases = [
    ["a.js", `const k = "${serviceJwt}";`, "privileged-jwt"],
    ["b.js", `const k = "sb_${"secret"}_abcdefghijklmnopqrstuvwx";`, "supabase-secret-key"],
    ["c.txt", `-----BEGIN ${"PRIVATE"} KEY-----`, "private-key"],
    ["config.json", JSON.stringify({ syncAccessKey: "x".repeat(40) }), "forbidden-config-key"],
    ["release.jks", "binary", "signing-material-file"],
    ["d.js", `const p = "${fixtureDefault}";`, "legacy-default-password"],
    ["e.bin", "prefix-live-secret-value-123-suffix", "known-secret-value"]
  ];
  for (const [file, body, rule] of cases) {
    const findings = scanner.scanBuffer(file, Buffer.from(body), {
      secretValues: [{ label: "config.json:syncAccessKey", value: "live-secret-value-123" }],
      legacyDigests: [digest]
    });
    assert.ok(findings.some((f) => f.rule === rule), `${rule} detected in ${file}`);
    for (const finding of findings) {
      assert.equal(JSON.stringify(finding).includes("live-secret-value-123"), false, "value is redacted");
      assert.equal(JSON.stringify(finding).includes(fixtureDefault), false, "value is redacted");
    }
  }
  assert.deepEqual(scanner.scanBuffer("ok.js", Buffer.from(`const anon = "${anonJwt}";`)), [], "public anon key is allowed");
  assert.equal(scanner.LEGACY_DEFAULT_PASSWORD_DIGESTS.length, 3);
});

test("only allowlisted public keys survive into the shipped config", () => {
  const raw = Object.fromEntries(CLIENT_FORBIDDEN_CONFIG_KEYS.map((key) => [key, "secret-value-123456"]));
  Object.assign(raw, { supabaseUrl: SUPABASE_URL, supabaseAnonKey: ANON, businessId: "biz-1", unexpected: "x" });
  const shipped = pickClientConfig(raw);
  assert.deepEqual(forbiddenClientConfigKeys(shipped), []);
  assert.deepEqual(Object.keys(shipped).sort(), ["businessId", "supabaseAnonKey", "supabaseUrl"]);
  for (const key of CLIENT_CONFIG_ALLOWED_KEYS) assert.doesNotMatch(key, /password|secret|service|token|accessKey/i);
  assert.deepEqual(forbiddenClientConfigKeys(JSON.parse(fs.readFileSync(path.join(root, "config.example.json"), "utf8"))), []);
  const prepare = fs.readFileSync(path.join(root, "scripts", "prepare-web.js"), "utf8");
  assert.match(prepare, /pickClientConfig/);
  assert.match(prepare, /Refusing to ship secrets/);
  assert.doesNotMatch(prepare, /copyFile\(configPath/);
});

test("password module no longer exposes default-password helpers", () => {
  for (const name of ["getDefaultKbaPassword", "getDefaultDeveloperPassword", "setDefaultKbaPassword", "readDefaultKbaPasswordFromConfig"]) {
    assert.equal(name in passwordModule, false, `${name} removed`);
  }
});

test("built-in system accounts carry no password and cannot sign in until one is set", async () => {
  assert.equal("password" in DEFAULT_SYSTEM_OWNER, false);
  assert.equal("password" in DEFAULT_SUPER_ADMIN, false);
  const state = { users: [], settings: {} };
  ensureDefaultSystemAccounts(state, { now: "2026-09-28T00:00:00.000Z" });
  assert.ok(state.users.length >= 2);
  assert.ok(state.users.every((user) => !user.passwordHash));
  assert.equal(hasUsableLocalLogin(state.users), false);
  for (const guess of ["", "1234", "password", "change-me"]) {
    assert.equal(await verifyPassword(guess, ""), false, "empty hash never verifies");
  }
  state.users[0].passwordHash = await hashPassword("Owner-chosen-9281");
  assert.equal(hasUsableLocalLogin(state.users), true);
});

// ---------------------------------------------------------------------------------------------
// Secrets never travel in snapshots and the legacy key leaves synced settings

test("cloud snapshots strip sync keys, tokens and webhook secrets", () => {
  const cleaned = sanitizeStateForCloud({
    settings: { businessName: "S", syncAccessKey: "legacy", syncToken: "tok", momoWebhookSecret: "hook" },
    users: []
  });
  assert.equal("syncAccessKey" in cleaned.settings, false);
  assert.equal("syncToken" in cleaned.settings, false);
  assert.equal("momoWebhookSecret" in cleaned.settings, false);
  assert.equal(cleaned.settings.businessName, "S");
});

test("a legacy access key moves from synced settings into a device-only slot", () => {
  const state = cloudState({ syncAccessKey: "legacy-device-key-0123456789abcdef" });
  captureLegacySyncKey(state);
  assert.equal("syncAccessKey" in state.settings, false);
  assert.equal(localStorage.getItem(LEGACY_SYNC_KEY_STORAGE), "legacy-device-key-0123456789abcdef");
});

test("offline queue uses a random per-device key and still opens items sealed with the legacy key", async () => {
  const fingerprint = "device-fp";
  const deviceKey = deviceQueueSecret(localStorage);
  assert.match(deviceKey, /^[0-9a-f]{64}$/);
  assert.equal(deviceQueueSecret(localStorage), deviceKey, "stable per device");
  const legacySealed = await encryptOfflinePayload({ amount: 5 }, { secret: "legacy-business-key", fingerprint });
  assert.deepEqual(await decryptOfflinePayload(legacySealed, { secret: [deviceKey, "legacy-business-key"], fingerprint }), { amount: 5 });
  const sealed = await encryptOfflinePayload({ amount: 7 }, { secret: [deviceKey, "legacy-business-key"], fingerprint });
  await assert.rejects(() => decryptOfflinePayload(sealed, { secret: "legacy-business-key", fingerprint }), "new items need the device key");
  assert.deepEqual(await decryptOfflinePayload(sealed, { secret: [deviceKey], fingerprint }), { amount: 7 });
});

// ---------------------------------------------------------------------------------------------
// Cloud snapshot sync is authorized by the user's session

function mockFetch(handler) {
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || "GET", headers: options.headers || {}, body: options.body });
    const { status = 200, body = [] } = handler(String(url), options) || {};
    return new Response(status === 204 ? null : JSON.stringify(body), { status });
  };
  return calls;
}

function storeSession(appUser = { id: "u-col", username: "ama", role: "Collector" }) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({
    access_token: "user-access-token",
    refresh_token: "user-refresh-token",
    expires_at: Date.now() + 3600_000,
    app_user: appUser
  }));
}

test("snapshot sync sends the user's session token and no shared access key", async () => {
  App.state = cloudState();
  App.syncBusy = false;
  storeSession();
  const calls = mockFetch((url, options) => {
    if ((options.method || "GET") === "PATCH") return { body: [{ id: 1 }] };
    return { body: [{ business_id: "biz-1", payload: { customers: [] }, saved_at: "2026-09-28T00:00:00Z" }] };
  });
  await latestCloudSnapshot();
  await pushCloudBackup(true);
  assert.ok(calls.length >= 2);
  for (const call of calls) {
    assert.equal(call.headers.Authorization, "Bearer user-access-token");
    assert.doesNotMatch(call.url, /access_key/);
    assert.doesNotMatch(String(call.body || ""), /access_key/);
  }
  assert.doesNotMatch(calls[0].url, /select=[^&]*access_key/);
});

test("without a session or legacy key the device refuses to touch cloud snapshots", async () => {
  App.state = cloudState();
  const calls = mockFetch(() => ({ body: [] }));
  await assert.rejects(() => latestCloudSnapshot(), /Sign in online/);
  assert.equal(calls.length, 0);
});

test("pre-cutover devices holding the legacy key use it only as a filter with the anon key", async () => {
  App.state = cloudState();
  localStorage.setItem(LEGACY_SYNC_KEY_STORAGE, "legacy-device-key-0123456789abcdef");
  const calls = mockFetch(() => ({ body: [] }));
  await latestCloudSnapshot();
  assert.equal(calls[0].headers.Authorization, `Bearer ${ANON}`);
  assert.match(calls[0].url, /access_key=eq\./);
});

// ---------------------------------------------------------------------------------------------
// Staff login: client

test("staff cloud login stores only per-user session material", async () => {
  const state = cloudState();
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({
      access_token: "user-access-token",
      refresh_token: "user-refresh-token",
      expires_in: 3600,
      app_user: { id: "u-col", username: "ama", role: "Collector" }
    }), { status: 200 });
  };
  const result = await staffCloudLogin(state, { username: "Ama", password: "pw-123456", mfaCode: "" }, { fetchImpl });
  assert.equal(result.ok, true);
  assert.equal(calls[0].url, `${SUPABASE_URL}/functions/v1/staff-login`);
  assert.equal(calls[0].options.headers.apikey, ANON);
  assert.deepEqual(Object.keys(JSON.parse(calls[0].options.body)).sort(), ["business_code", "mfa_code", "password", "username"]);
  const stored = JSON.parse(localStorage.getItem(SESSION_KEY));
  assert.equal(stored.access_token, "user-access-token");
  assert.equal(stored.refresh_token, "user-refresh-token");
  assert.equal(hasStaffCloudSession("u-col"), true);
  assert.equal(hasStaffCloudSession("someone-else"), false);
});

test("staff cloud login distinguishes denied, MFA, offline and not-yet-deployed", async () => {
  const state = cloudState();
  const respond = (status, body) => async () => new Response(JSON.stringify(body), { status });
  const denied = await staffCloudLogin(state, { username: "a", password: "b" }, { fetchImpl: respond(401, { error: "Invalid login or inactive account." }) });
  assert.equal(denied.denied, true);
  const mfa = await staffCloudLogin(state, { username: "a", password: "b" }, { fetchImpl: respond(401, { error: "Enter your MFA code.", mfa_required: true }) });
  assert.equal(mfa.mfaRequired, true);
  const limited = await staffCloudLogin(state, { username: "a", password: "b" }, { fetchImpl: respond(429, { error: "Too many" }) });
  assert.equal(limited.denied, true);
  assert.equal(limited.status, 429);
  const missing = await staffCloudLogin(state, { username: "a", password: "b" }, { fetchImpl: respond(404, {}) });
  assert.equal(missing.unavailable, true);
  const offline = await staffCloudLogin(state, { username: "a", password: "b" }, { fetchImpl: async () => { throw new TypeError("fetch failed"); } });
  assert.equal(offline.offline, true);
  assert.equal(localStorage.getItem(SESSION_KEY), null, "no session stored on failure");
});

// ---------------------------------------------------------------------------------------------
// Staff login: server rules and Edge Function

test("server credential checks match the app's rules", async () => {
  const hash = await hashPassword("Correct-horse-42");
  const user = { id: "u1", username: "ama", role: "Collector", active: true, passwordHash: hash };
  assert.equal(await verifyPasswordHash("Correct-horse-42", hash), true);
  assert.equal(await verifyPasswordHash("wrong", hash), false);
  assert.equal(await verifyPasswordHash("anything", ""), false);
  assert.equal((await evaluateStaffLogin({ user, password: "Correct-horse-42" })).ok, true);
  assert.equal((await evaluateStaffLogin({ user, password: "nope" })).reason, "bad_password");

  const payload = {
    settings: {},
    users: [
      user,
      { id: "u2", username: "gone", active: false, passwordHash: hash },
      { id: "u3", username: "dev", role: "Developer", active: true, passwordHash: hash },
      { id: "u4", username: "del", active: true, passwordHash: hash, updatedAt: "2026-01-01" }
    ],
    deletedUsers: [{ userId: "u4", deletedAt: "2026-02-01" }]
  };
  assert.equal(findStaffUser(payload, "ama")?.id, "u1");
  assert.equal(findStaffUser(payload, "gone"), null, "inactive");
  assert.equal(findStaffUser(payload, "dev"), null, "developer login off by default");
  assert.equal(findStaffUser(payload, "del"), null, "tombstoned");

  const secret = generateTotpSecret();
  const owner = { id: "o1", username: "john", role: "SystemOwner", active: true, passwordHash: hash, mfaEnabled: true, mfaSecret: secret };
  const needCode = await evaluateStaffLogin({ user: owner, password: "Correct-horse-42" });
  assert.equal(needCode.mfaRequired, true);
  const now = Date.now();
  const code = await generateTotpCode(secret, { now });
  assert.equal(await verifyTotp(secret, code, { now }), true);
  assert.equal((await evaluateStaffLogin({ user: owner, password: "Correct-horse-42", mfaCode: code, now })).ok, true);
  assert.equal((await evaluateStaffLogin({ user: owner, password: "Correct-horse-42", mfaCode: "000000", now })).ok, false);
});

function fakeSupabase({ users, failures = 0, links = [] }) {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    const method = options.method || "GET";
    calls.push({ url, method, headers: options.headers || {}, body: options.body ? JSON.parse(options.body) : null });
    const reply = (status, body) => new Response(body == null ? "" : JSON.stringify(body), { status });
    if (url.includes("/rest/v1/st_staff_login_attempts")) {
      return method === "GET" ? reply(200, Array.from({ length: failures }, (_, i) => ({ id: i }))) : reply(201, null);
    }
    if (url.includes("/rest/v1/smile_trust_cloud_snapshots")) return reply(200, [{ payload: { settings: {}, users } }]);
    if (url.includes("/rest/v1/st_staff_auth_links")) return method === "GET" ? reply(200, links) : reply(201, null);
    if (url.includes("/rest/v1/businesses")) return reply(200, []);
    if (url.endsWith("/auth/v1/admin/users") && method === "POST") return reply(200, { id: "auth-new", email: calls.at(-1).body.email });
    if (url.includes("/auth/v1/admin/users/") && method === "PUT") return reply(200, { id: "auth-old", email: "x@staff.smile-trust.invalid" });
    if (url.includes("/auth/v1/token")) {
      return reply(200, { access_token: "user-access-token", refresh_token: "user-refresh-token", expires_in: 3600, token_type: "bearer" });
    }
    return reply(404, {});
  };
  return { calls, fetchImpl };
}

const loginRequest = (body) => new Request("https://fn.local/staff-login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ business_code: "biz-1", ...body })
});
const env = { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: SERVICE, SUPABASE_ANON_KEY: ANON };

test("staff-login issues a per-user session with server-set business claims and never returns the service key", async () => {
  const hash = await hashPassword("Correct-horse-42");
  const fake = fakeSupabase({ users: [{ id: "u-col", username: "Ama", role: "Collector", active: true, passwordHash: hash }] });
  const handler = createStaffLoginHandler({ env, fetchImpl: fake.fetchImpl });
  const response = await handler(loginRequest({ username: "ama", password: "Correct-horse-42" }));
  const text = await response.text();
  assert.equal(response.status, 200);
  assert.equal(text.includes(SERVICE), false, "service key never in the response");
  const body = JSON.parse(text);
  assert.equal(body.access_token, "user-access-token");
  assert.deepEqual(body.app_user, { id: "u-col", username: "Ama", role: "Collector" });
  const created = fake.calls.find((c) => c.url.endsWith("/auth/v1/admin/users"));
  assert.deepEqual(created.body.app_metadata, { business_code: "biz-1", app_user_id: "u-col", app_role: "Collector" });
  assert.equal(created.body.user_metadata, undefined, "claims are not user-editable metadata");
  const token = fake.calls.find((c) => c.url.includes("/auth/v1/token"));
  assert.equal(token.headers.apikey, ANON, "session issued with the anon key");
  assert.equal(token.headers.Authorization, undefined);
  for (const call of fake.calls) {
    assert.ok(call.url.startsWith(SUPABASE_URL), "service key only sent to the project");
  }
});

test("staff-login rejects wrong passwords, inactive users and brute force without creating sessions", async () => {
  const hash = await hashPassword("Correct-horse-42");
  const users = [
    { id: "u-col", username: "ama", role: "Collector", active: true, passwordHash: hash },
    { id: "u-old", username: "kofi", role: "Collector", active: false, passwordHash: hash }
  ];
  const wrong = fakeSupabase({ users });
  const r1 = await createStaffLoginHandler({ env, fetchImpl: wrong.fetchImpl })(loginRequest({ username: "ama", password: "nope" }));
  assert.equal(r1.status, 401);
  assert.equal(wrong.calls.some((c) => c.url.includes("/auth/v1/")), false);
  assert.ok(wrong.calls.some((c) => c.method === "POST" && c.body?.succeeded === false), "failure recorded");

  const inactive = fakeSupabase({ users, links: [{ auth_user_id: "auth-old" }] });
  const r2 = await createStaffLoginHandler({ env, fetchImpl: inactive.fetchImpl })(loginRequest({ username: "kofi", password: "Correct-horse-42" }));
  assert.equal(r2.status, 401);
  const ban = inactive.calls.find((c) => c.method === "PUT");
  assert.ok(ban?.body?.ban_duration && ban.body.ban_duration !== "none", "deactivated user's cloud account is banned");
  assert.equal(inactive.calls.some((c) => c.url.includes("/auth/v1/token")), false);

  const limited = fakeSupabase({ users, failures: 5 });
  const r3 = await createStaffLoginHandler({ env, fetchImpl: limited.fetchImpl })(loginRequest({ username: "ama", password: "Correct-horse-42" }));
  assert.equal(r3.status, 429);
  assert.equal(limited.calls.some((c) => c.url.includes("/auth/v1/")), false);

  const bad = fakeSupabase({ users });
  const r4 = await createStaffLoginHandler({ env, fetchImpl: bad.fetchImpl })(loginRequest({ business_code: "bad code!", username: "ama", password: "x" }));
  assert.equal(r4.status, 400);
  const r5 = await createStaffLoginHandler({ env: { SUPABASE_URL }, fetchImpl: bad.fetchImpl })(loginRequest({ username: "ama", password: "x" }));
  assert.equal(r5.status, 500, "refuses to run without server-side keys");
});

test("staff-login ships only in the server function, never in the client bundle", () => {
  const index = fs.readFileSync(path.join(root, "supabase/functions/staff-login/index.ts"), "utf8");
  assert.match(index, /Deno\.env/);
  const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
  assert.doesNotMatch(app, /SERVICE_ROLE/);
  assert.equal(fs.existsSync(path.join(root, "www/supabase")), false);
});

// ---------------------------------------------------------------------------------------------
// Member portal: server-verified, member-scoped

test("portal login goes to the server RPC and keeps only a member session token", async () => {
  const state = cloudState();
  const calls = [];
  const bundle = { customer: { id: "c1", name: "Ama" }, collections: [{ id: "col-1", customerId: "c1", amount: 50 }] };
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ ok: true, token: "a".repeat(64), expires_at: "2026-09-28T01:00:00Z", bundle }), { status: 200 });
  };
  const result = await portal.portalServerLogin(state, "c13000001", "4567", { fetchImpl });
  assert.equal(result.ok, true);
  assert.equal(calls[0].url, `${SUPABASE_URL}/rest/v1/rpc/portal_login`);
  assert.equal(calls[0].options.headers.apikey, ANON);
  const stored = portal.storedPortalSession();
  assert.equal(stored.token, "a".repeat(64));
  assert.equal(localStorage.getItem(portal.PORTAL_SESSION_KEY), null, "portal session is not persisted across app restarts");
  const view = portal.portalStateFromBundle(stored.bundle);
  assert.deepEqual(view.customers.map((c) => c.id), ["c1"]);
  assert.equal("users" in view, false, "no staff data in the member view");
  portal.clearPortalSession();
  assert.equal(portal.storedPortalSession(), null);
});

test("portal requests are imported once with a fixed id and marked ingested only when asked", async () => {
  App.state = cloudState();
  storeSession();
  const state = { ...cloudState(), customers: [{ id: "c1", name: "Ama" }], withdrawalRequests: [{ id: "wdr-portal-r-old" }] };
  const calls = mockFetch((url) => {
    if (url.endsWith("rpc/portal_pending_requests")) {
      return { body: [
        { id: "r-old", customer_id: "c1", amount_pesewas: 1000 },
        { id: "r-new", customer_id: "c1", amount_pesewas: 2500 },
        { id: "r-stranger", customer_id: "c-unknown", amount_pesewas: 100 }
      ] };
    }
    return { body: { ingested: 2 } };
  });
  const created = [];
  const result = await portal.ingestPortalRequests(state, (row, id) => {
    created.push(id);
    return { request: { id } };
  });
  assert.deepEqual(created, ["wdr-portal-r-new"], "existing request is not duplicated; unknown member skipped");
  assert.deepEqual(result.ids.sort(), ["r-new", "r-old"]);
  assert.equal(calls.some((c) => c.url.includes("portal_mark_requests_ingested")), false, "not marked during import");
  assert.equal(calls[0].headers.Authorization, "Bearer user-access-token");
  await portal.markPortalRequestsIngested(state, result.ids);
  assert.ok(calls.some((c) => c.url.endsWith("rpc/portal_mark_requests_ingested")));
});
