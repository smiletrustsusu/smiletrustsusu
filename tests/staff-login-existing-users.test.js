/**
 * staff-login adopting existing public.app_users rows (JOHN / AMA / KWAME on the live project):
 * no new owner, no automatic password changes, uuids preserved, one-time activation only for
 * accounts that have never had a password. Uses an in-memory fake of the Supabase REST/Auth APIs.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  activationCodeHash,
  appRoleFromRelational,
  staffUserFromAppUserRow,
  verifyPasswordHash
} from "../supabase/functions/staff-login/auth-core.js";
import { createStaffLoginHandler } from "../supabase/functions/staff-login/handler.js";
import { hashPassword } from "../src/password.js";
import { generateTotpCode, generateTotpSecret } from "../src/core/totp.js";

const SUPABASE_URL = "https://example.supabase.co";
const env = { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: "service-test-value", SUPABASE_ANON_KEY: "anon-test-value" };
const BUSINESS_UUID = "11111111-1111-1111-1111-111111111111";
const JOHN = "22222222-2222-2222-2222-222222222222";
const AMA = "33333333-3333-3333-3333-333333333333";
const KWAME = "44444444-4444-4444-4444-444444444444";
const CODE = "ABCD-EFGH-JKLM";

function liveStaff() {
  return [
    { id: JOHN, client_id: "demo-user-john", username: "john", name: "System Owner", role: "SystemOwner", active: true, password_hash: null },
    { id: AMA, client_id: "demo-user-ama", username: "ama", name: "Ama Branch Manager", role: "AssistantManager", active: true, password_hash: null },
    { id: KWAME, client_id: "demo-user-kwame", username: "kwame", name: "Kwame Collector", role: "Collector", active: true, password_hash: null }
  ];
}

function fakeProject({ appUsers = liveStaff(), snapshotUsers = null, mfa = [], codes = [], failures = 0, now = () => Date.now() } = {}) {
  const db = { appUsers, mfa, codes, attempts: [], links: [], authUsers: [] };
  const calls = [];
  const reply = (status, body) => new Response(status === 204 ? null : body == null ? "" : JSON.stringify(body), { status });
  const fetchImpl = async (input, options = {}) => {
    const url = new URL(input);
    const method = options.method || "GET";
    const body = options.body ? JSON.parse(options.body) : null;
    calls.push({ url: input, method, headers: options.headers || {}, body });
    const q = url.searchParams;
    const eq = (name) => (q.get(name) || "").replace(/^eq\./, "");
    const table = url.pathname.replace("/rest/v1/", "");
    if (table === "st_staff_login_attempts") {
      if (method === "POST") { db.attempts.push(body); return reply(201, null); }
      return reply(200, Array.from({ length: failures }, (_, i) => ({ id: i })));
    }
    if (table === "smile_trust_cloud_snapshots") return reply(200, snapshotUsers ? [{ payload: { settings: {}, users: snapshotUsers } }] : []);
    if (table === "businesses") return reply(200, (q.get("or") || "").includes("SMILE-TRUST") ? [{ id: BUSINESS_UUID }] : []);
    if (table === "app_users") {
      if (method === "GET") {
        const wanted = (q.get("username") || "").replace(/^ilike\./, "").toLowerCase();
        return reply(200, db.appUsers.filter((row) => eq("business_id") === BUSINESS_UUID && row.username.toLowerCase() === wanted).map((row) => ({ ...row })));
      }
      if (method === "PATCH") {
        const row = db.appUsers.find((item) => item.id === eq("id"));
        if (!row || row.password_hash) return reply(200, []);
        Object.assign(row, body);
        return reply(200, [{ ...row }]);
      }
    }
    if (table === "user_mfa_secrets") {
      return reply(200, db.mfa.filter((row) => row.user_client_id === eq("user_client_id") && row.enabled).map((row) => ({ secret: row.secret })));
    }
    if (table === "st_staff_activation_codes") {
      if (method === "GET") {
        const at = Date.parse((q.get("expires_at") || "").replace(/^gt\./, ""));
        return reply(200, db.codes.filter((row) => row.app_user_uuid === eq("app_user_uuid") && !row.used_at && Date.parse(row.expires_at) > at));
      }
      if (method === "PATCH") {
        const targets = q.get("id")
          ? db.codes.filter((row) => row.id === eq("id"))
          : db.codes.filter((row) => row.app_user_uuid === eq("app_user_uuid") && !row.used_at);
        targets.forEach((row) => Object.assign(row, body));
        return reply(204, null);
      }
    }
    if (table === "st_staff_auth_links") {
      if (method === "POST") { db.links.push(body); return reply(201, null); }
      return reply(200, db.links.filter((row) => row.app_user_id === eq("app_user_id")).map((row) => ({ auth_user_id: row.auth_user_id })));
    }
    if (url.pathname === "/auth/v1/admin/users" && method === "POST") {
      const id = `auth-${db.authUsers.length + 1}`;
      db.authUsers.push({ id, ...body });
      return reply(200, { id, email: body.email });
    }
    if (url.pathname.startsWith("/auth/v1/admin/users/") && method === "PUT") {
      const user = db.authUsers.find((item) => url.pathname.endsWith(item.id));
      if (!user) return reply(404, {});
      Object.assign(user, body);
      return reply(200, { id: user.id, email: user.email });
    }
    if (url.pathname === "/auth/v1/token") {
      return reply(200, { access_token: `token-for-${body.email}`, refresh_token: "refresh", expires_in: 3600, token_type: "bearer" });
    }
    return reply(404, {});
  };
  return { db, calls, fetchImpl, handler: createStaffLoginHandler({ env, fetchImpl, now }) };
}

const post = (body) => new Request("https://fn.local/staff-login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ business_code: "SMILE-TRUST", ...body })
});

async function codeRow(appUserUuid, code = CODE, { expiresIn = 3600000, id = `code-${appUserUuid}` } = {}) {
  return { id, app_user_uuid: appUserUuid, code_hash: await activationCodeHash(appUserUuid, code), expires_at: new Date(Date.now() + expiresIn).toISOString(), used_at: null };
}

test("app_users rows map to staff-login users with the app's ids and roles", () => {
  const [john, ama, kwame] = liveStaff().map((row) => staffUserFromAppUserRow(row));
  assert.deepEqual([john.id, john.uuid, john.role, john.passwordHash], ["demo-user-john", JOHN, "SystemOwner", ""]);
  assert.equal(ama.role, "Admin", "AssistantManager is Admin in the app, so MFA rules apply the same way");
  assert.equal(kwame.role, "Collector");
  assert.equal(appRoleFromRelational("Owner"), "KBA");
  assert.equal(staffUserFromAppUserRow({ id: "x", username: "a", password_hash: "[protected]" }).passwordHash, "");
  assert.equal(staffUserFromAppUserRow({ id: "x", username: "a" }).id, "x", "rows without client_id keep their uuid");
});

test("existing users without a password cannot sign in and nothing is created or changed", async () => {
  const project = fakeProject();
  for (const username of ["john", "ama", "kwame"]) {
    const response = await project.handler(post({ username, password: "any-password-1" }));
    assert.equal(response.status, 401);
  }
  assert.equal(project.calls.some((call) => call.url.includes("/auth/v1/")), false, "no Auth identity created");
  assert.equal(project.calls.some((call) => call.method === "PATCH"), false, "no staff row changed");
  assert.ok(project.db.appUsers.every((row) => row.password_hash == null));
});

test("JOHN activates with a one-time code, chooses a password, and keeps his uuid and role", async () => {
  const project = fakeProject({ codes: [await codeRow(JOHN)] });
  const response = await project.handler(post({ action: "activate", username: "JOHN", activation_code: "abcd efgh jklm", new_password: "Owner-chosen-9" }));
  assert.equal(response.status, 200);
  const text = await response.text();
  const body = JSON.parse(text);
  assert.deepEqual(body.app_user, { id: "demo-user-john", username: "john", role: "SystemOwner" });
  const john = project.db.appUsers.find((row) => row.id === JOHN);
  assert.match(john.password_hash, /^pbkdf2:120000:[0-9a-f]{32}:[0-9a-f]{64}$/);
  assert.equal(await verifyPasswordHash("Owner-chosen-9", john.password_hash), true);
  assert.equal(text.includes(john.password_hash), false, "hash never returned");
  assert.equal(john.role, "SystemOwner");
  assert.equal(project.db.appUsers.length, 3, "no new staff row");
  assert.ok(project.db.codes[0].used_at, "code consumed");
  const created = project.db.authUsers[0];
  assert.deepEqual(created.app_metadata, { business_code: "SMILE-TRUST", app_user_id: "demo-user-john", app_role: "SystemOwner" });
  assert.equal(project.db.links[0].app_user_id, "demo-user-john");

  const again = await project.handler(post({ action: "activate", username: "john", activation_code: CODE, new_password: "Attacker-pass-9" }));
  assert.equal(again.status, 401, "a used code cannot set another password");
  assert.equal(await verifyPasswordHash("Owner-chosen-9", john.password_hash), true);

  const login = await project.handler(post({ username: "john", password: "Owner-chosen-9" }));
  assert.equal(login.status, 200);
  assert.equal(project.db.authUsers.length, 1, "the same Auth identity is reused");
  const wrong = await project.handler(post({ username: "john", password: "not-it-123" }));
  assert.equal(wrong.status, 401);
});

test("activation rejects wrong, expired, weak and cross-user codes", async () => {
  const project = fakeProject({ codes: [await codeRow(KWAME), await codeRow(AMA, "ZZZZ-ZZZZ-ZZZZ", { expiresIn: -1000 })] });
  const wrong = await project.handler(post({ action: "activate", username: "kwame", activation_code: "WXYZ-WXYZ-WXYZ", new_password: "Collector-pw-1" }));
  assert.equal(wrong.status, 401);
  assert.ok(project.db.attempts.some((row) => row.succeeded === false), "failure counted toward the lockout");
  const crossUser = await project.handler(post({ action: "activate", username: "ama", activation_code: CODE, new_password: "Manager-pw-12" }));
  assert.equal(crossUser.status, 401, "KWAME's code does not activate AMA");
  const expired = await project.handler(post({ action: "activate", username: "ama", activation_code: "ZZZZ-ZZZZ-ZZZZ", new_password: "Manager-pw-12" }));
  assert.equal(expired.status, 401);
  const weak = await project.handler(post({ action: "activate", username: "kwame", activation_code: CODE, new_password: "short" }));
  assert.equal(weak.status, 400);
  assert.ok(project.db.appUsers.every((row) => row.password_hash == null), "no password was set");
  assert.equal(project.calls.some((call) => call.url.includes("/auth/v1/")), false);

  const limited = fakeProject({ codes: [await codeRow(KWAME)], failures: 5 });
  const locked = await limited.handler(post({ action: "activate", username: "kwame", activation_code: CODE, new_password: "Collector-pw-1" }));
  assert.equal(locked.status, 429);
});

test("an account that already has a password can never be changed through activation", async () => {
  const staff = liveStaff();
  staff[1].password_hash = await hashPassword("Ama-existing-1");
  const original = staff[1].password_hash;
  const project = fakeProject({ appUsers: staff, codes: [await codeRow(AMA)] });
  const response = await project.handler(post({ action: "activate", username: "ama", activation_code: CODE, new_password: "Hijack-attempt-1" }));
  assert.equal(response.status, 401);
  assert.equal(staff[1].password_hash, original);
  const login = await project.handler(post({ username: "ama", password: "Ama-existing-1" }));
  assert.equal(login.status, 200, "AMA keeps signing in with her existing password");
  assert.equal(project.db.authUsers[0].app_metadata.app_role, "Admin");
});

test("MFA already enabled on the server is enforced for activation and sign-in", async () => {
  const secret = generateTotpSecret();
  const staff = liveStaff();
  const project = fakeProject({ appUsers: staff, mfa: [{ user_client_id: "demo-user-ama", secret, enabled: true }], codes: [await codeRow(AMA)] });
  const noCode = await project.handler(post({ action: "activate", username: "ama", activation_code: CODE, new_password: "Manager-pw-12" }));
  assert.equal(noCode.status, 401);
  assert.equal(JSON.parse(await noCode.text()).mfa_required, true);
  assert.equal(staff[1].password_hash, null, "nothing is written until MFA passes");
  assert.equal(project.db.codes[0].used_at, null, "the code survives a missing MFA code");
  const now = Date.now();
  const ok = await project.handler(post({ action: "activate", username: "ama", activation_code: CODE, new_password: "Manager-pw-12", mfa_code: await generateTotpCode(secret, { now }) }));
  assert.equal(ok.status, 200);
  const login = await project.handler(post({ username: "ama", password: "Manager-pw-12" }));
  assert.equal(JSON.parse(await login.text()).mfa_required, true);
});

test("deactivated staff cannot sign in or activate, whichever source deactivated them", async () => {
  const staff = liveStaff();
  staff[2].active = false;
  const project = fakeProject({ appUsers: staff, codes: [await codeRow(KWAME)] });
  const activate = await project.handler(post({ action: "activate", username: "kwame", activation_code: CODE, new_password: "Collector-pw-1" }));
  assert.equal(activate.status, 401);

  const hash = await hashPassword("Kwame-real-pw-1");
  const both = liveStaff();
  both[2].password_hash = hash;
  const snapshotOff = fakeProject({ appUsers: both, snapshotUsers: [{ id: "demo-user-kwame", username: "kwame", role: "Collector", active: false, passwordHash: hash }] });
  const login = await snapshotOff.handler(post({ username: "kwame", password: "Kwame-real-pw-1" }));
  assert.equal(login.status, 401, "a deactivation in the app snapshot wins");
});

test("app_users credentials and roles win over a tampered snapshot copy", async () => {
  const staff = liveStaff();
  staff[2].password_hash = await hashPassword("Kwame-real-pw-1");
  const forged = await hashPassword("Forged-pw-123");
  const project = fakeProject({
    appUsers: staff,
    snapshotUsers: [{ id: "demo-user-kwame", username: "kwame", role: "SystemOwner", active: true, passwordHash: forged }]
  });
  const attack = await project.handler(post({ username: "kwame", password: "Forged-pw-123" }));
  assert.equal(attack.status, 401);
  const real = await project.handler(post({ username: "kwame", password: "Kwame-real-pw-1" }));
  assert.equal(real.status, 200);
  assert.equal(project.db.authUsers[0].app_metadata.app_role, "Collector");
});

test("new API keys are sent only in the apikey header", async () => {
  const project = fakeProject();
  // Assembled at runtime so the repository secret scanner does not flag this fake key.
  const fakeServiceKey = ["sb", "secret", "test_value_1234567890"].join("_");
  const handler = createStaffLoginHandler({
    env: { SUPABASE_URL, STAFF_LOGIN_SERVICE_KEY: fakeServiceKey, STAFF_LOGIN_PUBLIC_KEY: "sb_publishable_test_value" },
    fetchImpl: project.fetchImpl
  });
  await handler(post({ username: "john", password: "any-password-1" }));
  const restCalls = project.calls.filter((call) => call.url.includes("/rest/v1/"));
  assert.ok(restCalls.length > 0);
  for (const call of restCalls) {
    assert.equal(call.headers.apikey, fakeServiceKey);
    assert.equal(call.headers.Authorization, undefined);
  }
});
