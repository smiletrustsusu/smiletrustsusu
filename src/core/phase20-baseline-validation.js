/**
 * Phase 20 — Enterprise baseline consistency validation (EIBPRFBS).
 * Loads/references prior canonical registries where importable; checks coverage,
 * ownership, readiness/certification completeness, and expected phase docs.
 * Does not redefine Phases 1–19 or replace Modules 1–30.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  EIBPRFBS_VERSION,
  PRIOR_PHASE_COUNT,
  MODULE_COUNT,
  PHASE16_GATE_EXCEPTION_RULE,
  PHASE16_PROD_GATES,
  MONEY_INVARIANTS,
  listModuleBaselines,
  listPhaseBaselines,
  listProductionReadinessChecks,
  listEnterpriseCertifications,
  listAcceptanceTypes,
  listFinalGovernance,
  getProductionReadinessCheck,
  getEnterpriseCertification,
  validateBaselineRegistry,
  assertIdUniqueness,
  assertModuleCoverage,
  assertPhaseCoverage,
  assertReadinessOwners,
  assertCertificationCompleteness,
  eibprfbsCounts
} from "./canonical-baseline-registry.js";

export const P20_BASELINE_VALIDATION_VERSION = "1.0.0";
export { EIBPRFBS_VERSION, PHASE16_GATE_EXCEPTION_RULE, PHASE16_PROD_GATES, MONEY_INVARIANTS };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");

function ok(extra = {}) {
  return { ok: true, ...extra };
}

function err(code, message, extra = {}) {
  return { ok: false, code, message, ...extra };
}

function fileExists(relPath) {
  if (!relPath) return false;
  return fs.existsSync(path.join(ROOT, relPath.replace(/^\.\//, "")));
}

/**
 * Soft-import prior registries. Failures become warnings (catalog continuity),
 * not Critical — Phase 20 must not break if a prior export shape changes slightly.
 */
export async function loadPriorRegistries() {
  const refs = [
    ["continuity", "./canonical-continuity-registry.js"],
    ["testing", "./canonical-testing-registry.js"],
    ["performance", "./canonical-performance-registry.js"],
    ["operations", "./canonical-operations-registry.js"],
    ["governance", "./canonical-governance-registry.js"],
    ["monitoring", "./canonical-monitoring-registry.js"],
    ["deployment", "./canonical-deployment-registry.js"],
    ["config", "./canonical-config-registry.js"],
    ["ai", "./canonical-ai-registry.js"]
  ];
  const loaded = {};
  const warnings = [];
  for (const [name, rel] of refs) {
    try {
      loaded[name] = await import(rel);
    } catch (e) {
      warnings.push(`Prior registry ${name} not importable: ${e.message}`);
    }
  }
  return { loaded, warnings };
}

export function checkPriorRegistryContinuity(loaded = {}) {
  const warnings = [];
  const critical = [];

  if (loaded.governance) {
    if (loaded.governance.PLATFORM_MODULE !== 30) {
      critical.push("Governance registry PLATFORM_MODULE must remain 30");
    }
    if (loaded.governance.PHASE16_GATE_EXCEPTION_RULE !== PHASE16_GATE_EXCEPTION_RULE) {
      critical.push("Governance Phase 16 exception rule drift");
    }
  } else {
    warnings.push("canonical-governance-registry.js not loaded for continuity check");
  }

  if (loaded.testing) {
    const gates = loaded.testing.listQualityGates?.() || loaded.testing.QUALITY_GATES;
    if (Array.isArray(gates)) {
      for (const gid of PHASE16_PROD_GATES) {
        const found = gates.find((g) => g.id === gid || g === gid);
        if (!found) warnings.push(`Phase 16 gate ${gid} not found in testing registry export`);
      }
    }
  } else {
    warnings.push("canonical-testing-registry.js not loaded for gate continuity");
  }

  if (loaded.config && loaded.config.ECPFMS_VERSION == null) {
    warnings.push("Config registry missing ECPFMS_VERSION");
  }

  return { critical, warnings };
}

export function checkPhaseDocReferences() {
  const critical = [];
  const warnings = [];
  for (const ph of listPhaseBaselines()) {
    if (!ph.primaryDoc) {
      critical.push(`${ph.id} missing primaryDoc`);
      continue;
    }
    if (!fileExists(ph.primaryDoc)) {
      // Registry-backed phases may point at companion module docs; missing is Critical
      // only when no registryPath exists as compensating artifact.
      if (ph.registryPath && fileExists(ph.registryPath)) {
        warnings.push(`${ph.id} primaryDoc missing on disk (${ph.primaryDoc}); registry present`);
      } else {
        critical.push(`${ph.id} primaryDoc not found: ${ph.primaryDoc}`);
      }
    }
    if (ph.registryPath && !fileExists(ph.registryPath)) {
      warnings.push(`${ph.id} registryPath not found: ${ph.registryPath}`);
    }
    if (ph.catalogsDoc && !fileExists(ph.catalogsDoc)) {
      warnings.push(`${ph.id} catalogsDoc not found: ${ph.catalogsDoc}`);
    }
  }
  return { critical, warnings };
}

export function checkModuleDocReferences() {
  const critical = [];
  const warnings = [];
  for (const mod of listModuleBaselines()) {
    if (!mod.primaryDoc) {
      critical.push(`${mod.id} missing primaryDoc`);
      continue;
    }
    if (!fileExists(mod.primaryDoc)) {
      // Modules 1–3 may only appear in EMAS; treat EMAS hit as compensating.
      if (mod.moduleId <= 3 && fileExists("docs/enterprise-master-architecture.md")) {
        warnings.push(`${mod.id} dedicated module doc missing; EMAS catalog covers module ${mod.moduleId}`);
      } else {
        critical.push(`${mod.id} primaryDoc not found: ${mod.primaryDoc}`);
      }
    }
  }
  return { critical, warnings };
}

/**
 * Evaluate production readiness from a gate/result map.
 * Mandatory gates fail closed without approved exception (Phase 16/19 pattern).
 */
export function evaluateProductionReadiness({
  checkResults = {},
  exceptions = {},
  asOf = new Date().toISOString()
} = {}) {
  const checks = listProductionReadinessChecks();
  const failures = [];
  const passed = [];
  const exceptionApproved = [];

  for (const check of checks) {
    const result = checkResults[check.id] || checkResults[check.code];
    const status = result?.status || result || "missing";
    const exc = exceptions[check.id] || exceptions[check.code];

    if (status === "pass") {
      passed.push(check.id);
      continue;
    }

    if (status === "exception_approved" || (exc && isExceptionValid(exc, asOf))) {
      if (check.mandatory && !exc && status !== "exception_approved") {
        failures.push({
          id: check.id,
          reason: "exception_approved status without exception record"
        });
      } else {
        exceptionApproved.push(check.id);
      }
      continue;
    }

    if (check.mandatory || check.failClosed) {
      failures.push({
        id: check.id,
        reason: status === "missing" ? "mandatory_gate_missing" : `status=${status}`,
        failClosed: true
      });
    }
  }

  const okAll = failures.length === 0;
  return ok({
    ready: okAll,
    failClosed: !okAll,
    passed,
    exceptionApproved,
    failures,
    mandatoryCount: checks.filter((c) => c.mandatory).length,
    asOf,
    consumesPhase16ExceptionRule: PHASE16_GATE_EXCEPTION_RULE,
    note: "Catalog evaluation only — does not certify a live bank production go-live"
  });
}

export function isExceptionValid(exc, asOf = new Date().toISOString()) {
  if (!exc || typeof exc !== "object") return false;
  if (exc.state && exc.state !== "approved") return false;
  if (exc.rule && exc.rule !== PHASE16_GATE_EXCEPTION_RULE) return false;
  const now = Date.parse(asOf);
  if (exc.validFrom && Date.parse(exc.validFrom) > now) return false;
  if (exc.validTo && Date.parse(exc.validTo) < now) return false;
  if (exc.expiresAt && Date.parse(exc.expiresAt) < now) return false;
  return true;
}

/**
 * Certification expiry / renewal rules.
 */
export function evaluateCertificationValidity({
  certificationId,
  issuedAt,
  expiresAt,
  asOf = new Date().toISOString(),
  renewed = false
} = {}) {
  const cert = getEnterpriseCertification(certificationId);
  if (!cert) return err("P20-CERT-001", `Unknown certification ${certificationId}`);

  if (!issuedAt) return err("P20-CERT-002", "issuedAt required");

  let expiry = expiresAt;
  if (!expiry) {
    const issuedMs = Date.parse(issuedAt);
    expiry = new Date(issuedMs + cert.defaultExpiryDays * 86400000).toISOString();
  }

  const now = Date.parse(asOf);
  const expMs = Date.parse(expiry);
  const expired = expMs < now;
  const valid = !expired || renewed === true;

  if (expired && cert.renewalRequired && !renewed) {
    return err("P20-CERT-003", "Certification expired; renewal required", {
      certificationId,
      expiresAt: expiry,
      renewalRequired: true,
      valid: false
    });
  }

  return ok({
    certificationId,
    certificationType: cert.certificationType,
    issuedAt,
    expiresAt: expiry,
    valid,
    expired,
    renewalRequired: !!cert.renewalRequired,
    approvalRoles: [...(cert.approvalRoles || [])],
    entryCriteria: [...(cert.entryCriteria || [])]
  });
}

/**
 * Comprehensive enterprise baseline validation.
 * @returns {{ ok: boolean, critical: string[], warnings: string[], summary: object }}
 */
export async function validateEnterpriseBaseline(options = {}) {
  const critical = [];
  const warnings = [];

  const registry = validateBaselineRegistry();
  if (!registry.ok) {
    critical.push(registry.message);
    if (registry.errors) critical.push(...registry.errors);
  }

  for (const fn of [
    assertIdUniqueness,
    assertModuleCoverage,
    assertPhaseCoverage,
    assertReadinessOwners,
    assertCertificationCompleteness
  ]) {
    const r = fn();
    if (!r.ok) critical.push(r.message);
  }

  const mods = listModuleBaselines();
  const phases = listPhaseBaselines();
  if (mods.length !== MODULE_COUNT) critical.push(`Expected ${MODULE_COUNT} modules, got ${mods.length}`);
  if (phases.length !== PRIOR_PHASE_COUNT) {
    critical.push(`Expected ${PRIOR_PHASE_COUNT} phases, got ${phases.length}`);
  }

  const docMods = checkModuleDocReferences();
  critical.push(...docMods.critical);
  warnings.push(...docMods.warnings);

  const docPhases = checkPhaseDocReferences();
  critical.push(...docPhases.critical);
  warnings.push(...docPhases.warnings);

  // Phase 20 own docs
  for (const rel of [
    "docs/enterprise-implementation-baseline.md",
    "docs/eibprfbs-catalogs.md",
    "docs/phase20-final-validation-report.md",
    "src/core/canonical-baseline-registry.js",
    "src/core/phase20-baseline-validation.js"
  ]) {
    if (!fileExists(rel)) critical.push(`Missing Phase 20 artifact: ${rel}`);
  }

  // Schema presence
  for (const rel of [
    "docs/schemas/baseline/enterprise-baseline-artifact.schema.json",
    "docs/schemas/baseline/production-readiness-result.schema.json",
    "docs/schemas/baseline/enterprise-certification.schema.json"
  ]) {
    if (!fileExists(rel)) critical.push(`Missing Phase 20 schema: ${rel}`);
  }

  const readiness = listProductionReadinessChecks();
  const missingOwner = readiness.filter((r) => !r.accountableAuthority);
  if (missingOwner.length) {
    critical.push(`Readiness checks without owners: ${missingOwner.map((m) => m.id).join(",")}`);
  }

  const certs = listEnterpriseCertifications();
  for (const c of certs) {
    if (!c.entryCriteria?.length) critical.push(`${c.id} missing entryCriteria`);
    if (!c.approvalRoles?.length) critical.push(`${c.id} missing approvalRoles`);
  }

  const acceptance = listAcceptanceTypes();
  for (const a of acceptance) {
    for (const rid of a.requiredReadinessIds || []) {
      if (!getProductionReadinessCheck(rid)) {
        critical.push(`${a.id} dangling readiness ref ${rid}`);
      }
    }
  }

  const gov = listFinalGovernance();
  if (gov.length < 6) warnings.push("Final governance entries fewer than expected minimum (6)");

  let priorWarnings = [];
  if (options.skipPriorImports !== true) {
    try {
      const { loaded, warnings: loadWarn } = await loadPriorRegistries();
      priorWarnings = loadWarn;
      const cont = checkPriorRegistryContinuity(loaded);
      critical.push(...cont.critical);
      warnings.push(...cont.warnings);
    } catch (e) {
      warnings.push(`Prior registry import skipped: ${e.message}`);
    }
  }

  warnings.push(...priorWarnings);

  // Deduplicate
  const crit = [...new Set(critical)];
  const warn = [...new Set(warnings)];

  const summary = {
    version: EIBPRFBS_VERSION,
    validationVersion: P20_BASELINE_VALIDATION_VERSION,
    counts: eibprfbsCounts(),
    criticalCount: crit.length,
    warningCount: warn.length,
    modules: MODULE_COUNT,
    phases: PRIOR_PHASE_COUNT,
    specificationBaselinePublicationReady: crit.length === 0,
    liveProductionGoLiveClaimed: false,
    note:
      "Critical=0 means the *specification baseline* is consistent for publication — not that a live production bank is certified."
  };

  return {
    ok: crit.length === 0,
    critical: crit,
    warnings: warn,
    summary
  };
}

export function evaluateReadinessFailClosed(checkResults = {}, exceptions = {}) {
  const result = evaluateProductionReadiness({ checkResults, exceptions });
  return {
    ...result,
    ok: result.ready === true,
    message: result.ready
      ? "All mandatory readiness checks passed or exception-approved"
      : "Mandatory readiness gate(s) failed closed"
  };
}
