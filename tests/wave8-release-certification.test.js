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
  summarizeNodeTestOutput,
  WAVE8_EXPECTED_PLATFORM_SKIPS
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

// ------------------------------------------------------------------------------------------
// Skipped tests: only reviewed platform skips may leave the required pass rate at 100%

const STEP_B = "step B: the export writes the exact stored payload to a private STALE-DO-NOT-RESTORE file and prints only its fingerprint";
const STEP_B_REASON = "PostgreSQL 16 psql on Windows is not available";

function specRun({ pass, fail = 0, skipped = 0, todo = 0, skipLines = [], failLines = [] }) {
  return [
    "✔ some passing test (1.2ms)",
    ...failLines.map((name) => `✖ ${name} (3.1ms)`),
    ...skipLines,
    `ℹ tests ${pass + fail + skipped + todo}`,
    "ℹ suites 0",
    `ℹ pass ${pass}`,
    `ℹ fail ${fail}`,
    "ℹ cancelled 0",
    `ℹ skipped ${skipped}`,
    `ℹ todo ${todo}`,
    "ℹ duration_ms 278079.05"
  ].join("\n");
}
const stepBSpecLine = `﹣ ${STEP_B} (0.4ms) # ${STEP_B_REASON}`;

function rcFor(summary) {
  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  return buildRcEvidencePackage({ existsPath: fsExists, readText: fsRead, packageJson, testSummary: summary, preparedWeb: true });
}

test("skip policy: one reviewed entry that matches the real Windows-only test exactly", () => {
  assert.equal(WAVE8_EXPECTED_PLATFORM_SKIPS.length, 1);
  const [rule] = WAVE8_EXPECTED_PLATFORM_SKIPS;
  assert.equal(rule.name, STEP_B);
  assert.equal(rule.file, "tests/stale-snapshot-recovery.test.js");
  assert.equal(rule.skipReason, STEP_B_REASON);
  assert.equal(rule.runsOnPlatform, "win32");
  assert.match(rule.reason, /Windows-only rehearsal of Export-StaleSnapshotEvidence\.ps1/);
  assert.ok(Object.isFrozen(WAVE8_EXPECTED_PLATFORM_SKIPS) && Object.isFrozen(rule));
  const source = fsRead(rule.file);
  assert.equal(source.split(`test(${JSON.stringify(rule.name)}`).length - 1, 1, "the exact test name exists once in its file");
  assert.equal(source.split(`t.skip(${JSON.stringify(rule.skipReason)})`).length - 1, 1, "the exact skip reason exists once in its file");
  assert.match(source, /if \(process\.platform !== "win32" \|\| !fs\.existsSync\(PSQL\)\) return t\.skip\("PostgreSQL 16 psql on Windows is not available"\);/);
});

test("A/G. no skips: 1046 pass / 0 fail / 0 skipped is green at 100% on Windows and Linux", () => {
  for (const platform of ["win32", "linux"]) {
    const summary = summarizeNodeTestOutput(specRun({ pass: 1046 }), { platform });
    assert.equal(summary.total, 1046);
    assert.equal(summary.skipped, 0);
    assert.equal(summary.skippedReported, true);
    assert.equal(summary.expectedPlatformSkips, 0);
    assert.equal(summary.unexpectedSkipCount, 0);
    assert.equal(summary.requiredTotal, 1046);
    assert.equal(summary.passRate, 100);
    const rc = rcFor(summary);
    assert.equal(rc.decision, "PASS", rc.blockers.join(", "));
  }
});

test("B. the approved Windows-only test skipped on Linux: 1045 pass / 0 fail / 1 expected skip is 100% of required tests", () => {
  const summary = summarizeNodeTestOutput(specRun({ pass: 1045, skipped: 1, skipLines: [stepBSpecLine] }), { platform: "linux" });
  assert.equal(summary.total, 1046);
  assert.equal(summary.passed, 1045);
  assert.equal(summary.failed, 0);
  assert.equal(summary.skipped, 1);
  assert.equal(summary.expectedPlatformSkips, 1);
  assert.equal(summary.unexpectedSkipCount, 0);
  assert.equal(summary.skipsClassified, true);
  assert.equal(summary.requiredTotal, 1045);
  assert.equal(summary.passRate, 100);
  assert.equal(summary.rawPassRate, 99.9, "the raw rate is still recorded honestly");
  assert.deepEqual(summary.expectedSkips.map((item) => [item.name, item.file, item.platform]), [[STEP_B, "tests/stale-snapshot-recovery.test.js", "linux"]]);
  const rc = rcFor(summary);
  assert.equal(rc.decision, "PASS", rc.blockers.join(", "));
  assert.equal(rc.testSummary.passed, 1045, "evidence never claims 1046 passed");
  assert.equal(rc.testSummary.skipped, 1);
});

test("B'. the same skip on Windows, where the rehearsal must run, is unexpected", () => {
  const summary = summarizeNodeTestOutput(specRun({ pass: 1045, skipped: 1, skipLines: [stepBSpecLine] }), { platform: "win32" });
  assert.equal(summary.unexpectedSkipCount, 1);
  assert.equal(summary.requiredTotal, 1046);
  const rc = rcFor(summary);
  assert.equal(rc.decision, "FAIL");
  assert.ok(rc.blockers.includes("npm_test_unexpected_skips"));
  assert.ok(rc.blockers.includes("npm_test_not_green"));
});

test("C. an unknown skipped test fails with npm_test_unexpected_skips, including near-miss names and reasons", () => {
  for (const line of [
    "﹣ some other test (0.3ms) # SKIP",
    `﹣ ${STEP_B.slice(0, -1)} (0.4ms) # ${STEP_B_REASON}`,
    `﹣ ${STEP_B} extra (0.4ms) # ${STEP_B_REASON}`,
    `﹣ ${STEP_B} (0.4ms) # local database unavailable`,
    `﹣ ${STEP_B} (0.4ms) # SKIP`
  ]) {
    const summary = summarizeNodeTestOutput(specRun({ pass: 1045, skipped: 1, skipLines: [line] }), { platform: "linux" });
    assert.equal(summary.expectedPlatformSkips, 0, line);
    assert.equal(summary.unexpectedSkipCount, 1, line);
    const rc = rcFor(summary);
    assert.equal(rc.decision, "FAIL", line);
    assert.ok(rc.blockers.includes("npm_test_unexpected_skips"), line);
  }
});

test("D. a skip count whose test identity cannot be established fails closed", () => {
  const unnamed = summarizeNodeTestOutput(specRun({ pass: 1045, skipped: 1 }), { platform: "linux" });
  assert.equal(unnamed.skipped, 1);
  assert.equal(unnamed.unidentifiedSkips, 1);
  assert.equal(unnamed.skipsClassified, false);
  assert.equal(unnamed.requiredTotal, 1046);
  assert.ok(unnamed.passRate < 100);
  const rc = rcFor(unnamed);
  assert.equal(rc.decision, "FAIL");
  assert.ok(rc.blockers.includes("npm_test_unexpected_skips"));

  const moreSkipsThanNames = summarizeNodeTestOutput(specRun({ pass: 1044, skipped: 2, skipLines: [stepBSpecLine] }), { platform: "linux" });
  assert.equal(moreSkipsThanNames.skipsClassified, false);
  assert.equal(moreSkipsThanNames.expectedPlatformSkips, 0, "nothing is deducted until every skip is identified");
  assert.equal(rcFor(moreSkipsThanNames).decision, "FAIL");

  const noSkipLine = summarizeNodeTestOutput("ℹ tests 1046\nℹ pass 1045\nℹ fail 0\n", { platform: "linux" });
  assert.equal(noSkipLine.skippedReported, false);
  assert.equal(noSkipLine.skipped, 1, "an unaccounted test without an explicit skip count is treated as an unidentified skip");
  assert.equal(rcFor(noSkipLine).decision, "FAIL");
});

test("E. an expected skip never hides a failed test", () => {
  const summary = summarizeNodeTestOutput(specRun({ pass: 1044, fail: 1, skipped: 1, skipLines: [stepBSpecLine], failLines: ["broken thing"] }), { platform: "linux" });
  assert.equal(summary.expectedPlatformSkips, 1);
  assert.equal(summary.failed, 1);
  assert.equal(summary.requiredTotal, 1045);
  assert.ok(summary.passRate < 100);
  const rc = rcFor(summary);
  assert.equal(rc.decision, "FAIL");
  assert.ok(rc.blockers.includes("npm_test_not_green"));
});

test("F. one expected and one unknown skip together fail", () => {
  const summary = summarizeNodeTestOutput(specRun({ pass: 1044, skipped: 2, skipLines: [stepBSpecLine, "﹣ unknown test (0.2ms) # SKIP"] }), { platform: "linux" });
  assert.equal(summary.expectedSkips.length, 1);
  assert.equal(summary.unexpectedSkipCount, 1);
  assert.equal(summary.skipsClassified, false);
  assert.equal(summary.expectedPlatformSkips, 0);
  const rc = rcFor(summary);
  assert.equal(rc.decision, "FAIL");
  assert.ok(rc.blockers.includes("npm_test_unexpected_skips"));
});

test("H. TAP and colored default-reporter output parse the same way", () => {
  const tap = summarizeNodeTestOutput([
    "ok 1 - some passing test",
    `ok 2 - ${STEP_B} # SKIP ${STEP_B_REASON}`,
    "# tests 2", "# pass 1", "# fail 0", "# skipped 1", "# todo 0"
  ].join("\n"), { platform: "linux" });
  assert.equal(tap.skipped, 1);
  assert.equal(tap.expectedPlatformSkips, 1);
  assert.equal(tap.requiredTotal, 1);
  assert.equal(tap.passRate, 100);

  const escaped = summarizeNodeTestOutput("ok 1 - name with \\# hash # SKIP\n# tests 1\n# pass 0\n# fail 0\n# skipped 1\n", { platform: "linux" });
  assert.deepEqual(escaped.skippedTests, [{ name: "name with # hash", skipReason: "" }]);
  assert.equal(escaped.unexpectedSkipCount, 1);

  const colored = summarizeNodeTestOutput(`\x1b[36m${stepBSpecLine}\x1b[39m\n` + specRun({ pass: 1045, skipped: 1 }), { platform: "linux" });
  assert.equal(colored.expectedPlatformSkips, 1);
  assert.equal(colored.passRate, 100);

  const legacy = summarizeNodeTestOutput("# tests 10\n# pass 10\n# fail 0\n");
  assert.equal(legacy.skipped, 0);
  assert.equal(legacy.passRate, 100);
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
