import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const { isPlaceholderUpdateUrl } = require("../electron/updater.js");

test("GAP-008 placeholder update URLs are blocked", () => {
  assert.equal(isPlaceholderUpdateUrl(""), true);
  assert.equal(isPlaceholderUpdateUrl("https://updates.example.invalid/smile-trust-susu"), true);
  assert.equal(isPlaceholderUpdateUrl("https://example.com/feed"), true);
  assert.equal(isPlaceholderUpdateUrl("https://updates.smiletrust.example.org/feed"), false);
});

test("GAP-008 package.json publish is null (no example.invalid feed)", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  assert.equal(pkg.build.publish, null);
  assert.equal(pkg.build.win.signAndEditExecutable, false);
});

test("GAP-008 check:electron-signing assess is pilot-safe and exportable", () => {
  const { assessElectronSigning } = require("../scripts/check-electron-signing.js");
  const assessment = assessElectronSigning();
  assert.equal(assessment.ok, true);
  assert.equal(assessment.productionReady, false);
  assert.equal(assessment.signAndEditExecutable, false);
  assert.ok(Array.isArray(assessment.notes));
});

test("GAP-007 CI workflow runs npm test and validate:rc", () => {
  const ci = fs.readFileSync(path.join(root, ".github/workflows/ci.yml"), "utf8");
  assert.match(ci, /npm test/);
  assert.match(ci, /validate:rc/);
  assert.match(ci, /prepare:web/);
  assert.match(ci, /validate:pilot/);
  assert.match(ci, /cache:\s*npm/);
  assert.match(ci, /check:channels/);
  assert.match(ci, /hash:artifacts/);
  assert.match(ci, /concurrency:/);
  assert.match(ci, /permissions:/);
});

test("GAP-004 check:android script and android README exist", () => {
  assert.ok(fs.existsSync(path.join(root, "scripts/check-android-path.js")));
  assert.ok(fs.existsSync(path.join(root, "scripts/ensure-android-platform.js")));
  assert.ok(fs.existsSync(path.join(root, "scripts/pilot-android.js")));
  assert.ok(fs.existsSync(path.join(root, "scripts/release-android.js")));
  assert.ok(fs.existsSync(path.join(root, "android/README.md")));
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  assert.equal(pkg.scripts["check:android"], "node scripts/check-android-path.js");
  assert.equal(pkg.scripts["android:ensure"], "node scripts/ensure-android-platform.js");
  assert.equal(pkg.scripts["pilot:android"], "node scripts/pilot-android.js");
  assert.equal(pkg.scripts["release:android"], "node scripts/release-android.js");
  assert.equal(pkg.scripts["check:channels"], "node scripts/check-channels.js");
});

test("GAP-012 hash:artifacts script exists and is wired", () => {
  assert.ok(fs.existsSync(path.join(root, "scripts/hash-release-artifacts.js")));
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  assert.equal(pkg.scripts["hash:artifacts"], "node scripts/hash-release-artifacts.js");
});

test("GAP-018 check:www-sot script and CI step exist", () => {
  assert.ok(fs.existsSync(path.join(root, "scripts/check-www-sot.js")));
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  assert.equal(pkg.scripts["check:www-sot"], "node scripts/check-www-sot.js");
  const ci = fs.readFileSync(path.join(root, ".github/workflows/ci.yml"), "utf8");
  assert.match(ci, /check:www-sot/);
  const { assessWwwSot } = require("../scripts/check-www-sot.js");
  const assessment = assessWwwSot();
  assert.equal(typeof assessment.ok, "boolean");
  assert.equal(assessment.gap, "GAP-018");
});

test("GAP-016 deploy pilot/prod profiles exist (non-secret)", () => {
  const pilot = path.join(root, "deploy/profiles/pilot.json");
  const prod = path.join(root, "deploy/profiles/prod.json");
  assert.ok(fs.existsSync(pilot));
  assert.ok(fs.existsSync(prod));
  const pilotJson = JSON.parse(fs.readFileSync(pilot, "utf8"));
  const prodJson = JSON.parse(fs.readFileSync(prod, "utf8"));
  assert.equal(pilotJson.profileId, "pilot");
  assert.equal(prodJson.profileId, "prod");
  assert.equal(pilotJson.payments.liveMomoCalls, false);
  const blob = JSON.stringify(pilotJson) + JSON.stringify(prodJson);
  assert.doesNotMatch(blob, /api[_-]?key|BEGIN (RSA |EC )?PRIVATE/i);
});

test("GAP-019 MoMo inventory doc exists", () => {
  const inv = fs.readFileSync(path.join(root, "docs/backlog/momo-gap-inventory.md"), "utf8");
  assert.match(inv, /GAP-019/);
  assert.match(inv, /BUG-000004/);
  assert.match(inv, /no live MoMo/i);
});

test("GAP-004 setup:android-signing refuses inventing certs without env", () => {
  const { assessSigningReadiness } = require("../scripts/setup-android-signing.js");
  const prevAllow = process.env.SMILE_ANDROID_ALLOW_LOCAL_KEYSTORE;
  const prevPass = process.env.SMILE_ANDROID_STORE_PASSWORD;
  delete process.env.SMILE_ANDROID_ALLOW_LOCAL_KEYSTORE;
  delete process.env.SMILE_ANDROID_STORE_PASSWORD;
  try {
    const a = assessSigningReadiness();
    assert.equal(typeof a.readyForReleaseBuild, "boolean");
    assert.ok(Array.isArray(a.notes));
    assert.match(a.notes.join(" "), /Do not invent/);
  } finally {
    if (prevAllow != null) process.env.SMILE_ANDROID_ALLOW_LOCAL_KEYSTORE = prevAllow;
    else delete process.env.SMILE_ANDROID_ALLOW_LOCAL_KEYSTORE;
    if (prevPass != null) process.env.SMILE_ANDROID_STORE_PASSWORD = prevPass;
    else delete process.env.SMILE_ANDROID_STORE_PASSWORD;
  }
});

test("GAP-008 check:electron-signing script is wired", () => {
  assert.ok(fs.existsSync(path.join(root, "scripts/check-electron-signing.js")));
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  assert.equal(pkg.scripts["check:electron-signing"], "node scripts/check-electron-signing.js");
});

test("GAP-007 check:channels includes www-sot", () => {
  const src = fs.readFileSync(path.join(root, "scripts/check-channels.js"), "utf8");
  assert.match(src, /check-www-sot\.js/);
  assert.match(src, /check-android-path\.js/);
  assert.match(src, /check-electron-signing\.js/);
});

test("GAP-007 CI remote connect doc exists without inventing remotes", () => {
  const doc = fs.readFileSync(path.join(root, "docs/ci-remote-connect.md"), "utf8");
  assert.match(doc, /Do not invent remotes/);
  assert.match(doc, /git remote/);
  assert.match(doc, /check:channels/);
});
