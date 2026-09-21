import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listOrgBlockedHardStops } from "../src/core/org-blocked-hard-stops.js";
import { renderOrgBlockedHardStopsPanel } from "../src/ui/wave10-golive-views.js";

const require = createRequire(import.meta.url);
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

test("GAP-022 EIR alias doc exists and forbids engine rename", () => {
  const doc = fs.readFileSync(path.join(root, "docs/backlog/eir-catalog-aliases.md"), "utf8");
  assert.match(doc, /GAP-022/);
  assert.match(doc, /TASK-000198/);
  assert.match(doc, /Loan Platform/);
  assert.match(doc, /Do not rename/i);
  assert.match(doc, /WAVE-06/);
  assert.match(doc, /WAVE-10/);
});

test("GAP-023 PWA web-offline limits doc exists without false Capacitor parity", () => {
  const doc = fs.readFileSync(path.join(root, "docs/backlog/pwa-web-offline-support.md"), "utf8");
  assert.match(doc, /GAP-023/);
  assert.match(doc, /TASK-000199/);
  assert.match(doc, /shell cache/i);
  assert.match(doc, /not.*Capacitor|No false parity/i);
  assert.match(doc, /pesewas|15%|31|1000/);
});

test("blocked-on-org.md lists owner actions without fake Approvals", () => {
  const doc = fs.readFileSync(path.join(root, "docs/backlog/blocked-on-org.md"), "utf8");
  assert.match(doc, /PendingHumanSignOff|HA-\*/);
  assert.match(doc, /not\*\* invent|do not invent|Do not invent|not invent/i);
  assert.match(doc, /GAP-003/);
  assert.match(doc, /GAP-001/);
  assert.doesNotMatch(doc, /HA-\*.*Approved by agent/i);
});

test("org blocked hard stops model is read-only and non-empty", () => {
  const snap = listOrgBlockedHardStops();
  assert.ok(snap.blockedCount >= 6);
  assert.ok(snap.items.some((i) => i.gap === "GAP-003"));
  assert.ok(snap.items.some((i) => i.gap === "GAP-005"));
});

test("Audit/Reports org-blocked panel renders without new nav claim", () => {
  const html = renderOrgBlockedHardStopsPanel({
    items: listOrgBlockedHardStops().items,
    note: listOrgBlockedHardStops().note
  });
  assert.match(html, /Blocked on org/);
  assert.match(html, /check:prod-readiness/);
  assert.match(html, /--run-tests/);
  assert.match(html, /org-handoff-checklist\.md/);
  assert.match(html, /data-panel-focus="wave9-executive-recorder"/);
  assert.match(html, /data-panel-focus="wave9-uat-recorder"/);
});

test("UAT migrate helper requires confirm flag and never defaults to prod URL", () => {
  const src = fs.readFileSync(path.join(root, "scripts/apply-uat-migrations.js"), "utf8");
  const md = fs.readFileSync(path.join(root, "scripts/apply-uat-migrations.md"), "utf8");
  assert.match(src, /--i-understand-uat-only/);
  assert.match(src, /SMILE_UAT_DATABASE_URL/);
  assert.doesNotMatch(src, /default.*SMILE_PROD|default.*production url/i);
  assert.match(md, /Never use this against production/i);
  const { listMigrationFiles } = require("../scripts/apply-uat-migrations.js");
  const files = listMigrationFiles();
  assert.ok(files.some((f) => /rls\.sql$/.test(f.rel)));
  assert.ok(files.some((f) => f.order === 1));
  assert.ok(files.some((f) => f.order === 45));
});

test("connect-git-remote requires SMILE_GIT_REMOTE and documents usage", () => {
  const src = fs.readFileSync(path.join(root, "scripts/connect-git-remote.js"), "utf8");
  assert.match(src, /SMILE_GIT_REMOTE/);
  assert.match(src, /docs\/ci-remote-connect\.md/);
  assert.match(src, /do not invent remotes/i);
});

test("check:prod-readiness documents default skip and exports assessors", () => {
  const src = fs.readFileSync(path.join(root, "scripts/check-prod-readiness.js"), "utf8");
  assert.match(src, /default\)\s+Do NOT run npm test/i);
  assert.match(src, /--run-tests/);
  assert.match(src, /runTestsDefault:\s*false/);
  const {
    assessChannelScripts,
    assessDeployProfiles,
    assessBootstrapPasswordGuard
  } = require("../scripts/check-prod-readiness.js");
  assert.equal(assessChannelScripts().status, "Ready");
  assert.equal(assessDeployProfiles().status, "Ready");
  const pwd = assessBootstrapPasswordGuard();
  assert.ok(["Ready", "Partial", "Blocked"].includes(pwd.status));
});

test("check:channels includes www-sot smoke", () => {
  const src = fs.readFileSync(path.join(root, "scripts/check-channels.js"), "utf8");
  assert.match(src, /check-www-sot\.js/);
  assert.match(src, /check-android-path\.js/);
  assert.match(src, /check-electron-signing\.js/);
});
