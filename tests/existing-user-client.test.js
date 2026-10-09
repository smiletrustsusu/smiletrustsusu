/**
 * Client side of adopting the live project's existing staff: identity adoption on the device,
 * publishable-key headers, activation requests, the post-switch sync hold, the build-time backend
 * config check and the artifact backend scan.
 */
import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const memory = new Map();
const storage = {
  getItem: (key) => (memory.has(key) ? memory.get(key) : null),
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: (key) => memory.delete(key)
};
globalThis.localStorage = storage;
globalThis.sessionStorage = storage;
globalThis.document ??= { querySelector: () => null };

const { adoptCloudVerifiedUser } = await import("../src/core/cloud-user-adoption.js");
const { supabaseKeyHeaders } = await import("../src/sync/supabase-headers.js");
const { staffCloudActivate } = await import("../src/sync/staff-session.js");
const { restFetch } = await import("../src/sync/supabase-rest.js");
const { SESSION_KEY } = await import("../src/sync/supabase-auth.js");
const { BACKEND_SYNC_HOLD_KEY, backendSyncHeld, backendTransitionNotice, enforceBackendIdentity } = await import("../src/core/backend-guard.js");
const { clientBackendConfigProblems, supabaseProjectRef } = await import("../src/config.js");
const require = createRequire(import.meta.url);
const scanner = require("../scripts/lib/client-secret-scan.js");

const URL_A = "https://aaaaaaaaaaaaaaaaaaaa.supabase.co";
const REF_A = "aaaaaaaaaaaaaaaaaaaa";
const REF_B = "bbbbbbbbbbbbbbbbbbbb";
const state = () => ({ settings: { cloudUrl: URL_A, cloudKey: "sb_publishable_test", businessId: "SMILE-TRUST" }, users: [] });
const fakeJwt = (claims) => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.c2lnbmF0dXJlLXZhbHVl`;

beforeEach(() => memory.clear());

test("a clean device's placeholder owner becomes the live JOHN instead of a second owner", () => {
  const users = [
    { id: "u-owner", username: "JOHN", role: "SystemOwner", systemOwner: true, passwordHash: "", mustChangePassword: true, active: true },
    { id: "u-developer", username: "KBA", role: "KBA", passwordHash: "" },
    { id: "demo-user-ama", username: "ama", role: "Admin", active: true }
  ];
  const result = adoptCloudVerifiedUser(users, { id: "demo-user-john", username: "john", role: "SystemOwner" }, { username: "john", passwordHash: "pbkdf2:1:aa:bb", now: "2026-09-30T00:00:00.000Z" });
  assert.equal(result.ok, true);
  assert.equal(result.user.id, "demo-user-john", "the device uses the server identity");
  assert.equal(result.user.passwordHash, "pbkdf2:1:aa:bb");
  assert.equal(result.user.mustChangePassword, false);
  assert.equal(result.users.filter((user) => user.username.toLowerCase() === "john").length, 1, "exactly one JOHN");
  assert.equal(result.users.filter((user) => user.systemOwner).length, 1, "exactly one system owner");
  assert.ok(result.users.some((user) => user.id === "demo-user-ama"));
});

test("a loaded server record is updated in place, duplicates dropped, real local accounts never overwritten", () => {
  const byId = [
    { id: "u-owner", username: "JOHN", passwordHash: "" },
    { id: "demo-user-john", username: "john", role: "SystemOwner", systemOwner: true }
  ];
  const adopted = adoptCloudVerifiedUser(byId, { id: "demo-user-john", role: "SystemOwner" }, { username: "john", passwordHash: "pbkdf2:1:cc:dd" });
  assert.equal(adopted.ok, true);
  assert.deepEqual(adopted.users.map((user) => user.id), ["demo-user-john"]);

  const conflict = adoptCloudVerifiedUser(
    [{ id: "u-local", username: "kwame", passwordHash: "pbkdf2:1:ee:ff" }],
    { id: "demo-user-kwame", role: "Collector" },
    { username: "kwame", passwordHash: "pbkdf2:1:11:22" }
  );
  assert.deepEqual(conflict, { ok: false, reason: "conflict" });
  const missing = adoptCloudVerifiedUser([], { id: "demo-user-ama" }, { username: "ama", passwordHash: "pbkdf2:1:11:22" });
  assert.deepEqual(missing, { ok: false, reason: "missing" }, "no account is invented when the server data did not load");
});

test("publishable keys go only in apikey; legacy anon keys and user tokens keep the bearer header", () => {
  assert.deepEqual(supabaseKeyHeaders("sb_publishable_x"), { apikey: "sb_publishable_x", "x-smile-write-protocol": "048-v1", "Content-Type": "application/json" });
  assert.equal(supabaseKeyHeaders("sb_publishable_x", { bearer: "user-jwt" }).Authorization, "Bearer user-jwt");
  const legacy = fakeJwt({ role: "anon", ref: REF_A });
  assert.equal(supabaseKeyHeaders(legacy).Authorization, `Bearer ${legacy}`);
});

test("activation posts the code and new password to staff-login and starts sync on success", async () => {
  storage.setItem(BACKEND_SYNC_HOLD_KEY, JSON.stringify({ host: "aaaaaaaaaaaaaaaaaaaa.supabase.co" }));
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ access_token: "a", refresh_token: "r", expires_in: 3600, app_user: { id: "demo-user-john", username: "john", role: "SystemOwner" } }), { status: 200 });
  };
  const result = await staffCloudActivate(state(), { username: " John ", activationCode: "ABCD-EFGH-JKLM", newPassword: "Owner-chosen-9" }, { fetchImpl });
  assert.equal(result.ok, true);
  assert.equal(calls[0].url, `${URL_A}/functions/v1/staff-login`);
  assert.equal(calls[0].options.headers.Authorization, undefined, "publishable key is not sent as a bearer token");
  const body = JSON.parse(calls[0].options.body);
  assert.deepEqual(body, { business_code: "SMILE-TRUST", action: "activate", username: "John", activation_code: "ABCD-EFGH-JKLM", new_password: "Owner-chosen-9", mfa_code: "" });
  assert.equal(backendSyncHeld(storage), false, "a real staff session releases the sync hold");
  assert.ok(storage.getItem(SESSION_KEY));

  storage.setItem(BACKEND_SYNC_HOLD_KEY, "{}");
  const denied = await staffCloudActivate(state(), { username: "john", activationCode: "x", newPassword: "y" }, {
    fetchImpl: async () => new Response(JSON.stringify({ error: "Activation code is invalid or has expired." }), { status: 401 })
  });
  assert.equal(denied.denied, true);
  assert.equal(backendSyncHeld(storage), true, "a failed activation keeps sync on hold");
});

test("while sync is held, no database call leaves the device without a staff session", async () => {
  const original = globalThis.fetch;
  const seen = [];
  globalThis.fetch = async (url, options) => {
    seen.push({ url, options });
    return new Response("[]", { status: 200 });
  };
  try {
    storage.setItem(BACKEND_SYNC_HOLD_KEY, "{}");
    await assert.rejects(restFetch(state(), "rpc/fetch_business_snapshot", { method: "POST", body: {} }), /Sign in online/);
    assert.equal(seen.length, 0);
    storage.setItem(SESSION_KEY, JSON.stringify({ access_token: "user-jwt", refresh_token: "r", expires_at: Date.now() + 3600000 }));
    await restFetch(state(), "rpc/fetch_business_snapshot", { method: "POST", body: {} });
    assert.equal(seen.length, 1);
    assert.equal(seen[0].options.headers.Authorization, "Bearer user-jwt");
  } finally {
    globalThis.fetch = original;
  }
});

test("switching backend holds sync and tells the login screen what happened", () => {
  const OLD = "https://cccccccccccccccccccc.supabase.co";
  storage.setItem("smile_trust_susu_v1", JSON.stringify({ settings: { cloudUrl: OLD, businessId: "st-old" }, customers: [{ id: "c1" }] }));
  storage.setItem("smile_trust_susu_sync_url", OLD);
  const result = enforceBackendIdentity({ storage, config: { supabaseUrl: URL_A, businessId: "SMILE-TRUST" }, now: "2026-09-30T00:00:00.000Z" });
  assert.equal(result.quarantined, true);
  assert.equal(result.held, true);
  const notice = backendTransitionNotice(storage);
  assert.equal(notice.to.host, "aaaaaaaaaaaaaaaaaaaa.supabase.co");
  assert.equal(notice.to.businessId, "SMILE-TRUST");
  assert.equal(notice.from.host, "cccccccccccccccccccc.supabase.co");

  memory.clear();
  const fresh = enforceBackendIdentity({ storage, config: { supabaseUrl: URL_A, businessId: "SMILE-TRUST" } });
  assert.equal(fresh.held, true, "a brand-new device also waits for an online sign-in");

  memory.clear();
  storage.setItem("smile_trust_susu_v1", JSON.stringify({ settings: { cloudUrl: URL_A, businessId: "SMILE-TRUST" } }));
  const same = enforceBackendIdentity({ storage, config: { supabaseUrl: URL_A, businessId: "SMILE-TRUST" } });
  assert.equal(same.held, false, "a device already on this backend keeps syncing");
});

test("the build refuses a key from another project or a secret key", () => {
  assert.equal(supabaseProjectRef(URL_A), REF_A);
  const ok = clientBackendConfigProblems({ supabaseUrl: URL_A, supabaseAnonKey: "sb_publishable_abc", businessId: "SMILE-TRUST" });
  assert.deepEqual(ok, { problems: [], warnings: [] });
  const mismatch = clientBackendConfigProblems({ supabaseUrl: URL_A, supabaseAnonKey: fakeJwt({ role: "anon", ref: REF_B }), businessId: "SMILE-TRUST" });
  assert.match(mismatch.problems.join(), new RegExp(`belongs to project ${REF_B}`));
  const secret = clientBackendConfigProblems({ supabaseUrl: URL_A, supabaseAnonKey: "sb_secret_abc", businessId: "x" });
  assert.match(secret.problems.join(), /secret key/);
  const service = clientBackendConfigProblems({ supabaseUrl: URL_A, supabaseAnonKey: fakeJwt({ role: "service_role", ref: REF_A }), businessId: "x" });
  assert.match(service.problems.join(), /only the anon key/);
  const noKey = clientBackendConfigProblems({ supabaseUrl: URL_A, supabaseAnonKey: "", businessId: "SMILE-TRUST" });
  assert.deepEqual(noKey.problems, []);
  assert.match(noKey.warnings.join(), /cloud sign-in and sync are off/);
});

test("the artifact scan reports every Supabase project and fails on any but the expected one", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "st-backend-scan-"));
  try {
    fs.writeFileSync(path.join(dir, "config.json"), JSON.stringify({ supabaseUrl: URL_A, supabaseAnonKey: "sb_publishable_abc" }));
    fs.writeFileSync(path.join(dir, "app.js"), `const x = "${URL_A}/rest/v1";`);
    const clean = scanner.scanDirectory(dir, { expectBackend: REF_A });
    assert.deepEqual(clean.findings, []);
    assert.deepEqual(clean.backends.map((item) => item.ref), [REF_A]);

    fs.writeFileSync(path.join(dir, "old.js"), `const key = "${fakeJwt({ role: "anon", ref: REF_B })}";`);
    const stale = scanner.scanDirectory(dir, { expectBackend: REF_A });
    assert.deepEqual(stale.findings.map((item) => [item.rule, item.file]), [["unexpected-backend", "old.js"]]);

    const wrongConfig = scanner.scanDirectory(dir, { expectBackend: REF_B });
    assert.ok(wrongConfig.findings.some((item) => item.rule === "expected-backend-missing"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
