/**
 * Phase 16 — Canonical Testing Registry (ETQAVS).
 * Catalog of test suites, quality gates, validation rules, certification
 * criteria, thresholds, sample sizes, stress windows, and recovery limits.
 * Consumes Phase 14 CI/CD & env promotion and Phase 15 RPO/RTO recovery —
 * does not redefine them. Does not replace Modules 1–30 operational engines.
 * Catalog only: no money posts, no RBAC rewrite, no new nav.
 */

export const ETQAVS_VERSION = "1.0.0";
export const ETQAVS_STATUS = "Authoritative";
export const CI_CD_PHASE_REF = "src/core/canonical-deployment-registry.js";
export const PHASE14_ENV_PROMOTION_REF = "docs/enterprise-deployment-devops.md#quality-gates";
export const PHASE15_RTO_REF = "src/core/canonical-continuity-registry.js";
export const PHASE15_BREACH_REF = "src/core/phase15-breach-reporting.js";
export const PHASE12_AI_REF = "src/core/canonical-ai-registry.js";
export const PHASE9_SECURITY_REF = "docs/enterprise-security.md";
export const MONITORING_MODULE = 19;
export const BACKUP_ENGINE_MODULE = 21;
export const AI_MODULE = 29;
export const PLATFORM_MODULE = 30;

export const SUITE_ID_PATTERN = /^TSU-[0-9]{3}$/;
export const CASE_ID_PATTERN = /^TC-[0-9]{3}$/;
export const GATE_ID_PATTERN = /^QG-[0-9]{3}$/;
export const VAL_ID_PATTERN = /^VAL-[0-9]{3}$/;
export const CERT_ID_PATTERN = /^CERT-[0-9]{3}$/;
export const THR_ID_PATTERN = /^THR-[0-9]{3}$/;
export const SMP_ID_PATTERN = /^SMP-[0-9]{3}$/;
export const REC_LIM_ID_PATTERN = /^RLIM-[0-9]{3}$/;
export const KPI_ID_PATTERN = /^KPI-[0-9]{3}$/;
export const CODE_PATTERN = /^[A-Z][A-Z0-9_]{2,63}$/;

/** Aligns with Phase 14 REQUIRED_ENV_CODES promotion path. */
export const PROMOTION_PATH = Object.freeze([
  "DEV",
  "QA",
  "UAT",
  "STAGING",
  "PRODUCTION"
]);

export const TEST_LEVELS = Object.freeze([
  "unit",
  "integration",
  "system",
  "uat",
  "regression",
  "security",
  "performance",
  "load",
  "stress",
  "dr",
  "backup_restore",
  "ai",
  "database",
  "accessibility",
  "compatibility",
  "smoke",
  "sanity"
]);

export const DEFECT_SEVERITIES = Object.freeze([
  Object.freeze({
    code: "Critical",
    rank: 1,
    releaseRule: "0_open",
    description: "Blocks release; 0 open required"
  }),
  Object.freeze({
    code: "High",
    rank: 2,
    releaseRule: "0_open_unless_approved_exception",
    description: "0 open unless formally approved exception"
  }),
  Object.freeze({
    code: "Medium",
    rank: 3,
    releaseRule: "approved_remediation_plan_required",
    description: "Approved remediation plan required"
  }),
  Object.freeze({
    code: "Low",
    rank: 4,
    releaseRule: "logged_and_scheduled",
    description: "Logged and scheduled"
  })
]);

export const DEFECT_PRIORITIES = Object.freeze([
  "P0_immediate",
  "P1_high",
  "P2_medium",
  "P3_low"
]);

export const GATE_DECISIONS = Object.freeze(["pass", "fail", "exception_approved"]);
export const CERT_DECISIONS = Object.freeze(["certified", "rejected", "pending"]);

/** Stabilization aligns with Phase 14 production/DR (30 min) — not redefined. */
export const STABILIZATION_MINUTES = 30;
export const STATISTICAL_CONFIDENCE = Object.freeze({
  confidenceLevel: 0.95,
  marginOfError: 0.05
});

function freezeEntry(entry) {
  if (!entry || typeof entry !== "object") return entry;
  const out = { ...entry };
  for (const key of Object.keys(out)) {
    if (Array.isArray(out[key])) out[key] = Object.freeze([...out[key]]);
    else if (out[key] && typeof out[key] === "object") out[key] = Object.freeze({ ...out[key] });
  }
  return Object.freeze(out);
}

function ok(extra = {}) {
  return { ok: true, ...extra };
}

function err(code, message, extra = {}) {
  return { ok: false, code, message, ...extra };
}

// ─── Roles (Accountable Authorities) ─────────────────────────────────────────

export const TESTING_ROLES = Object.freeze([
  freezeEntry({
    id: "ROLE-QA-LEAD",
    code: "ROLE_QA_LEAD",
    title: "QA Lead",
    accountableAuthority: "QA Lead"
  }),
  freezeEntry({
    id: "ROLE-VALIDATION-LEAD",
    code: "ROLE_VALIDATION_LEAD",
    title: "Validation Lead",
    accountableAuthority: "Validation Lead"
  }),
  freezeEntry({
    id: "ROLE-TEST-ARCHITECT",
    code: "ROLE_TEST_ARCHITECT",
    title: "Enterprise Test Architect",
    accountableAuthority: "Enterprise Test Architect"
  }),
  freezeEntry({
    id: "ROLE-SECURITY-TEST",
    code: "ROLE_SECURITY_TEST",
    title: "Security Test Architect",
    accountableAuthority: "Security Operations Lead"
  }),
  freezeEntry({
    id: "ROLE-PERF-ENG",
    code: "ROLE_PERF_ENG",
    title: "Performance Test Engineer",
    accountableAuthority: "Performance Test Engineer"
  }),
  freezeEntry({
    id: "ROLE-CIO",
    code: "ROLE_CIO",
    title: "Chief Information Officer",
    accountableAuthority: "CIO"
  }),
  freezeEntry({
    id: "ROLE-RELEASE-MGR",
    code: "ROLE_RELEASE_MGR",
    title: "Release Manager",
    accountableAuthority: "Release Manager"
  }),
  freezeEntry({
    id: "ROLE-PLATFORM-OPS",
    code: "ROLE_PLATFORM_OPS",
    title: "Platform Operations Lead",
    accountableAuthority: "Platform Operations Lead"
  }),
  freezeEntry({
    id: "ROLE-AI-VALIDATION",
    code: "ROLE_AI_VALIDATION",
    title: "AI Validation Specialist",
    accountableAuthority: "AI Validation Specialist"
  }),
  freezeEntry({
    id: "ROLE-BUSINESS-OWNER",
    code: "ROLE_BUSINESS_OWNER",
    title: "Business Acceptance Owner",
    accountableAuthority: "Business Acceptance Owner"
  })
]);

// ─── Test Suite Registry ─────────────────────────────────────────────────────

export const TEST_SUITES = Object.freeze([
  freezeEntry({
    id: "TSU-001",
    code: "SUITE_UNIT",
    name: "Unit test suite",
    level: "unit",
    mandatory: true,
    automationRequired: true,
    phase14PipelineHint: "PIPE-001",
    relatedModules: Object.freeze([1, 2, 3, 4, 5, 6, 7, 24, 27]),
    accountableAuthority: "QA Lead",
    roleId: "ROLE-QA-LEAD",
    description: "Mandatory unit tests; coverage gates apply per THR-001…THR-006"
  }),
  freezeEntry({
    id: "TSU-002",
    code: "SUITE_INTEGRATION",
    name: "Integration test suite",
    level: "integration",
    mandatory: true,
    automationRequired: true,
    phase14PipelineHint: "PIPE-001",
    relatedModules: Object.freeze([7, 12, 16, 28]),
    accountableAuthority: "Enterprise Test Architect",
    roleId: "ROLE-TEST-ARCHITECT",
    description: "API/DB/payment/notification integration; in-process contract facades only"
  }),
  freezeEntry({
    id: "TSU-003",
    code: "SUITE_SYSTEM",
    name: "System / E2E suite",
    level: "system",
    mandatory: true,
    automationRequired: true,
    relatedModules: Object.freeze([1, 2, 3, 4, 5, 6, 15, 16]),
    accountableAuthority: "QA Lead",
    roleId: "ROLE-QA-LEAD",
    description: "Critical workflows, offline sync, branch/tenant isolation; money in pesewas"
  }),
  freezeEntry({
    id: "TSU-004",
    code: "SUITE_UAT",
    name: "User acceptance suite",
    level: "uat",
    mandatory: true,
    automationRequired: false,
    relatedModules: Object.freeze([1, 2, 3, 4, 5, 6, 30]),
    accountableAuthority: "Business Acceptance Owner",
    roleId: "ROLE-BUSINESS-OWNER",
    description: "Business scenarios + sign-off; interest 15%, collection days 31, cashier limit 1000"
  }),
  freezeEntry({
    id: "TSU-005",
    code: "SUITE_REGRESSION",
    name: "Regression suite",
    level: "regression",
    mandatory: true,
    automationRequired: true,
    relatedModules: Object.freeze([1, 2, 3, 4, 5, 6, 7, 24, 27]),
    accountableAuthority: "QA Lead",
    roleId: "ROLE-QA-LEAD",
    description: "Release regression including smoke/sanity subsets"
  }),
  freezeEntry({
    id: "TSU-006",
    code: "SUITE_SECURITY",
    name: "Security validation suite",
    level: "security",
    mandatory: true,
    automationRequired: true,
    relatedModules: Object.freeze([22, 30]),
    phaseRef: "Phase 9",
    accountableAuthority: "Security Operations Lead",
    roleId: "ROLE-SECURITY-TEST",
    description: "AuthZ/AuthN/session/secrets/vuln/dependency scans — consumes Phase 9 controls"
  }),
  freezeEntry({
    id: "TSU-007",
    code: "SUITE_PERFORMANCE",
    name: "Performance suite",
    level: "performance",
    mandatory: true,
    automationRequired: true,
    relatedModules: Object.freeze([19]),
    accountableAuthority: "Performance Test Engineer",
    roleId: "ROLE-PERF-ENG",
    description: "Response time, throughput, resource utilization vs THR-PERF-*"
  }),
  freezeEntry({
    id: "TSU-008",
    code: "SUITE_LOAD",
    name: "Load suite",
    level: "load",
    mandatory: true,
    automationRequired: true,
    relatedModules: Object.freeze([19]),
    accountableAuthority: "Performance Test Engineer",
    roleId: "ROLE-PERF-ENG",
    description: "Production-equivalent concurrent load (≥60 min)"
  }),
  freezeEntry({
    id: "TSU-009",
    code: "SUITE_STRESS",
    name: "Stress suite",
    level: "stress",
    mandatory: true,
    automationRequired: true,
    relatedModules: Object.freeze([19, 30]),
    accountableAuthority: "Performance Test Engineer",
    roleId: "ROLE-PERF-ENG",
    description: "Phased 100%→200% workload with recovery/stabilization windows"
  }),
  freezeEntry({
    id: "TSU-010",
    code: "SUITE_DR",
    name: "Disaster recovery validation suite",
    level: "dr",
    mandatory: true,
    automationRequired: false,
    relatedModules: Object.freeze([21, 30]),
    phaseRef: "Phase 15",
    accountableAuthority: "Platform Operations Lead",
    roleId: "ROLE-PLATFORM-OPS",
    description: "DR exercises validate Phase 15 RTO/RPO — does not redefine budgets"
  }),
  freezeEntry({
    id: "TSU-011",
    code: "SUITE_BACKUP_RESTORE",
    name: "Backup restore validation suite",
    level: "backup_restore",
    mandatory: true,
    automationRequired: true,
    relatedModules: Object.freeze([21]),
    accountableAuthority: "Platform Operations Lead",
    roleId: "ROLE-PLATFORM-OPS",
    description: "Module 21 verify/restore; integrity 100%"
  }),
  freezeEntry({
    id: "TSU-012",
    code: "SUITE_AI_VALIDATION",
    name: "AI model validation suite",
    level: "ai",
    mandatory: true,
    automationRequired: true,
    relatedModules: Object.freeze([29, 24]),
    phaseRef: "Phase 12",
    accountableAuthority: "AI Validation Specialist",
    roleId: "ROLE-AI-VALIDATION",
    description: "Advisory-only AI; accuracy/precision/recall/drift/bias; no auto loan approval"
  }),
  freezeEntry({
    id: "TSU-013",
    code: "SUITE_DATABASE",
    name: "Database validation suite",
    level: "database",
    mandatory: true,
    automationRequired: true,
    relatedModules: Object.freeze([7, 21]),
    accountableAuthority: "Validation Lead",
    roleId: "ROLE-VALIDATION-LEAD",
    description: "Referential integrity, migrations, rollback; amounts remain integer pesewas"
  }),
  freezeEntry({
    id: "TSU-014",
    code: "SUITE_SMOKE",
    name: "Smoke suite",
    level: "smoke",
    mandatory: true,
    automationRequired: true,
    relatedModules: Object.freeze([1, 22, 30]),
    accountableAuthority: "QA Lead",
    roleId: "ROLE-QA-LEAD",
    description: "Post-deploy smoke for health, auth, critical path"
  }),
  freezeEntry({
    id: "TSU-015",
    code: "SUITE_SANITY",
    name: "Sanity suite",
    level: "sanity",
    mandatory: false,
    automationRequired: true,
    relatedModules: Object.freeze([1, 2, 3]),
    accountableAuthority: "QA Lead",
    roleId: "ROLE-QA-LEAD",
    description: "Focused sanity after hotfixes"
  }),
  freezeEntry({
    id: "TSU-016",
    code: "SUITE_ACCESSIBILITY",
    name: "Accessibility suite",
    level: "accessibility",
    mandatory: false,
    automationRequired: true,
    relatedModules: Object.freeze([30]),
    accountableAuthority: "QA Lead",
    roleId: "ROLE-QA-LEAD",
    description: "Web admin accessibility checks"
  }),
  freezeEntry({
    id: "TSU-017",
    code: "SUITE_COMPATIBILITY",
    name: "Compatibility suite",
    level: "compatibility",
    mandatory: false,
    automationRequired: true,
    relatedModules: Object.freeze([15, 30]),
    accountableAuthority: "QA Lead",
    roleId: "ROLE-QA-LEAD",
    description: "Web + Android APK + Electron EXE matrix"
  })
]);

// ─── Representative test cases (catalog samples) ─────────────────────────────

export const TEST_CASES = Object.freeze([
  freezeEntry({
    id: "TC-001",
    code: "TC_UNIT_COVERAGE_GATE",
    suiteId: "TSU-001",
    name: "Unit coverage ≥90% line",
    mandatory: true,
    accountableAuthority: "QA Lead",
    roleId: "ROLE-QA-LEAD"
  }),
  freezeEntry({
    id: "TC-002",
    code: "TC_INTEGRATION_API_CONTRACT",
    suiteId: "TSU-002",
    name: "API contract compliance 100%",
    mandatory: true,
    accountableAuthority: "Enterprise Test Architect",
    roleId: "ROLE-TEST-ARCHITECT"
  }),
  freezeEntry({
    id: "TC-003",
    code: "TC_SYSTEM_OFFLINE_SYNC",
    suiteId: "TSU-003",
    name: "Offline/online reconciliation 100%",
    mandatory: true,
    accountableAuthority: "QA Lead",
    roleId: "ROLE-QA-LEAD"
  }),
  freezeEntry({
    id: "TC-004",
    code: "TC_UAT_BUSINESS_SIGNOFF",
    suiteId: "TSU-004",
    name: "Business sign-off recorded",
    mandatory: true,
    accountableAuthority: "Business Acceptance Owner",
    roleId: "ROLE-BUSINESS-OWNER"
  }),
  freezeEntry({
    id: "TC-005",
    code: "TC_SECURITY_AUTHZ",
    suiteId: "TSU-006",
    name: "Authorization / no privilege escalation",
    mandatory: true,
    accountableAuthority: "Security Operations Lead",
    roleId: "ROLE-SECURITY-TEST"
  }),
  freezeEntry({
    id: "TC-006",
    code: "TC_PERF_P95",
    suiteId: "TSU-007",
    name: "P95 response ≤750ms",
    mandatory: true,
    accountableAuthority: "Performance Test Engineer",
    roleId: "ROLE-PERF-ENG"
  }),
  freezeEntry({
    id: "TC-007",
    code: "TC_DR_RTO",
    suiteId: "TSU-010",
    name: "DR exercise within Phase 15 RTO",
    mandatory: true,
    accountableAuthority: "Platform Operations Lead",
    roleId: "ROLE-PLATFORM-OPS"
  }),
  freezeEntry({
    id: "TC-008",
    code: "TC_AI_ADVISORY_ONLY",
    suiteId: "TSU-012",
    name: "AI remains advisory; no auto loan approval",
    mandatory: true,
    accountableAuthority: "AI Validation Specialist",
    roleId: "ROLE-AI-VALIDATION"
  }),
  freezeEntry({
    id: "TC-009",
    code: "TC_MONEY_PESEWAS",
    suiteId: "TSU-003",
    name: "Money amounts integer pesewas; interest 15; collection days 31; cashier 1000",
    mandatory: true,
    accountableAuthority: "Validation Lead",
    roleId: "ROLE-VALIDATION-LEAD"
  }),
  freezeEntry({
    id: "TC-010",
    code: "TC_BACKUP_RESTORE",
    suiteId: "TSU-011",
    name: "Module 21 backup restore validation 100%",
    mandatory: true,
    accountableAuthority: "Platform Operations Lead",
    roleId: "ROLE-PLATFORM-OPS"
  })
]);

// ─── Quality Gate Registry (env promotion — consume Phase 14 path) ───────────

export const QUALITY_GATES = Object.freeze([
  freezeEntry({
    id: "QG-001",
    code: "GATE_DEV_TO_QA",
    name: "Development → QA",
    fromEnv: "DEV",
    toEnv: "QA",
    requiredSuiteIds: Object.freeze(["TSU-001", "TSU-002"]),
    requiredThresholdCategories: Object.freeze(["unit", "integration", "static_analysis"]),
    requiredApprovals: Object.freeze(["ROLE-QA-LEAD"]),
    accountableAuthority: "QA Lead",
    roleId: "ROLE-QA-LEAD",
    bypassRequires: "emergency_exception_approved",
    description: "Unit, integration, static analysis"
  }),
  freezeEntry({
    id: "QG-002",
    code: "GATE_QA_TO_UAT",
    name: "QA → UAT",
    fromEnv: "QA",
    toEnv: "UAT",
    requiredSuiteIds: Object.freeze(["TSU-003", "TSU-005", "TSU-006"]),
    requiredThresholdCategories: Object.freeze(["system", "regression", "security"]),
    requiredApprovals: Object.freeze(["ROLE-QA-LEAD", "ROLE-SECURITY-TEST"]),
    accountableAuthority: "QA Lead",
    roleId: "ROLE-QA-LEAD",
    bypassRequires: "emergency_exception_approved",
    description: "Functional, regression, security"
  }),
  freezeEntry({
    id: "QG-003",
    code: "GATE_UAT_TO_STAGING",
    name: "UAT → Staging",
    fromEnv: "UAT",
    toEnv: "STAGING",
    requiredSuiteIds: Object.freeze(["TSU-004", "TSU-007"]),
    requiredThresholdCategories: Object.freeze(["uat", "performance"]),
    requiredApprovals: Object.freeze(["ROLE-BUSINESS-OWNER", "ROLE-PERF-ENG"]),
    accountableAuthority: "Business Acceptance Owner",
    roleId: "ROLE-BUSINESS-OWNER",
    bypassRequires: "emergency_exception_approved",
    description: "Business acceptance, performance"
  }),
  freezeEntry({
    id: "QG-004",
    code: "GATE_STAGING_TO_PROD",
    name: "Staging → Production",
    fromEnv: "STAGING",
    toEnv: "PRODUCTION",
    requiredSuiteIds: Object.freeze([
      "TSU-005",
      "TSU-006",
      "TSU-007",
      "TSU-010",
      "TSU-011",
      "TSU-014"
    ]),
    requiredThresholdCategories: Object.freeze([
      "regression",
      "security",
      "performance",
      "dr",
      "backup_restore",
      "release_certification"
    ]),
    requiredApprovals: Object.freeze([
      "ROLE-VALIDATION-LEAD",
      "ROLE-RELEASE-MGR",
      "ROLE-CIO",
      "ROLE-PLATFORM-OPS"
    ]),
    accountableAuthority: "CIO",
    roleId: "ROLE-CIO",
    bypassRequires: "emergency_exception_approved",
    description: "Full certification, release approval"
  })
]);

// ─── Validation Registry ─────────────────────────────────────────────────────

export const VALIDATIONS = Object.freeze([
  freezeEntry({
    id: "VAL-001",
    code: "VAL_THRESHOLD_MEASURABLE",
    name: "Every threshold is measurable",
    category: "threshold",
    accountableAuthority: "Validation Lead",
    roleId: "ROLE-VALIDATION-LEAD"
  }),
  freezeEntry({
    id: "VAL-002",
    code: "VAL_SAMPLE_WINDOW",
    name: "Sample size and measurement window validity",
    category: "measurement",
    accountableAuthority: "Validation Lead",
    roleId: "ROLE-VALIDATION-LEAD"
  }),
  freezeEntry({
    id: "VAL-003",
    code: "VAL_RECOVERY_LIMITS",
    name: "Recovery time limits vs Phase 15 RTO",
    category: "recovery",
    accountableAuthority: "Platform Operations Lead",
    roleId: "ROLE-PLATFORM-OPS"
  }),
  freezeEntry({
    id: "VAL-004",
    code: "VAL_EVIDENCE_INTEGRITY",
    name: "Test evidence supports every reported result",
    category: "evidence",
    accountableAuthority: "Validation Lead",
    roleId: "ROLE-VALIDATION-LEAD"
  }),
  freezeEntry({
    id: "VAL-005",
    code: "VAL_EXCEPTION_TRACEABILITY",
    name: "Exceptions formally approved and traceable",
    category: "governance",
    accountableAuthority: "CIO",
    roleId: "ROLE-CIO"
  }),
  freezeEntry({
    id: "VAL-006",
    code: "VAL_MONITORING_HOOKS",
    name: "Module 19 monitoring validation for release",
    category: "monitoring",
    relatedModules: Object.freeze([19]),
    accountableAuthority: "Platform Operations Lead",
    roleId: "ROLE-PLATFORM-OPS"
  })
]);

// ─── Certification Registry ──────────────────────────────────────────────────

export const CERTIFICATIONS = Object.freeze([
  freezeEntry({
    id: "CERT-001",
    code: "CERT_PRODUCTION_RELEASE",
    name: "Production release certification",
    requiredGateIds: Object.freeze(["QG-001", "QG-002", "QG-003", "QG-004"]),
    requiredSuiteIds: Object.freeze([
      "TSU-005",
      "TSU-006",
      "TSU-007",
      "TSU-010",
      "TSU-011"
    ]),
    requiresBusinessAcceptance: true,
    requiresMonitoringValidation: true,
    requiresSecurityPass: true,
    requiresDrPass: true,
    accountableAuthority: "CIO",
    roleId: "ROLE-CIO",
    description: "All mandatory gates + perf/security/DR/monitoring/business acceptance"
  }),
  freezeEntry({
    id: "CERT-002",
    code: "CERT_HOTFIX_EMERGENCY",
    name: "Emergency hotfix certification",
    requiredGateIds: Object.freeze(["QG-001", "QG-004"]),
    requiredSuiteIds: Object.freeze(["TSU-001", "TSU-014", "TSU-006"]),
    requiresBusinessAcceptance: false,
    requiresMonitoringValidation: true,
    requiresSecurityPass: true,
    requiresDrPass: false,
    requiresException: true,
    accountableAuthority: "CIO",
    roleId: "ROLE-CIO",
    description: "Narrow path; emergency exception mandatory"
  })
]);

// ─── Pass/Fail Thresholds (Appendix A) ───────────────────────────────────────

export const THRESHOLDS = Object.freeze([
  // Unit
  freezeEntry({
    id: "THR-001",
    code: "THR_UNIT_PASS_RATE",
    category: "unit",
    metric: "test_pass_rate",
    comparator: "eq",
    passValue: 100,
    unit: "percent",
    failCondition: "Any failed mandatory unit test",
    accountableAuthority: "QA Lead",
    roleId: "ROLE-QA-LEAD"
  }),
  freezeEntry({
    id: "THR-002",
    code: "THR_UNIT_LINE_COVERAGE",
    category: "unit",
    metric: "line_coverage",
    comparator: "gte",
    passValue: 90,
    unit: "percent",
    failCondition: "< 90%",
    accountableAuthority: "QA Lead",
    roleId: "ROLE-QA-LEAD"
  }),
  freezeEntry({
    id: "THR-003",
    code: "THR_UNIT_BRANCH_COVERAGE",
    category: "unit",
    metric: "branch_coverage",
    comparator: "gte",
    passValue: 85,
    unit: "percent",
    failCondition: "< 85%",
    accountableAuthority: "QA Lead",
    roleId: "ROLE-QA-LEAD"
  }),
  freezeEntry({
    id: "THR-004",
    code: "THR_UNIT_FUNCTION_COVERAGE",
    category: "unit",
    metric: "function_coverage",
    comparator: "gte",
    passValue: 95,
    unit: "percent",
    failCondition: "< 95%",
    accountableAuthority: "QA Lead",
    roleId: "ROLE-QA-LEAD"
  }),
  freezeEntry({
    id: "THR-005",
    code: "THR_UNIT_MUTATION",
    category: "unit",
    metric: "mutation_score",
    comparator: "gte",
    passValue: 80,
    unit: "percent",
    failCondition: "< 80%",
    accountableAuthority: "QA Lead",
    roleId: "ROLE-QA-LEAD"
  }),
  freezeEntry({
    id: "THR-006",
    code: "THR_UNIT_STATIC_CRITICAL",
    category: "static_analysis",
    metric: "critical_static_issues",
    comparator: "eq",
    passValue: 0,
    unit: "count",
    failCondition: "≥ 1 Critical issue",
    accountableAuthority: "QA Lead",
    roleId: "ROLE-QA-LEAD"
  }),
  // Integration
  freezeEntry({
    id: "THR-010",
    code: "THR_INT_PASS_RATE",
    category: "integration",
    metric: "test_pass_rate",
    comparator: "eq",
    passValue: 100,
    unit: "percent",
    failCondition: "Any failed critical integration test",
    accountableAuthority: "Enterprise Test Architect",
    roleId: "ROLE-TEST-ARCHITECT"
  }),
  freezeEntry({
    id: "THR-011",
    code: "THR_INT_API_CONTRACT",
    category: "integration",
    metric: "api_contract_compliance",
    comparator: "eq",
    passValue: 100,
    unit: "percent",
    failCondition: "Any contract mismatch",
    accountableAuthority: "Enterprise Test Architect",
    roleId: "ROLE-TEST-ARCHITECT"
  }),
  freezeEntry({
    id: "THR-012",
    code: "THR_INT_DB_INTEGRITY",
    category: "integration",
    metric: "database_transaction_integrity",
    comparator: "eq",
    passValue: 100,
    unit: "percent",
    failCondition: "Any integrity violation",
    accountableAuthority: "Validation Lead",
    roleId: "ROLE-VALIDATION-LEAD"
  }),
  freezeEntry({
    id: "THR-013",
    code: "THR_INT_EXTERNAL",
    category: "integration",
    metric: "external_service_success",
    comparator: "gte",
    passValue: 99,
    unit: "percent",
    failCondition: "Below 99%",
    accountableAuthority: "Enterprise Test Architect",
    roleId: "ROLE-TEST-ARCHITECT"
  }),
  freezeEntry({
    id: "THR-014",
    code: "THR_INT_QUEUE",
    category: "integration",
    metric: "message_queue_success",
    comparator: "gte",
    passValue: 99.9,
    unit: "percent",
    failCondition: "Below 99.9%",
    accountableAuthority: "Enterprise Test Architect",
    roleId: "ROLE-TEST-ARCHITECT"
  }),
  // System
  freezeEntry({
    id: "THR-020",
    code: "THR_SYS_CRITICAL_WF",
    category: "system",
    metric: "critical_workflow_pass",
    comparator: "eq",
    passValue: 100,
    unit: "percent",
    failCondition: "Any failed critical workflow",
    accountableAuthority: "QA Lead",
    roleId: "ROLE-QA-LEAD"
  }),
  freezeEntry({
    id: "THR-021",
    code: "THR_SYS_CROSS_MODULE",
    category: "system",
    metric: "cross_module_integration",
    comparator: "eq",
    passValue: 100,
    unit: "percent",
    failCondition: "Any unresolved integration failure",
    accountableAuthority: "QA Lead",
    roleId: "ROLE-QA-LEAD"
  }),
  freezeEntry({
    id: "THR-022",
    code: "THR_SYS_SYNC",
    category: "system",
    metric: "offline_online_sync",
    comparator: "eq",
    passValue: 100,
    unit: "percent",
    failCondition: "Any unreconciled transaction",
    accountableAuthority: "QA Lead",
    roleId: "ROLE-QA-LEAD"
  }),
  freezeEntry({
    id: "THR-023",
    code: "THR_SYS_BRANCH_ISO",
    category: "system",
    metric: "branch_isolation",
    comparator: "eq",
    passValue: 100,
    unit: "percent",
    failCondition: "Any data leakage",
    accountableAuthority: "Validation Lead",
    roleId: "ROLE-VALIDATION-LEAD"
  }),
  freezeEntry({
    id: "THR-024",
    code: "THR_SYS_TENANT_ISO",
    category: "system",
    metric: "tenant_isolation",
    comparator: "eq",
    passValue: 100,
    unit: "percent",
    failCondition: "Any cross-tenant access",
    accountableAuthority: "Validation Lead",
    roleId: "ROLE-VALIDATION-LEAD"
  }),
  // UAT
  freezeEntry({
    id: "THR-030",
    code: "THR_UAT_SCENARIOS",
    category: "uat",
    metric: "approved_business_scenarios",
    comparator: "eq",
    passValue: 100,
    unit: "percent",
    failCondition: "Any mandatory scenario rejected",
    accountableAuthority: "Business Acceptance Owner",
    roleId: "ROLE-BUSINESS-OWNER"
  }),
  freezeEntry({
    id: "THR-031",
    code: "THR_UAT_SIGNOFF",
    category: "uat",
    metric: "business_signoff",
    comparator: "eq",
    passValue: 1,
    unit: "boolean",
    failCondition: "Missing sign-off",
    accountableAuthority: "Business Acceptance Owner",
    roleId: "ROLE-BUSINESS-OWNER"
  }),
  freezeEntry({
    id: "THR-032",
    code: "THR_UAT_HIGH_DEFECTS",
    category: "uat",
    metric: "open_high_defects",
    comparator: "eq",
    passValue: 0,
    unit: "count",
    failCondition: "≥ 1 Open High",
    accountableAuthority: "QA Lead",
    roleId: "ROLE-QA-LEAD"
  }),
  freezeEntry({
    id: "THR-033",
    code: "THR_UAT_CRITICAL_DEFECTS",
    category: "uat",
    metric: "open_critical_defects",
    comparator: "eq",
    passValue: 0,
    unit: "count",
    failCondition: "≥ 1 Open Critical",
    accountableAuthority: "QA Lead",
    roleId: "ROLE-QA-LEAD"
  }),
  // Performance
  freezeEntry({
    id: "THR-040",
    code: "THR_PERF_MEDIAN",
    category: "performance",
    metric: "median_api_response_ms",
    comparator: "lte",
    passValue: 300,
    unit: "ms",
    failCondition: "> 300 ms",
    accountableAuthority: "Performance Test Engineer",
    roleId: "ROLE-PERF-ENG"
  }),
  freezeEntry({
    id: "THR-041",
    code: "THR_PERF_P95",
    category: "performance",
    metric: "p95_response_ms",
    comparator: "lte",
    passValue: 750,
    unit: "ms",
    failCondition: "> 750 ms",
    accountableAuthority: "Performance Test Engineer",
    roleId: "ROLE-PERF-ENG"
  }),
  freezeEntry({
    id: "THR-042",
    code: "THR_PERF_P99",
    category: "performance",
    metric: "p99_response_ms",
    comparator: "lte",
    passValue: 1500,
    unit: "ms",
    failCondition: "> 1.5 s",
    accountableAuthority: "Performance Test Engineer",
    roleId: "ROLE-PERF-ENG"
  }),
  freezeEntry({
    id: "THR-043",
    code: "THR_PERF_AVAILABILITY",
    category: "performance",
    metric: "api_availability",
    comparator: "gte",
    passValue: 99.9,
    unit: "percent",
    failCondition: "< 99.9%",
    accountableAuthority: "Performance Test Engineer",
    roleId: "ROLE-PERF-ENG"
  }),
  freezeEntry({
    id: "THR-044",
    code: "THR_PERF_ERROR_RATE",
    category: "performance",
    metric: "error_rate",
    comparator: "lte",
    passValue: 0.5,
    unit: "percent",
    failCondition: "> 0.5%",
    accountableAuthority: "Performance Test Engineer",
    roleId: "ROLE-PERF-ENG"
  }),
  freezeEntry({
    id: "THR-045",
    code: "THR_PERF_CPU",
    category: "performance",
    metric: "cpu_utilization_steady",
    comparator: "lte",
    passValue: 70,
    unit: "percent",
    failCondition: "> 70%",
    accountableAuthority: "Performance Test Engineer",
    roleId: "ROLE-PERF-ENG"
  }),
  freezeEntry({
    id: "THR-046",
    code: "THR_PERF_MEMORY",
    category: "performance",
    metric: "memory_utilization_steady",
    comparator: "lte",
    passValue: 75,
    unit: "percent",
    failCondition: "> 75%",
    accountableAuthority: "Performance Test Engineer",
    roleId: "ROLE-PERF-ENG"
  }),
  // Load/stress integrity
  freezeEntry({
    id: "THR-050",
    code: "THR_LOAD_DATA_INTEGRITY",
    category: "load",
    metric: "data_integrity",
    comparator: "eq",
    passValue: 100,
    unit: "percent",
    failCondition: "Any corruption",
    accountableAuthority: "Performance Test Engineer",
    roleId: "ROLE-PERF-ENG"
  }),
  freezeEntry({
    id: "THR-051",
    code: "THR_STRESS_GRACEFUL",
    category: "stress",
    metric: "graceful_degradation",
    comparator: "eq",
    passValue: 1,
    unit: "boolean",
    failCondition: "Service crash or data corruption",
    accountableAuthority: "Performance Test Engineer",
    roleId: "ROLE-PERF-ENG"
  }),
  // Security
  freezeEntry({
    id: "THR-060",
    code: "THR_SEC_CRITICAL_VULN",
    category: "security",
    metric: "critical_vulnerabilities",
    comparator: "eq",
    passValue: 0,
    unit: "count",
    failCondition: "≥ 1",
    accountableAuthority: "Security Operations Lead",
    roleId: "ROLE-SECURITY-TEST"
  }),
  freezeEntry({
    id: "THR-061",
    code: "THR_SEC_HIGH_VULN",
    category: "security",
    metric: "unresolved_high_vulnerabilities",
    comparator: "eq",
    passValue: 0,
    unit: "count",
    failCondition: "≥ 1 unresolved",
    accountableAuthority: "Security Operations Lead",
    roleId: "ROLE-SECURITY-TEST"
  }),
  freezeEntry({
    id: "THR-062",
    code: "THR_SEC_AUTHN",
    category: "security",
    metric: "authentication_tests_pass",
    comparator: "eq",
    passValue: 100,
    unit: "percent",
    failCondition: "Any failed mandatory authentication test",
    accountableAuthority: "Security Operations Lead",
    roleId: "ROLE-SECURITY-TEST"
  }),
  freezeEntry({
    id: "THR-063",
    code: "THR_SEC_AUTHZ",
    category: "security",
    metric: "authorization_tests_pass",
    comparator: "eq",
    passValue: 100,
    unit: "percent",
    failCondition: "Any privilege escalation or unauthorized access",
    accountableAuthority: "Security Operations Lead",
    roleId: "ROLE-SECURITY-TEST"
  }),
  // Database
  freezeEntry({
    id: "THR-070",
    code: "THR_DB_REFERENTIAL",
    category: "database",
    metric: "referential_integrity",
    comparator: "eq",
    passValue: 100,
    unit: "percent",
    failCondition: "Any violation",
    accountableAuthority: "Validation Lead",
    roleId: "ROLE-VALIDATION-LEAD"
  }),
  freezeEntry({
    id: "THR-071",
    code: "THR_DB_MIGRATION",
    category: "database",
    metric: "migration_validation",
    comparator: "eq",
    passValue: 100,
    unit: "percent",
    failCondition: "Migration failure",
    accountableAuthority: "Validation Lead",
    roleId: "ROLE-VALIDATION-LEAD"
  }),
  freezeEntry({
    id: "THR-072",
    code: "THR_DB_BACKUP_RESTORE",
    category: "backup_restore",
    metric: "backup_restore_validation",
    comparator: "eq",
    passValue: 100,
    unit: "percent",
    failCondition: "Restore failure",
    accountableAuthority: "Platform Operations Lead",
    roleId: "ROLE-PLATFORM-OPS"
  }),
  freezeEntry({
    id: "THR-073",
    code: "THR_DB_ROLLBACK",
    category: "database",
    metric: "transaction_rollback",
    comparator: "eq",
    passValue: 100,
    unit: "percent",
    failCondition: "Rollback inconsistency",
    accountableAuthority: "Validation Lead",
    roleId: "ROLE-VALIDATION-LEAD"
  }),
  // AI (advisory)
  freezeEntry({
    id: "THR-080",
    code: "THR_AI_ACCURACY",
    category: "ai",
    metric: "accuracy",
    comparator: "gte",
    passValue: 95,
    unit: "percent",
    failCondition: "Below approved target",
    accountableAuthority: "AI Validation Specialist",
    roleId: "ROLE-AI-VALIDATION",
    notes: "Or approved model-specific target; Phase 12 advisory only"
  }),
  freezeEntry({
    id: "THR-081",
    code: "THR_AI_NO_DRIFT",
    category: "ai",
    metric: "unacceptable_drift",
    comparator: "eq",
    passValue: 0,
    unit: "boolean_flag",
    failCondition: "Unresolved unacceptable drift",
    accountableAuthority: "AI Validation Specialist",
    roleId: "ROLE-AI-VALIDATION"
  }),
  // DR — consume Phase 15 RPO/RTO (pass when measured ≤ approved)
  freezeEntry({
    id: "THR-090",
    code: "THR_DR_RPO",
    category: "dr",
    metric: "rpo_achievement",
    comparator: "lte_approved_rpo",
    passValue: null,
    unit: "minutes",
    failCondition: "Exceeds Phase 14/15 RPO target",
    accountableAuthority: "Platform Operations Lead",
    roleId: "ROLE-PLATFORM-OPS",
    consumesPhase15: true
  }),
  freezeEntry({
    id: "THR-091",
    code: "THR_DR_RTO",
    category: "dr",
    metric: "rto_achievement",
    comparator: "lte_approved_rto",
    passValue: null,
    unit: "minutes",
    failCondition: "Exceeds Phase 14/15 RTO target",
    accountableAuthority: "Platform Operations Lead",
    roleId: "ROLE-PLATFORM-OPS",
    consumesPhase15: true
  }),
  freezeEntry({
    id: "THR-092",
    code: "THR_DR_INTEGRITY",
    category: "dr",
    metric: "data_integrity",
    comparator: "eq",
    passValue: 100,
    unit: "percent",
    failCondition: "Any inconsistency",
    accountableAuthority: "Platform Operations Lead",
    roleId: "ROLE-PLATFORM-OPS"
  }),
  // Defect release rules
  freezeEntry({
    id: "THR-100",
    code: "THR_DEF_CRITICAL_OPEN",
    category: "defect",
    metric: "open_critical_defects",
    comparator: "eq",
    passValue: 0,
    unit: "count",
    failCondition: "≥ 1 Critical open",
    accountableAuthority: "QA Lead",
    roleId: "ROLE-QA-LEAD"
  }),
  freezeEntry({
    id: "THR-101",
    code: "THR_DEF_HIGH_OPEN",
    category: "defect",
    metric: "open_high_defects",
    comparator: "eq_or_exception",
    passValue: 0,
    unit: "count",
    failCondition: "≥ 1 High open without approved exception",
    accountableAuthority: "QA Lead",
    roleId: "ROLE-QA-LEAD"
  })
]);

// ─── Sample sizes & measurement windows (Appendix B) ─────────────────────────

export const SAMPLE_WINDOWS = Object.freeze([
  freezeEntry({
    id: "SMP-001",
    code: "SMP_UNIT_EXEC",
    category: "unit",
    metric: "unit_test_execution",
    minSample: "100% mandatory unit tests",
    window: "One complete build",
    accountableAuthority: "QA Lead",
    roleId: "ROLE-QA-LEAD"
  }),
  freezeEntry({
    id: "SMP-002",
    code: "SMP_INT_DB_TXN",
    category: "integration",
    metric: "database_transactions",
    minSampleNumeric: 1000,
    minSample: "Minimum 1,000 representative transactions",
    window: "Entire integration test execution",
    accountableAuthority: "Validation Lead",
    roleId: "ROLE-VALIDATION-LEAD"
  }),
  freezeEntry({
    id: "SMP-003",
    code: "SMP_SYS_CONCURRENT",
    category: "system",
    metric: "concurrent_user_scenarios",
    minSample: "Approved peak user profile",
    windowMinutesMin: 60,
    window: "Sustained execution ≥ 60 minutes",
    accountableAuthority: "QA Lead",
    roleId: "ROLE-QA-LEAD"
  }),
  freezeEntry({
    id: "SMP-004",
    code: "SMP_SYS_SYNC",
    category: "system",
    metric: "offline_online_sync_events",
    minSampleNumeric: 500,
    minSample: "Minimum 500 synchronization events",
    window: "Full synchronization cycle",
    accountableAuthority: "QA Lead",
    roleId: "ROLE-QA-LEAD"
  }),
  freezeEntry({
    id: "SMP-005",
    code: "SMP_UAT_SCENARIOS",
    category: "uat",
    metric: "business_scenarios",
    minSample: "100% mandatory business scenarios",
    window: "Complete UAT cycle",
    accountableAuthority: "Business Acceptance Owner",
    roleId: "ROLE-BUSINESS-OWNER"
  }),
  freezeEntry({
    id: "SMP-006",
    code: "SMP_PERF_RESPONSE",
    category: "performance",
    metric: "response_time",
    minSampleNumeric: 10000,
    minSample: "Minimum 10,000 requests",
    windowMinutesMin: 30,
    warmupMinutesMin: 5,
    window: "Sustained 30-minute steady-state (exclude ≥5 min warm-up)",
    accountableAuthority: "Performance Test Engineer",
    roleId: "ROLE-PERF-ENG"
  }),
  freezeEntry({
    id: "SMP-007",
    code: "SMP_LOAD_TXN",
    category: "load",
    metric: "transactions",
    minSampleNumeric: 100000,
    minSample: "Minimum 100,000 business transactions",
    windowMinutesMin: 60,
    window: "Entire load test (≥60 min concurrent users)",
    accountableAuthority: "Performance Test Engineer",
    roleId: "ROLE-PERF-ENG"
  }),
  freezeEntry({
    id: "SMP-008",
    code: "SMP_LOAD_QUEUE",
    category: "load",
    metric: "queue_processing",
    minSampleNumeric: 50000,
    minSample: "Minimum 50,000 queued events",
    window: "Entire load test",
    accountableAuthority: "Performance Test Engineer",
    roleId: "ROLE-PERF-ENG"
  }),
  freezeEntry({
    id: "SMP-009",
    code: "SMP_SEC_AUTHZ",
    category: "security",
    metric: "authorization_scenarios",
    minSample: "100% role/permission combinations",
    window: "One complete security test cycle",
    accountableAuthority: "Security Operations Lead",
    roleId: "ROLE-SECURITY-TEST"
  }),
  freezeEntry({
    id: "SMP-010",
    code: "SMP_DB_TXN",
    category: "database",
    metric: "transaction_validation",
    minSampleNumeric: 10000,
    minSample: "Minimum 10,000 representative transactions",
    window: "Full database test cycle",
    accountableAuthority: "Validation Lead",
    roleId: "ROLE-VALIDATION-LEAD"
  }),
  freezeEntry({
    id: "SMP-011",
    code: "SMP_AI_DRIFT",
    category: "ai",
    metric: "drift_detection",
    minSample: "Rolling production observations",
    windowDaysMin: 30,
    window: "Minimum 30 consecutive days",
    accountableAuthority: "AI Validation Specialist",
    roleId: "ROLE-AI-VALIDATION"
  }),
  freezeEntry({
    id: "SMP-012",
    code: "SMP_AI_LATENCY",
    category: "ai",
    metric: "inference_latency",
    minSampleNumeric: 10000,
    minSample: "Minimum 10,000 predictions",
    windowMinutesMin: 30,
    window: "Sustained 30-minute period",
    accountableAuthority: "AI Validation Specialist",
    roleId: "ROLE-AI-VALIDATION"
  }),
  freezeEntry({
    id: "SMP-013",
    code: "SMP_DR_RTO",
    category: "dr",
    metric: "rto_measurement",
    minSample: "Entire recovery event",
    window: "From outage declaration to stabilized service",
    accountableAuthority: "Platform Operations Lead",
    roleId: "ROLE-PLATFORM-OPS"
  })
]);

// ─── Stress-test phases (Appendix C) ─────────────────────────────────────────

export const STRESS_PHASES = Object.freeze([
  freezeEntry({
    id: "STP-001",
    code: "STRESS_ENV_VALIDATION",
    name: "Environment Validation",
    order: 1,
    required: true,
    minMinutes: 5,
    maxMinutes: 30,
    accountableAuthority: "Performance Test Engineer",
    roleId: "ROLE-PERF-ENG"
  }),
  freezeEntry({
    id: "STP-002",
    code: "STRESS_WARMUP",
    name: "Warm-Up",
    order: 2,
    required: true,
    minMinutes: 10,
    maxMinutes: 20,
    accountableAuthority: "Performance Test Engineer",
    roleId: "ROLE-PERF-ENG"
  }),
  freezeEntry({
    id: "STP-003",
    code: "STRESS_BASELINE",
    name: "Baseline Measurement",
    order: 3,
    required: true,
    minMinutes: 15,
    maxMinutes: 30,
    loadPercent: 100,
    accountableAuthority: "Performance Test Engineer",
    roleId: "ROLE-PERF-ENG"
  }),
  freezeEntry({
    id: "STP-004",
    code: "STRESS_RAMPUP",
    name: "Ramp-Up",
    order: 4,
    required: true,
    minMinutes: 30,
    maxMinutes: 60,
    loadProgression: Object.freeze([125, 150, 175]),
    accountableAuthority: "Performance Test Engineer",
    roleId: "ROLE-PERF-ENG"
  }),
  freezeEntry({
    id: "STP-005",
    code: "STRESS_SUSTAINED",
    name: "Sustained Stress",
    order: 5,
    required: true,
    minMinutes: 60,
    maxMinutes: 120,
    accountableAuthority: "Performance Test Engineer",
    roleId: "ROLE-PERF-ENG"
  }),
  freezeEntry({
    id: "STP-006",
    code: "STRESS_PEAK",
    name: "Peak Load",
    order: 6,
    required: true,
    minMinutes: 30,
    maxMinutes: 60,
    loadPercent: 200,
    accountableAuthority: "Performance Test Engineer",
    roleId: "ROLE-PERF-ENG"
  }),
  freezeEntry({
    id: "STP-007",
    code: "STRESS_FAILURE_OBS",
    name: "Failure Observation",
    order: 7,
    required: true,
    minMinutes: 15,
    maxMinutes: 60,
    stableFailureMinutes: 15,
    accountableAuthority: "Performance Test Engineer",
    roleId: "ROLE-PERF-ENG"
  }),
  freezeEntry({
    id: "STP-008",
    code: "STRESS_RECOVERY",
    name: "Recovery",
    order: 8,
    required: true,
    minMinutes: 30,
    maxMinutes: null,
    accountableAuthority: "Performance Test Engineer",
    roleId: "ROLE-PERF-ENG"
  }),
  freezeEntry({
    id: "STP-009",
    code: "STRESS_STABILIZATION",
    name: "Stabilization",
    order: 9,
    required: true,
    minMinutes: 30,
    maxMinutes: 60,
    accountableAuthority: "Performance Test Engineer",
    roleId: "ROLE-PERF-ENG"
  })
]);

export const STRESS_WORKLOAD_STAGES = Object.freeze([
  freezeEntry({ stage: "Baseline", loadPercent: 100 }),
  freezeEntry({ stage: "Ramp 1", loadPercent: 125 }),
  freezeEntry({ stage: "Ramp 2", loadPercent: 150 }),
  freezeEntry({ stage: "Ramp 3", loadPercent: 175 }),
  freezeEntry({ stage: "Peak", loadPercent: 200 })
]);

export const STRESS_SAMPLING = Object.freeze([
  freezeEntry({ metric: "cpu_utilization", everySeconds: 5 }),
  freezeEntry({ metric: "memory_utilization", everySeconds: 5 }),
  freezeEntry({ metric: "disk_io", everySeconds: 10 }),
  freezeEntry({ metric: "network_throughput", everySeconds: 10 }),
  freezeEntry({ metric: "api_response_time", everySeconds: 0, note: "every_request" }),
  freezeEntry({ metric: "error_rate", everySeconds: 0, note: "continuous" }),
  freezeEntry({ metric: "db_query_latency", everySeconds: 0, note: "every_query" }),
  freezeEntry({ metric: "queue_depth", everySeconds: 10 }),
  freezeEntry({ metric: "ai_inference_latency", everySeconds: 0, note: "every_inference" }),
  freezeEntry({ metric: "health_checks", everySeconds: 30 })
]);

// ─── Recovery time limits (Appendix D) — testing limits; RTO from Phase 15 ───

export const RECOVERY_LIMITS = Object.freeze([
  freezeEntry({
    id: "RLIM-001",
    code: "RLIM_APP_RESTART",
    scenario: "Application Service Restart",
    maxMinutes: 5,
    accountableAuthority: "Platform Operations Lead",
    roleId: "ROLE-PLATFORM-OPS"
  }),
  freezeEntry({
    id: "RLIM-002",
    code: "RLIM_API_GATEWAY",
    scenario: "API Gateway Recovery",
    maxMinutes: 10,
    accountableAuthority: "Platform Operations Lead",
    roleId: "ROLE-PLATFORM-OPS"
  }),
  freezeEntry({
    id: "RLIM-003",
    code: "RLIM_WORKER",
    scenario: "Background Worker Recovery",
    maxMinutes: 10,
    accountableAuthority: "Platform Operations Lead",
    roleId: "ROLE-PLATFORM-OPS"
  }),
  freezeEntry({
    id: "RLIM-004",
    code: "RLIM_DB_RESTART",
    scenario: "Database Service Restart",
    maxMinutes: 15,
    accountableAuthority: "Platform Operations Lead",
    roleId: "ROLE-PLATFORM-OPS"
  }),
  freezeEntry({
    id: "RLIM-005",
    code: "RLIM_DB_FAILOVER",
    scenario: "Database Failover",
    maxMinutes: 30,
    accountableAuthority: "Platform Operations Lead",
    roleId: "ROLE-PLATFORM-OPS"
  }),
  freezeEntry({
    id: "RLIM-006",
    code: "RLIM_BACKUP_RESTORE",
    scenario: "Backup Restoration Validation",
    maxMinutes: 60,
    engineModule: 21,
    accountableAuthority: "Platform Operations Lead",
    roleId: "ROLE-PLATFORM-OPS"
  }),
  freezeEntry({
    id: "RLIM-007",
    code: "RLIM_WEB_PORTAL",
    scenario: "Web Administration Portal Recovery",
    maxMinutes: 15,
    accountableAuthority: "Platform Operations Lead",
    roleId: "ROLE-PLATFORM-OPS"
  }),
  freezeEntry({
    id: "RLIM-008",
    code: "RLIM_ANDROID_BACKEND",
    scenario: "Android Backend Services Recovery",
    maxMinutes: 15,
    accountableAuthority: "Platform Operations Lead",
    roleId: "ROLE-PLATFORM-OPS"
  }),
  freezeEntry({
    id: "RLIM-009",
    code: "RLIM_AUTH",
    scenario: "Authentication Service Recovery",
    maxMinutes: 15,
    relatedModules: Object.freeze([22]),
    accountableAuthority: "Security Operations Lead",
    roleId: "ROLE-SECURITY-TEST"
  }),
  freezeEntry({
    id: "RLIM-010",
    code: "RLIM_NOTIFICATION",
    scenario: "Notification Service Recovery",
    maxMinutes: 30,
    relatedModules: Object.freeze([12]),
    accountableAuthority: "Platform Operations Lead",
    roleId: "ROLE-PLATFORM-OPS"
  }),
  freezeEntry({
    id: "RLIM-011",
    code: "RLIM_AI_INFERENCE",
    scenario: "AI Inference Service Recovery",
    maxMinutes: 60,
    relatedModules: Object.freeze([29]),
    accountableAuthority: "AI Validation Specialist",
    roleId: "ROLE-AI-VALIDATION"
  }),
  freezeEntry({
    id: "RLIM-012",
    code: "RLIM_COMPLETE_DR",
    scenario: "Complete Disaster Recovery Exercise",
    maxMinutes: null,
    usesPhase15Rto: true,
    passCondition: "≤ Approved Phase 15 RTO",
    failCondition: "Exceeds approved RTO",
    accountableAuthority: "Platform Operations Lead",
    roleId: "ROLE-PLATFORM-OPS"
  })
]);

export const RECOVERY_PHASE_LIMITS = Object.freeze([
  freezeEntry({ phase: "Failure Detection", maxMinutes: 1 }),
  freezeEntry({ phase: "Incident Classification", maxMinutes: 5 }),
  freezeEntry({ phase: "Recovery Initiation", maxMinutes: 5 }),
  freezeEntry({ phase: "Infrastructure Restoration", maxMinutes: 15 }),
  freezeEntry({ phase: "Application Startup", maxMinutes: 10 }),
  freezeEntry({ phase: "Database Validation", maxMinutes: 10 }),
  freezeEntry({ phase: "Functional Validation", maxMinutes: 10 }),
  freezeEntry({ phase: "Stabilization", maxMinutes: 30 })
]);

// ─── KPIs ────────────────────────────────────────────────────────────────────

export const QUALITY_KPIS = Object.freeze([
  freezeEntry({
    id: "KPI-001",
    code: "KPI_TEST_PASS_RATE",
    name: "Test Pass Rate",
    formula: "(Passed Tests ÷ Total Executed Mandatory Tests) × 100",
    thresholdHint: "≥ 100% for mandatory suites at gate",
    reporting: "per_build",
    accountableAuthority: "QA Lead",
    roleId: "ROLE-QA-LEAD"
  }),
  freezeEntry({
    id: "KPI-002",
    code: "KPI_DEFECT_DENSITY",
    name: "Defect Density",
    formula: "Defects Found ÷ KLOC (or story points)",
    thresholdHint: "Trend down; release gate via severity rules",
    reporting: "per_release",
    accountableAuthority: "QA Lead",
    roleId: "ROLE-QA-LEAD"
  }),
  freezeEntry({
    id: "KPI-003",
    code: "KPI_ESCAPE_RATE",
    name: "Defect Escape Rate",
    formula: "(Production Defects ÷ (Pre-Prod + Production Defects)) × 100",
    thresholdHint: "Minimize; investigate escapes > baseline",
    reporting: "monthly",
    accountableAuthority: "QA Lead",
    roleId: "ROLE-QA-LEAD"
  }),
  freezeEntry({
    id: "KPI-004",
    code: "KPI_AUTOMATION_COVERAGE",
    name: "Automation Coverage",
    formula: "(Automated Mandatory Cases ÷ Total Mandatory Cases) × 100",
    thresholdHint: "Increase toward full mandatory automation where feasible",
    reporting: "per_release",
    accountableAuthority: "Enterprise Test Architect",
    roleId: "ROLE-TEST-ARCHITECT"
  }),
  freezeEntry({
    id: "KPI-005",
    code: "KPI_MTTV",
    name: "Mean Time To Validate",
    formula: "Σ Validation Duration ÷ Validations Completed",
    thresholdHint: "Within CI SLA; Phase 14 pipeline consume",
    reporting: "weekly",
    accountableAuthority: "Validation Lead",
    roleId: "ROLE-VALIDATION-LEAD"
  }),
  freezeEntry({
    id: "KPI-006",
    code: "KPI_MTTR_DEFECT",
    name: "Mean Time To Resolve Defects",
    formula: "Σ (ClosedAt − OpenedAt) ÷ Closed Defects",
    thresholdHint: "P0/P1 within SLA",
    reporting: "monthly",
    accountableAuthority: "QA Lead",
    roleId: "ROLE-QA-LEAD"
  }),
  freezeEntry({
    id: "KPI-007",
    code: "KPI_REGRESSION_STABILITY",
    name: "Regression Stability",
    formula: "(Stable Regression Runs ÷ Total Regression Runs) × 100",
    thresholdHint: "≥ 95% green on release candidates",
    reporting: "per_release",
    accountableAuthority: "QA Lead",
    roleId: "ROLE-QA-LEAD"
  }),
  freezeEntry({
    id: "KPI-008",
    code: "KPI_RELEASE_QUALITY_INDEX",
    name: "Release Quality Index",
    formula:
      "Weighted score of pass rate, escape rate, severity backlog, gate compliance (0–100)",
    thresholdHint: "≥ approved org target for production certify",
    reporting: "per_release",
    accountableAuthority: "CIO",
    roleId: "ROLE-CIO"
  }),
  freezeEntry({
    id: "KPI-009",
    code: "KPI_RECOVERY_SUCCESS_RATE",
    name: "Recovery Success Rate",
    formula: "(Successful Recoveries ÷ Total Recovery Tests) × 100",
    thresholdHint: "100% for mandatory DR before certify",
    reporting: "monthly",
    accountableAuthority: "Platform Operations Lead",
    roleId: "ROLE-PLATFORM-OPS"
  }),
  freezeEntry({
    id: "KPI-010",
    code: "KPI_RECOVERY_TIME_COMPLIANCE",
    name: "Recovery Time Compliance",
    formula: "(Recoveries Within Target ÷ Total Recovery Tests) × 100",
    thresholdHint: "Align with Phase 15 RTO for complete DR",
    reporting: "quarterly",
    accountableAuthority: "Platform Operations Lead",
    roleId: "ROLE-PLATFORM-OPS"
  })
]);

// ─── Indexes & helpers ───────────────────────────────────────────────────────

function indexByIdAndCode(list) {
  const map = new Map();
  for (const item of list) {
    map.set(item.id, item);
    if (item.code) map.set(item.code, item);
  }
  return map;
}

const SUITE_INDEX = indexByIdAndCode(TEST_SUITES);
const CASE_INDEX = indexByIdAndCode(TEST_CASES);
const GATE_INDEX = indexByIdAndCode(QUALITY_GATES);
const VAL_INDEX = indexByIdAndCode(VALIDATIONS);
const CERT_INDEX = indexByIdAndCode(CERTIFICATIONS);
const THR_INDEX = indexByIdAndCode(THRESHOLDS);
const SMP_INDEX = indexByIdAndCode(SAMPLE_WINDOWS);
const RLIM_INDEX = indexByIdAndCode(RECOVERY_LIMITS);
const KPI_INDEX = indexByIdAndCode(QUALITY_KPIS);
const ROLE_INDEX = indexByIdAndCode(TESTING_ROLES);

export function listTestSuites() {
  return [...TEST_SUITES];
}
export function listTestCases() {
  return [...TEST_CASES];
}
export function listQualityGates() {
  return [...QUALITY_GATES];
}
export function listValidations() {
  return [...VALIDATIONS];
}
export function listCertifications() {
  return [...CERTIFICATIONS];
}
export function listThresholds() {
  return [...THRESHOLDS];
}
export function listSampleWindows() {
  return [...SAMPLE_WINDOWS];
}
export function listStressPhases() {
  return [...STRESS_PHASES];
}
export function listRecoveryLimits() {
  return [...RECOVERY_LIMITS];
}
export function listQualityKpis() {
  return [...QUALITY_KPIS];
}
export function listTestingRoles() {
  return [...TESTING_ROLES];
}

export function getTestSuite(idOrCode) {
  return SUITE_INDEX.get(idOrCode) || null;
}
export function getTestCase(idOrCode) {
  return CASE_INDEX.get(idOrCode) || null;
}
export function getQualityGate(idOrCode) {
  return GATE_INDEX.get(idOrCode) || null;
}
export function getValidation(idOrCode) {
  return VAL_INDEX.get(idOrCode) || null;
}
export function getCertification(idOrCode) {
  return CERT_INDEX.get(idOrCode) || null;
}
export function getThreshold(idOrCode) {
  return THR_INDEX.get(idOrCode) || null;
}
export function getSampleWindow(idOrCode) {
  return SMP_INDEX.get(idOrCode) || null;
}
export function getRecoveryLimit(idOrCode) {
  return RLIM_INDEX.get(idOrCode) || null;
}
export function getQualityKpi(idOrCode) {
  return KPI_INDEX.get(idOrCode) || null;
}
export function getTestingRole(idOrCode) {
  return ROLE_INDEX.get(idOrCode) || null;
}

export function thresholdsByCategory(category) {
  return THRESHOLDS.filter((t) => t.category === category);
}

export function qualityGateForPromotion(fromEnv, toEnv) {
  return (
    QUALITY_GATES.find((g) => g.fromEnv === fromEnv && g.toEnv === toEnv) || null
  );
}

export function assertIdUniqueness() {
  const groups = [
    ["TSU", TEST_SUITES],
    ["TC", TEST_CASES],
    ["QG", QUALITY_GATES],
    ["VAL", VALIDATIONS],
    ["CERT", CERTIFICATIONS],
    ["THR", THRESHOLDS],
    ["SMP", SAMPLE_WINDOWS],
    ["STP", STRESS_PHASES],
    ["RLIM", RECOVERY_LIMITS],
    ["KPI", QUALITY_KPIS],
    ["ROLE", TESTING_ROLES]
  ];
  for (const [label, list] of groups) {
    const ids = new Set();
    const codes = new Set();
    for (const item of list) {
      const id = item.id || `${label}-${item.phase || item.stage || item.name}`;
      const code = item.code || item.phase || item.stage || item.metric || id;
      if (ids.has(id)) return err("ETQ-ID-001", `Duplicate ${label} id ${id}`);
      if (codes.has(code)) return err("ETQ-ID-002", `Duplicate ${label} code ${code}`);
      ids.add(id);
      codes.add(code);
    }
  }
  return ok();
}

export function assertSingleOwnerPerEntry() {
  const collections = [
    ...TEST_SUITES,
    ...TEST_CASES,
    ...QUALITY_GATES,
    ...VALIDATIONS,
    ...CERTIFICATIONS,
    ...THRESHOLDS,
    ...SAMPLE_WINDOWS,
    ...STRESS_PHASES,
    ...RECOVERY_LIMITS,
    ...QUALITY_KPIS
  ];
  for (const item of collections) {
    if (!item.accountableAuthority || !String(item.accountableAuthority).trim()) {
      return err("ETQ-OWN-001", `Missing accountableAuthority on ${item.id || item.code}`);
    }
  }
  return ok();
}

export function assertQualityGateCoverage() {
  const expected = [
    ["DEV", "QA"],
    ["QA", "UAT"],
    ["UAT", "STAGING"],
    ["STAGING", "PRODUCTION"]
  ];
  for (const [from, to] of expected) {
    if (!qualityGateForPromotion(from, to)) {
      return err("ETQ-QG-001", `Missing quality gate ${from}→${to}`);
    }
  }
  for (const gate of QUALITY_GATES) {
    for (const sid of gate.requiredSuiteIds || []) {
      if (!getTestSuite(sid)) {
        return err("ETQ-QG-002", `${gate.id} unknown suite ${sid}`);
      }
    }
  }
  return ok();
}

export function assertRefsResolve() {
  const errors = [];
  for (const tc of TEST_CASES) {
    if (!getTestSuite(tc.suiteId)) errors.push(`${tc.id} unknown suite ${tc.suiteId}`);
  }
  for (const cert of CERTIFICATIONS) {
    for (const gid of cert.requiredGateIds || []) {
      if (!getQualityGate(gid)) errors.push(`${cert.id} unknown gate ${gid}`);
    }
    for (const sid of cert.requiredSuiteIds || []) {
      if (!getTestSuite(sid)) errors.push(`${cert.id} unknown suite ${sid}`);
    }
  }
  for (const item of [...TEST_SUITES, ...QUALITY_GATES, ...THRESHOLDS, ...RECOVERY_LIMITS]) {
    if (item.roleId && !getTestingRole(item.roleId)) {
      errors.push(`${item.id} unknown roleId ${item.roleId}`);
    }
  }
  if (errors.length) return err("ETQ-REF-001", "Cross-reference resolution failed", { errors });
  return ok();
}

/**
 * Confirm Phase 16 does not redefine Phase 14 env codes or Phase 15 RTO policy.
 * Stabilization must remain 30 minutes (Phase 14 production/DR).
 */
export function assertCrossPhaseConsistency(options = {}) {
  const errors = [];
  const phase14Envs = options.phase14EnvCodes || PROMOTION_PATH;
  for (const gate of QUALITY_GATES) {
    if (!phase14Envs.includes(gate.fromEnv) && gate.fromEnv !== "DR") {
      errors.push(`${gate.id} fromEnv ${gate.fromEnv} not in Phase 14 path`);
    }
    if (!phase14Envs.includes(gate.toEnv) && gate.toEnv !== "DR") {
      errors.push(`${gate.id} toEnv ${gate.toEnv} not in Phase 14 path`);
    }
  }
  if (STABILIZATION_MINUTES !== 30) {
    errors.push("STABILIZATION_MINUTES must remain 30 (Phase 14/15 alignment)");
  }
  const stabPhase = RECOVERY_PHASE_LIMITS.find((p) => p.phase === "Stabilization");
  if (!stabPhase || stabPhase.maxMinutes !== 30) {
    errors.push("Recovery Stabilization phase must be 30 minutes");
  }
  const stressStab = STRESS_PHASES.find((p) => p.code === "STRESS_STABILIZATION");
  if (!stressStab || stressStab.minMinutes !== 30) {
    errors.push("Stress Stabilization minMinutes must be 30");
  }
  const completeDr = getRecoveryLimit("RLIM-012");
  if (!completeDr?.usesPhase15Rto) {
    errors.push("Complete DR recovery must consume Phase 15 RTO (usesPhase15Rto)");
  }
  if (BACKUP_ENGINE_MODULE !== 21) errors.push("BACKUP_ENGINE_MODULE must remain 21");
  if (PLATFORM_MODULE !== 30) errors.push("PLATFORM_MODULE must remain 30");
  if (AI_MODULE !== 29) errors.push("AI_MODULE must remain 29");
  if (MONITORING_MODULE !== 19) errors.push("MONITORING_MODULE must remain 19");

  if (errors.length) {
    return err("ETQ-XP-001", "Cross-phase consistency failed", { errors });
  }
  return ok();
}

export function assertModulesNotReplaced() {
  return ok({
    monitoringModule: MONITORING_MODULE,
    backupEngineModule: BACKUP_ENGINE_MODULE,
    aiModule: AI_MODULE,
    platformModule: PLATFORM_MODULE,
    note: "Phase 16 catalogs only; engines remain Modules 19/21/29/30"
  });
}

export function validateTestingRegistry(options = {}) {
  const checks = [
    assertIdUniqueness(),
    assertSingleOwnerPerEntry(),
    assertQualityGateCoverage(),
    assertRefsResolve(),
    assertCrossPhaseConsistency(options),
    assertModulesNotReplaced()
  ];
  const errors = [];
  for (const c of checks) {
    if (!c.ok) {
      errors.push(c.message);
      if (c.errors) errors.push(...c.errors);
    }
  }
  if (errors.length) return err("ETQ-VAL-000", "Testing registry invalid", { errors });
  return ok({ counts: etqavsCounts() });
}

export function etqavsCounts() {
  return Object.freeze({
    roles: TESTING_ROLES.length,
    suites: TEST_SUITES.length,
    cases: TEST_CASES.length,
    qualityGates: QUALITY_GATES.length,
    validations: VALIDATIONS.length,
    certifications: CERTIFICATIONS.length,
    thresholds: THRESHOLDS.length,
    sampleWindows: SAMPLE_WINDOWS.length,
    stressPhases: STRESS_PHASES.length,
    recoveryLimits: RECOVERY_LIMITS.length,
    kpis: QUALITY_KPIS.length
  });
}
