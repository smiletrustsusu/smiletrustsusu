/**
 * Wave 10 — Production deployment / go-live / hypercare / closure tests.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  WAVE10_WAVE,
  WAVE10_VERSION,
  WAVE10_CATALOG_ALIAS,
  WAVE10_GAP_CHECKLIST,
  WAVE10_PARITY_CHECKLIST,
  PROD_ENV_CHECKLIST,
  CUTOVER_STEPS,
  PROD_VALIDATION_CHECKS,
  GOLIVE_COORDINATION_ROLES,
  HYPERCARE_PLAN,
  PIR_DIMENSIONS,
  CI_BACKLOG_PROCESS,
  KT_CHECKLIST,
  SUCCESS_METRICS,
  ROLLBACK_PLAN,
  HUMAN_SIGNOFF_STATUS,
  GOLIVE_DECISIONS,
  loadRc1EntryCriterion,
  loadWave9EntryCriterion,
  seedSyntheticGoliveRun,
  evaluateProductionGoLive,
  buildGoliveEvidencePackage,
  generateProjectClosureArtifact,
  analyzeWave10Gaps,
  wave10SmokeChecklist,
  scoreProdEnv
} from "../src/core/wave10-production-golive-ops.js";
import {
  renderWave10GolivePanel,
  renderWave10CutoverChecklist,
  renderWave10HypercareBoard,
  renderWave10ClosureSignoff
} from "../src/ui/wave10-golive-views.js";
import { getWave } from "../src/core/enterprise-roadmap-registry.js";
import { SUPER_ADMIN_FORBIDDEN } from "../src/core/rbac.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function loadRc1() {
  const p = path.join(ROOT, "docs", "release-evidence", "rc1-evidence.json");
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function loadWave9() {
  const p = path.join(ROOT, "docs", "release-evidence", "wave9-pilot-evidence.json");
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

test("Wave 10 catalog alias, gaps, parity, money, forbidden", () => {
  assert.equal(WAVE10_WAVE, "WAVE-10");
  assert.match(WAVE10_VERSION, /10\.0/);
  assert.equal(WAVE10_CATALOG_ALIAS.deliveryCode, "PROD_DEPLOY_GOLIVE_HYPERCARE_CLOSURE");
  assert.equal(WAVE10_CATALOG_ALIAS.historicalEirCode, "PRODUCTION_READINESS");
  assert.match(WAVE10_CATALOG_ALIAS.wavesCompleteNote, /1–10|1-10/);
  const gaps = analyzeWave10Gaps();
  assert.equal(gaps.openCritical, 0);
  assert.equal(gaps.frameworkReady, true);
  assert.equal(gaps.notNextJsRewrite, true);
  assert.equal(gaps.moneyDefaults.interest, 15);
  assert.equal(gaps.moneyDefaults.collectionDays, 31);
  assert.equal(gaps.moneyDefaults.cashierLimitGhs, 1000);
  assert.equal(gaps.moneyDefaults.pesewas, true);
  assert.ok(WAVE10_GAP_CHECKLIST.some((g) => g.id === "W10-G15" && g.status === "deferred"));
  assert.ok(WAVE10_PARITY_CHECKLIST.length >= 8);
  assert.ok(SUPER_ADMIN_FORBIDDEN.includes("System.Reset"));
  const smoke = wave10SmokeChecklist();
  assert.equal(smoke.wave, "WAVE-10");
  assert.match(smoke.claimBoundary, /Framework complete/);
});

test("prod env differs from pilot/dev; cutover, PV, hypercare, metrics counts", () => {
  assert.ok(PROD_ENV_CHECKLIST.length >= 10);
  assert.ok(PROD_ENV_CHECKLIST.every((e) => e.differsFromPilotDev === true));
  assert.ok(CUTOVER_STEPS.length >= 12);
  assert.ok(PROD_VALIDATION_CHECKS.length >= 16);
  assert.equal(HYPERCARE_PLAN.durationDays, 14);
  assert.ok(SUCCESS_METRICS.length >= 9);
  assert.ok(SUCCESS_METRICS.every((m) => m.actual === null));
  assert.ok(GOLIVE_COORDINATION_ROLES.some((r) => r.id === "GLR-AA" && r.humanSignOffRequired));
  assert.ok(PIR_DIMENSIONS.length >= 6);
  assert.ok(KT_CHECKLIST.length >= 6);
  assert.ok(CI_BACKLOG_PROCESS.itemTypes.includes("TechDebt"));
  assert.ok(ROLLBACK_PLAN.steps.some((s) => /revert/i.test(s)));
  assert.ok(ROLLBACK_PLAN.steps.some((s) => /restore/i.test(s)));
  assert.ok(ROLLBACK_PLAN.steps.some((s) => /flag/i.test(s)));
  assert.ok(ROLLBACK_PLAN.steps.some((s) => /communicat/i.test(s)));
  const domains = new Set(PROD_VALIDATION_CHECKS.map((c) => c.domain));
  for (const d of [
    "auth",
    "rbac",
    "customer",
    "savings",
    "collections",
    "deposits_withdrawals",
    "loans",
    "accounting",
    "reporting",
    "dashboards",
    "notifications",
    "audit",
    "offline_sync",
    "devices",
    "api_health",
    "db_health"
  ]) {
    assert.ok(domains.has(d), `missing domain ${d}`);
  }
});

test("entry criteria: RC1 + Wave 9 Conditional/Go", () => {
  assert.equal(loadRc1EntryCriterion(null).ok, false);
  assert.equal(loadWave9EntryCriterion(null).ok, false);
  assert.equal(loadWave9EntryCriterion({ goNoGo: { decision: "No-Go", readyForWave10: "no" } }).ok, false);
  assert.equal(
    loadWave9EntryCriterion({ goNoGo: { decision: "Conditional", readyForWave10: "conditional" } }).ok,
    true
  );

  const run = seedSyntheticGoliveRun();
  const blocked = evaluateProductionGoLive({
    rc1Evidence: null,
    wave9Evidence: null,
    goliveRun: run
  });
  assert.ok(blocked.hardBlockers.includes("rc1_entry_criterion_failed"));
  assert.ok(blocked.hardBlockers.includes("wave9_entry_criterion_failed"));

  const ok = evaluateProductionGoLive({
    rc1Evidence: { decision: "PASS", readyForWave9: true },
    wave9Evidence: {
      goNoGo: {
        decision: "Conditional",
        readyForWave10: "conditional",
        conditions: ["executive_sponsor_pending_human_signoff"],
        humanApprovals: [{ id: "HA-EXEC", status: HUMAN_SIGNOFF_STATUS.PENDING }]
      }
    },
    goliveRun: run
  });
  assert.equal(ok.hardBlockers.length, 0);
  assert.equal(ok.decision, "FrameworkReady");
  assert.equal(ok.liveProductionCutover, false);
  assert.equal(ok.liveProductionAccepted, false);
  assert.equal(ok.cert001.certified, false);
  assert.ok(ok.cert001.preview);
  const exec = ok.humanApprovals.find((a) => a.id === "HA-EXEC");
  assert.equal(exec.status, HUMAN_SIGNOFF_STATUS.PENDING);
  assert.ok(GOLIVE_DECISIONS.includes(ok.decision));
});

test("Accepted blocked without human approvals and live cutover", () => {
  const run = seedSyntheticGoliveRun();
  run.humanApprovals = run.humanApprovals.map((a) => ({
    ...a,
    status: HUMAN_SIGNOFF_STATUS.APPROVED
  }));
  // Still no live cutover timestamps
  const result = evaluateProductionGoLive({
    rc1Evidence: { decision: "PASS", readyForWave9: true },
    wave9Evidence: {
      goNoGo: {
        decision: "Go",
        readyForWave10: "yes",
        conditions: [],
        humanApprovals: [{ id: "HA-EXEC", status: HUMAN_SIGNOFF_STATUS.APPROVED }]
      }
    },
    goliveRun: run
  });
  assert.notEqual(result.decision, "Accepted");
  assert.equal(result.cert001.certified, false);
});

test("pack files missing is hard blocker; env score", () => {
  const run = seedSyntheticGoliveRun();
  const env = scoreProdEnv(run.envResults);
  assert.equal(env.differsFromPilotDev, true);
  assert.equal(env.ok, true);

  const missing = evaluateProductionGoLive({
    rc1Evidence: { decision: "PASS", readyForWave9: true },
    wave9Evidence: { goNoGo: { decision: "Conditional", readyForWave10: "conditional" } },
    goliveRun: run,
    packFilesMissing: true
  });
  assert.ok(missing.hardBlockers.includes("wave10_pack_files_missing"));
});

test("buildGoliveEvidencePackage + closure + UI", () => {
  const rc1 = loadRc1() || { decision: "PASS", readyForWave9: true };
  const wave9 = loadWave9() || {
    goNoGo: {
      decision: "Conditional",
      readyForWave10: "conditional",
      conditions: ["executive_sponsor_pending_human_signoff"],
      humanApprovals: [{ id: "HA-EXEC", status: HUMAN_SIGNOFF_STATUS.PENDING }]
    }
  };
  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  const evidence = buildGoliveEvidencePackage({
    rc1Evidence: rc1,
    wave9Evidence: wave9,
    packageJson,
    goliveRun: seedSyntheticGoliveRun()
  });
  assert.equal(evidence.schemaVersion, "wave10-golive-evidence/1.0");
  assert.equal(evidence.claim.liveProductionCutover, false);
  assert.equal(evidence.claim.cert001Certified, false);
  assert.ok(["FrameworkReady", "AwaitingApprovals", "Conditional", "Accepted"].includes(evidence.goLive.decision));
  assert.ok(evidence.humanApprovals || evidence.goLive.humanApprovals);
  assert.ok(evidence.goLive.humanApprovals.every((a) => a.status !== "Approved" || a.id));
  assert.ok(evidence.goLive.humanApprovals.find((a) => a.id === "HA-EXEC").status === HUMAN_SIGNOFF_STATUS.PENDING);
  assert.ok(evidence.registries.cutoverStepCount >= 12);
  assert.ok(evidence.registries.validationCheckCount >= 16);
  assert.ok(evidence.registries.metricCount >= 9);
  assert.equal(evidence.registries.hypercareDurationDays, 14);
  assert.ok(evidence.projectClosure.frameworkWavesComplete);
  assert.match(evidence.projectClosure.statement, /1–10|1-10/);

  const closure = generateProjectClosureArtifact({ goliveEvaluation: evidence.goLive });
  assert.equal(closure.executiveSignOff.status, HUMAN_SIGNOFF_STATUS.PENDING);

  const html = renderWave10GolivePanel({
    smoke: wave10SmokeChecklist(),
    gaps: analyzeWave10Gaps(),
    evidence,
    canView: true
  });
  assert.match(html, /wave10-golive-panel/);
  assert.match(html, /aria-labelledby/);
  assert.match(html, /Production Cutover/);
  assert.match(renderWave10CutoverChecklist(evidence.cutover.steps.slice(0, 5)), /cutover checklist/i);
  assert.match(renderWave10CutoverChecklist(evidence.cutover.steps.slice(0, 5)), /ReadyToExecute/);
  assert.match(renderWave10CutoverChecklist(evidence.cutover.steps.slice(0, 5)), /Rollback/);
  assert.match(renderWave10CutoverChecklist(evidence.cutover.steps.slice(0, 5)), /HA-\*/);
  assert.match(renderWave10HypercareBoard(evidence.hypercare, evidence.successMetrics), /Hypercare board/);
  assert.match(renderWave10ClosureSignoff(evidence), /Closure \/ sign-off/);
});

test("roadmap WAVE-10 notes prod deploy/golive; docs exist", () => {
  const wave = getWave("WAVE-10") || getWave(10);
  assert.ok(wave);
  assert.match(String(wave.notes || ""), /[Gg]o-[Ll]ive|[Pp]roduction|[Hh]ypercare|PROD_DEPLOY/);
  assert.ok(["Mostly Complete", "In Progress", "Planned"].includes(wave.waveStatus));
  for (const rel of [
    "docs/wave10-production-golive.md",
    "src/core/wave10-production-golive-ops.js",
    "src/ui/wave10-golive-views.js",
    "scripts/wave10-golive-assess.js"
  ]) {
    assert.equal(fs.existsSync(path.join(ROOT, rel)), true, rel);
  }
});
