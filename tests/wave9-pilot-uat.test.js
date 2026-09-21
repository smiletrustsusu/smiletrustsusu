/**
 * Wave 9 — Pilot / UAT / Ops readiness tests.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  WAVE9_WAVE,
  WAVE9_VERSION,
  WAVE9_CATALOG_ALIAS,
  WAVE9_GAP_CHECKLIST,
  WAVE9_PARITY_CHECKLIST,
  UAT_SCENARIOS,
  UAT_DOMAINS,
  PILOT_ENV_CHECKLIST,
  OPS_READINESS_CHECKS,
  TRAINING_TRACKS,
  PILOT_PARTICIPANT_GROUPS,
  GO_LIVE_DIMENSIONS,
  HUMAN_SIGNOFF_STATUS,
  listMandatoryUatScenarios,
  assertUatDomainCoverage,
  seedSyntheticPilotRun,
  loadRc1EntryCriterion,
  evaluateGoNoGo,
  buildPilotEvidencePackage,
  analyzeWave9Gaps,
  wave9SmokeChecklist,
  scoreOpsReadiness,
  scoreUatPack
} from "../src/core/wave9-pilot-uat-ops.js";
import {
  renderWave9PilotPanel,
  renderWave9UatTracker,
  renderWave9GoNoGoSummary
} from "../src/ui/wave9-pilot-views.js";
import { getWave } from "../src/core/enterprise-roadmap-registry.js";
import { SUPER_ADMIN_FORBIDDEN } from "../src/core/rbac.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function loadRc1() {
  const p = path.join(ROOT, "docs", "release-evidence", "rc1-evidence.json");
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

test("Wave 9 catalog alias, gaps, parity, money, forbidden", () => {
  assert.equal(WAVE9_WAVE, "WAVE-09");
  assert.match(WAVE9_VERSION, /9\.0/);
  assert.equal(WAVE9_CATALOG_ALIAS.deliveryCode, "PILOT_UAT_OPS_READINESS");
  assert.equal(WAVE9_CATALOG_ALIAS.historicalEirCode, "ENTERPRISE_FEATURES");
  const gaps = analyzeWave9Gaps();
  assert.equal(gaps.openCritical, 0);
  assert.equal(gaps.frameworkReady, true);
  assert.equal(gaps.notNextJsRewrite, true);
  assert.equal(gaps.moneyDefaults.interest, 15);
  assert.equal(gaps.moneyDefaults.collectionDays, 31);
  assert.equal(gaps.moneyDefaults.cashierLimitGhs, 1000);
  assert.equal(gaps.moneyDefaults.pesewas, true);
  assert.ok(WAVE9_GAP_CHECKLIST.some((g) => g.id === "W9-G12" && g.status === "deferred"));
  assert.ok(WAVE9_PARITY_CHECKLIST.length >= 7);
  assert.ok(SUPER_ADMIN_FORBIDDEN.includes("System.Reset"));
  const smoke = wave9SmokeChecklist();
  assert.equal(smoke.wave, "WAVE-09");
  assert.equal(smoke.domainCoverageOk, true);
});

test("UAT scenario coverage across mandatory domains", () => {
  assert.ok(UAT_SCENARIOS.length >= 20);
  const mandatory = listMandatoryUatScenarios();
  assert.ok(mandatory.length >= 18);
  const coverage = assertUatDomainCoverage();
  assert.equal(coverage.ok, true, JSON.stringify(coverage.missing));
  for (const d of UAT_DOMAINS) {
    assert.ok(coverage.covered.includes(d), `missing domain ${d}`);
  }
  for (const s of UAT_SCENARIOS) {
    assert.ok(s.id && s.domain && s.title);
    assert.ok(Array.isArray(s.preconditions));
    assert.ok(Array.isArray(s.steps));
    assert.ok(Array.isArray(s.expected));
    assert.ok(s.resultTemplate);
    assert.equal(s.resultTemplate.approverStatus, HUMAN_SIGNOFF_STATUS.PENDING);
  }
});

test("pilot isolation flags, ops readiness, training, participants", () => {
  assert.ok(PILOT_ENV_CHECKLIST.length >= 8);
  assert.ok(PILOT_ENV_CHECKLIST.every((e) => e.isolationFromProd === true));
  assert.ok(OPS_READINESS_CHECKS.length >= 9);
  assert.ok(TRAINING_TRACKS.length >= 5);
  for (const t of TRAINING_TRACKS) {
    assert.ok(t.modules.length >= 3);
    assert.ok(t.exercises.length >= 2);
    assert.ok(t.competencyChecklist.length >= 2);
  }
  assert.ok(PILOT_PARTICIPANT_GROUPS.some((g) => g.id === "PG-EXEC" && g.humanSignOffRequired));
  assert.ok(GO_LIVE_DIMENSIONS.some((d) => d.id === "GL-EXEC" && d.humanSignOff));
});

test("RC1 entry gate required for non-No-Go", () => {
  const missing = loadRc1EntryCriterion(null);
  assert.equal(missing.ok, false);

  const failRc = loadRc1EntryCriterion({ decision: "FAIL", readyForWave9: false });
  assert.equal(failRc.ok, false);

  const passRc = loadRc1EntryCriterion({ decision: "PASS", readyForWave9: true });
  assert.equal(passRc.ok, true);

  const run = seedSyntheticPilotRun();
  const noGo = evaluateGoNoGo({ rc1Evidence: null, pilotRun: run });
  assert.equal(noGo.decision, "No-Go");
  assert.ok(noGo.reasons.includes("rc1_entry_criterion_failed"));

  const withPass = evaluateGoNoGo({
    rc1Evidence: { decision: "PASS", readyForWave9: true },
    pilotRun: run
  });
  assert.equal(withPass.decision, "Conditional");
  assert.equal(withPass.readyForWave10, "conditional");
  assert.ok(withPass.conditions.includes("executive_sponsor_pending_human_signoff"));
  assert.equal(withPass.livePilotExecuted, false);
  assert.equal(withPass.liveBranchCutover, false);

  const exec = withPass.humanApprovals.find((a) => a.id === "HA-EXEC");
  assert.equal(exec.status, HUMAN_SIGNOFF_STATUS.PENDING);
});

test("synthetic run auto-passes technical smoke; business sign-off pending", () => {
  const run = seedSyntheticPilotRun();
  assert.equal(run.kind, "synthetic");
  assert.equal(run.liveBranchCutover, false);
  const tech = run.scenarioResults.filter((r) => r.technicalSmoke);
  assert.ok(tech.length >= 5);
  assert.ok(tech.every((r) => r.passFail === "pass"));
  assert.ok(tech.every((r) => r.approverStatus === HUMAN_SIGNOFF_STATUS.PENDING));
  const business = run.scenarioResults.filter((r) => !r.technicalSmoke);
  assert.ok(business.some((r) => r.status === "ReadyToExecute"));
  const uat = scoreUatPack(run.scenarioResults);
  assert.equal(uat.packComplete, true);
  assert.equal(uat.businessAcceptanceComplete, false);
  const ops = scoreOpsReadiness(run.opsResults);
  assert.equal(ops.ok, true);
});

test("open Critical issue forces No-Go", () => {
  const run = seedSyntheticPilotRun();
  run.issueRegister.push({
    id: "ISS-CRIT",
    severity: "Critical",
    title: "Blocking defect",
    status: "open",
    blocking: true
  });
  const result = evaluateGoNoGo({
    rc1Evidence: { decision: "PASS", readyForWave9: true },
    pilotRun: run
  });
  assert.equal(result.decision, "No-Go");
  assert.ok(result.reasons.includes("open_critical_issues"));
});

test("buildPilotEvidencePackage + UI render", () => {
  const rc1 = loadRc1() || { decision: "PASS", readyForWave9: true, certificationScope: "RC1_PILOT_UAT" };
  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  const evidence = buildPilotEvidencePackage({
    rc1Evidence: rc1,
    packageJson,
    pilotRun: seedSyntheticPilotRun()
  });
  assert.equal(evidence.schemaVersion, "wave9-pilot-evidence/1.0");
  assert.equal(evidence.claim.liveBranchCutover, false);
  assert.equal(evidence.claim.productionReconciled, false);
  assert.ok(["Conditional", "Go", "No-Go"].includes(evidence.goNoGo.decision));
  if (rc1.decision === "PASS") {
    assert.equal(evidence.goNoGo.decision, "Conditional");
  }
  assert.ok(evidence.uatMatrix.domainCoverageOk);
  assert.ok(evidence.registries.uatScenarioCount >= 20);
  assert.ok(evidence.registries.opsCheckCount >= 9);
  assert.ok(evidence.registries.trainingTrackCount >= 5);

  const html = renderWave9PilotPanel({
    smoke: wave9SmokeChecklist(),
    gaps: analyzeWave9Gaps(),
    evidence,
    canView: true
  });
  assert.match(html, /wave9-pilot-panel/);
  assert.match(html, /aria-labelledby/);
  assert.match(html, /Pilot \/ UAT/);
  const tracker = renderWave9UatTracker(evidence.uatMatrix.scenarios.slice(0, 5));
  assert.match(tracker, /UAT tracker/);
  const summary = renderWave9GoNoGoSummary(evidence);
  assert.match(summary, /Go \/ No-Go summary/);
});

test("roadmap WAVE-09 notes pilot/UAT delivery; docs exist", () => {
  const wave = getWave("WAVE-09") || getWave(9);
  assert.ok(wave);
  assert.match(String(wave.notes || ""), /[Pp]ilot|[Uu]AT|PILOT_UAT/);
  assert.match(String(wave.code || ""), /PILOT_UAT|ENTERPRISE/);
  assert.ok(["Mostly Complete", "In Progress"].includes(wave.waveStatus));
  for (const rel of [
    "docs/wave9-pilot-uat.md",
    "docs/wave9-uat-pack.md",
    "docs/wave9-training-package.md",
    "docs/wave9-go-nogo-report.md",
    "docs/uat/wave9-uat-execution-guide.md",
    "docs/release-evidence/wave9-uat-run-sheet.json",
    "src/core/wave9-pilot-uat-ops.js",
    "src/core/wave9-uat-recording.js",
    "src/ui/wave9-pilot-views.js",
    "scripts/wave9-pilot-assess.js"
  ]) {
    assert.equal(fs.existsSync(path.join(ROOT, rel)), true, rel);
  }
});
