/**
 * Wave 8 — Release certification / RC1 validation tests.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  WAVE8_WAVE,
  WAVE8_VERSION,
  WAVE8_CATALOG_ALIAS,
  WAVE8_GAP_CHECKLIST,
  WAVE8_PARITY_CHECKLIST,
  analyzeWave8Gaps,
  wave8SmokeChecklist,
  runCrossWaveSmoke,
  runSecurityIsolationSmoke,
  runPerfSmokeHarness,
  runDrOfflineSmoke,
  runAccessibilitySmoke,
  buildDefectRegistry,
  evaluateWave8QualityGates,
  decideReleaseCandidate,
  buildRcEvidencePackage,
  summarizeNodeTestOutput
} from "../src/core/wave8-release-certification.js";
import { renderWave8CertificationPanel } from "../src/ui/wave8-certification-views.js";
import { getWave } from "../src/core/enterprise-roadmap-registry.js";
import { SUPER_ADMIN_FORBIDDEN } from "../src/core/rbac.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function fsExists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

function fsRead(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

test("Wave 8 catalog alias and gaps", () => {
  assert.equal(WAVE8_WAVE, "WAVE-08");
  assert.match(WAVE8_VERSION, /8\.0/);
  assert.equal(WAVE8_CATALOG_ALIAS.deliveryCode, "RELEASE_CERTIFICATION");
  assert.equal(WAVE8_CATALOG_ALIAS.historicalEirCode, "REPORTING_PLATFORM");
  const gaps = analyzeWave8Gaps();
  assert.equal(gaps.openCritical, 0);
  assert.equal(gaps.pilotReady, true);
  assert.equal(gaps.notNextJsRewrite, true);
  assert.ok(WAVE8_GAP_CHECKLIST.some((g) => g.id === "W8-G13" && g.status === "deferred"));
  assert.ok(WAVE8_PARITY_CHECKLIST.length >= 7);
  assert.ok(SUPER_ADMIN_FORBIDDEN.includes("System.Reset"));
  const smoke = wave8SmokeChecklist();
  assert.equal(smoke.wave, "WAVE-08");
});

test("cross-wave smoke includes Waves 1–7 + Phase 16", () => {
  let packageJson = {};
  try {
    packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  } catch {
    packageJson = {};
  }
  const cross = runCrossWaveSmoke({ existsPath: fsExists, packageJson });
  assert.equal(cross.ok, true, JSON.stringify(cross.failed));
  assert.ok(cross.checks.some((c) => c.id === "W7" && c.pass));
  assert.ok(cross.checks.some((c) => c.id === "NO_NEXT" && c.pass));
  assert.equal(cross.moneyDefaults.interest, 15);
  assert.equal(cross.wave7.fraudRules, 7);
});

test("security, DR, a11y, perf harnesses", () => {
  const security = runSecurityIsolationSmoke({ existsPath: fsExists });
  assert.equal(security.ok, true, JSON.stringify(security.failed));
  const dr = runDrOfflineSmoke({ existsPath: fsExists });
  assert.equal(dr.ok, true, JSON.stringify(dr.failed));
  const a11y = runAccessibilitySmoke({ readText: fsRead });
  assert.equal(a11y.ok, true, JSON.stringify(a11y.failed));
  const perf = runPerfSmokeHarness({ kpiCalcMs: 3 });
  assert.equal(perf.ok, true);
  assert.equal(perf.liveLoad, false);
});

test("defect registry blocks on critical; RC decision logic", () => {
  const blocked = buildDefectRegistry([
    { id: "X", title: "broken", level: "critical" }
  ]);
  assert.equal(blocked.openCritical, 1);
  assert.equal(blocked.releaseAllowed, false);

  const clean = buildDefectRegistry([]);
  assert.equal(clean.openCritical, 0);
  assert.equal(clean.releaseAllowed, true);

  const gateEval = evaluateWave8QualityGates({
    testPassRate: 100,
    openCriticalDefects: 0,
    openHighDefects: 0,
    securityPassed: true,
    perfPassed: true,
    drPassed: true
  });
  assert.equal(gateEval.mandatoryPassed, true);

  const pass = decideReleaseCandidate({
    crossWaveOk: true,
    gateEval,
    defects: clean,
    securityPassed: true,
    drPassed: true,
    a11yOk: true,
    testPassRate: 100
  });
  assert.equal(pass.decision, "PASS");
  assert.equal(pass.readyForWave9, true);
  assert.equal(pass.notProductionCert001, true);
  assert.equal(pass.cert001Preview.certified, false);

  const fail = decideReleaseCandidate({
    crossWaveOk: false,
    gateEval: { mandatoryPassed: false },
    defects: blocked,
    securityPassed: false,
    drPassed: false,
    a11yOk: false,
    testPassRate: 90
  });
  assert.equal(fail.decision, "FAIL");
  assert.ok(fail.blockers.length >= 3);
});

test("buildRcEvidencePackage + summarizeNodeTestOutput", () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  const summary = summarizeNodeTestOutput("# tests 10\n# pass 10\n# fail 0\n");
  assert.equal(summary.passed, 10);
  assert.equal(summary.failed, 0);
  assert.equal(summary.passRate, 100);
  const fancy = summarizeNodeTestOutput("ℹ tests 647\nℹ pass 647\nℹ fail 0\n");
  assert.equal(fancy.passed, 647);
  assert.equal(fancy.total, 647);
  assert.equal(fancy.passRate, 100);

  const evidence = buildRcEvidencePackage({
    existsPath: fsExists,
    readText: fsRead,
    packageJson,
    testSummary: summary,
    preparedWeb: true
  });
  assert.equal(evidence.schemaVersion, "wave8-rc-evidence/1.0");
  assert.equal(evidence.decision, "PASS");
  assert.equal(evidence.readyForWave9, true);
  assert.ok(evidence.qualityGates.gateResults.length >= 2);
});

test("UI panel and docs/registry", () => {
  const html = renderWave8CertificationPanel({
    smoke: wave8SmokeChecklist(),
    gaps: analyzeWave8Gaps(),
    evidence: { decision: "PASS", readyForWave9: true, blockers: [], qualityGates: { gateResults: [] } },
    canView: true
  });
  assert.match(html, /Release Certification/);
  assert.match(html, /RC1|pilot/i);

  const doc = fs.readFileSync(path.join(ROOT, "docs/wave8-release-certification.md"), "utf8");
  assert.match(doc, /WAVE-08/);
  assert.match(doc, /validate:rc/);
  assert.match(doc, /Phase 16|ETQAVS/i);
  assert.match(doc, /Reporting Platform/);
  assert.match(doc, /CERT-001/);
  assert.match(doc, /not.*Next\.js|NOT.*Next\.js|no Next\.js/i);

  assert.ok(fsExists("scripts/wave8-release-validate.js"));
  assert.ok(String(packageJsonScripts()).includes("validate:rc"));

  const wave = getWave(8) || getWave("WAVE-08");
  assert.ok(wave);
  assert.equal(wave.code, "RELEASE_CERTIFICATION");
  assert.match(String(wave.name), /Release Certification|Testing|Quality/i);
  assert.ok(String(wave.notes || "").includes("wave8-release-certification") || String(wave.notes || "").includes("RC1"));
  assert.ok((wave.requiredDocumentation || []).some((d) => String(d).includes("wave8-release-certification")));
});

function packageJsonScripts() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  return JSON.stringify(pkg.scripts || {});
}
