/**
 * scripts/activate-existing-staff.ps1: runs the real script against a loopback stand-in for the
 * staff-login Edge Function and checks the request contract and that no secret reaches the output.
 * Skipped where no PowerShell is installed.
 */
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const script = path.join(root, "scripts", "activate-existing-staff.ps1");

function findPowerShell() {
  for (const candidate of process.platform === "win32" ? ["powershell.exe", "pwsh"] : ["pwsh"]) {
    const probe = spawnSync(candidate, ["-NoProfile", "-Command", "exit 0"], { stdio: "ignore" });
    if (probe.status === 0) return candidate;
  }
  return "";
}
const powershell = findPowerShell();
const skip = powershell ? false : "PowerShell is not installed";

const CODE = "abcd-efgh-jklm";
const PASSWORD = "Owner-Chosen-Pw9";
const ACCESS = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0LWFjY2Vzcy10b2tlbiJ9.c2lnbmF0dXJlLXZhbHVl";
const REFRESH = "refresh-token-value-0123456789";

async function mockStaffLogin(responder) {
  const requests = [];
  const server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => { raw += chunk; });
    req.on("end", () => {
      const entry = { method: req.method, url: req.url, headers: req.headers, raw, body: raw ? JSON.parse(raw) : null };
      requests.push(entry);
      const { status = 200, body = {} } = responder(entry, requests.length) || {};
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return {
    requests,
    endpoint: `http://127.0.0.1:${port}/functions/v1/staff-login`,
    close: () => new Promise((resolve) => server.close(resolve))
  };
}

function runScript(args, stdinLines = []) {
  return new Promise((resolve) => {
    const child = spawn(powershell, ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", script, ...args], { cwd: root });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("close", (code) => resolve({ code, stdout, stderr, output: stdout + stderr }));
    child.stdin.end(stdinLines.map((line) => `${line}\n`).join(""));
  });
}

const sessionReply = (role = "SystemOwner", username = "john") => ({
  status: 200,
  body: { access_token: ACCESS, refresh_token: REFRESH, expires_in: 3600, token_type: "bearer", app_user: { id: `demo-user-${username}`, username, role } }
});

function assertNoSecrets(output) {
  for (const secret of [PASSWORD, CODE, CODE.toUpperCase(), "ABCDEFGHJKLM", ACCESS, REFRESH, "eyJ"]) {
    assert.equal(output.includes(secret), false, `output must not contain ${secret.slice(0, 4)}...`);
  }
  assert.doesNotMatch(output, /new_password|activation_code|access_token|refresh_token/);
}

test("activation sends the exact staff-login contract and prints only safe details", { skip }, async () => {
  const server = await mockStaffLogin(() => sessionReply());
  try {
    const run = await runScript(["-Username", "  JOHN ", "-LocalTestEndpoint", server.endpoint], [CODE, PASSWORD, PASSWORD]);
    assert.equal(run.code, 0, run.output);
    assert.equal(server.requests.length, 1);
    const [request] = server.requests;
    assert.equal(request.method, "POST");
    assert.equal(request.url, "/functions/v1/staff-login");
    assert.deepEqual(Object.keys(request.body), ["business_code", "username", "action", "activation_code", "new_password"]);
    assert.deepEqual(request.body, {
      business_code: "SMILE-TRUST",
      username: "john",
      action: "activate",
      activation_code: "ABCDEFGHJKLM",
      new_password: PASSWORD
    });
    assert.equal(request.headers.apikey, undefined, "no key is sent unless one is given");
    assert.equal(request.headers.authorization, undefined);
    assert.match(run.stdout, /ACTIVATION SUCCEEDED/);
    assert.match(run.stdout, /Username: john/);
    assert.match(run.stdout, /Role: SystemOwner/);
    assert.match(run.stdout, /Business: SMILE-TRUST/);
    assertNoSecrets(run.output);
  } finally {
    await server.close();
  }
});

test("server errors are reported as status plus a sanitized message", { skip }, async () => {
  const server = await mockStaffLogin(() => ({
    status: 401,
    body: { error: `Activation code is invalid or has expired. ${ACCESS} ${"x".repeat(40)}\u0007`, mfa_required: false, echoed: PASSWORD }
  }));
  try {
    const run = await runScript(["-Username", "john", "-LocalTestEndpoint", server.endpoint], [CODE, PASSWORD, PASSWORD]);
    assert.equal(run.code, 1);
    assert.match(run.stderr, /ACTIVATION FAILED/);
    assert.match(run.stderr, /HTTP status: 401/);
    assert.match(run.stderr, /Server message: Activation code is invalid or has expired\. \[redacted\] \[redacted\]/);
    assert.match(run.stderr, /Nothing was changed/);
    assertNoSecrets(run.output);
  } finally {
    await server.close();
  }
});

test("a server failure during activation is reported as an uncertain outcome", { skip }, async () => {
  const server = await mockStaffLogin(() => ({ status: 502, body: { error: "Could not start a cloud session. Try again." } }));
  try {
    const run = await runScript(["-Username", "john", "-LocalTestEndpoint", server.endpoint], [CODE, PASSWORD, PASSWORD]);
    assert.equal(run.code, 1);
    assert.match(run.stderr, /HTTP status: 502/);
    assert.match(run.stderr, /OUTCOME UNCERTAIN/);
    assert.match(run.stderr, /Do NOT request a new activation code/);
    assertNoSecrets(run.output);
  } finally {
    await server.close();
  }
});

test("a privileged account without an authenticator is reported as MFA ENROLLMENT REQUIRED, never as a session", { skip }, async () => {
  const server = await mockStaffLogin(() => ({ status: 403, body: { error: "Two-factor authentication is required for your role.", mfa_enrollment_required: true } }));
  try {
    const activate = await runScript(["-Username", "john", "-LocalTestEndpoint", server.endpoint], [CODE, PASSWORD, PASSWORD]);
    assert.equal(activate.code, 3);
    assert.match(activate.stdout, /ACTIVATION SUCCEEDED \(password saved\)/);
    assert.match(activate.stdout, /MFA ENROLLMENT REQUIRED/);
    assert.match(activate.stdout, /Do NOT request a new activation code/);
    assert.doesNotMatch(activate.stdout, /SIGN-IN VERIFIED|Session:/);
    assertNoSecrets(activate.output);
    const login = await runScript(["-Username", "john", "-Mode", "Login", "-LocalTestEndpoint", server.endpoint], [PASSWORD]);
    assert.equal(login.code, 3);
    assert.match(login.stdout, /PASSWORD ACCEPTED/);
    assert.doesNotMatch(login.stdout, /SIGN-IN VERIFIED/);
    assertNoSecrets(login.output);
  } finally {
    await server.close();
  }
});

test("other projects, non-Supabase URLs, remote test endpoints and secret keys are refused before any input", { skip }, async () => {
  const server = await mockStaffLogin(() => sessionReply());
  const fakeSecret = ["sb", "secret", "abcdefghijklmnop"].join("_");
  try {
    const cases = [
      ["-Username", "john", "-SupabaseUrl", "https://aaaaaaaaaaaaaaaaaaaa.supabase.co"],
      ["-Username", "john", "-SupabaseUrl", "https://evil.example.com"],
      ["-Username", "john", "-SupabaseUrl", "http://qouokiqoepjpoksupskb.supabase.co"],
      ["-Username", "john", "-LocalTestEndpoint", "http://10.0.0.5:8080/functions/v1/staff-login"],
      ["-Username", "john", "-LocalTestEndpoint", server.endpoint, "-PublishableKey", fakeSecret],
      ["-Username", "john", "-LocalTestEndpoint", server.endpoint, "-PublishableKey", "not-a-key"]
    ];
    for (const args of cases) {
      const run = await runScript(args, [CODE, PASSWORD, PASSWORD]);
      assert.equal(run.code, 2, `${args.join(" ")}\n${run.output}`);
      assert.match(run.stderr, /REFUSED/);
      assert.equal(run.output.includes(fakeSecret), false);
      assertNoSecrets(run.output);
    }
    assert.equal(server.requests.length, 0, "nothing was sent");
  } finally {
    await server.close();
  }
});

test("mismatched, short or padded passwords and malformed codes are refused locally", { skip }, async () => {
  const server = await mockStaffLogin(() => sessionReply());
  try {
    for (const lines of [
      [CODE, PASSWORD, `${PASSWORD}x`],
      [CODE, "short", "short"],
      [CODE, ` ${PASSWORD}`, ` ${PASSWORD}`],
      ["abc", PASSWORD, PASSWORD]
    ]) {
      const run = await runScript(["-Username", "john", "-LocalTestEndpoint", server.endpoint], lines);
      assert.equal(run.code, 2, run.output);
      assert.match(run.stderr, /Nothing was sent/);
      assertNoSecrets(run.output);
    }
    const badUser = await runScript(["-Username", "john;drop", "-LocalTestEndpoint", server.endpoint], [CODE, PASSWORD, PASSWORD]);
    assert.equal(badUser.code, 2);
    assert.equal(server.requests.length, 0);
  } finally {
    await server.close();
  }
});

test("an MFA challenge prompts for the authenticator code and retries once", { skip }, async () => {
  const server = await mockStaffLogin((request, count) => (count === 1
    ? { status: 401, body: { error: "Enter your MFA code.", mfa_required: true } }
    : sessionReply("Admin", "ama")));
  try {
    const run = await runScript(["-Username", "ama", "-LocalTestEndpoint", server.endpoint], [CODE, PASSWORD, PASSWORD, "123456"]);
    assert.equal(run.code, 0, run.output);
    assert.equal(server.requests.length, 2);
    assert.equal(server.requests[0].body.mfa_code, undefined);
    assert.equal(server.requests[1].body.mfa_code, "123456");
    assert.equal(server.requests[1].body.activation_code, "ABCDEFGHJKLM");
    assert.match(run.stdout, /Role: Admin/);
    assert.equal(run.output.includes("123456"), false);
    assertNoSecrets(run.output);
  } finally {
    await server.close();
  }
});

test("login mode verifies sign-in, signs the session out with the publishable key, and prints no token", { skip }, async () => {
  const server = await mockStaffLogin((request) => (request.url.startsWith("/auth/v1/logout") ? { status: 204, body: {} } : sessionReply()));
  try {
    const run = await runScript(["-Username", "john", "-Mode", "Login", "-LocalTestEndpoint", server.endpoint, "-PublishableKey", "sb_publishable_test_value"], [PASSWORD]);
    assert.equal(run.code, 0, run.output);
    const [login, logout] = server.requests;
    assert.deepEqual(login.body, { business_code: "SMILE-TRUST", username: "john", action: "login", password: PASSWORD });
    assert.equal(login.headers.apikey, "sb_publishable_test_value");
    assert.equal(login.headers.authorization, undefined, "the publishable key is never a bearer token");
    assert.equal(logout.url, "/auth/v1/logout?scope=local");
    assert.equal(logout.headers.authorization, `Bearer ${ACCESS}`);
    assert.match(run.stdout, /SIGN-IN VERIFIED/);
    assert.match(run.stdout, /signed out/);
    assertNoSecrets(run.output);
  } finally {
    await server.close();
  }
});

test("a 200 without a session or for a different account is not reported as success", { skip }, async () => {
  for (const reply of [{ status: 200, body: { app_user: { username: "john", role: "SystemOwner" } } }, sessionReply("SystemOwner", "kwame")]) {
    const server = await mockStaffLogin(() => reply);
    try {
      const run = await runScript(["-Username", "john", "-LocalTestEndpoint", server.endpoint], [CODE, PASSWORD, PASSWORD]);
      assert.equal(run.code, 1, run.output);
      assert.doesNotMatch(run.stdout, /SUCCEEDED/);
      assertNoSecrets(run.output);
    } finally {
      await server.close();
    }
  }
});
