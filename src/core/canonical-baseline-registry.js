/**
 * Phase 20 — Canonical Enterprise Baseline Registry (EIBPRFBS).
 * Integrates Modules 1–30 + Phases 1–19 as the published specification baseline.
 * Does NOT redefine Phases 1–19 content or replace Modules 1–30 engines.
 * Catalog / governance consolidation only: no money posts, no RBAC rewrite, no new nav.
 * Money invariants preserved: pesewas · interest 15 · collection days 31 · cashier 1000.
 */

export const EIBPRFBS_VERSION = "1.0.0";
export const EIBPRFBS_STATUS = "Authoritative";
export const EIBPRFBS_EFFECTIVE_DATE = "2026-09-15";
export const PLATFORM_MODULE = 30;
export const GOVERNANCE_PHASE = 19;
export const BASELINE_PHASE = 20;
export const PRIOR_PHASE_COUNT = 19;
export const MODULE_COUNT = 30;

export const PHASE19_REGISTRY_REF = "src/core/canonical-governance-registry.js";
export const PHASE19_HELPER_REF = "src/core/phase19-change-release.js";
export const PHASE19_DOC_REF = "docs/enterprise-governance-change-release.md";
export const PHASE16_REGISTRY_REF = "src/core/canonical-testing-registry.js";
export const PHASE16_GATE_EXCEPTION_RULE = "emergency_exception_approved";
export const PHASE16_PROD_GATES = Object.freeze(["QG-001", "QG-002", "QG-003", "QG-004"]);

export const MONEY_INVARIANTS = Object.freeze({
  amountUnit: "pesewas",
  defaultInterestPercent: 15,
  collectionCycleDays: 31,
  cashierFloatLimit: 1000
});

export const BL_MOD_ID_PATTERN = /^BL-MOD-[0-9]{3}$/;
export const BL_PH_ID_PATTERN = /^BL-PH-[0-9]{3}$/;
export const RDY_ID_PATTERN = /^RDY-[0-9]{3}$/;
export const CERT_BL_ID_PATTERN = /^CERT-BL-[0-9]{3}$/;
export const ACC_ID_PATTERN = /^ACC-[0-9]{3}$/;
export const GOV_BL_ID_PATTERN = /^GOV-BL-[0-9]{3}$/;
export const CODE_PATTERN = /^[A-Z][A-Z0-9_]{2,63}$/;

export const BASELINE_ARTIFACT_KINDS = Object.freeze(["module", "phase"]);
export const BASELINE_STATUS = Object.freeze([
  "draft",
  "baselined",
  "published",
  "superseded",
  "retired"
]);
export const READINESS_CATEGORIES = Object.freeze([
  "functional",
  "security",
  "performance",
  "bcdr",
  "monitoring",
  "ops",
  "support",
  "training",
  "docs",
  "regulatory",
  "executive"
]);
export const CERTIFICATION_TYPES = Object.freeze([
  "application",
  "infrastructure",
  "security",
  "data",
  "performance",
  "backup",
  "dr",
  "ops",
  "governance",
  "compliance"
]);
export const ACCEPTANCE_TYPES = Object.freeze([
  "technical",
  "business",
  "operational",
  "security",
  "executive",
  "regulatory"
]);
export const IMPLEMENTATION_STAGES = Object.freeze([
  "environment_prep",
  "infra",
  "db",
  "config",
  "security",
  "android",
  "web",
  "migration",
  "integrations",
  "monitoring",
  "ops_readiness",
  "onboarding",
  "training",
  "go_live",
  "hypercare",
  "steady_state"
]);

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

function byIdOrCode(list, idOrCode) {
  if (!idOrCode) return null;
  return list.find((x) => x.id === idOrCode || x.code === idOrCode) || null;
}

function approvalPlaceholder(authority, body) {
  return Object.freeze({
    status: "pending_package",
    accountableAuthority: authority,
    approvingBody: body,
    approvedAt: null,
    approvalRef: null,
    notes: "Placeholder — filled by executive approval package at go-live, not at spec baseline publish"
  });
}

const MODULE_DEFS = [
  [1, "Authentication & Session", "docs/enterprise-master-architecture.md", null, "Security Governance Lead", [1, 9]],
  [2, "Dashboard", "docs/enterprise-master-architecture.md", null, "Platform Administrator", [1, 13]],
  [3, "Customer CRM", "docs/enterprise-master-architecture.md", "src/core/canonical-domain-registry.js", "Platform Administrator", [3]],
  [4, "Agent & Collector Management", "docs/agent-management.md", null, "Platform Administrator", [3, 6]],
  [5, "Branch Management", "docs/branch-management.md", null, "Platform Administrator", [3, 8]],
  [6, "Individual Savings Collection", "docs/individual-savings-collection.md", null, "CIO", [3, 7, 16]],
  [7, "Group Susu Management", "docs/group-susu-management.md", null, "CIO", [3, 4, 16]],
  [8, "Loans", "docs/loan-status-transitions.md", null, "CIO", [3, 4, 16]],
  [9, "Withdrawals & Savings Redemption", "docs/withdrawals-savings-redemption.md", null, "CIO", [3, 7, 16]],
  [10, "Accounting & General Ledger", "docs/accounting-general-ledger.md", null, "CIO", [3, 7, 16]],
  [11, "Reports, Analytics & BI (operational)", "docs/reports-analytics-bi.md", null, "Policy Owner", [13, 17]],
  [12, "Notification & Communication", "docs/notification-communication.md", null, "Platform Administrator", [5, 18]],
  [13, "Audit Trail & Compliance", "docs/audit-compliance.md", null, "Compliance Officer", [9, 19]],
  [14, "System Administration & Configuration", "docs/system-administration.md", "src/core/canonical-config-registry.js", "Platform Administrator", [8, 19]],
  [15, "Offline Synchronization & Conflict Resolution", "docs/offline-sync.md", null, "Platform Administrator", [14, 18]],
  [16, "Mobile Money & Payment Gateway Integration", "docs/payment-engine.md", null, "CIO", [6, 14, 18]],
  [17, "Receipt, Document & Statement Management", "docs/document-engine.md", null, "Platform Administrator", [3, 7]],
  [18, "Background Jobs, Queue & Scheduler", "docs/job-engine.md", null, "Platform Administrator", [14, 18]],
  [19, "Monitoring, Observability, Health & Diagnostics", "docs/monitoring-engine.md", "src/core/canonical-monitoring-registry.js", "Platform Administrator", [13, 18]],
  [20, "API Gateway & External Integration Platform", "docs/api-gateway.md", "src/core/canonical-api-registry.js", "CIO", [6, 14]],
  [21, "Backup, Restore, DR & Business Continuity", "docs/backup-recovery.md", "src/core/canonical-continuity-registry.js", "CIO", [14, 15]],
  [22, "Security Operations, Fraud Detection & Risk Management", "docs/security-operations.md", null, "Security Governance Lead", [9, 13, 16]],
  [23, "Workflow Engine & Case Management", "docs/workflow-engine.md", "src/core/canonical-state-machine-registry.js", "Change Manager", [4, 19]],
  [24, "Rule Engine & Decision Management", "docs/rule-engine.md", null, "Compliance Officer", [3, 16]],
  [25, "Data Exchange, Import, Export & Migration", "docs/data-exchange.md", null, "Platform Administrator", [7, 14]],
  [26, "Document & Digital Records Management", "docs/digital-records.md", null, "Compliance Officer", [7, 15]],
  [27, "Enterprise BI, KPI & Schema Registries", "docs/enterprise-bi.md", null, "Policy Owner", [13, 17]],
  [28, "Enterprise Integration Hub & Third-Party API Gateway", "docs/enterprise-integration.md", null, "CIO", [6, 14, 18]],
  [29, "Enterprise AI, ML & Predictive Intelligence", "docs/enterprise-ai.md", "src/core/canonical-ai-registry.js", "Compliance Officer", [12, 16]],
  [30, "Enterprise Platform Administration", "docs/platform-administration.md", "src/core/canonical-config-registry.js", "Platform Administrator", [8, 14, 16, 18, 19, 20]]
];

export const MODULE_BASELINE_ARTIFACTS = Object.freeze(
  MODULE_DEFS.map(([moduleId, title, primaryDoc, registryPath, authority, phaseRefs]) =>
    freezeEntry({
      id: `BL-MOD-${String(moduleId).padStart(3, "0")}`,
      code: `MODULE_${String(moduleId).padStart(2, "0")}`,
      kind: "module",
      moduleId,
      title,
      version: "1.0.0",
      status: "published",
      accountableAuthority: authority,
      effectiveDate: EIBPRFBS_EFFECTIVE_DATE,
      primaryDoc,
      registryPath,
      phaseRefs: Object.freeze([...phaseRefs]),
      enginesNotReplaced: true,
      moneyInvariantGuard: moduleId >= 6 && moduleId <= 10 || moduleId === 16,
      approvalRecord: approvalPlaceholder(authority, "Enterprise Governance Board"),
      traceability: Object.freeze({
        emasRef: "docs/enterprise-master-architecture.md#7-module-catalog-modules-1-30",
        baselinePhase: BASELINE_PHASE,
        priorSpecsConsumed: true
      })
    })
  )
);

const PHASE_DEFS = [
  [1, "EMAS — Enterprise Master Architecture", "docs/enterprise-master-architecture.md", null, "Governance Board Chair", "EMAS"],
  [2, "Enterprise Consistency Review", "docs/enterprise-consistency-review.md", null, "Governance Board Chair", "ECR"],
  [3, "Canonical Domain Model (ECDM)", "docs/enterprise-canonical-domain-model.md", "src/core/canonical-domain-registry.js", "Policy Owner", "ECDM"],
  [4, "Canonical State Machines (ECSMLS)", "docs/enterprise-canonical-state-machines.md", "src/core/canonical-state-machine-registry.js", "Change Manager", "ECSMLS"],
  [5, "Canonical Event Catalog (ECECMS)", "docs/enterprise-canonical-event-catalog.md", "src/core/canonical-event-registry.js", "Platform Administrator", "ECECMS"],
  [6, "Canonical API Catalog (ECACIS)", "docs/enterprise-canonical-api-catalog.md", "src/core/canonical-api-registry.js", "CIO", "ECACIS"],
  [7, "Canonical Database Architecture (ECDAPS)", "docs/enterprise-canonical-database-architecture.md", "src/core/canonical-database-registry.js", "Platform Administrator", "ECDAPS"],
  [8, "Configuration, Policy & Feature Management (ECPFMS)", "docs/system-administration.md", "src/core/canonical-config-registry.js", "Platform Administrator", "ECPFMS"],
  [9, "Enterprise Security Controls", "docs/security-operations.md", null, "Security Governance Lead", "ESCTRL"],
  [10, "Enterprise Schema Package & Envelopes", "docs/schemas/manifest.json", null, "Policy Owner", "ESCHEMA"],
  [11, "Architecture Review Workflow", "docs/enterprise-architecture-review-workflow.md", null, "Governance Board Chair", "EARW"],
  [12, "AI Automation Decision & Identifiers (EAIADIS)", "docs/enterprise-ai-automation-decision.md", "src/core/canonical-ai-registry.js", "Compliance Officer", "EAIADIS"],
  [13, "Monitoring & Observability (EMOIS)", "docs/enterprise-monitoring-observability.md", "src/core/canonical-monitoring-registry.js", "Platform Administrator", "EMOIS"],
  [14, "Deployment / DevOps / Infrastructure (EDDIES)", "docs/enterprise-deployment-devops.md", "src/core/canonical-deployment-registry.js", "Release Manager", "EDDIES"],
  [15, "Business Continuity & DR (EBCBDRS)", "docs/enterprise-business-continuity-dr.md", "src/core/canonical-continuity-registry.js", "CIO", "EBCBDRS"],
  [16, "Testing / QA / Validation (ETQAVS)", "docs/enterprise-testing-qa-validation.md", "src/core/canonical-testing-registry.js", "Release Manager", "ETQAVS"],
  [17, "Performance / Scalability / Capacity (EPSCMS)", "docs/enterprise-performance-capacity.md", "src/core/canonical-performance-registry.js", "CIO", "EPSCMS"],
  [18, "Operations / Support (EOSSMS)", "docs/enterprise-operations-support.md", "src/core/canonical-operations-registry.js", "Change Manager", "EOSSMS"],
  [19, "Governance / Change / Release (EGCCRMS)", "docs/enterprise-governance-change-release.md", "src/core/canonical-governance-registry.js", "Governance Board Chair", "EGCCRMS"]
];

export const PHASE_BASELINE_ARTIFACTS = Object.freeze(
  PHASE_DEFS.map(([phaseNumber, title, primaryDoc, registryPath, authority, acronym]) =>
    freezeEntry({
      id: `BL-PH-${String(phaseNumber).padStart(3, "0")}`,
      code: `PHASE_${String(phaseNumber).padStart(2, "0")}_${acronym}`,
      kind: "phase",
      phaseNumber,
      title,
      acronym,
      version: "1.0.0",
      status: "published",
      accountableAuthority: authority,
      effectiveDate: EIBPRFBS_EFFECTIVE_DATE,
      primaryDoc,
      registryPath,
      catalogsDoc:
        phaseNumber === 3
          ? "docs/ecdm-catalogs.md"
          : phaseNumber === 4
            ? "docs/ecsmls-catalogs.md"
            : phaseNumber === 5
              ? "docs/ececms-catalogs.md"
              : phaseNumber === 6
                ? "docs/ecacis-catalogs.md"
                : phaseNumber === 7
                  ? "docs/ecdaps-catalogs.md"
                  : phaseNumber === 13
                    ? "docs/emoois-catalogs.md"
                    : phaseNumber === 14
                      ? "docs/eddies-catalogs.md"
                      : phaseNumber === 15
                        ? "docs/ebcbdrs-catalogs.md"
                        : phaseNumber === 16
                          ? "docs/etqavs-catalogs.md"
                          : phaseNumber === 17
                            ? "docs/epscms-catalogs.md"
                            : phaseNumber === 18
                              ? "docs/eossms-catalogs.md"
                              : phaseNumber === 19
                                ? "docs/egccrms-catalogs.md"
                                : null,
      contentNotRedefined: true,
      downstreamBaseline: "docs/enterprise-implementation-baseline.md",
      approvalRecord: approvalPlaceholder(authority, "Policy Review Board"),
      traceability: Object.freeze({
        integratesInto: "Phase 20 EIBPRFBS",
        priorSpecsAuthoritative: true,
        schemaManifest: phaseNumber >= 12 ? "docs/schemas/manifest.json" : null
      })
    })
  )
);

export const PRODUCTION_READINESS_CHECKS = Object.freeze(
  [
    ["RDY-001", "FUNC_CORE", "functional", "Core Modules 6–10 posting paths validated", "Release Manager", true, ["QG-001", "QG-002"]],
    ["RDY-002", "FUNC_INTEGRATION", "functional", "Gateway/hub facades + offline sync smoke", "Platform Administrator", true, ["QG-002"]],
    ["RDY-003", "SEC_CONTROLS", "security", "AuthN/AuthZ/session/secrets/vuln gates pass", "Security Governance Lead", true, ["QG-001", "QG-004"]],
    ["RDY-004", "SEC_FRAUD", "security", "Module 22 risk/fraud ops readiness", "Security Governance Lead", true, ["QG-004"]],
    ["RDY-005", "PERF_SLO", "performance", "Phase 17 capacity + Phase 16 perf ceilings met", "CIO", true, ["QG-003"]],
    ["RDY-006", "BCDR_RPO_RTO", "bcdr", "Phase 15 RPO/RTO targets demonstrated", "CIO", true, ["QG-002"]],
    ["RDY-007", "BCDR_DRILL", "bcdr", "DR drill evidence within validity window", "Release Manager", true, ["QG-002"]],
    ["RDY-008", "MON_SLO", "monitoring", "Phase 13 SLOs/alerts/health wired", "Platform Administrator", true, ["QG-003"]],
    ["RDY-009", "OPS_RUNBOOKS", "ops", "Phase 18 incident/service/runbook catalogs staffed", "Change Manager", true, []],
    ["RDY-010", "OPS_ONCALL", "ops", "On-call rotation + escalation published", "Change Manager", true, []],
    ["RDY-011", "SUP_SERVICE_DESK", "support", "Service desk queues and SLAs active", "Change Manager", true, []],
    ["RDY-012", "TRAIN_ROLES", "training", "Role-based training completion recorded", "Platform Administrator", true, []],
    ["RDY-013", "DOCS_BASELINE", "docs", "Phase 20 baseline + Phase 1–19 docs published", "Policy Owner", true, []],
    ["RDY-014", "REG_COMPLIANCE", "regulatory", "Compliance evidence pack attached", "Compliance Officer", true, ["QG-004"]],
    ["RDY-015", "EXEC_GO_NOGO", "executive", "Executive go/no-go package signed", "Governance Board Chair", true, []],
    ["RDY-016", "FUNC_MONEY_INV", "functional", "Money invariants: pesewas/15/31/1000 verified", "CIO", true, ["QG-001"]],
    ["RDY-017", "SEC_EXCEPTION", "security", "Open exceptions inventoried; expired blocked", "Compliance Officer", true, []],
    ["RDY-018", "PERF_STRESS", "performance", "Stress/load evidence within Phase 17 profiles", "CIO", false, ["QG-003"]],
    ["RDY-019", "MON_DASHBOARDS", "monitoring", "Ops dashboards reviewed for go-live", "Platform Administrator", false, []],
    ["RDY-020", "TRAIN_HYPERCARE", "training", "Hypercare staffing plan approved", "Release Manager", true, []]
  ].map(([id, code, category, title, owner, mandatory, gateIds]) =>
    freezeEntry({
      id,
      code,
      category,
      title,
      accountableAuthority: owner,
      mandatory,
      failClosed: mandatory,
      phase16GateIds: Object.freeze([...gateIds]),
      exceptionRule: PHASE16_GATE_EXCEPTION_RULE,
      consumesPhase16: gateIds.length > 0,
      consumesPhase19: category === "executive" || category === "docs",
      evidenceRequired: true,
      status: "catalogued"
    })
  )
);

export const ENTERPRISE_CERTIFICATIONS = Object.freeze(
  [
    ["CERT-BL-001", "APP_CERT", "application", "Application release certification", "Release Manager", ["CIO", "Release Manager", "Platform Administrator"], 180],
    ["CERT-BL-002", "INFRA_CERT", "infrastructure", "Infrastructure environment certification", "Platform Administrator", ["CIO", "Platform Administrator"], 365],
    ["CERT-BL-003", "SEC_CERT", "security", "Security control certification", "Security Governance Lead", ["Security Governance Lead", "CIO", "Internal Auditor"], 180],
    ["CERT-BL-004", "DATA_CERT", "data", "Data/schema integrity certification", "Policy Owner", ["Policy Owner", "Platform Administrator"], 365],
    ["CERT-BL-005", "PERF_CERT", "performance", "Performance & capacity certification", "CIO", ["CIO", "Release Manager"], 180],
    ["CERT-BL-006", "BACKUP_CERT", "backup", "Backup verification certification", "Platform Administrator", ["CIO", "Platform Administrator"], 90],
    ["CERT-BL-007", "DR_CERT", "dr", "Disaster recovery certification", "CIO", ["CIO", "Release Manager", "Governance Board Chair"], 180],
    ["CERT-BL-008", "OPS_CERT", "ops", "Operations readiness certification", "Change Manager", ["Change Manager", "Platform Administrator"], 180],
    ["CERT-BL-009", "GOV_CERT", "governance", "Governance/change/release certification", "Governance Board Chair", ["Governance Board Chair", "CAB Chair", "Release Manager"], 365],
    ["CERT-BL-010", "CMP_CERT", "compliance", "Compliance/regulatory certification", "Compliance Officer", ["Compliance Officer", "Governance Board Chair"], 365]
  ].map(([id, code, certType, title, authority, roles, expiryDays]) =>
    freezeEntry({
      id,
      code,
      certificationType: certType,
      title,
      accountableAuthority: authority,
      entryCriteria: Object.freeze([
        "Related readiness checks pass or hold approved exception",
        "Evidence pack attached",
        "SoD: approver ≠ auditor",
        "Money invariants confirmed where applicable"
      ]),
      approvalRoles: Object.freeze([...roles]),
      evidenceRequired: true,
      defaultExpiryDays: expiryDays,
      renewalRequired: true,
      consumesPhase16: certType === "application" || certType === "security" || certType === "performance",
      consumesPhase19: certType === "governance",
      phase16CertAlign: certType === "application" ? "CERT-001" : null,
      status: "catalogued"
    })
  )
);

export const ACCEPTANCE_TYPES_CATALOG = Object.freeze(
  [
    ["ACC-001", "TECH_ACCEPT", "technical", "Technical acceptance of integrated baseline", "Release Manager", ["RDY-001", "RDY-002", "RDY-016"]],
    ["ACC-002", "BIZ_ACCEPT", "business", "Business acceptance of Susu operations scope", "CIO", ["RDY-001", "RDY-015"]],
    ["ACC-003", "OPS_ACCEPT", "operational", "Operational acceptance (runbooks/on-call)", "Change Manager", ["RDY-009", "RDY-010", "RDY-011"]],
    ["ACC-004", "SEC_ACCEPT", "security", "Security acceptance", "Security Governance Lead", ["RDY-003", "RDY-004", "RDY-017"]],
    ["ACC-005", "EXEC_ACCEPT", "executive", "Executive acceptance / go-live authority", "Governance Board Chair", ["RDY-015", "RDY-013"]],
    ["ACC-006", "REG_ACCEPT", "regulatory", "Regulatory/compliance acceptance", "Compliance Officer", ["RDY-014", "RDY-017"]]
  ].map(([id, code, acceptanceType, title, authority, readinessIds]) =>
    freezeEntry({
      id,
      code,
      acceptanceType,
      title,
      accountableAuthority: authority,
      requiredReadinessIds: Object.freeze([...readinessIds]),
      entryCriteria: Object.freeze([
        "Mandatory readiness checks linked pass or exception-approved",
        "Sign-off recorded with role + timestamp",
        "Residual risks accepted or remediated"
      ]),
      approvalRoles: Object.freeze([authority]),
      failClosed: true,
      status: "catalogued"
    })
  )
);

export const FINAL_GOVERNANCE_ENTRIES = Object.freeze(
  [
    ["GOV-BL-001", "BASELINE_MAINT", "Baseline maintenance cadence", "Policy Owner", "quarterly"],
    ["GOV-BL-002", "BASELINE_EVOLVE", "Baseline evolution via Phase 19 change/release", "Change Manager", "per_change"],
    ["GOV-BL-003", "COMPAT_MATRIX", "Compatibility matrix APK↔API↔DB", "Configuration Manager", "per_release"],
    ["GOV-BL-004", "DEPRECATION", "Deprecation notice ≥90 days (VER-006 consume)", "Release Manager", "as_needed"],
    ["GOV-BL-005", "EOL", "End-of-life disposition", "Governance Board Chair", "as_needed"],
    ["GOV-BL-006", "PERIODIC_REVIEW", "Periodic enterprise baseline review", "Governance Board Chair", "annual"],
    ["GOV-BL-007", "EXCEPTION_CONTROL", "Exception inventory & expiry (Phase 19 EXC)", "Compliance Officer", "monthly"],
    ["GOV-BL-008", "SCHEMA_MANIFEST", "Schema manifest / SHA-256 integrity", "Policy Owner", "per_release"]
  ].map(([id, code, title, authority, cadence]) =>
    freezeEntry({
      id,
      code,
      title,
      accountableAuthority: authority,
      cadence,
      consumesPhase19: true,
      phase19Refs: Object.freeze(["docs/enterprise-governance-change-release.md", PHASE19_REGISTRY_REF]),
      status: "published",
      effectiveDate: EIBPRFBS_EFFECTIVE_DATE
    })
  )
);

export const IMPLEMENTATION_STAGE_CATALOG = Object.freeze(
  IMPLEMENTATION_STAGES.map((stage, idx) =>
    freezeEntry({
      id: `STG-${String(idx + 1).padStart(3, "0")}`,
      code: stage.toUpperCase(),
      stage,
      ordinal: idx + 1,
      title: stage.replace(/_/g, " "),
      accountableAuthority:
        stage === "go_live" || stage === "executive"
          ? "Governance Board Chair"
          : stage === "security"
            ? "Security Governance Lead"
            : stage === "monitoring" || stage === "ops_readiness"
              ? "Change Manager"
              : "Release Manager",
      prerequisites: Object.freeze(
        idx === 0 ? ["Baseline published"] : [`STG-${String(idx).padStart(3, "0")} complete`]
      ),
      validationPoints: Object.freeze([`Stage ${stage} exit criteria met`]),
      rollback: Object.freeze([
        "Halt promotion",
        "Revert via Phase 14 pipeline / prior CI baseline",
        "Open Phase 18 incident if production impact"
      ]),
      successCriteria: Object.freeze([`STG-${String(idx + 1).padStart(3, "0")} signed off`])
    })
  )
);

export const TRACEABILITY_DIMENSIONS = Object.freeze([
  "requirements",
  "modules",
  "phases",
  "apis",
  "db",
  "security",
  "tests",
  "quality_gates",
  "kpis",
  "risks",
  "controls",
  "policies",
  "schemas",
  "deployment",
  "runbooks"
]);

// ─── List / get ──────────────────────────────────────────────────────────────

export function listModuleBaselines() {
  return MODULE_BASELINE_ARTIFACTS;
}
export function listPhaseBaselines() {
  return PHASE_BASELINE_ARTIFACTS;
}
export function listBaselineArtifacts() {
  return Object.freeze([...MODULE_BASELINE_ARTIFACTS, ...PHASE_BASELINE_ARTIFACTS]);
}
export function listProductionReadinessChecks() {
  return PRODUCTION_READINESS_CHECKS;
}
export function listEnterpriseCertifications() {
  return ENTERPRISE_CERTIFICATIONS;
}
export function listAcceptanceTypes() {
  return ACCEPTANCE_TYPES_CATALOG;
}
export function listFinalGovernance() {
  return FINAL_GOVERNANCE_ENTRIES;
}
export function listImplementationStages() {
  return IMPLEMENTATION_STAGE_CATALOG;
}

export function getModuleBaseline(idOrCode) {
  return byIdOrCode(MODULE_BASELINE_ARTIFACTS, idOrCode);
}
export function getPhaseBaseline(idOrCode) {
  return byIdOrCode(PHASE_BASELINE_ARTIFACTS, idOrCode);
}
export function getBaselineArtifact(idOrCode) {
  return byIdOrCode(listBaselineArtifacts(), idOrCode);
}
export function getProductionReadinessCheck(idOrCode) {
  return byIdOrCode(PRODUCTION_READINESS_CHECKS, idOrCode);
}
export function getEnterpriseCertification(idOrCode) {
  return byIdOrCode(ENTERPRISE_CERTIFICATIONS, idOrCode);
}
export function getAcceptanceType(idOrCode) {
  return byIdOrCode(ACCEPTANCE_TYPES_CATALOG, idOrCode);
}
export function getFinalGovernance(idOrCode) {
  return byIdOrCode(FINAL_GOVERNANCE_ENTRIES, idOrCode);
}
export function getModuleBaselineByNumber(moduleId) {
  return MODULE_BASELINE_ARTIFACTS.find((m) => m.moduleId === moduleId) || null;
}
export function getPhaseBaselineByNumber(phaseNumber) {
  return PHASE_BASELINE_ARTIFACTS.find((p) => p.phaseNumber === phaseNumber) || null;
}

// ─── Validate (registry-internal) ────────────────────────────────────────────

export function assertIdUniqueness() {
  const ids = [];
  const codes = [];
  const pools = [
    MODULE_BASELINE_ARTIFACTS,
    PHASE_BASELINE_ARTIFACTS,
    PRODUCTION_READINESS_CHECKS,
    ENTERPRISE_CERTIFICATIONS,
    ACCEPTANCE_TYPES_CATALOG,
    FINAL_GOVERNANCE_ENTRIES,
    IMPLEMENTATION_STAGE_CATALOG
  ];
  for (const list of pools) {
    for (const e of list) {
      ids.push(e.id);
      if (e.code) codes.push(e.code);
    }
  }
  const dupIds = ids.filter((id, i) => ids.indexOf(id) !== i);
  const dupCodes = codes.filter((c, i) => codes.indexOf(c) !== i);
  if (dupIds.length || dupCodes.length) {
    return err("EIB-ID-001", "Duplicate baseline registry identifiers", {
      dupIds: [...new Set(dupIds)],
      dupCodes: [...new Set(dupCodes)]
    });
  }
  return ok({ idCount: ids.length, codeCount: codes.length });
}

export function assertModuleCoverage() {
  const nums = MODULE_BASELINE_ARTIFACTS.map((m) => m.moduleId).sort((a, b) => a - b);
  const missing = [];
  for (let i = 1; i <= MODULE_COUNT; i++) {
    if (!nums.includes(i)) missing.push(i);
  }
  if (missing.length || nums.length !== MODULE_COUNT) {
    return err("EIB-MOD-001", "Module 1–30 coverage incomplete", { missing, count: nums.length });
  }
  return ok({ modules: MODULE_COUNT });
}

export function assertPhaseCoverage() {
  const nums = PHASE_BASELINE_ARTIFACTS.map((p) => p.phaseNumber).sort((a, b) => a - b);
  const missing = [];
  for (let i = 1; i <= PRIOR_PHASE_COUNT; i++) {
    if (!nums.includes(i)) missing.push(i);
  }
  if (missing.length || nums.length !== PRIOR_PHASE_COUNT) {
    return err("EIB-PH-001", "Phase 1–19 coverage incomplete", { missing, count: nums.length });
  }
  return ok({ phases: PRIOR_PHASE_COUNT });
}

export function assertReadinessOwners() {
  const bad = PRODUCTION_READINESS_CHECKS.filter((r) => !r.accountableAuthority);
  if (bad.length) {
    return err("EIB-RDY-001", "Readiness checks missing owners", {
      ids: bad.map((b) => b.id)
    });
  }
  const cats = new Set(PRODUCTION_READINESS_CHECKS.map((r) => r.category));
  const missingCats = READINESS_CATEGORIES.filter((c) => !cats.has(c));
  if (missingCats.length) {
    return err("EIB-RDY-002", "Readiness category coverage incomplete", { missingCats });
  }
  return ok({ checks: PRODUCTION_READINESS_CHECKS.length });
}

export function assertCertificationCompleteness() {
  const bad = ENTERPRISE_CERTIFICATIONS.filter(
    (c) =>
      !c.entryCriteria?.length ||
      !c.approvalRoles?.length ||
      !c.accountableAuthority ||
      !c.defaultExpiryDays
  );
  if (bad.length) {
    return err("EIB-CERT-001", "Certifications missing entry criteria or approval roles", {
      ids: bad.map((b) => b.id)
    });
  }
  const types = new Set(ENTERPRISE_CERTIFICATIONS.map((c) => c.certificationType));
  const missing = CERTIFICATION_TYPES.filter((t) => !types.has(t));
  if (missing.length) {
    return err("EIB-CERT-002", "Certification type coverage incomplete", { missing });
  }
  return ok({ certifications: ENTERPRISE_CERTIFICATIONS.length });
}

export function assertAcceptanceCompleteness() {
  const types = new Set(ACCEPTANCE_TYPES_CATALOG.map((a) => a.acceptanceType));
  const missing = ACCEPTANCE_TYPES.filter((t) => !types.has(t));
  if (missing.length) {
    return err("EIB-ACC-001", "Acceptance type coverage incomplete", { missing });
  }
  for (const a of ACCEPTANCE_TYPES_CATALOG) {
    for (const rid of a.requiredReadinessIds || []) {
      if (!getProductionReadinessCheck(rid)) {
        return err("EIB-ACC-002", `${a.id} references unknown readiness ${rid}`);
      }
    }
  }
  return ok({ acceptanceTypes: ACCEPTANCE_TYPES_CATALOG.length });
}

export function assertSingleOwnerPerEntry() {
  const all = listBaselineArtifacts();
  for (const e of all) {
    if (!e.accountableAuthority || typeof e.accountableAuthority !== "string") {
      return err("EIB-OWN-001", `${e.id} missing accountableAuthority`);
    }
  }
  for (const r of PRODUCTION_READINESS_CHECKS) {
    if (!r.accountableAuthority) return err("EIB-OWN-002", `${r.id} missing owner`);
  }
  return ok();
}

export function assertMoneyInvariants() {
  if (MONEY_INVARIANTS.amountUnit !== "pesewas") {
    return err("EIB-MNY-001", "amountUnit must be pesewas");
  }
  if (MONEY_INVARIANTS.defaultInterestPercent !== 15) {
    return err("EIB-MNY-002", "interest must remain 15");
  }
  if (MONEY_INVARIANTS.collectionCycleDays !== 31) {
    return err("EIB-MNY-003", "collection days must remain 31");
  }
  if (MONEY_INVARIANTS.cashierFloatLimit !== 1000) {
    return err("EIB-MNY-004", "cashier limit must remain 1000");
  }
  return ok({ ...MONEY_INVARIANTS });
}

export function assertModulesNotReplaced() {
  const replaced = MODULE_BASELINE_ARTIFACTS.filter((m) => m.enginesNotReplaced !== true);
  if (replaced.length) {
    return err("EIB-NR-001", "Module baselines must declare enginesNotReplaced", {
      ids: replaced.map((r) => r.id)
    });
  }
  return ok({
    platformModule: PLATFORM_MODULE,
    note: "Phase 20 integrates catalogs only; Modules 1–30 engines not replaced; Phases 1–19 not redefined"
  });
}

export function validateBaselineRegistry() {
  const checks = [
    assertIdUniqueness(),
    assertModuleCoverage(),
    assertPhaseCoverage(),
    assertReadinessOwners(),
    assertCertificationCompleteness(),
    assertAcceptanceCompleteness(),
    assertSingleOwnerPerEntry(),
    assertMoneyInvariants(),
    assertModulesNotReplaced()
  ];
  const errors = [];
  for (const c of checks) {
    if (!c.ok) {
      errors.push(c.message);
      if (c.missing) errors.push(...c.missing.map(String));
      if (c.missingCats) errors.push(...c.missingCats);
      if (c.ids) errors.push(...c.ids);
      if (c.dupIds) errors.push(...c.dupIds);
    }
  }
  if (errors.length) return err("EIB-VAL-000", "Baseline registry invalid", { errors });
  return ok({ counts: eibprfbsCounts() });
}

export function eibprfbsCounts() {
  return Object.freeze({
    modules: MODULE_BASELINE_ARTIFACTS.length,
    phases: PHASE_BASELINE_ARTIFACTS.length,
    baselineArtifacts: MODULE_BASELINE_ARTIFACTS.length + PHASE_BASELINE_ARTIFACTS.length,
    readinessChecks: PRODUCTION_READINESS_CHECKS.length,
    mandatoryReadinessChecks: PRODUCTION_READINESS_CHECKS.filter((r) => r.mandatory).length,
    certifications: ENTERPRISE_CERTIFICATIONS.length,
    acceptanceTypes: ACCEPTANCE_TYPES_CATALOG.length,
    finalGovernance: FINAL_GOVERNANCE_ENTRIES.length,
    implementationStages: IMPLEMENTATION_STAGE_CATALOG.length,
    readinessCategories: READINESS_CATEGORIES.length,
    certificationTypes: CERTIFICATION_TYPES.length,
    moneyInvariants: MONEY_INVARIANTS
  });
}
