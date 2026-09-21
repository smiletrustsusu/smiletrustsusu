/**
 * Phase 19 — Canonical Governance Registry (EGCCRMS).
 * Catalog of enterprise governance, change, configuration, release, version,
 * compliance, policy lifecycle, exceptions, and governance workflows.
 * Consumes Phase 8 config/policy semantics, Phase 14 CI/CD & emergency
 * exception patterns, Phase 16 quality gates / CERT-*, Phase 18 ops —
 * does not redefine those standards.
 * Does not replace Modules 1–30 engines (esp. Module 30 platform admin).
 * Catalog only: no money posts, no RBAC rewrite, no new nav.
 * Phase 20 (EIBPRFBS) is the downstream final specification baseline —
 * it integrates EGCCRMS by reference and must not redefine this registry.
 */

export const EGCCRMS_VERSION = "1.0.0";
export const EGCCRMS_STATUS = "Authoritative";
export const PLATFORM_MODULE = 30;
export const CONFIG_POLICY_PHASE = 8;
export const DEPLOYMENT_PHASE = 14;
export const TESTING_PHASE = 16;
export const OPERATIONS_PHASE = 18;
export const PHASE8_REGISTRY_REF = "src/core/canonical-config-registry.js";
export const PHASE14_REGISTRY_REF = "src/core/canonical-deployment-registry.js";
export const PHASE16_REGISTRY_REF = "src/core/canonical-testing-registry.js";
export const PHASE18_REGISTRY_REF = "src/core/canonical-operations-registry.js";
export const PHASE14_EMERGENCY_PATTERN =
  "docs/enterprise-deployment-devops.md#e3-delegation--emergency";
export const PHASE16_GATE_EXCEPTION_RULE = "emergency_exception_approved";
export const PHASE16_CERT_HOTFIX = "CERT-002";
export const PHASE16_PROD_GATES = Object.freeze(["QG-001", "QG-002", "QG-003", "QG-004"]);
export const PHASE16_HOTFIX_GATES = Object.freeze(["QG-001", "QG-004"]);

export const ROLE_ID_PATTERN = /^ROLE-[A-Z0-9-]+$/;
export const COMM_ID_PATTERN = /^COMM-[0-9]{3}$/;
export const CHG_ID_PATTERN = /^CHG-[0-9]{3}$/;
export const CI_ID_PATTERN = /^CI-[0-9]{3}$/;
export const REL_ID_PATTERN = /^REL-[0-9]{3}$/;
export const VER_ID_PATTERN = /^VER-[0-9]{3}$/;
export const POL_ID_PATTERN = /^POL-[0-9]{3}$/;
export const CMP_ID_PATTERN = /^CMP-[0-9]{3}$/;
export const EXC_ID_PATTERN = /^EXC-[0-9]{3}$/;
export const GWF_ID_PATTERN = /^GWF-[0-9]{3}$/;
export const CODE_PATTERN = /^[A-Z][A-Z0-9_]{2,63}$/;

export const CHANGE_CLASSES = Object.freeze(["standard", "normal", "emergency"]);
export const CHANGE_DOMAINS = Object.freeze([
  "infrastructure",
  "application",
  "database",
  "configuration",
  "security",
  "ai_model",
  "reporting"
]);
export const CHANGE_LIFECYCLE = Object.freeze([
  "initiation",
  "assessment",
  "authorization",
  "planning",
  "implementation",
  "validation",
  "closure",
  "pir"
]);
export const CI_CATEGORIES = Object.freeze([
  "android_apk",
  "web_portal",
  "api",
  "database",
  "infrastructure",
  "certificate",
  "secret_ref",
  "ai_model",
  "report",
  "pipeline",
  "monitoring_config",
  "configuration"
]);
export const CI_STATUS = Object.freeze([
  "planned",
  "registered",
  "baselined",
  "in_change",
  "retired"
]);
export const RELEASE_TYPES = Object.freeze([
  "major",
  "minor",
  "patch",
  "hotfix",
  "emergency"
]);
export const RELEASE_LIFECYCLE = Object.freeze([
  "planning",
  "packaging",
  "scheduling",
  "approvals",
  "readiness",
  "prod_authorization",
  "deployment",
  "post_release_validation",
  "rollback_decision",
  "closure"
]);
export const POLICY_LIFECYCLE = Object.freeze([
  "draft",
  "review",
  "approved",
  "published",
  "superseded",
  "retired"
]);
export const POLICY_ARTIFACT_KINDS = Object.freeze([
  "policy",
  "standard",
  "procedure",
  "runbook",
  "specification",
  "json_schema",
  "registry"
]);
export const COMPLIANCE_DOMAINS = Object.freeze([
  "internal",
  "regulatory",
  "policy",
  "security",
  "operational"
]);
export const EXCEPTION_STATES = Object.freeze([
  "requested",
  "approved",
  "denied",
  "expired",
  "revoked"
]);
export const WORKFLOW_STATES = Object.freeze([
  "not_started",
  "in_progress",
  "awaiting_decision",
  "approved",
  "rejected",
  "escalated",
  "closed"
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

// ─── Governance Roles ────────────────────────────────────────────────────────

export const GOVERNANCE_ROLES = Object.freeze([
  freezeEntry({
    id: "ROLE-GOV-BOARD",
    code: "ROLE_GOVERNANCE_BOARD_CHAIR",
    title: "Governance Board Chair",
    accountableAuthority: "Governance Board Chair",
    decisionRights: Object.freeze(["enterprise_policy", "portfolio_priority", "exception_appeal"])
  }),
  freezeEntry({
    id: "ROLE-CAB-CHAIR",
    code: "ROLE_CAB_CHAIR",
    title: "CAB Chair",
    accountableAuthority: "CAB Chair",
    decisionRights: Object.freeze(["normal_change_authorize", "cab_agenda", "pir_accept"])
  }),
  freezeEntry({
    id: "ROLE-ECAB",
    code: "ROLE_ECAB_CHAIR",
    title: "Emergency CAB Chair",
    accountableAuthority: "Emergency CAB Chair",
    decisionRights: Object.freeze(["emergency_change_authorize", "emergency_release_authorize"])
  }),
  freezeEntry({
    id: "ROLE-CHANGE-MGR",
    code: "ROLE_CHANGE_MANAGER",
    title: "Change Manager",
    accountableAuthority: "Change Manager",
    decisionRights: Object.freeze(["classify_change", "schedule_change", "close_change"])
  }),
  freezeEntry({
    id: "ROLE-RELEASE-MGR",
    code: "ROLE_RELEASE_MANAGER",
    title: "Release Manager",
    accountableAuthority: "Release Manager",
    decisionRights: Object.freeze(["release_plan", "readiness_signoff", "rollback_govern"])
  }),
  freezeEntry({
    id: "ROLE-CONFIG-MGR",
    code: "ROLE_CONFIGURATION_MANAGER",
    title: "Configuration Manager",
    accountableAuthority: "Configuration Manager",
    decisionRights: Object.freeze(["ci_baseline", "ci_audit", "drift_disposition"])
  }),
  freezeEntry({
    id: "ROLE-POLICY-OWNER",
    code: "ROLE_POLICY_OWNER",
    title: "Policy Owner",
    accountableAuthority: "Policy Owner",
    decisionRights: Object.freeze(["policy_draft", "policy_publish_request", "policy_retire"])
  }),
  freezeEntry({
    id: "ROLE-COMPLIANCE",
    code: "ROLE_COMPLIANCE_OFFICER",
    title: "Compliance Officer",
    accountableAuthority: "Compliance Officer",
    decisionRights: Object.freeze(["compliance_assess", "exception_recommend", "evidence_accept"])
  }),
  freezeEntry({
    id: "ROLE-CIO",
    code: "ROLE_CIO",
    title: "Chief Information Officer",
    accountableAuthority: "CIO",
    decisionRights: Object.freeze(["prod_release_authorize", "major_change_veto", "cert_override_review"])
  }),
  freezeEntry({
    id: "ROLE-PLATFORM-ADMIN",
    code: "ROLE_PLATFORM_ADMIN",
    title: "Platform Administrator",
    accountableAuthority: "Platform Administrator",
    decisionRights: Object.freeze(["operational_config_govern", "module30_metadata", "env_promotion_record"]),
    owningModule: PLATFORM_MODULE,
    note: "References Module 30 platform admin; does not replace platform-ops engines"
  }),
  freezeEntry({
    id: "ROLE-SEC-GOV",
    code: "ROLE_SECURITY_GOVERNANCE",
    title: "Security Governance Lead",
    accountableAuthority: "Security Governance Lead",
    decisionRights: Object.freeze(["security_change_approve", "cert_secret_ci_govern"])
  }),
  freezeEntry({
    id: "ROLE-AUDIT",
    code: "ROLE_INTERNAL_AUDITOR",
    title: "Internal Auditor",
    accountableAuthority: "Internal Auditor",
    decisionRights: Object.freeze(["audit_governance", "sod_check", "pir_independent_review"])
  })
]);

// ─── Committees ──────────────────────────────────────────────────────────────

export const GOVERNANCE_COMMITTEES = Object.freeze([
  freezeEntry({
    id: "COMM-001",
    code: "COMM_ENTERPRISE_GOV_BOARD",
    name: "Enterprise Governance Board",
    cadence: "monthly",
    chairRoleId: "ROLE-GOV-BOARD",
    accountableAuthority: "Governance Board Chair",
    scope: "Enterprise policy, portfolio, escalated exceptions, Phase 1–19 catalog authority"
  }),
  freezeEntry({
    id: "COMM-002",
    code: "COMM_CAB",
    name: "Change Advisory Board (CAB)",
    cadence: "weekly",
    chairRoleId: "ROLE-CAB-CHAIR",
    accountableAuthority: "CAB Chair",
    scope: "Normal changes, release calendar alignment, PIR acceptance"
  }),
  freezeEntry({
    id: "COMM-003",
    code: "COMM_ECAB",
    name: "Emergency CAB (ECAB)",
    cadence: "on_demand",
    chairRoleId: "ROLE-ECAB",
    accountableAuthority: "Emergency CAB Chair",
    scope: "Emergency changes/releases; aligns Phase 14 emergency delegation & Phase 16 emergency_exception_approved",
    phase14Ref: PHASE14_EMERGENCY_PATTERN,
    phase16Ref: PHASE16_GATE_EXCEPTION_RULE
  }),
  freezeEntry({
    id: "COMM-004",
    code: "COMM_RELEASE_READINESS",
    name: "Release Readiness Board",
    cadence: "per_release",
    chairRoleId: "ROLE-RELEASE-MGR",
    accountableAuthority: "Release Manager",
    scope: "Major/minor readiness; consumes Phase 16 CERT-001 / QG-* without redefining gates"
  }),
  freezeEntry({
    id: "COMM-005",
    code: "COMM_CONFIG_CONTROL",
    name: "Configuration Control Board",
    cadence: "biweekly",
    chairRoleId: "ROLE-CONFIG-MGR",
    accountableAuthority: "Configuration Manager",
    scope: "CI baselines, drift disposition, CMDB integrity"
  }),
  freezeEntry({
    id: "COMM-006",
    code: "COMM_POLICY_REVIEW",
    name: "Policy Review Board",
    cadence: "monthly",
    chairRoleId: "ROLE-POLICY-OWNER",
    accountableAuthority: "Policy Owner",
    scope: "Policy/standard/procedure/schema/registry lifecycle approvals"
  }),
  freezeEntry({
    id: "COMM-007",
    code: "COMM_COMPLIANCE_RISK",
    name: "Compliance & Risk Committee",
    cadence: "quarterly",
    chairRoleId: "ROLE-COMPLIANCE",
    accountableAuthority: "Compliance Officer",
    scope: "Compliance domains, evidence, exception oversight"
  })
]);

// ─── Change Types (class × domain coverage) ──────────────────────────────────

export const CHANGE_TYPES = Object.freeze([
  freezeEntry({
    id: "CHG-001",
    code: "CHG_STANDARD_CONFIG",
    name: "Standard configuration change",
    changeClass: "standard",
    domain: "configuration",
    cabRequired: false,
    ecabRequired: false,
    requiredApproverRoleIds: Object.freeze(["ROLE-CHANGE-MGR", "ROLE-PLATFORM-ADMIN"]),
    pirRequired: false,
    maxLeadTimeHours: 24,
    consumesPhase8: true,
    accountableAuthority: "Change Manager",
    roleId: "ROLE-CHANGE-MGR",
    lifecycle: CHANGE_LIFECYCLE,
    description: "Pre-approved config within Phase 8 policy bounds; Module 30 records metadata"
  }),
  freezeEntry({
    id: "CHG-002",
    code: "CHG_STANDARD_REPORTING",
    name: "Standard reporting change",
    changeClass: "standard",
    domain: "reporting",
    cabRequired: false,
    ecabRequired: false,
    requiredApproverRoleIds: Object.freeze(["ROLE-CHANGE-MGR"]),
    pirRequired: false,
    maxLeadTimeHours: 48,
    accountableAuthority: "Change Manager",
    roleId: "ROLE-CHANGE-MGR",
    lifecycle: CHANGE_LIFECYCLE
  }),
  freezeEntry({
    id: "CHG-003",
    code: "CHG_NORMAL_APPLICATION",
    name: "Normal application change",
    changeClass: "normal",
    domain: "application",
    cabRequired: true,
    ecabRequired: false,
    requiredApproverRoleIds: Object.freeze(["ROLE-CAB-CHAIR", "ROLE-RELEASE-MGR"]),
    pirRequired: true,
    maxLeadTimeHours: 168,
    accountableAuthority: "CAB Chair",
    roleId: "ROLE-CAB-CHAIR",
    lifecycle: CHANGE_LIFECYCLE
  }),
  freezeEntry({
    id: "CHG-004",
    code: "CHG_NORMAL_INFRASTRUCTURE",
    name: "Normal infrastructure change",
    changeClass: "normal",
    domain: "infrastructure",
    cabRequired: true,
    ecabRequired: false,
    requiredApproverRoleIds: Object.freeze(["ROLE-CAB-CHAIR", "ROLE-PLATFORM-ADMIN"]),
    pirRequired: true,
    maxLeadTimeHours: 168,
    consumesPhase14: true,
    accountableAuthority: "CAB Chair",
    roleId: "ROLE-CAB-CHAIR",
    lifecycle: CHANGE_LIFECYCLE
  }),
  freezeEntry({
    id: "CHG-005",
    code: "CHG_NORMAL_DATABASE",
    name: "Normal database change",
    changeClass: "normal",
    domain: "database",
    cabRequired: true,
    ecabRequired: false,
    requiredApproverRoleIds: Object.freeze(["ROLE-CAB-CHAIR", "ROLE-CONFIG-MGR", "ROLE-AUDIT"]),
    pirRequired: true,
    maxLeadTimeHours: 240,
    moneyInvariantGuard: "pesewas; interest 15; collection days 31; cashier 1000",
    accountableAuthority: "CAB Chair",
    roleId: "ROLE-CAB-CHAIR",
    lifecycle: CHANGE_LIFECYCLE
  }),
  freezeEntry({
    id: "CHG-006",
    code: "CHG_NORMAL_SECURITY",
    name: "Normal security change",
    changeClass: "normal",
    domain: "security",
    cabRequired: true,
    ecabRequired: false,
    requiredApproverRoleIds: Object.freeze(["ROLE-CAB-CHAIR", "ROLE-SEC-GOV"]),
    pirRequired: true,
    maxLeadTimeHours: 120,
    accountableAuthority: "Security Governance Lead",
    roleId: "ROLE-SEC-GOV",
    lifecycle: CHANGE_LIFECYCLE
  }),
  freezeEntry({
    id: "CHG-007",
    code: "CHG_NORMAL_AI_MODEL",
    name: "Normal AI model change",
    changeClass: "normal",
    domain: "ai_model",
    cabRequired: true,
    ecabRequired: false,
    requiredApproverRoleIds: Object.freeze(["ROLE-CAB-CHAIR", "ROLE-COMPLIANCE", "ROLE-CIO"]),
    pirRequired: true,
    maxLeadTimeHours: 336,
    advisoryOnly: true,
    note: "AI remains advisory; no auto loan approval (Phase 12 constraint)",
    accountableAuthority: "CIO",
    roleId: "ROLE-CIO",
    lifecycle: CHANGE_LIFECYCLE
  }),
  freezeEntry({
    id: "CHG-008",
    code: "CHG_EMERGENCY_APPLICATION",
    name: "Emergency application change",
    changeClass: "emergency",
    domain: "application",
    cabRequired: false,
    ecabRequired: true,
    requiredApproverRoleIds: Object.freeze(["ROLE-ECAB", "ROLE-CIO", "ROLE-RELEASE-MGR"]),
    pirRequired: true,
    maxLeadTimeHours: 4,
    requiresExceptionId: true,
    phase14EmergencyAlign: true,
    phase16Bypass: PHASE16_GATE_EXCEPTION_RULE,
    phase16CertRef: PHASE16_CERT_HOTFIX,
    accountableAuthority: "Emergency CAB Chair",
    roleId: "ROLE-ECAB",
    lifecycle: CHANGE_LIFECYCLE
  }),
  freezeEntry({
    id: "CHG-009",
    code: "CHG_EMERGENCY_SECURITY",
    name: "Emergency security change",
    changeClass: "emergency",
    domain: "security",
    cabRequired: false,
    ecabRequired: true,
    requiredApproverRoleIds: Object.freeze(["ROLE-ECAB", "ROLE-SEC-GOV", "ROLE-CIO"]),
    pirRequired: true,
    maxLeadTimeHours: 2,
    requiresExceptionId: true,
    phase14EmergencyAlign: true,
    phase16Bypass: PHASE16_GATE_EXCEPTION_RULE,
    accountableAuthority: "Emergency CAB Chair",
    roleId: "ROLE-ECAB",
    lifecycle: CHANGE_LIFECYCLE
  }),
  freezeEntry({
    id: "CHG-010",
    code: "CHG_EMERGENCY_INFRASTRUCTURE",
    name: "Emergency infrastructure change",
    changeClass: "emergency",
    domain: "infrastructure",
    cabRequired: false,
    ecabRequired: true,
    requiredApproverRoleIds: Object.freeze(["ROLE-ECAB", "ROLE-PLATFORM-ADMIN", "ROLE-CIO"]),
    pirRequired: true,
    maxLeadTimeHours: 4,
    requiresExceptionId: true,
    phase14EmergencyAlign: true,
    phase16Bypass: PHASE16_GATE_EXCEPTION_RULE,
    accountableAuthority: "Emergency CAB Chair",
    roleId: "ROLE-ECAB",
    lifecycle: CHANGE_LIFECYCLE
  })
]);

// ─── Configuration Items (CMDB sample) ───────────────────────────────────────

export const CONFIGURATION_ITEMS = Object.freeze([
  freezeEntry({
    id: "CI-001",
    code: "CI_ANDROID_APK_COLLECTOR",
    name: "Collector Android APK",
    category: "android_apk",
    status: "baselined",
    version: "2.4.1",
    baselineId: "BL-APK-2026-09",
    ownerRoleId: "ROLE-RELEASE-MGR",
    accountableAuthority: "Release Manager",
    relatedModules: Object.freeze([6, 15, 17]),
    relatedPhases: Object.freeze([14, 16, 18]),
    relationships: Object.freeze(["CI-003", "CI-007", "CI-011"]),
    moneyInvariantGuard: true
  }),
  freezeEntry({
    id: "CI-002",
    code: "CI_WEB_PORTAL",
    name: "Web Portal (prepare:web → www/)",
    category: "web_portal",
    status: "baselined",
    version: "2.4.1",
    baselineId: "BL-WEB-2026-09",
    ownerRoleId: "ROLE-RELEASE-MGR",
    accountableAuthority: "Release Manager",
    relatedModules: Object.freeze([1, 30]),
    relatedPhases: Object.freeze([14, 16]),
    relationships: Object.freeze(["CI-003", "CI-010"]),
    artifactPath: "www/"
  }),
  freezeEntry({
    id: "CI-003",
    code: "CI_API_GATEWAY",
    name: "API Gateway contracts (in-process facades)",
    category: "api",
    status: "baselined",
    version: "1.8.0",
    baselineId: "BL-API-2026-09",
    ownerRoleId: "ROLE-CONFIG-MGR",
    accountableAuthority: "Configuration Manager",
    relatedModules: Object.freeze([20]),
    relatedPhases: Object.freeze([4, 14]),
    relationships: Object.freeze(["CI-004", "CI-002"]),
    note: "No new HTTP servers; OpenAPI as contract facades only"
  }),
  freezeEntry({
    id: "CI-004",
    code: "CI_PRIMARY_DB",
    name: "Primary transactional database",
    category: "database",
    status: "baselined",
    version: "schema-3.2.0",
    baselineId: "BL-DB-2026-09",
    ownerRoleId: "ROLE-CONFIG-MGR",
    accountableAuthority: "Configuration Manager",
    relatedModules: Object.freeze([7, 21]),
    relatedPhases: Object.freeze([3, 15]),
    relationships: Object.freeze(["CI-005", "CI-003"]),
    moneyInvariantGuard: true
  }),
  freezeEntry({
    id: "CI-005",
    code: "CI_INFRA_COMPUTE",
    name: "Production compute / hosting pool",
    category: "infrastructure",
    status: "baselined",
    version: "infra-2026.09",
    baselineId: "BL-INFRA-2026-09",
    ownerRoleId: "ROLE-PLATFORM-ADMIN",
    accountableAuthority: "Platform Administrator",
    relatedModules: Object.freeze([30]),
    relatedPhases: Object.freeze([14, 15]),
    relationships: Object.freeze(["CI-004", "CI-006"]),
    consumesPhase14: true
  }),
  freezeEntry({
    id: "CI-006",
    code: "CI_TLS_CERT_PORTAL",
    name: "TLS certificate — portal endpoint",
    category: "certificate",
    status: "baselined",
    version: "cert-portal-2026",
    baselineId: "BL-CERT-2026-09",
    ownerRoleId: "ROLE-SEC-GOV",
    accountableAuthority: "Security Governance Lead",
    relatedModules: Object.freeze([22, 30]),
    relatedPhases: Object.freeze([9, 14]),
    relationships: Object.freeze(["CI-002", "CI-007"]),
    expiresAt: "2027-03-15T00:00:00.000Z"
  }),
  freezeEntry({
    id: "CI-007",
    code: "CI_SECRET_REF_MOMO",
    name: "Secret reference — MoMo credentials (ref only)",
    category: "secret_ref",
    status: "baselined",
    version: "secretref-momo-v3",
    baselineId: "BL-SEC-2026-09",
    ownerRoleId: "ROLE-SEC-GOV",
    accountableAuthority: "Security Governance Lead",
    relatedModules: Object.freeze([16, 22]),
    relatedPhases: Object.freeze([8, 9]),
    relationships: Object.freeze(["CI-003"]),
    note: "Stores reference/handle only — never plaintext secrets in catalog"
  }),
  freezeEntry({
    id: "CI-008",
    code: "CI_AI_LOAN_ADVISORY",
    name: "AI loan default advisory model (AI-CAP-001)",
    category: "ai_model",
    status: "baselined",
    version: "model-1.2.0",
    baselineId: "BL-AI-2026-09",
    ownerRoleId: "ROLE-COMPLIANCE",
    accountableAuthority: "Compliance Officer",
    relatedModules: Object.freeze([29]),
    relatedPhases: Object.freeze([12, 16]),
    relationships: Object.freeze(["CI-003"]),
    advisoryOnly: true
  }),
  freezeEntry({
    id: "CI-009",
    code: "CI_REPORT_BRANCH_DAILY",
    name: "Branch daily collections report definition",
    category: "report",
    status: "baselined",
    version: "rpt-1.4.0",
    baselineId: "BL-RPT-2026-09",
    ownerRoleId: "ROLE-POLICY-OWNER",
    accountableAuthority: "Policy Owner",
    relatedModules: Object.freeze([11]),
    relatedPhases: Object.freeze([10, 17]),
    relationships: Object.freeze(["CI-004"]),
    moneyInvariantGuard: true
  }),
  freezeEntry({
    id: "CI-010",
    code: "CI_PIPELINE_PROD_RELEASE",
    name: "Production release pipeline",
    category: "pipeline",
    status: "baselined",
    version: "pipe-14.2.0",
    baselineId: "BL-PIPE-2026-09",
    ownerRoleId: "ROLE-RELEASE-MGR",
    accountableAuthority: "Release Manager",
    relatedModules: Object.freeze([30]),
    relatedPhases: Object.freeze([14, 16]),
    relationships: Object.freeze(["CI-001", "CI-002", "CI-011"]),
    consumesPhase14: true,
    note: "Consumes Phase 14 CI/CD; does not redefine deployment standards"
  }),
  freezeEntry({
    id: "CI-011",
    code: "CI_MONITORING_SYNC_HEALTH",
    name: "Sync health monitoring configuration",
    category: "monitoring_config",
    status: "baselined",
    version: "mon-cfg-1.1.0",
    baselineId: "BL-MON-2026-09",
    ownerRoleId: "ROLE-CONFIG-MGR",
    accountableAuthority: "Configuration Manager",
    relatedModules: Object.freeze([15, 19]),
    relatedPhases: Object.freeze([13, 18]),
    relationships: Object.freeze(["CI-001", "CI-010"]),
    consumesPhase13: true,
    note: "Consumes Phase 13 MET/SLO; Phase 18 ops dashboards — not redefined"
  }),
  freezeEntry({
    id: "CI-012",
    code: "CI_PHASE8_POLICY_PACK",
    name: "Phase 8 config/policy pack (governed as CI)",
    category: "configuration",
    status: "baselined",
    version: "ecpfms-1.0.0",
    baselineId: "BL-CFG-2026-09",
    ownerRoleId: "ROLE-PLATFORM-ADMIN",
    accountableAuthority: "Platform Administrator",
    relatedModules: Object.freeze([30]),
    relatedPhases: Object.freeze([8]),
    relationships: Object.freeze(["CI-007", "CI-002"]),
    consumesPhase8: true,
    note: "Governs change of Phase 8 artifacts; does not redefine config semantics"
  })
]);

// ─── Release Types ───────────────────────────────────────────────────────────

export const RELEASE_TYPE_CATALOG = Object.freeze([
  freezeEntry({
    id: "REL-001",
    code: "REL_MAJOR",
    name: "Major release",
    releaseType: "major",
    semverBump: "major",
    requiredGateIds: PHASE16_PROD_GATES,
    certificationId: "CERT-001",
    requiredApproverRoleIds: Object.freeze([
      "ROLE-RELEASE-MGR",
      "ROLE-CIO",
      "ROLE-CAB-CHAIR",
      "ROLE-PLATFORM-ADMIN"
    ]),
    rollbackPlanRequired: true,
    postValidationHours: 72,
    accountableAuthority: "Release Manager",
    roleId: "ROLE-RELEASE-MGR",
    lifecycle: RELEASE_LIFECYCLE
  }),
  freezeEntry({
    id: "REL-002",
    code: "REL_MINOR",
    name: "Minor release",
    releaseType: "minor",
    semverBump: "minor",
    requiredGateIds: PHASE16_PROD_GATES,
    certificationId: "CERT-001",
    requiredApproverRoleIds: Object.freeze(["ROLE-RELEASE-MGR", "ROLE-CAB-CHAIR", "ROLE-PLATFORM-ADMIN"]),
    rollbackPlanRequired: true,
    postValidationHours: 48,
    accountableAuthority: "Release Manager",
    roleId: "ROLE-RELEASE-MGR",
    lifecycle: RELEASE_LIFECYCLE
  }),
  freezeEntry({
    id: "REL-003",
    code: "REL_PATCH",
    name: "Patch release",
    releaseType: "patch",
    semverBump: "patch",
    requiredGateIds: Object.freeze(["QG-001", "QG-002", "QG-004"]),
    certificationId: "CERT-001",
    requiredApproverRoleIds: Object.freeze(["ROLE-RELEASE-MGR", "ROLE-PLATFORM-ADMIN"]),
    rollbackPlanRequired: true,
    postValidationHours: 24,
    accountableAuthority: "Release Manager",
    roleId: "ROLE-RELEASE-MGR",
    lifecycle: RELEASE_LIFECYCLE
  }),
  freezeEntry({
    id: "REL-004",
    code: "REL_HOTFIX",
    name: "Hotfix release",
    releaseType: "hotfix",
    semverBump: "patch",
    requiredGateIds: PHASE16_HOTFIX_GATES,
    certificationId: PHASE16_CERT_HOTFIX,
    requiredApproverRoleIds: Object.freeze(["ROLE-RELEASE-MGR", "ROLE-ECAB", "ROLE-CIO"]),
    rollbackPlanRequired: true,
    requiresException: true,
    postValidationHours: 12,
    phase16Align: true,
    accountableAuthority: "Release Manager",
    roleId: "ROLE-RELEASE-MGR",
    lifecycle: RELEASE_LIFECYCLE
  }),
  freezeEntry({
    id: "REL-005",
    code: "REL_EMERGENCY",
    name: "Emergency release",
    releaseType: "emergency",
    semverBump: "patch",
    requiredGateIds: PHASE16_HOTFIX_GATES,
    certificationId: PHASE16_CERT_HOTFIX,
    requiredApproverRoleIds: Object.freeze(["ROLE-ECAB", "ROLE-CIO", "ROLE-RELEASE-MGR"]),
    rollbackPlanRequired: true,
    requiresException: true,
    postValidationHours: 8,
    phase14EmergencyAlign: true,
    phase16Bypass: PHASE16_GATE_EXCEPTION_RULE,
    accountableAuthority: "Emergency CAB Chair",
    roleId: "ROLE-ECAB",
    lifecycle: RELEASE_LIFECYCLE
  })
]);

// ─── Version Governance Rules ────────────────────────────────────────────────

export const VERSION_RULES = Object.freeze([
  freezeEntry({
    id: "VER-001",
    code: "VER_SEMVER",
    name: "Semantic versioning",
    rule: "MAJOR.MINOR.PATCH",
    pattern: "^\\d+\\.\\d+\\.\\d+$",
    accountableAuthority: "Release Manager",
    roleId: "ROLE-RELEASE-MGR"
  }),
  freezeEntry({
    id: "VER-002",
    code: "VER_BUILD_NUMBER",
    name: "Monotonic build number",
    rule: "integer build ≥ previous for same artifact stream",
    pattern: "^[1-9][0-9]*$",
    accountableAuthority: "Release Manager",
    roleId: "ROLE-RELEASE-MGR"
  }),
  freezeEntry({
    id: "VER-003",
    code: "VER_RELEASE_ID",
    name: "Release identifier",
    rule: "REL-YYYYMMDD-N or REL-* catalog + build",
    pattern: "^REL-[0-9]{8}-[0-9]+$",
    accountableAuthority: "Release Manager",
    roleId: "ROLE-RELEASE-MGR"
  }),
  freezeEntry({
    id: "VER-004",
    code: "VER_ARTIFACT_ID",
    name: "Artifact identifier",
    rule: "CI code + semver + build",
    pattern: "^CI-[0-9]{3}@[0-9]+\\.[0-9]+\\.[0-9]+\\+[0-9]+$",
    accountableAuthority: "Configuration Manager",
    roleId: "ROLE-CONFIG-MGR"
  }),
  freezeEntry({
    id: "VER-005",
    code: "VER_COMPATIBILITY",
    name: "Compatibility matrix",
    rule: "APK↔API↔DB minor-compatible within published matrix; breaking requires major",
    accountableAuthority: "Configuration Manager",
    roleId: "ROLE-CONFIG-MGR"
  }),
  freezeEntry({
    id: "VER-006",
    code: "VER_DEPRECATION_EOL",
    name: "Deprecation & EOL",
    rule: "Deprecate ≥90 days before EOL; retired CIs cannot receive normal changes",
    minDeprecationDays: 90,
    accountableAuthority: "Policy Owner",
    roleId: "ROLE-POLICY-OWNER"
  })
]);

// ─── Policies / Standards (lifecycle-governed) ───────────────────────────────

export const POLICY_CATALOG = Object.freeze([
  freezeEntry({
    id: "POL-001",
    code: "POL_CHANGE_MGMT",
    name: "Enterprise Change Management Policy",
    kind: "policy",
    lifecycleState: "published",
    version: "1.0.0",
    accountableAuthority: "Change Manager",
    roleId: "ROLE-CHANGE-MGR",
    relatedPhases: Object.freeze([14, 16, 19])
  }),
  freezeEntry({
    id: "POL-002",
    code: "POL_RELEASE_MGMT",
    name: "Release Management Standard",
    kind: "standard",
    lifecycleState: "published",
    version: "1.0.0",
    accountableAuthority: "Release Manager",
    roleId: "ROLE-RELEASE-MGR",
    relatedPhases: Object.freeze([14, 16, 19])
  }),
  freezeEntry({
    id: "POL-003",
    code: "POL_CONFIG_MGMT",
    name: "Configuration Management Procedure",
    kind: "procedure",
    lifecycleState: "published",
    version: "1.0.0",
    accountableAuthority: "Configuration Manager",
    roleId: "ROLE-CONFIG-MGR",
    relatedPhases: Object.freeze([8, 19])
  }),
  freezeEntry({
    id: "POL-004",
    code: "POL_EMERGENCY_EXCEPTION",
    name: "Emergency Exception Runbook",
    kind: "runbook",
    lifecycleState: "published",
    version: "1.0.0",
    accountableAuthority: "Emergency CAB Chair",
    roleId: "ROLE-ECAB",
    relatedPhases: Object.freeze([14, 16, 19]),
    phase14Align: true,
    phase16Align: true
  }),
  freezeEntry({
    id: "POL-005",
    code: "POL_EGCCRMS_SPEC",
    name: "EGCCRMS Specification",
    kind: "specification",
    lifecycleState: "published",
    version: "1.0.0",
    accountableAuthority: "Governance Board Chair",
    roleId: "ROLE-GOV-BOARD",
    relatedPhases: Object.freeze([19]),
    note: "Phase 20 Implementation Blueprint will consolidate Phases 1–19 — not started"
  }),
  freezeEntry({
    id: "POL-006",
    code: "POL_CHANGE_REQUEST_SCHEMA",
    name: "Change Request JSON Schema",
    kind: "json_schema",
    lifecycleState: "published",
    version: "1.0.0",
    accountableAuthority: "Configuration Manager",
    roleId: "ROLE-CONFIG-MGR",
    schemaPath: "docs/schemas/governance/change-request.schema.json"
  }),
  freezeEntry({
    id: "POL-007",
    code: "POL_GOVERNANCE_REGISTRY",
    name: "Canonical Governance Registry",
    kind: "registry",
    lifecycleState: "published",
    version: EGCCRMS_VERSION,
    accountableAuthority: "Governance Board Chair",
    roleId: "ROLE-GOV-BOARD",
    registryPath: "src/core/canonical-governance-registry.js"
  }),
  freezeEntry({
    id: "POL-008",
    code: "POL_MONEY_INVARIANTS",
    name: "Money Invariant Protection Standard",
    kind: "standard",
    lifecycleState: "published",
    version: "1.0.0",
    accountableAuthority: "Compliance Officer",
    roleId: "ROLE-COMPLIANCE",
    moneyInvariants: "pesewas; interest 15; collection days 31; cashier 1000"
  })
]);

/** Allowed policy lifecycle transitions (from → to[]). */
export const POLICY_TRANSITIONS = Object.freeze({
  draft: Object.freeze(["review", "retired"]),
  review: Object.freeze(["approved", "draft", "retired"]),
  approved: Object.freeze(["published", "draft", "retired"]),
  published: Object.freeze(["superseded", "retired"]),
  superseded: Object.freeze(["retired"]),
  retired: Object.freeze([])
});

// ─── Compliance Domains ──────────────────────────────────────────────────────

export const COMPLIANCE_CATALOG = Object.freeze([
  freezeEntry({
    id: "CMP-001",
    code: "CMP_INTERNAL_GOV",
    name: "Internal governance compliance",
    domain: "internal",
    evidenceRequired: true,
    reportingCadence: "monthly",
    accountableAuthority: "Compliance Officer",
    roleId: "ROLE-COMPLIANCE"
  }),
  freezeEntry({
    id: "CMP-002",
    code: "CMP_REGULATORY",
    name: "Regulatory compliance (financial Susu ops)",
    domain: "regulatory",
    evidenceRequired: true,
    reportingCadence: "quarterly",
    accountableAuthority: "Compliance Officer",
    roleId: "ROLE-COMPLIANCE",
    moneyInvariantGuard: true
  }),
  freezeEntry({
    id: "CMP-003",
    code: "CMP_POLICY_ADHERENCE",
    name: "Enterprise policy adherence",
    domain: "policy",
    evidenceRequired: true,
    reportingCadence: "monthly",
    accountableAuthority: "Policy Owner",
    roleId: "ROLE-POLICY-OWNER"
  }),
  freezeEntry({
    id: "CMP-004",
    code: "CMP_SECURITY",
    name: "Security control compliance",
    domain: "security",
    evidenceRequired: true,
    reportingCadence: "monthly",
    accountableAuthority: "Security Governance Lead",
    roleId: "ROLE-SEC-GOV"
  }),
  freezeEntry({
    id: "CMP-005",
    code: "CMP_OPERATIONAL",
    name: "Operational compliance (SLA / change / release)",
    domain: "operational",
    evidenceRequired: true,
    reportingCadence: "weekly",
    accountableAuthority: "Change Manager",
    roleId: "ROLE-CHANGE-MGR",
    relatedPhases: Object.freeze([16, 18, 19])
  })
]);

// ─── Exception Registry ──────────────────────────────────────────────────────

export const EXCEPTION_REGISTRY = Object.freeze([
  freezeEntry({
    id: "EXC-001",
    code: "EXC_HOTFIX_GATE_BYPASS",
    name: "Hotfix quality-gate emergency exception",
    state: "approved",
    changeClass: "emergency",
    phase16Bypass: PHASE16_GATE_EXCEPTION_RULE,
    phase16CertRef: PHASE16_CERT_HOTFIX,
    phase14Align: true,
    approverRoleIds: Object.freeze(["ROLE-ECAB", "ROLE-CIO"]),
    validFrom: "2026-09-01T00:00:00.000Z",
    validTo: "2026-12-31T23:59:59.000Z",
    maxDurationHours: 72,
    pirRequired: true,
    accountableAuthority: "Emergency CAB Chair",
    roleId: "ROLE-ECAB",
    note: "Aligns Phase 14 emergency delegation + Phase 16 bypassRequires=emergency_exception_approved"
  }),
  freezeEntry({
    id: "EXC-002",
    code: "EXC_STANDARD_WINDOW_EXT",
    name: "Standard change window extension",
    state: "approved",
    changeClass: "standard",
    approverRoleIds: Object.freeze(["ROLE-CHANGE-MGR", "ROLE-CAB-CHAIR"]),
    validFrom: "2026-09-01T00:00:00.000Z",
    validTo: "2026-10-31T23:59:59.000Z",
    maxDurationHours: 168,
    pirRequired: false,
    accountableAuthority: "Change Manager",
    roleId: "ROLE-CHANGE-MGR"
  }),
  freezeEntry({
    id: "EXC-003",
    code: "EXC_EXPIRED_SAMPLE",
    name: "Expired sample exception (test fixture)",
    state: "expired",
    changeClass: "normal",
    approverRoleIds: Object.freeze(["ROLE-CAB-CHAIR"]),
    validFrom: "2025-01-01T00:00:00.000Z",
    validTo: "2025-06-30T23:59:59.000Z",
    maxDurationHours: 24,
    pirRequired: true,
    accountableAuthority: "CAB Chair",
    roleId: "ROLE-CAB-CHAIR"
  }),
  freezeEntry({
    id: "EXC-004",
    code: "EXC_AI_MODEL_PILOT",
    name: "AI model pilot advisory exception",
    state: "approved",
    changeClass: "normal",
    domain: "ai_model",
    approverRoleIds: Object.freeze(["ROLE-COMPLIANCE", "ROLE-CIO"]),
    validFrom: "2026-08-01T00:00:00.000Z",
    validTo: "2027-01-31T23:59:59.000Z",
    maxDurationHours: 2160,
    pirRequired: false,
    advisoryOnly: true,
    accountableAuthority: "Compliance Officer",
    roleId: "ROLE-COMPLIANCE"
  })
]);

// ─── Governance Workflows ────────────────────────────────────────────────────

export const GOVERNANCE_WORKFLOWS = Object.freeze([
  freezeEntry({
    id: "GWF-001",
    code: "GWF_NORMAL_CHANGE",
    name: "Normal change authorization workflow",
    entryCriteria: Object.freeze([
      "change_request_complete",
      "ci_impact_assessed",
      "risk_scored"
    ]),
    exitCriteria: Object.freeze(["cab_decision_recorded", "implementation_window_set"]),
    decisionPoints: Object.freeze(["cab_approve", "cab_reject", "cab_defer"]),
    evidenceRequired: Object.freeze(["impact_assessment", "test_plan_ref", "rollback_plan"]),
    signOffRoleIds: Object.freeze(["ROLE-CAB-CHAIR", "ROLE-CHANGE-MGR"]),
    escalationRoleIds: Object.freeze(["ROLE-CIO", "ROLE-GOV-BOARD"]),
    accountableAuthority: "CAB Chair",
    roleId: "ROLE-CAB-CHAIR"
  }),
  freezeEntry({
    id: "GWF-002",
    code: "GWF_EMERGENCY_CHANGE",
    name: "Emergency change / ECAB workflow",
    entryCriteria: Object.freeze([
      "sev_critical_or_security_incident",
      "exception_requested",
      "ecab_quorum"
    ]),
    exitCriteria: Object.freeze(["ecab_authorize", "exception_linked", "pir_scheduled"]),
    decisionPoints: Object.freeze(["ecab_approve", "ecab_reject", "escalate_cio"]),
    evidenceRequired: Object.freeze(["incident_ref", "exception_id", "interim_risk"]),
    signOffRoleIds: Object.freeze(["ROLE-ECAB", "ROLE-CIO"]),
    escalationRoleIds: Object.freeze(["ROLE-GOV-BOARD", "ROLE-AUDIT"]),
    phase14Align: true,
    phase16Align: true,
    accountableAuthority: "Emergency CAB Chair",
    roleId: "ROLE-ECAB"
  }),
  freezeEntry({
    id: "GWF-003",
    code: "GWF_RELEASE_READINESS",
    name: "Release readiness & prod authorization",
    entryCriteria: Object.freeze([
      "release_package_complete",
      "phase16_gates_evaluated",
      "rollback_plan_attached"
    ]),
    exitCriteria: Object.freeze(["prod_auth_recorded", "post_validation_plan"]),
    decisionPoints: Object.freeze(["go", "no_go", "conditional_go"]),
    evidenceRequired: Object.freeze(["qg_results", "cert_id", "monitoring_check"]),
    signOffRoleIds: Object.freeze(["ROLE-RELEASE-MGR", "ROLE-CIO", "ROLE-PLATFORM-ADMIN"]),
    escalationRoleIds: Object.freeze(["ROLE-GOV-BOARD"]),
    consumesPhase16: true,
    accountableAuthority: "Release Manager",
    roleId: "ROLE-RELEASE-MGR"
  }),
  freezeEntry({
    id: "GWF-004",
    code: "GWF_CI_BASELINE",
    name: "CI baseline & drift disposition",
    entryCriteria: Object.freeze(["ci_registered", "inventory_complete"]),
    exitCriteria: Object.freeze(["baseline_id_assigned", "status_accounting_updated"]),
    decisionPoints: Object.freeze(["accept_baseline", "remediate_drift", "retire_ci"]),
    evidenceRequired: Object.freeze(["baseline_hash", "relationship_map", "audit_note"]),
    signOffRoleIds: Object.freeze(["ROLE-CONFIG-MGR"]),
    escalationRoleIds: Object.freeze(["ROLE-CAB-CHAIR", "ROLE-AUDIT"]),
    accountableAuthority: "Configuration Manager",
    roleId: "ROLE-CONFIG-MGR"
  }),
  freezeEntry({
    id: "GWF-005",
    code: "GWF_POLICY_LIFECYCLE",
    name: "Policy & standard lifecycle workflow",
    entryCriteria: Object.freeze(["artifact_drafted", "owner_assigned"]),
    exitCriteria: Object.freeze(["published_or_retired", "supersession_linked"]),
    decisionPoints: Object.freeze(["approve", "return_to_draft", "retire"]),
    evidenceRequired: Object.freeze(["review_comments", "sod_check"]),
    signOffRoleIds: Object.freeze(["ROLE-POLICY-OWNER", "ROLE-GOV-BOARD"]),
    escalationRoleIds: Object.freeze(["ROLE-AUDIT"]),
    accountableAuthority: "Policy Owner",
    roleId: "ROLE-POLICY-OWNER"
  }),
  freezeEntry({
    id: "GWF-006",
    code: "GWF_EXCEPTION_MGMT",
    name: "Exception request / expiry workflow",
    entryCriteria: Object.freeze(["exception_justified", "max_duration_set"]),
    exitCriteria: Object.freeze(["approved_or_denied", "expiry_monitored"]),
    decisionPoints: Object.freeze(["approve", "deny", "revoke", "extend"]),
    evidenceRequired: Object.freeze(["risk_acceptance", "compensating_control"]),
    signOffRoleIds: Object.freeze(["ROLE-COMPLIANCE", "ROLE-ECAB"]),
    escalationRoleIds: Object.freeze(["ROLE-CIO", "ROLE-GOV-BOARD"]),
    accountableAuthority: "Compliance Officer",
    roleId: "ROLE-COMPLIANCE"
  })
]);

// ─── Cross-reference Modules 1–30 × Phases 1–18 (governance lens) ────────────

export const CROSS_REF_MATRIX = Object.freeze(
  Array.from({ length: 30 }, (_, i) => {
    const module = i + 1;
    const phases = [];
    if ([1, 2, 3, 5, 6, 7, 8].includes(module)) phases.push(1, 2, 3);
    if ([11].includes(module)) phases.push(10, 17);
    if ([15].includes(module)) phases.push(13, 14, 18);
    if ([19].includes(module)) phases.push(13, 18);
    if ([21].includes(module)) phases.push(14, 15);
    if ([22].includes(module)) phases.push(9, 16);
    if ([24, 29].includes(module)) phases.push(12, 16);
    if ([30].includes(module)) phases.push(8, 14, 16, 18, 19);
    if (!phases.length) phases.push(1, 19);
    const unique = [...new Set(phases)].sort((a, b) => a - b);
    return freezeEntry({
      module,
      relatedPhases: Object.freeze(unique),
      governanceNote:
        module === 30
          ? "Operational config governance reference; engines not replaced"
          : "Change/config/release governed via EGCCRMS; engines not replaced",
      accountableAuthority: module === 30 ? "Platform Administrator" : "Change Manager"
    });
  })
);

// ─── List / Get ──────────────────────────────────────────────────────────────

export function listGovernanceRoles() {
  return [...GOVERNANCE_ROLES];
}
export function listCommittees() {
  return [...GOVERNANCE_COMMITTEES];
}
export function listChangeTypes() {
  return [...CHANGE_TYPES];
}
export function listConfigurationItems() {
  return [...CONFIGURATION_ITEMS];
}
export function listReleaseTypes() {
  return [...RELEASE_TYPE_CATALOG];
}
export function listVersionRules() {
  return [...VERSION_RULES];
}
export function listPolicies() {
  return [...POLICY_CATALOG];
}
export function listCompliance() {
  return [...COMPLIANCE_CATALOG];
}
export function listExceptions() {
  return [...EXCEPTION_REGISTRY];
}
export function listGovernanceWorkflows() {
  return [...GOVERNANCE_WORKFLOWS];
}
export function listCrossRefs() {
  return [...CROSS_REF_MATRIX];
}

export function getGovernanceRole(idOrCode) {
  return byIdOrCode(GOVERNANCE_ROLES, idOrCode);
}
export function getCommittee(idOrCode) {
  return byIdOrCode(GOVERNANCE_COMMITTEES, idOrCode);
}
export function getChangeType(idOrCode) {
  return byIdOrCode(CHANGE_TYPES, idOrCode);
}
export function getConfigurationItem(idOrCode) {
  return byIdOrCode(CONFIGURATION_ITEMS, idOrCode);
}
export function getReleaseType(idOrCode) {
  return byIdOrCode(RELEASE_TYPE_CATALOG, idOrCode);
}
export function getVersionRule(idOrCode) {
  return byIdOrCode(VERSION_RULES, idOrCode);
}
export function getPolicy(idOrCode) {
  return byIdOrCode(POLICY_CATALOG, idOrCode);
}
export function getCompliance(idOrCode) {
  return byIdOrCode(COMPLIANCE_CATALOG, idOrCode);
}
export function getException(idOrCode) {
  return byIdOrCode(EXCEPTION_REGISTRY, idOrCode);
}
export function getGovernanceWorkflow(idOrCode) {
  return byIdOrCode(GOVERNANCE_WORKFLOWS, idOrCode);
}

export function getChangeTypesByClass(changeClass) {
  return CHANGE_TYPES.filter((c) => c.changeClass === changeClass);
}

export function getChangeTypeByClassAndDomain(changeClass, domain) {
  return (
    CHANGE_TYPES.find((c) => c.changeClass === changeClass && c.domain === domain) || null
  );
}

export function getCisByCategory(category) {
  return CONFIGURATION_ITEMS.filter((c) => c.category === category);
}

export function getReleaseTypeByKind(releaseType) {
  return RELEASE_TYPE_CATALOG.find((r) => r.releaseType === releaseType) || null;
}

// ─── Validation helpers ──────────────────────────────────────────────────────

export function assertIdUniqueness() {
  const groups = [
    ["ROLE", GOVERNANCE_ROLES],
    ["COMM", GOVERNANCE_COMMITTEES],
    ["CHG", CHANGE_TYPES],
    ["CI", CONFIGURATION_ITEMS],
    ["REL", RELEASE_TYPE_CATALOG],
    ["VER", VERSION_RULES],
    ["POL", POLICY_CATALOG],
    ["CMP", COMPLIANCE_CATALOG],
    ["EXC", EXCEPTION_REGISTRY],
    ["GWF", GOVERNANCE_WORKFLOWS]
  ];
  for (const [label, list] of groups) {
    const ids = new Set();
    const codes = new Set();
    for (const item of list) {
      if (ids.has(item.id)) return err("EGC-ID-001", `Duplicate ${label} id ${item.id}`);
      if (codes.has(item.code)) return err("EGC-ID-002", `Duplicate ${label} code ${item.code}`);
      ids.add(item.id);
      codes.add(item.code);
    }
  }
  return ok();
}

export function assertSingleOwnerPerEntry() {
  const collections = [
    ...GOVERNANCE_COMMITTEES,
    ...CHANGE_TYPES,
    ...CONFIGURATION_ITEMS,
    ...RELEASE_TYPE_CATALOG,
    ...VERSION_RULES,
    ...POLICY_CATALOG,
    ...COMPLIANCE_CATALOG,
    ...EXCEPTION_REGISTRY,
    ...GOVERNANCE_WORKFLOWS,
    ...CROSS_REF_MATRIX
  ];
  for (const item of collections) {
    if (!item.accountableAuthority || !String(item.accountableAuthority).trim()) {
      return err("EGC-OWN-001", `Missing accountableAuthority on ${item.id || `module-${item.module}`}`);
    }
  }
  for (const role of GOVERNANCE_ROLES) {
    if (!role.accountableAuthority) {
      return err("EGC-OWN-002", `Missing accountableAuthority on ${role.id}`);
    }
  }
  return ok();
}

export function assertExactlyOneAccountableAuthority() {
  return assertSingleOwnerPerEntry();
}

export function assertRefsResolve() {
  const errors = [];
  for (const c of GOVERNANCE_COMMITTEES) {
    if (!getGovernanceRole(c.chairRoleId)) {
      errors.push(`${c.id} unknown chairRoleId ${c.chairRoleId}`);
    }
  }
  for (const ch of CHANGE_TYPES) {
    if (ch.roleId && !getGovernanceRole(ch.roleId)) {
      errors.push(`${ch.id} unknown roleId ${ch.roleId}`);
    }
    for (const rid of ch.requiredApproverRoleIds || []) {
      if (!getGovernanceRole(rid)) errors.push(`${ch.id} unknown approver ${rid}`);
    }
  }
  for (const ci of CONFIGURATION_ITEMS) {
    if (ci.ownerRoleId && !getGovernanceRole(ci.ownerRoleId)) {
      errors.push(`${ci.id} unknown ownerRoleId ${ci.ownerRoleId}`);
    }
    for (const rel of ci.relationships || []) {
      if (!getConfigurationItem(rel)) errors.push(`${ci.id} unknown relationship ${rel}`);
    }
  }
  for (const r of RELEASE_TYPE_CATALOG) {
    for (const rid of r.requiredApproverRoleIds || []) {
      if (!getGovernanceRole(rid)) errors.push(`${r.id} unknown approver ${rid}`);
    }
  }
  for (const w of GOVERNANCE_WORKFLOWS) {
    for (const rid of [...(w.signOffRoleIds || []), ...(w.escalationRoleIds || [])]) {
      if (!getGovernanceRole(rid)) errors.push(`${w.id} unknown role ${rid}`);
    }
  }
  for (const ex of EXCEPTION_REGISTRY) {
    for (const rid of ex.approverRoleIds || []) {
      if (!getGovernanceRole(rid)) errors.push(`${ex.id} unknown approver ${rid}`);
    }
  }
  if (errors.length) return err("EGC-REF-001", "Cross-reference resolution failed", { errors });
  return ok();
}

export function assertChangeTypeCoverage() {
  const errors = [];
  for (const cls of CHANGE_CLASSES) {
    if (!CHANGE_TYPES.some((c) => c.changeClass === cls)) {
      errors.push(`Missing change class ${cls}`);
    }
  }
  for (const domain of CHANGE_DOMAINS) {
    if (!CHANGE_TYPES.some((c) => c.domain === domain)) {
      errors.push(`Missing change domain ${domain}`);
    }
  }
  if (errors.length) return err("EGC-CHG-001", "Change type coverage incomplete", { errors });
  return ok({ classes: CHANGE_CLASSES.length, domains: CHANGE_DOMAINS.length });
}

export function assertCiCategoryCoverage() {
  const present = new Set(CONFIGURATION_ITEMS.map((c) => c.category));
  const missing = CI_CATEGORIES.filter((c) => !present.has(c));
  if (missing.length) {
    return err("EGC-CI-001", "CI category coverage incomplete", { missing });
  }
  return ok({ categories: CI_CATEGORIES.length, cis: CONFIGURATION_ITEMS.length });
}

export function assertReleaseTypeCoverage() {
  const present = new Set(RELEASE_TYPE_CATALOG.map((r) => r.releaseType));
  const missing = RELEASE_TYPES.filter((t) => !present.has(t));
  if (missing.length) {
    return err("EGC-REL-001", "Release type coverage incomplete", { missing });
  }
  return ok({ releaseTypes: RELEASE_TYPES.length });
}

export function assertPolicyLifecycleStates() {
  for (const state of POLICY_LIFECYCLE) {
    if (!POLICY_TRANSITIONS[state]) {
      return err("EGC-POL-001", `Missing transitions for state ${state}`);
    }
  }
  for (const p of POLICY_CATALOG) {
    if (!POLICY_LIFECYCLE.includes(p.lifecycleState)) {
      return err("EGC-POL-002", `${p.id} invalid lifecycleState ${p.lifecycleState}`);
    }
  }
  return ok({ states: POLICY_LIFECYCLE.length });
}

export function assertCrossPhaseConsistency() {
  const errors = [];
  if (PLATFORM_MODULE !== 30) errors.push("PLATFORM_MODULE must remain 30");
  if (CONFIG_POLICY_PHASE !== 8) errors.push("CONFIG_POLICY_PHASE must remain 8");
  if (DEPLOYMENT_PHASE !== 14) errors.push("DEPLOYMENT_PHASE must remain 14");
  if (TESTING_PHASE !== 16) errors.push("TESTING_PHASE must remain 16");
  if (OPERATIONS_PHASE !== 18) errors.push("OPERATIONS_PHASE must remain 18");

  const emerg = CHANGE_TYPES.filter((c) => c.changeClass === emergencyClass());
  for (const e of emerg) {
    if (!e.phase14EmergencyAlign) errors.push(`${e.id} must align Phase 14 emergency`);
    if (e.phase16Bypass !== PHASE16_GATE_EXCEPTION_RULE) {
      errors.push(`${e.id} must use Phase 16 ${PHASE16_GATE_EXCEPTION_RULE}`);
    }
    if (!e.requiresExceptionId) errors.push(`${e.id} must require exception id`);
  }

  const hotfix = getReleaseTypeByKind("hotfix");
  const emergency = getReleaseTypeByKind("emergency");
  if (!hotfix?.requiresException || hotfix.certificationId !== PHASE16_CERT_HOTFIX) {
    errors.push("Hotfix must require exception and CERT-002");
  }
  if (!emergency?.phase14EmergencyAlign || emergency.phase16Bypass !== PHASE16_GATE_EXCEPTION_RULE) {
    errors.push("Emergency release must align Phase 14/16 exception patterns");
  }

  const phase8Ci = getConfigurationItem("CI-012");
  if (!phase8Ci?.consumesPhase8) errors.push("CI-012 must consume Phase 8");

  const pipe = getConfigurationItem("CI-010");
  if (!pipe?.consumesPhase14) errors.push("CI-010 must consume Phase 14 pipelines");

  if (CROSS_REF_MATRIX.length !== 30) errors.push("Cross-ref must cover modules 1–30");

  if (errors.length) {
    return err("EGC-XP-001", "Cross-phase consistency failed", { errors });
  }
  return ok();
}

function emergencyClass() {
  return "emergency";
}

export function assertModulesNotReplaced() {
  return ok({
    platformModule: PLATFORM_MODULE,
    configPolicyPhase: CONFIG_POLICY_PHASE,
    deploymentPhase: DEPLOYMENT_PHASE,
    testingPhase: TESTING_PHASE,
    operationsPhase: OPERATIONS_PHASE,
    note: "Phase 19 catalogs only; Phase 8/14/16/18 standards consumed; Module 30 not replaced; Phase 20 EIBPRFBS is downstream baseline (does not redefine EGCCRMS)"
  });
}

export function validateGovernanceRegistry() {
  const checks = [
    assertIdUniqueness(),
    assertSingleOwnerPerEntry(),
    assertRefsResolve(),
    assertChangeTypeCoverage(),
    assertCiCategoryCoverage(),
    assertReleaseTypeCoverage(),
    assertPolicyLifecycleStates(),
    assertCrossPhaseConsistency(),
    assertModulesNotReplaced()
  ];
  const errors = [];
  for (const c of checks) {
    if (!c.ok) {
      errors.push(c.message);
      if (c.errors) errors.push(...c.errors);
      if (c.missing) errors.push(...c.missing);
    }
  }
  if (errors.length) return err("EGC-VAL-000", "Governance registry invalid", { errors });
  return ok({ counts: egccrmsCounts() });
}

export function egccrmsCounts() {
  return Object.freeze({
    roles: GOVERNANCE_ROLES.length,
    committees: GOVERNANCE_COMMITTEES.length,
    changeTypes: CHANGE_TYPES.length,
    changeClasses: CHANGE_CLASSES.length,
    changeDomains: CHANGE_DOMAINS.length,
    configurationItems: CONFIGURATION_ITEMS.length,
    ciCategories: CI_CATEGORIES.length,
    releaseTypes: RELEASE_TYPE_CATALOG.length,
    versionRules: VERSION_RULES.length,
    policies: POLICY_CATALOG.length,
    policyLifecycleStates: POLICY_LIFECYCLE.length,
    compliance: COMPLIANCE_CATALOG.length,
    exceptions: EXCEPTION_REGISTRY.length,
    workflows: GOVERNANCE_WORKFLOWS.length,
    crossRefs: CROSS_REF_MATRIX.length
  });
}
