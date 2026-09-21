/**
 * Phase 18 — Canonical Operations Registry (EOSSMS).
 * Catalog of service management, service desk, incidents, problems,
 * service requests, knowledge, runbooks, ops KPIs, governance, offline
 * modes, sync retry/escalation, collector status messages, and decision flows.
 * Consumes Phases 13–17 catalogs — does not redefine monitoring, deployment,
 * BCDR, testing, or performance standards.
 * Does not replace Modules 1–30 engines (esp. Module 15 sync, 19 monitoring,
 * 21 backup, 30 platform).
 * Catalog only: no money posts, no RBAC rewrite, no new nav.
 */

export const EOSSMS_VERSION = "1.0.0";
export const EOSSMS_STATUS = "Authoritative";
export const SYNC_MODULE = 15;
export const SYNC_ENGINE_REF = "src/core/sync-ops.js";
export const OFFLINE_QUEUE_REF = "src/sync/offline-queue.js";
export const MONITORING_MODULE = 19;
export const MONITORING_ENGINE_REF = "src/core/monitoring-ops.js";
export const BACKUP_ENGINE_MODULE = 21;
export const JOB_ENGINE_MODULE = 18;
export const PLATFORM_MODULE = 30;
export const PHASE13_REGISTRY_REF = "src/core/canonical-monitoring-registry.js";
export const PHASE14_REGISTRY_REF = "src/core/canonical-deployment-registry.js";
export const PHASE15_REGISTRY_REF = "src/core/canonical-continuity-registry.js";
export const PHASE16_REGISTRY_REF = "src/core/canonical-testing-registry.js";
export const PHASE17_REGISTRY_REF = "src/core/canonical-performance-registry.js";

/** Phase 13 dashboard refresh — consumed, not redefined (EMOOIS observe cadence). */
export const PHASE13_DASHBOARD_REFRESH = Object.freeze({
  operationalStripSeconds: 30,
  alertsPanelSeconds: 60,
  deviceOfflinePanelSeconds: 60,
  syncHealthPanelSeconds: 60,
  businessVolumeMinutes: 5,
  sourceDoc: "docs/enterprise-monitoring-observability.md",
  note: "EOSSMS consumes refresh schedule for ops dashboards; does not redefine MET/SLO/ALT"
});

export const SVC_ID_PATTERN = /^SVC-[0-9]{3}$/;
export const SEV_ID_PATTERN = /^SEV-[0-9]{3}$/;
export const PRB_ID_PATTERN = /^PRB-[0-9]{3}$/;
export const SRT_ID_PATTERN = /^SRT-[0-9]{3}$/;
export const KB_ID_PATTERN = /^KB-[0-9]{3}$/;
export const RB_ID_PATTERN = /^RB-[0-9]{3}$/;
export const KPI_ID_PATTERN = /^OKPI-[0-9]{3}$/;
export const OGOV_ID_PATTERN = /^OGOV-[0-9]{3}$/;
export const OM_ID_PATTERN = /^OM-[0-9]{3}$/;
export const RETRY_ID_PATTERN = /^RETRY-[0-9]{3}$/;
export const ESC_ID_PATTERN = /^ESC-[0-9]{3}$/;
export const CSM_ID_PATTERN = /^CSM-[0-9]{3}$/;
export const DF_ID_PATTERN = /^DF-[0-9]{3}$/;
export const CODE_PATTERN = /^[A-Z][A-Z0-9_]{2,63}$/;

export const SERVICE_TIERS = Object.freeze([
  "tier1_critical",
  "tier2_core",
  "tier3_supporting",
  "tier4_optional"
]);
export const SERVICE_LIFECYCLE = Object.freeze([
  "proposed",
  "chartered",
  "active",
  "deprecated",
  "retired"
]);
export const TICKET_LIFECYCLE = Object.freeze([
  "new",
  "classified",
  "assigned",
  "in_progress",
  "pending_customer",
  "pending_vendor",
  "resolved",
  "closed",
  "reopened"
]);
export const INCIDENT_SEVERITIES = Object.freeze(["critical", "high", "medium", "low"]);
export const PROBLEM_TYPES = Object.freeze([
  "recurring_incident",
  "known_error",
  "capacity",
  "sync_conflict_pattern",
  "security",
  "data_integrity",
  "performance"
]);
export const REQUEST_CATEGORIES = Object.freeze([
  "account",
  "password_reset",
  "permission",
  "branch_config",
  "report",
  "integration",
  "training",
  "device"
]);
export const KNOWLEDGE_STATES = Object.freeze(["draft", "reviewed", "published", "archived"]);
export const OFFLINE_MODES = Object.freeze([
  "Online",
  "Offline",
  "Synchronizing",
  "Recovery",
  "ReadOnly"
]);
export const COLLECTOR_STATUSES = Object.freeze([
  "Online",
  "Offline",
  "Synchronizing",
  "SyncFailed",
  "ReadOnly",
  "PoorNetwork"
]);
export const SYNC_WORKFLOW_STAGES = Object.freeze([
  "authorize_device",
  "connectivity_check",
  "queue_snapshot",
  "validate_local",
  "conflict_prescan",
  "upload_batch",
  "server_ack",
  "apply_server",
  "download_deltas",
  "apply_local",
  "checkpoint",
  "reconcile",
  "session_close"
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

export const OPERATIONS_ROLES = Object.freeze([
  freezeEntry({
    id: "ROLE-SVC-OWNER",
    code: "ROLE_SERVICE_OWNER",
    title: "Service Owner",
    accountableAuthority: "Service Owner"
  }),
  freezeEntry({
    id: "ROLE-SD-MGR",
    code: "ROLE_SERVICE_DESK_MANAGER",
    title: "Service Desk Manager",
    accountableAuthority: "Service Desk Manager"
  }),
  freezeEntry({
    id: "ROLE-INC-MGR",
    code: "ROLE_INCIDENT_MANAGER",
    title: "Incident Manager",
    accountableAuthority: "Incident Manager"
  }),
  freezeEntry({
    id: "ROLE-PRB-MGR",
    code: "ROLE_PROBLEM_MANAGER",
    title: "Problem Manager",
    accountableAuthority: "Problem Manager"
  }),
  freezeEntry({
    id: "ROLE-OPS-LEAD",
    code: "ROLE_OPS_LEAD",
    title: "Operations Lead",
    accountableAuthority: "Operations Lead"
  }),
  freezeEntry({
    id: "ROLE-ONCALL",
    code: "ROLE_ONCALL_ENGINEER",
    title: "On-Call Engineer",
    accountableAuthority: "On-Call Engineer"
  }),
  freezeEntry({
    id: "ROLE-KB-OWNER",
    code: "ROLE_KNOWLEDGE_OWNER",
    title: "Knowledge Owner",
    accountableAuthority: "Knowledge Owner"
  }),
  freezeEntry({
    id: "ROLE-BRANCH-SUP",
    code: "ROLE_BRANCH_SUPERVISOR",
    title: "Branch Supervisor",
    accountableAuthority: "Branch Supervisor"
  }),
  freezeEntry({
    id: "ROLE-REG-OPS",
    code: "ROLE_REGIONAL_OPS",
    title: "Regional Operations",
    accountableAuthority: "Regional Operations"
  }),
  freezeEntry({
    id: "ROLE-CIO",
    code: "ROLE_CIO",
    title: "Chief Information Officer",
    accountableAuthority: "CIO"
  })
]);

export const SERVICE_CATALOG = Object.freeze([
  freezeEntry({
    id: "SVC-001",
    code: "SVC_AUTH_ACCESS",
    name: "Authentication & Access",
    tier: "tier1_critical",
    lifecycle: "active",
    portfolio: "platform",
    description: "Login, session, MFA, device authorization for web/APK collectors",
    owningModule: 1,
    relatedModules: Object.freeze([1, 15, 22]),
    relatedPhases: Object.freeze([9, 13, 14]),
    readiness: "production_ready",
    accountableAuthority: "Service Owner",
    roleId: "ROLE-SVC-OWNER"
  }),
  freezeEntry({
    id: "SVC-002",
    code: "SVC_MEMBER_ONBOARDING",
    name: "Member Onboarding",
    tier: "tier2_core",
    lifecycle: "active",
    portfolio: "business",
    owningModule: 3,
    relatedModules: Object.freeze([3, 15]),
    relatedPhases: Object.freeze([1, 2]),
    readiness: "production_ready",
    accountableAuthority: "Service Owner",
    roleId: "ROLE-SVC-OWNER"
  }),
  freezeEntry({
    id: "SVC-003",
    code: "SVC_SAVINGS",
    name: "Savings Accounts",
    tier: "tier1_critical",
    lifecycle: "active",
    portfolio: "business",
    owningModule: 5,
    relatedModules: Object.freeze([5, 7, 27]),
    relatedPhases: Object.freeze([1, 2, 13]),
    readiness: "production_ready",
    moneyInvariants: "pesewas; cashier float 1000",
    accountableAuthority: "Service Owner",
    roleId: "ROLE-SVC-OWNER"
  }),
  freezeEntry({
    id: "SVC-004",
    code: "SVC_COLLECTIONS",
    name: "Field Collections",
    tier: "tier1_critical",
    lifecycle: "active",
    portfolio: "business",
    owningModule: 6,
    relatedModules: Object.freeze([6, 15, 17, 27]),
    relatedPhases: Object.freeze([1, 13, 17]),
    readiness: "production_ready",
    moneyInvariants: "pesewas; collection days 31; cashier 1000",
    accountableAuthority: "Service Owner",
    roleId: "ROLE-SVC-OWNER"
  }),
  freezeEntry({
    id: "SVC-005",
    code: "SVC_LOANS",
    name: "Loans & Disbursement",
    tier: "tier1_critical",
    lifecycle: "active",
    portfolio: "business",
    owningModule: 8,
    relatedModules: Object.freeze([8, 27]),
    relatedPhases: Object.freeze([1, 12, 16]),
    readiness: "production_ready",
    moneyInvariants: "pesewas; interest 15 via Module 27",
    accountableAuthority: "Service Owner",
    roleId: "ROLE-SVC-OWNER"
  }),
  freezeEntry({
    id: "SVC-006",
    code: "SVC_LEDGER",
    name: "General Ledger",
    tier: "tier1_critical",
    lifecycle: "active",
    portfolio: "finance",
    owningModule: 7,
    relatedModules: Object.freeze([7, 21]),
    relatedPhases: Object.freeze([3, 15]),
    readiness: "production_ready",
    accountableAuthority: "Service Owner",
    roleId: "ROLE-SVC-OWNER"
  }),
  freezeEntry({
    id: "SVC-007",
    code: "SVC_OFFLINE_SYNC",
    name: "Offline Synchronization",
    tier: "tier1_critical",
    lifecycle: "active",
    portfolio: "platform",
    description: "Collector APK offline queue, conflict resolution, reconciliation — Module 15 engine",
    owningModule: 15,
    relatedModules: Object.freeze([15, 6, 18, 19]),
    relatedPhases: Object.freeze([13, 17, 18]),
    readiness: "production_ready",
    engineRef: SYNC_ENGINE_REF,
    accountableAuthority: "Operations Lead",
    roleId: "ROLE-OPS-LEAD"
  }),
  freezeEntry({
    id: "SVC-008",
    code: "SVC_PAYMENTS_MOMO",
    name: "Mobile Money Payments",
    tier: "tier1_critical",
    lifecycle: "active",
    portfolio: "integration",
    owningModule: 16,
    relatedModules: Object.freeze([16, 20, 28]),
    relatedPhases: Object.freeze([13, 14]),
    readiness: "production_ready",
    accountableAuthority: "Service Owner",
    roleId: "ROLE-SVC-OWNER"
  }),
  freezeEntry({
    id: "SVC-009",
    code: "SVC_RECEIPTS",
    name: "Receipts & Statements",
    tier: "tier2_core",
    lifecycle: "active",
    portfolio: "business",
    owningModule: 17,
    relatedModules: Object.freeze([17, 26]),
    relatedPhases: Object.freeze([1, 2]),
    readiness: "production_ready",
    accountableAuthority: "Service Owner",
    roleId: "ROLE-SVC-OWNER"
  }),
  freezeEntry({
    id: "SVC-010",
    code: "SVC_JOBS_QUEUE",
    name: "Background Jobs & Queues",
    tier: "tier2_core",
    lifecycle: "active",
    portfolio: "platform",
    owningModule: 18,
    relatedModules: Object.freeze([18, 15]),
    relatedPhases: Object.freeze([14, 17]),
    readiness: "production_ready",
    accountableAuthority: "Operations Lead",
    roleId: "ROLE-OPS-LEAD"
  }),
  freezeEntry({
    id: "SVC-011",
    code: "SVC_MONITORING",
    name: "Monitoring & Observability",
    tier: "tier1_critical",
    lifecycle: "active",
    portfolio: "platform",
    owningModule: 19,
    relatedModules: Object.freeze([19]),
    relatedPhases: Object.freeze([13]),
    readiness: "production_ready",
    engineRef: MONITORING_ENGINE_REF,
    accountableAuthority: "Operations Lead",
    roleId: "ROLE-OPS-LEAD"
  }),
  freezeEntry({
    id: "SVC-012",
    code: "SVC_API_GATEWAY",
    name: "API Gateway Facades",
    tier: "tier2_core",
    lifecycle: "active",
    portfolio: "platform",
    owningModule: 20,
    relatedModules: Object.freeze([20, 28]),
    relatedPhases: Object.freeze([4, 14]),
    readiness: "production_ready",
    accountableAuthority: "Service Owner",
    roleId: "ROLE-SVC-OWNER"
  }),
  freezeEntry({
    id: "SVC-013",
    code: "SVC_BACKUP_DR",
    name: "Backup & DR",
    tier: "tier1_critical",
    lifecycle: "active",
    portfolio: "platform",
    owningModule: 21,
    relatedModules: Object.freeze([21, 30]),
    relatedPhases: Object.freeze([15]),
    readiness: "production_ready",
    accountableAuthority: "Operations Lead",
    roleId: "ROLE-OPS-LEAD"
  }),
  freezeEntry({
    id: "SVC-014",
    code: "SVC_SECURITY_OPS",
    name: "Security Operations",
    tier: "tier1_critical",
    lifecycle: "active",
    portfolio: "security",
    owningModule: 22,
    relatedModules: Object.freeze([22]),
    relatedPhases: Object.freeze([9, 13]),
    readiness: "production_ready",
    accountableAuthority: "Incident Manager",
    roleId: "ROLE-INC-MGR"
  }),
  freezeEntry({
    id: "SVC-015",
    code: "SVC_REPORTING_BI",
    name: "Reporting & BI",
    tier: "tier2_core",
    lifecycle: "active",
    portfolio: "analytics",
    owningModule: 11,
    relatedModules: Object.freeze([11, 27]),
    relatedPhases: Object.freeze([13, 17]),
    readiness: "production_ready",
    accountableAuthority: "Service Owner",
    roleId: "ROLE-SVC-OWNER"
  }),
  freezeEntry({
    id: "SVC-016",
    code: "SVC_AI_ADVISORY",
    name: "AI Advisory Intelligence",
    tier: "tier3_supporting",
    lifecycle: "active",
    portfolio: "intelligence",
    owningModule: 29,
    relatedModules: Object.freeze([29, 24]),
    relatedPhases: Object.freeze([12, 16, 17]),
    readiness: "production_ready",
    notes: "Advisory only; no auto loan approval; no money posts",
    accountableAuthority: "Service Owner",
    roleId: "ROLE-SVC-OWNER"
  }),
  freezeEntry({
    id: "SVC-017",
    code: "SVC_PLATFORM_GOV",
    name: "Platform Governance",
    tier: "tier2_core",
    lifecycle: "active",
    portfolio: "platform",
    owningModule: 30,
    relatedModules: Object.freeze([30, 14]),
    relatedPhases: Object.freeze([14, 15]),
    readiness: "production_ready",
    accountableAuthority: "Operations Lead",
    roleId: "ROLE-OPS-LEAD"
  }),
  freezeEntry({
    id: "SVC-018",
    code: "SVC_SERVICE_DESK",
    name: "Service Desk & Support",
    tier: "tier2_core",
    lifecycle: "active",
    portfolio: "support",
    owningModule: 23,
    relatedModules: Object.freeze([23, 19]),
    relatedPhases: Object.freeze([13, 18]),
    readiness: "production_ready",
    accountableAuthority: "Service Desk Manager",
    roleId: "ROLE-SD-MGR"
  })
]);

export const INCIDENT_SLAS = Object.freeze([
  freezeEntry({
    id: "SEV-001",
    code: "SEV_CRITICAL",
    severity: "critical",
    name: "Critical — nationwide / money path outage",
    responseMinutes: 15,
    resolveMinutes: 240,
    escalateMinutes: 30,
    majorIncidentEligible: true,
    examples: "Collections posting down; sync engine unable to flush nationwide; ledger unavailable",
    customerCommCadenceMinutes: 30,
    accountableAuthority: "Incident Manager",
    roleId: "ROLE-INC-MGR",
    relatedModules: Object.freeze([6, 7, 15, 19])
  }),
  freezeEntry({
    id: "SEV-002",
    code: "SEV_HIGH",
    severity: "high",
    name: "High — multi-branch degraded",
    responseMinutes: 30,
    resolveMinutes: 480,
    escalateMinutes: 60,
    majorIncidentEligible: true,
    examples: "Regional sync backlog; MoMo provider health failed; branch APK cannot sync >4h",
    customerCommCadenceMinutes: 60,
    accountableAuthority: "Incident Manager",
    roleId: "ROLE-INC-MGR",
    relatedModules: Object.freeze([15, 16, 19])
  }),
  freezeEntry({
    id: "SEV-003",
    code: "SEV_MEDIUM",
    severity: "medium",
    name: "Medium — single branch / feature impaired",
    responseMinutes: 120,
    resolveMinutes: 1440,
    escalateMinutes: 240,
    majorIncidentEligible: false,
    examples: "Single branch offline queue stuck; report generation slow; one device revoked incorrectly",
    customerCommCadenceMinutes: 240,
    accountableAuthority: "Service Desk Manager",
    roleId: "ROLE-SD-MGR",
    relatedModules: Object.freeze([11, 15])
  }),
  freezeEntry({
    id: "SEV-004",
    code: "SEV_LOW",
    severity: "low",
    name: "Low — cosmetic / low impact",
    responseMinutes: 480,
    resolveMinutes: 4320,
    escalateMinutes: 1440,
    majorIncidentEligible: false,
    examples: "UI label issue; non-blocking warning; training request misrouted as incident",
    customerCommCadenceMinutes: 1440,
    accountableAuthority: "Service Desk Manager",
    roleId: "ROLE-SD-MGR",
    relatedModules: Object.freeze([2, 23])
  })
]);

export const PROBLEM_CATALOG = Object.freeze([
  freezeEntry({
    id: "PRB-001",
    code: "PRB_RECURRING_INCIDENT",
    problemType: "recurring_incident",
    name: "Recurring incident pattern",
    rcaRequired: true,
    knownErrorAllowed: true,
    capaRequired: true,
    accountableAuthority: "Problem Manager",
    roleId: "ROLE-PRB-MGR"
  }),
  freezeEntry({
    id: "PRB-002",
    code: "PRB_KNOWN_ERROR",
    problemType: "known_error",
    name: "Known error with workaround",
    rcaRequired: true,
    knownErrorAllowed: true,
    capaRequired: false,
    accountableAuthority: "Problem Manager",
    roleId: "ROLE-PRB-MGR"
  }),
  freezeEntry({
    id: "PRB-003",
    code: "PRB_CAPACITY",
    problemType: "capacity",
    name: "Capacity / performance underlying cause",
    rcaRequired: true,
    knownErrorAllowed: true,
    capaRequired: true,
    relatedPhases: Object.freeze([17]),
    accountableAuthority: "Problem Manager",
    roleId: "ROLE-PRB-MGR"
  }),
  freezeEntry({
    id: "PRB-004",
    code: "PRB_SYNC_CONFLICT",
    problemType: "sync_conflict_pattern",
    name: "Offline sync conflict / queue pattern",
    rcaRequired: true,
    knownErrorAllowed: true,
    capaRequired: true,
    relatedModules: Object.freeze([15]),
    notes: "References Module 15; does not replace sync-ops conflict strategies",
    accountableAuthority: "Problem Manager",
    roleId: "ROLE-PRB-MGR"
  }),
  freezeEntry({
    id: "PRB-005",
    code: "PRB_SECURITY",
    problemType: "security",
    name: "Security underlying cause",
    rcaRequired: true,
    knownErrorAllowed: false,
    capaRequired: true,
    relatedModules: Object.freeze([22]),
    accountableAuthority: "Problem Manager",
    roleId: "ROLE-PRB-MGR"
  }),
  freezeEntry({
    id: "PRB-006",
    code: "PRB_DATA_INTEGRITY",
    problemType: "data_integrity",
    name: "Data / money integrity underlying cause",
    rcaRequired: true,
    knownErrorAllowed: false,
    capaRequired: true,
    moneyInvariants: "pesewas; interest 15; collection 31; cashier 1000 — never last-write-wins",
    accountableAuthority: "Problem Manager",
    roleId: "ROLE-PRB-MGR"
  }),
  freezeEntry({
    id: "PRB-007",
    code: "PRB_PERFORMANCE",
    problemType: "performance",
    name: "Latency / throughput underlying cause",
    rcaRequired: true,
    knownErrorAllowed: true,
    capaRequired: true,
    relatedPhases: Object.freeze([13, 17]),
    accountableAuthority: "Problem Manager",
    roleId: "ROLE-PRB-MGR"
  })
]);

export const SERVICE_REQUEST_TYPES = Object.freeze([
  freezeEntry({
    id: "SRT-001",
    code: "SRT_ACCOUNT_CREATE",
    category: "account",
    name: "Create staff / collector account",
    approvalRequired: true,
    fulfillmentTargetHours: 24,
    accountableAuthority: "Service Desk Manager",
    roleId: "ROLE-SD-MGR"
  }),
  freezeEntry({
    id: "SRT-002",
    code: "SRT_PASSWORD_RESET",
    category: "password_reset",
    name: "Password reset",
    approvalRequired: false,
    fulfillmentTargetHours: 2,
    accountableAuthority: "Service Desk Manager",
    roleId: "ROLE-SD-MGR"
  }),
  freezeEntry({
    id: "SRT-003",
    code: "SRT_PERMISSION_CHANGE",
    category: "permission",
    name: "Permission / role change",
    approvalRequired: true,
    fulfillmentTargetHours: 24,
    notes: "Does not rewrite RBAC matrices; fulfills existing Module 1/22 roles",
    accountableAuthority: "Service Desk Manager",
    roleId: "ROLE-SD-MGR"
  }),
  freezeEntry({
    id: "SRT-004",
    code: "SRT_BRANCH_CONFIG",
    category: "branch_config",
    name: "Branch configuration change",
    approvalRequired: true,
    fulfillmentTargetHours: 48,
    relatedModules: Object.freeze([14, 30]),
    accountableAuthority: "Operations Lead",
    roleId: "ROLE-OPS-LEAD"
  }),
  freezeEntry({
    id: "SRT-005",
    code: "SRT_REPORT_ACCESS",
    category: "report",
    name: "Report / BI access request",
    approvalRequired: true,
    fulfillmentTargetHours: 48,
    relatedModules: Object.freeze([11, 27]),
    accountableAuthority: "Service Desk Manager",
    roleId: "ROLE-SD-MGR"
  }),
  freezeEntry({
    id: "SRT-006",
    code: "SRT_INTEGRATION",
    category: "integration",
    name: "Integration / MoMo partner enablement",
    approvalRequired: true,
    fulfillmentTargetHours: 72,
    relatedModules: Object.freeze([16, 28]),
    accountableAuthority: "Operations Lead",
    roleId: "ROLE-OPS-LEAD"
  }),
  freezeEntry({
    id: "SRT-007",
    code: "SRT_TRAINING",
    category: "training",
    name: "Collector / cashier training request",
    approvalRequired: false,
    fulfillmentTargetHours: 120,
    accountableAuthority: "Knowledge Owner",
    roleId: "ROLE-KB-OWNER"
  }),
  freezeEntry({
    id: "SRT-008",
    code: "SRT_DEVICE_REPLACE",
    category: "device",
    name: "Collector device replacement / re-auth",
    approvalRequired: true,
    fulfillmentTargetHours: 8,
    relatedModules: Object.freeze([15]),
    accountableAuthority: "Branch Supervisor",
    roleId: "ROLE-BRANCH-SUP"
  })
]);

export const KNOWLEDGE_ARTICLES = Object.freeze([
  freezeEntry({
    id: "KB-001",
    code: "KB_COLLECTOR_OFFLINE",
    title: "Collector offline collection procedure",
    state: "published",
    relatedRunbookIds: Object.freeze(["RB-010", "RB-011"]),
    accountableAuthority: "Knowledge Owner",
    roleId: "ROLE-KB-OWNER"
  }),
  freezeEntry({
    id: "KB-002",
    code: "KB_SYNC_RETRY",
    title: "How to retry failed sync items",
    state: "published",
    relatedRunbookIds: Object.freeze(["RB-010"]),
    accountableAuthority: "Knowledge Owner",
    roleId: "ROLE-KB-OWNER"
  }),
  freezeEntry({
    id: "KB-003",
    code: "KB_PASSWORD_RESET",
    title: "Staff password reset",
    state: "published",
    relatedRunbookIds: Object.freeze([]),
    accountableAuthority: "Knowledge Owner",
    roleId: "ROLE-KB-OWNER"
  }),
  freezeEntry({
    id: "KB-004",
    code: "KB_MAJOR_INCIDENT",
    title: "Major incident communications template",
    state: "published",
    relatedRunbookIds: Object.freeze(["RB-008"]),
    accountableAuthority: "Knowledge Owner",
    roleId: "ROLE-KB-OWNER"
  }),
  freezeEntry({
    id: "KB-005",
    code: "KB_EOD_REMINDER",
    title: "End-of-day sync reminder for collectors",
    state: "published",
    relatedRunbookIds: Object.freeze(["RB-012"]),
    accountableAuthority: "Knowledge Owner",
    roleId: "ROLE-KB-OWNER"
  }),
  freezeEntry({
    id: "KB-006",
    code: "KB_CONFLICT_RESOLVE",
    title: "Financial sync conflict — no LWW",
    state: "published",
    relatedRunbookIds: Object.freeze(["RB-011"]),
    accountableAuthority: "Knowledge Owner",
    roleId: "ROLE-KB-OWNER"
  })
]);

export const RUNBOOKS = Object.freeze([
  freezeEntry({
    id: "RB-001",
    code: "RB_APP_RESTART",
    name: "Application restart",
    category: "availability",
    preconditions: Object.freeze(["Confirm incident severity", "Notify on-call", "Check Module 19 health"]),
    steps: Object.freeze([
      "Drain interactive sessions where safe",
      "Restart app tier (web/Electron) per Phase 14 env",
      "Validate health checks via Module 19",
      "Confirm collections/ledger reachable"
    ]),
    validation: Object.freeze(["Health green", "Smoke login", "Sample collection read-only check"]),
    rollback: Object.freeze(["Revert to previous process instance", "Page on-call if restart loop"]),
    successCriteria: Object.freeze(["SLO-001 path observing healthy", "No new SEV-001 tickets"]),
    relatedModules: Object.freeze([19, 30]),
    relatedPhases: Object.freeze([13, 14]),
    offlineScenario: false,
    accountableAuthority: "On-Call Engineer",
    roleId: "ROLE-ONCALL"
  }),
  freezeEntry({
    id: "RB-002",
    code: "RB_DB_RECOVERY",
    name: "Database recovery",
    category: "data",
    preconditions: Object.freeze(["Phase 15 RPO/RTO known", "Module 21 backup verified", "Change ticket open"]),
    steps: Object.freeze([
      "Declare severity SEV-001 if money path blocked",
      "Restore per Module 21 — do not redefine RPO/RTO",
      "Validate ledger integrity and pesewa amounts",
      "Resume sync only after DB consistent"
    ]),
    validation: Object.freeze(["Backup verify pass", "Sample balance reconcile", "No duplicate journals"]),
    rollback: Object.freeze(["Fail back to last known good replica per Phase 15"]),
    successCriteria: Object.freeze(["Within Phase 15 RTO", "Money invariants intact"]),
    relatedModules: Object.freeze([7, 21]),
    relatedPhases: Object.freeze([15]),
    offlineScenario: false,
    accountableAuthority: "Operations Lead",
    roleId: "ROLE-OPS-LEAD"
  }),
  freezeEntry({
    id: "RB-003",
    code: "RB_BACKUP_VERIFY",
    name: "Backup verification",
    category: "continuity",
    preconditions: Object.freeze(["Module 21 engine available", "Maintenance window if restore-test"]),
    steps: Object.freeze([
      "Trigger verify via Module 21",
      "Record evidence for Phase 15 continuity catalog",
      "Escalate if verify fails"
    ]),
    validation: Object.freeze(["Verify job success", "Checksum match"]),
    rollback: Object.freeze(["N/A — verify is non-destructive"]),
    successCriteria: Object.freeze(["Verify pass within schedule"]),
    relatedModules: Object.freeze([21]),
    relatedPhases: Object.freeze([15]),
    offlineScenario: false,
    accountableAuthority: "Operations Lead",
    roleId: "ROLE-OPS-LEAD"
  }),
  freezeEntry({
    id: "RB-004",
    code: "RB_FAILOVER",
    name: "Failover / failback",
    category: "availability",
    preconditions: Object.freeze(["Phase 15 DR playbook", "CIO or Ops Lead approval for PRODUCTION"]),
    steps: Object.freeze([
      "Declare major incident if customer-facing",
      "Execute failover per Phase 15 / Module 21+30",
      "Validate auth, collections, sync",
      "Plan failback window"
    ]),
    validation: Object.freeze(["Primary unhealthy confirmed", "Secondary healthy", "Sync mode Online or Recovery"]),
    rollback: Object.freeze(["Failback when primary restored and reconciled"]),
    successCriteria: Object.freeze(["Service within Phase 15 RTO"]),
    relatedModules: Object.freeze([21, 30, 15]),
    relatedPhases: Object.freeze([15, 14]),
    offlineScenario: false,
    accountableAuthority: "Operations Lead",
    roleId: "ROLE-OPS-LEAD"
  }),
  freezeEntry({
    id: "RB-005",
    code: "RB_QUEUE_RECOVERY",
    name: "Queue recovery (jobs / sync)",
    category: "integration",
    preconditions: Object.freeze(["Identify Module 18 vs Module 15 queue", "Snapshot depths"]),
    steps: Object.freeze([
      "Pause consumers if poison messages",
      "Retry failed jobs via Module 18 / sync retry via Module 15",
      "Clear backlog under ESC thresholds",
      "Resume and watch Phase 13 sync panel (60s refresh)"
    ]),
    validation: Object.freeze(["Queue depth declining", "Success rate ≥99%"]),
    rollback: Object.freeze(["Re-pause consumers", "Escalate SEV-002"]),
    successCriteria: Object.freeze(["Depth below warning", "No financial LWW applied"]),
    relatedModules: Object.freeze([15, 18]),
    relatedPhases: Object.freeze([13, 17]),
    offlineScenario: true,
    accountableAuthority: "On-Call Engineer",
    roleId: "ROLE-ONCALL"
  }),
  freezeEntry({
    id: "RB-006",
    code: "RB_CERT_RENEWAL",
    name: "Certificate renewal",
    category: "security",
    preconditions: Object.freeze(["Cert inventory", "Phase 14 deploy window"]),
    steps: Object.freeze([
      "Issue/renew cert",
      "Deploy via Phase 14 pipeline",
      "Validate TLS endpoints"
    ]),
    validation: Object.freeze(["No cert expiry warnings", "Health checks pass"]),
    rollback: Object.freeze(["Revert prior cert artifact"]),
    successCriteria: Object.freeze(["Valid cert ≥30 days remaining"]),
    relatedModules: Object.freeze([20, 22]),
    relatedPhases: Object.freeze([14, 9]),
    offlineScenario: false,
    accountableAuthority: "On-Call Engineer",
    roleId: "ROLE-ONCALL"
  }),
  freezeEntry({
    id: "RB-007",
    code: "RB_SECURITY_IR",
    name: "Security incident response",
    category: "security",
    preconditions: Object.freeze(["Module 22 alert or report", "Preserve evidence"]),
    steps: Object.freeze([
      "Classify severity",
      "Contain (revoke device, disable user)",
      "Eradicate / remediate",
      "Recover services",
      "PIR within 5 business days"
    ]),
    validation: Object.freeze(["Threat contained", "Audit trail intact"]),
    rollback: Object.freeze(["N/A — containment first"]),
    successCriteria: Object.freeze(["No ongoing unauthorized access"]),
    relatedModules: Object.freeze([22, 15]),
    relatedPhases: Object.freeze([9, 13]),
    offlineScenario: false,
    accountableAuthority: "Incident Manager",
    roleId: "ROLE-INC-MGR"
  }),
  freezeEntry({
    id: "RB-008",
    code: "RB_PERF_DEGRADATION",
    name: "Performance degradation response",
    category: "performance",
    preconditions: Object.freeze(["Phase 13 SLO burn or Phase 17 RTHR warning", "Module 19 evidence"]),
    steps: Object.freeze([
      "Confirm latency vs Phase 13 SLO-006 / Phase 16 ceilings (consume only)",
      "Check queues, DB, sync backlog",
      "Scale per Phase 17 CAP strategies if triggered",
      "Communicate if SEV-002+"
    ]),
    validation: Object.freeze(["p95 recovering", "RTHR band returning to ok"]),
    rollback: Object.freeze(["Revert emergency scale if unstable"]),
    successCriteria: Object.freeze(["SLO burn rate declining"]),
    relatedModules: Object.freeze([19, 18]),
    relatedPhases: Object.freeze([13, 17]),
    offlineScenario: false,
    accountableAuthority: "On-Call Engineer",
    roleId: "ROLE-ONCALL"
  }),
  freezeEntry({
    id: "RB-009",
    code: "RB_SCHEDULED_MAINT",
    name: "Scheduled maintenance",
    category: "change",
    preconditions: Object.freeze(["Change approved", "Customer notice", "Rollback plan"]),
    steps: Object.freeze([
      "Enter maintenance window",
      "Execute change per Phase 14",
      "Smoke test money-critical paths",
      "Exit maintenance / announce"
    ]),
    validation: Object.freeze(["Smoke pass", "Monitoring green"]),
    rollback: Object.freeze(["Execute documented rollback before window end"]),
    successCriteria: Object.freeze(["Services restored on schedule"]),
    relatedModules: Object.freeze([30, 19]),
    relatedPhases: Object.freeze([14]),
    offlineScenario: false,
    accountableAuthority: "Operations Lead",
    roleId: "ROLE-OPS-LEAD"
  }),
  freezeEntry({
    id: "RB-010",
    code: "RB_OFFLINE_SYNC_RECOVERY",
    name: "Offline sync recovery",
    category: "sync",
    preconditions: Object.freeze([
      "Module 15 sync-ops available",
      "Device not revoked",
      "Do not use LWW for financial kinds"
    ]),
    steps: Object.freeze([
      "Confirm mode Offline/Synchronizing/Recovery",
      "Snapshot queueSize and failed counts",
      "Run Sync now / processSyncQueue (engine)",
      "Apply RETRY policy for transient failures",
      "Escalate per ESC if 4h / 24h / queue>1000 / success<99%"
    ]),
    validation: Object.freeze(["Queue draining", "Reconcile totals match", "Receipt mapping intact"]),
    rollback: Object.freeze(["Stop sync pass", "Hold financial conflicts for Sync.Resolve"]),
    successCriteria: Object.freeze(["Mode Online", "Daily reconcile complete"]),
    relatedModules: Object.freeze([15, 6, 19]),
    relatedPhases: Object.freeze([13, 18]),
    offlineScenario: true,
    accountableAuthority: "Operations Lead",
    roleId: "ROLE-OPS-LEAD"
  }),
  freezeEntry({
    id: "RB-011",
    code: "RB_SYNC_CONFLICT",
    name: "Sync conflict resolution support",
    category: "sync",
    preconditions: Object.freeze([
      "conflict_detected items present",
      "Sync.Resolve permission",
      "Financial → business_rule"
    ]),
    steps: Object.freeze([
      "Classify financial vs non-financial",
      "Never apply client_wins / LWW to financial kinds",
      "Resolve via Module 15 strategies",
      "Retry remaining queue",
      "Document known error if recurrent (PRB-004)"
    ]),
    validation: Object.freeze(["No open conflicts", "Balances in pesewas consistent"]),
    rollback: Object.freeze(["Leave in conflict_detected", "Escalate Problem"]),
    successCriteria: Object.freeze(["Conflicts cleared", "Audit recorded"]),
    relatedModules: Object.freeze([15]),
    relatedPhases: Object.freeze([18]),
    offlineScenario: true,
    accountableAuthority: "Branch Supervisor",
    roleId: "ROLE-BRANCH-SUP"
  }),
  freezeEntry({
    id: "RB-012",
    code: "RB_EOD_SYNC",
    name: "End-of-day collector sync",
    category: "sync",
    preconditions: Object.freeze(["Collector still has device", "Connectivity available or planned"]),
    steps: Object.freeze([
      "Remind collector via CSM-EOD guidance",
      "Complete pending collections (pesewas)",
      "Sync until Online or escalate if Offline >4h",
      "Confirm daily reconciliation for branch"
    ]),
    validation: Object.freeze(["Pending queue 0 or waived", "Branch reconcile signed"]),
    rollback: Object.freeze(["Secure device offline", "Escalate branch supervisor"]),
    successCriteria: Object.freeze(["EOD sync complete or incident opened"]),
    relatedModules: Object.freeze([15, 6]),
    relatedPhases: Object.freeze([18]),
    offlineScenario: true,
    accountableAuthority: "Branch Supervisor",
    roleId: "ROLE-BRANCH-SUP"
  })
]);

export const OPS_KPIS = Object.freeze([
  freezeEntry({
    id: "OKPI-001",
    code: "OKPI_MTTA",
    name: "Mean Time To Acknowledge",
    formula: "avg(acknowledgedAt - createdAt) for incidents in window",
    unit: "minutes",
    thresholdWarning: 20,
    thresholdCritical: 45,
    frequency: "daily",
    direction: "lower_better",
    accountableAuthority: "Service Desk Manager",
    roleId: "ROLE-SD-MGR"
  }),
  freezeEntry({
    id: "OKPI-002",
    code: "OKPI_MTTRSP",
    name: "Mean Time To Respond",
    formula: "avg(firstResponseAt - createdAt)",
    unit: "minutes",
    thresholdWarning: 30,
    thresholdCritical: 60,
    frequency: "daily",
    direction: "lower_better",
    accountableAuthority: "Incident Manager",
    roleId: "ROLE-INC-MGR"
  }),
  freezeEntry({
    id: "OKPI-003",
    code: "OKPI_MTTR",
    name: "Mean Time To Resolve",
    formula: "avg(resolvedAt - createdAt)",
    unit: "minutes",
    thresholdWarning: 480,
    thresholdCritical: 1440,
    frequency: "weekly",
    direction: "lower_better",
    accountableAuthority: "Incident Manager",
    roleId: "ROLE-INC-MGR"
  }),
  freezeEntry({
    id: "OKPI-004",
    code: "OKPI_FCR",
    name: "First Contact Resolution rate",
    formula: "resolved_on_first_contact / total_closed * 100",
    unit: "percent",
    thresholdWarning: 70,
    thresholdCritical: 55,
    frequency: "weekly",
    direction: "higher_better",
    accountableAuthority: "Service Desk Manager",
    roleId: "ROLE-SD-MGR"
  }),
  freezeEntry({
    id: "OKPI-005",
    code: "OKPI_REOPEN",
    name: "Reopen rate",
    formula: "reopened / closed * 100",
    unit: "percent",
    thresholdWarning: 8,
    thresholdCritical: 15,
    frequency: "weekly",
    direction: "lower_better",
    accountableAuthority: "Service Desk Manager",
    roleId: "ROLE-SD-MGR"
  }),
  freezeEntry({
    id: "OKPI-006",
    code: "OKPI_PROBLEM_RECURRENCE",
    name: "Problem recurrence rate",
    formula: "problems_with_repeat_incidents / open_problems * 100",
    unit: "percent",
    thresholdWarning: 20,
    thresholdCritical: 35,
    frequency: "monthly",
    direction: "lower_better",
    accountableAuthority: "Problem Manager",
    roleId: "ROLE-PRB-MGR"
  }),
  freezeEntry({
    id: "OKPI-007",
    code: "OKPI_SLA_COMPLIANCE",
    name: "Incident SLA compliance",
    formula: "incidents_meeting_response_and_resolve / total * 100",
    unit: "percent",
    thresholdWarning: 95,
    thresholdCritical: 90,
    frequency: "weekly",
    direction: "higher_better",
    accountableAuthority: "Incident Manager",
    roleId: "ROLE-INC-MGR"
  }),
  freezeEntry({
    id: "OKPI-008",
    code: "OKPI_AVAILABILITY",
    name: "Service availability (ops view)",
    formula: "uptime / window * 100 — consumes Phase 13 SLO-001 observation",
    unit: "percent",
    thresholdWarning: 99.5,
    thresholdCritical: 99.0,
    frequency: "daily",
    direction: "higher_better",
    relatedPhases: Object.freeze([13]),
    accountableAuthority: "Operations Lead",
    roleId: "ROLE-OPS-LEAD"
  }),
  freezeEntry({
    id: "OKPI-009",
    code: "OKPI_BACKLOG",
    name: "Ticket backlog age",
    formula: "count(open tickets older than 7d)",
    unit: "count",
    thresholdWarning: 25,
    thresholdCritical: 50,
    frequency: "daily",
    direction: "lower_better",
    accountableAuthority: "Service Desk Manager",
    roleId: "ROLE-SD-MGR"
  }),
  freezeEntry({
    id: "OKPI-010",
    code: "OKPI_CSAT",
    name: "Customer satisfaction",
    formula: "avg(survey_score) on 1–5 scale",
    unit: "score",
    thresholdWarning: 4.0,
    thresholdCritical: 3.5,
    frequency: "monthly",
    direction: "higher_better",
    accountableAuthority: "Service Desk Manager",
    roleId: "ROLE-SD-MGR"
  })
]);

export const OPERATIONS_GOVERNANCE = Object.freeze([
  freezeEntry({
    id: "OGOV-001",
    code: "OGOV_OWNERSHIP",
    name: "Single owner per process",
    topic: "ownership",
    rule: "Exactly one accountableAuthority per SVC/SEV/PRB/SRT/KB/RB/OKPI/OM/RETRY/ESC/CSM/DF entry",
    accountableAuthority: "Service Owner",
    roleId: "ROLE-SVC-OWNER"
  }),
  freezeEntry({
    id: "OGOV-002",
    code: "OGOV_MAJOR_INCIDENT",
    name: "Major incident declaration",
    topic: "approval",
    rule: "SEV-001 or multi-branch SEV-002 may declare major incident; Incident Manager commands; PIR required",
    accountableAuthority: "Incident Manager",
    roleId: "ROLE-INC-MGR"
  }),
  freezeEntry({
    id: "OGOV-003",
    code: "OGOV_NO_REDEFINE",
    name: "Do not redefine prior phases",
    topic: "exceptions",
    rule: "EOSSMS must not redefine Phases 13–17 standards or replace Modules 15/19/21/30 engines",
    accountableAuthority: "CIO",
    roleId: "ROLE-CIO"
  }),
  freezeEntry({
    id: "OGOV-004",
    code: "OGOV_SYNC_ESCALATION",
    name: "Offline sync escalation authority",
    topic: "escalation",
    rule: "4h→Branch Supervisor; 24h→Regional Ops; queue>1000 or success<99%→Ops Lead + incident",
    accountableAuthority: "Operations Lead",
    roleId: "ROLE-OPS-LEAD"
  }),
  freezeEntry({
    id: "OGOV-005",
    code: "OGOV_MONEY_INVARIANTS",
    name: "Money invariant protection in ops",
    topic: "ownership",
    rule: "Ops runbooks must preserve pesewas, interest 15, collection days 31, cashier 1000; no financial LWW",
    accountableAuthority: "Operations Lead",
    roleId: "ROLE-OPS-LEAD"
  }),
  freezeEntry({
    id: "OGOV-006",
    code: "OGOV_ONCALL",
    name: "On-call rotations",
    topic: "ownership",
    rule: "Primary + secondary on-call; handoff checklist; major incident bridge when declared",
    accountableAuthority: "Operations Lead",
    roleId: "ROLE-OPS-LEAD"
  })
]);

export const OFFLINE_MODE_CATALOG = Object.freeze([
  freezeEntry({
    id: "OM-001",
    code: "OM_ONLINE",
    mode: "Online",
    collectorStatus: "Online",
    description: "Connected; sync idle or complete; normal posting",
    allowsOfflineEnqueue: false,
    allowsSync: true,
    allowsHighRisk: true,
    accountableAuthority: "Operations Lead",
    roleId: "ROLE-OPS-LEAD"
  }),
  freezeEntry({
    id: "OM-002",
    code: "OM_OFFLINE",
    mode: "Offline",
    collectorStatus: "Offline",
    description: "No connectivity; local queue collections allowed per Module 15 rules",
    allowsOfflineEnqueue: true,
    allowsSync: false,
    allowsHighRisk: false,
    accountableAuthority: "Operations Lead",
    roleId: "ROLE-OPS-LEAD"
  }),
  freezeEntry({
    id: "OM-003",
    code: "OM_SYNCHRONIZING",
    mode: "Synchronizing",
    collectorStatus: "Synchronizing",
    description: "Ordered sync pass in progress (13-stage workflow)",
    allowsOfflineEnqueue: true,
    allowsSync: true,
    allowsHighRisk: false,
    accountableAuthority: "Operations Lead",
    roleId: "ROLE-OPS-LEAD"
  }),
  freezeEntry({
    id: "OM-004",
    code: "OM_RECOVERY",
    mode: "Recovery",
    collectorStatus: "SyncFailed",
    description: "Sync failure / recovery; retry policies apply; escalate per ESC",
    allowsOfflineEnqueue: true,
    allowsSync: true,
    allowsHighRisk: false,
    accountableAuthority: "Operations Lead",
    roleId: "ROLE-OPS-LEAD"
  }),
  freezeEntry({
    id: "OM-005",
    code: "OM_READONLY",
    mode: "ReadOnly",
    collectorStatus: "ReadOnly",
    description: "Read-only / auditor / revoked device path — no new financial enqueue",
    allowsOfflineEnqueue: false,
    allowsSync: false,
    allowsHighRisk: false,
    accountableAuthority: "Operations Lead",
    roleId: "ROLE-OPS-LEAD"
  })
]);

export const SYNC_RETRY_POLICIES = Object.freeze([
  freezeEntry({
    id: "RETRY-001",
    code: "RETRY_TRANSIENT_NETWORK",
    name: "Transient network failure",
    maxAttempts: 5,
    backoffSeconds: Object.freeze([30, 60, 120, 300, 600]),
    jitterPct: 20,
    appliesToStatuses: Object.freeze(["failed", "retrying"]),
    escalateAfterHours: 4,
    accountableAuthority: "Operations Lead",
    roleId: "ROLE-OPS-LEAD"
  }),
  freezeEntry({
    id: "RETRY-002",
    code: "RETRY_SERVER_BUSY",
    name: "Server busy / back-pressure",
    maxAttempts: 8,
    backoffSeconds: Object.freeze([60, 120, 240, 480, 900, 1200, 1800, 3600]),
    jitterPct: 15,
    appliesToStatuses: Object.freeze(["failed", "retrying"]),
    escalateAfterHours: 4,
    accountableAuthority: "Operations Lead",
    roleId: "ROLE-OPS-LEAD"
  }),
  freezeEntry({
    id: "RETRY-003",
    code: "RETRY_VALIDATION",
    name: "Validation failure (non-financial fixable)",
    maxAttempts: 3,
    backoffSeconds: Object.freeze([0, 300, 900]),
    jitterPct: 0,
    appliesToStatuses: Object.freeze(["failed"]),
    escalateAfterHours: 4,
    notes: "Financial validation failures go to conflict / manual — not blind retry",
    accountableAuthority: "Operations Lead",
    roleId: "ROLE-OPS-LEAD"
  }),
  freezeEntry({
    id: "RETRY-004",
    code: "RETRY_CONFLICT_HOLD",
    name: "Conflict detected — hold (no auto retry)",
    maxAttempts: 0,
    backoffSeconds: Object.freeze([]),
    jitterPct: 0,
    appliesToStatuses: Object.freeze(["conflict_detected"]),
    escalateAfterHours: 4,
    notes: "Requires Sync.Resolve; financial never LWW",
    accountableAuthority: "Branch Supervisor",
    roleId: "ROLE-BRANCH-SUP"
  }),
  freezeEntry({
    id: "RETRY-005",
    code: "RETRY_DEVICE_REVOKED",
    name: "Device revoked — no retry",
    maxAttempts: 0,
    backoffSeconds: Object.freeze([]),
    jitterPct: 0,
    appliesToStatuses: Object.freeze(["cancelled", "failed"]),
    escalateAfterHours: 0,
    notes: "Re-auth via SRT-008",
    accountableAuthority: "Operations Lead",
    roleId: "ROLE-OPS-LEAD"
  })
]);

export const ESCALATION_THRESHOLDS = Object.freeze([
  freezeEntry({
    id: "ESC-001",
    code: "ESC_OFFLINE_4H_BRANCH",
    name: "Offline / unsynced ≥ 4 hours → branch",
    metric: "offline_duration_hours",
    operator: "gte",
    thresholdValue: 4,
    escalateTo: "Branch Supervisor",
    severityHint: "high",
    accountableAuthority: "Branch Supervisor",
    roleId: "ROLE-BRANCH-SUP"
  }),
  freezeEntry({
    id: "ESC-002",
    code: "ESC_OFFLINE_24H_REGIONAL",
    name: "Offline / unsynced ≥ 24 hours → regional",
    metric: "offline_duration_hours",
    operator: "gte",
    thresholdValue: 24,
    escalateTo: "Regional Operations",
    severityHint: "critical",
    accountableAuthority: "Regional Operations",
    roleId: "ROLE-REG-OPS"
  }),
  freezeEntry({
    id: "ESC-003",
    code: "ESC_QUEUE_GT_1000",
    name: "Sync queue depth > 1000",
    metric: "queue_size",
    operator: "gt",
    thresholdValue: 1000,
    escalateTo: "Operations Lead",
    severityHint: "high",
    accountableAuthority: "Operations Lead",
    roleId: "ROLE-OPS-LEAD"
  }),
  freezeEntry({
    id: "ESC-004",
    code: "ESC_SUCCESS_LT_99",
    name: "Sync success rate < 99%",
    metric: "sync_success_pct",
    operator: "lt",
    thresholdValue: 99,
    escalateTo: "Operations Lead",
    severityHint: "high",
    accountableAuthority: "Operations Lead",
    roleId: "ROLE-OPS-LEAD"
  }),
  freezeEntry({
    id: "ESC-005",
    code: "ESC_CONFLICT_BURST",
    name: "Conflict burst ≥ 25 open",
    metric: "open_conflicts",
    operator: "gte",
    thresholdValue: 25,
    escalateTo: "Problem Manager",
    severityHint: "medium",
    accountableAuthority: "Problem Manager",
    roleId: "ROLE-PRB-MGR"
  })
]);

export const COLLECTOR_STATUS_MESSAGES = Object.freeze([
  freezeEntry({
    id: "CSM-001",
    code: "CSM_ONLINE",
    status: "Online",
    shortLabel: "Online",
    message: "You are online. Collections sync automatically when queued items remain.",
    colorHint: "success",
    accessibilityLabel: "Connection status: online",
    infoPanelFields: Object.freeze(["lastSyncAt", "pendingCount", "branchName"]),
    accountableAuthority: "Knowledge Owner",
    roleId: "ROLE-KB-OWNER"
  }),
  freezeEntry({
    id: "CSM-002",
    code: "CSM_OFFLINE",
    status: "Offline",
    shortLabel: "Offline",
    message:
      "You are offline. You may still collect (amounts in pesewas). Sync when network returns. Do not turn off the device until End of Day sync.",
    colorHint: "warning",
    accessibilityLabel: "Connection status: offline",
    infoPanelFields: Object.freeze([
      "offlineSince",
      "pendingCount",
      "queueSize",
      "lastSuccessfulSyncAt",
      "cashierFloatRemaining"
    ]),
    warningThresholdsHours: Object.freeze([1, 4, 24]),
    accountableAuthority: "Knowledge Owner",
    roleId: "ROLE-KB-OWNER"
  }),
  freezeEntry({
    id: "CSM-003",
    code: "CSM_SYNCHRONIZING",
    status: "Synchronizing",
    shortLabel: "Syncing",
    message: "Synchronizing… Please keep the app open. Progress updates as batches upload and apply.",
    colorHint: "info",
    accessibilityLabel: "Connection status: synchronizing",
    infoPanelFields: Object.freeze([
      "syncProgressPct",
      "uploadedCount",
      "appliedCount",
      "failedCount",
      "currentStage"
    ]),
    accountableAuthority: "Knowledge Owner",
    roleId: "ROLE-KB-OWNER"
  }),
  freezeEntry({
    id: "CSM-004",
    code: "CSM_SYNC_FAILED",
    status: "SyncFailed",
    shortLabel: "Sync failed",
    message:
      "Sync failed. Tap Retry. If it keeps failing, contact your Branch Supervisor. Do not delete the app or clear data.",
    colorHint: "danger",
    accessibilityLabel: "Connection status: synchronization failed",
    infoPanelFields: Object.freeze([
      "lastErrorCode",
      "retryCount",
      "failedCount",
      "queueSize",
      "correlationId"
    ]),
    failureGuidance: Object.freeze([
      "Confirm mobile data / Wi-Fi",
      "Tap Sync now / Retry",
      "If device revoked, request replacement (SRT-008)",
      "Escalate if offline ≥4 hours"
    ]),
    accountableAuthority: "Knowledge Owner",
    roleId: "ROLE-KB-OWNER"
  }),
  freezeEntry({
    id: "CSM-005",
    code: "CSM_READONLY",
    status: "ReadOnly",
    shortLabel: "Read only",
    message: "This device is read-only. You cannot post new collections. Contact Branch Supervisor.",
    colorHint: "neutral",
    accessibilityLabel: "Connection status: read only",
    infoPanelFields: Object.freeze(["reason", "deviceId", "supportContact"]),
    accountableAuthority: "Knowledge Owner",
    roleId: "ROLE-KB-OWNER"
  }),
  freezeEntry({
    id: "CSM-006",
    code: "CSM_POOR_NETWORK",
    status: "PoorNetwork",
    shortLabel: "Poor network",
    message:
      "Network is poor. Prefer completing collections offline, then sync when signal improves. Avoid starting large sync on very weak signal.",
    colorHint: "warning",
    accessibilityLabel: "Connection status: poor network",
    infoPanelFields: Object.freeze(["effectiveType", "pendingCount", "recommendedAction"]),
    accountableAuthority: "Knowledge Owner",
    roleId: "ROLE-KB-OWNER"
  })
]);

export const DECISION_FLOW_NODES = Object.freeze([
  freezeEntry({
    id: "DF-001",
    code: "DF_START_OF_DAY",
    flow: "start_of_day",
    name: "Start of day",
    outcomes: Object.freeze(["go_online", "work_offline", "device_blocked", "escalate"]),
    accountableAuthority: "Branch Supervisor",
    roleId: "ROLE-BRANCH-SUP"
  }),
  freezeEntry({
    id: "DF-002",
    code: "DF_TRANSACTION",
    flow: "transaction",
    name: "Collection transaction",
    outcomes: Object.freeze(["post_online", "enqueue_offline", "block_high_risk", "read_only_block"]),
    moneyInvariants: "pesewas; cashier 1000",
    accountableAuthority: "Branch Supervisor",
    roleId: "ROLE-BRANCH-SUP"
  }),
  freezeEntry({
    id: "DF-003",
    code: "DF_SYNC",
    flow: "sync",
    name: "Sync decision",
    outcomes: Object.freeze(["start_sync", "defer_poor_network", "retry", "escalate"]),
    accountableAuthority: "Operations Lead",
    roleId: "ROLE-OPS-LEAD"
  }),
  freezeEntry({
    id: "DF-004",
    code: "DF_CONFLICT",
    flow: "conflict",
    name: "Conflict handling",
    outcomes: Object.freeze(["auto_business_rule", "manual_resolve", "hold", "open_problem"]),
    accountableAuthority: "Branch Supervisor",
    roleId: "ROLE-BRANCH-SUP"
  }),
  freezeEntry({
    id: "DF-005",
    code: "DF_EOD",
    flow: "eod",
    name: "End of day",
    outcomes: Object.freeze(["sync_complete", "partial_waive", "open_incident", "secure_offline"]),
    accountableAuthority: "Branch Supervisor",
    roleId: "ROLE-BRANCH-SUP"
  }),
  freezeEntry({
    id: "DF-006",
    code: "DF_DEVICE_REPLACE",
    flow: "device_replacement",
    name: "Device replacement",
    outcomes: Object.freeze(["revoke_old", "authorize_new", "transfer_queue", "escalate_loss"]),
    accountableAuthority: "Operations Lead",
    roleId: "ROLE-OPS-LEAD"
  }),
  freezeEntry({
    id: "DF-007",
    code: "DF_ESCALATION",
    flow: "escalation",
    name: "Escalation path",
    outcomes: Object.freeze(["branch", "regional", "ops_lead", "major_incident"]),
    accountableAuthority: "Incident Manager",
    roleId: "ROLE-INC-MGR"
  })
]);

function findByIdOrCode(list, idOrCode) {
  if (!idOrCode) return null;
  const key = String(idOrCode);
  return list.find((e) => e.id === key || e.code === key) || null;
}

export function listServices() {
  return SERVICE_CATALOG;
}
export function listIncidentSlas() {
  return INCIDENT_SLAS;
}
export function listProblems() {
  return PROBLEM_CATALOG;
}
export function listServiceRequestTypes() {
  return SERVICE_REQUEST_TYPES;
}
export function listKnowledgeArticles() {
  return KNOWLEDGE_ARTICLES;
}
export function listRunbooks() {
  return RUNBOOKS;
}
export function listOpsKpis() {
  return OPS_KPIS;
}
export function listOperationsGovernance() {
  return OPERATIONS_GOVERNANCE;
}
export function listOfflineModes() {
  return OFFLINE_MODE_CATALOG;
}
export function listSyncRetryPolicies() {
  return SYNC_RETRY_POLICIES;
}
export function listEscalationThresholds() {
  return ESCALATION_THRESHOLDS;
}
export function listCollectorStatusMessages() {
  return COLLECTOR_STATUS_MESSAGES;
}
export function listDecisionFlowNodes() {
  return DECISION_FLOW_NODES;
}
export function listOperationsRoles() {
  return OPERATIONS_ROLES;
}

export function getService(idOrCode) {
  return findByIdOrCode(SERVICE_CATALOG, idOrCode);
}
export function getIncidentSla(idOrCode) {
  return findByIdOrCode(INCIDENT_SLAS, idOrCode);
}
export function getProblem(idOrCode) {
  return findByIdOrCode(PROBLEM_CATALOG, idOrCode);
}
export function getServiceRequestType(idOrCode) {
  return findByIdOrCode(SERVICE_REQUEST_TYPES, idOrCode);
}
export function getKnowledgeArticle(idOrCode) {
  return findByIdOrCode(KNOWLEDGE_ARTICLES, idOrCode);
}
export function getRunbook(idOrCode) {
  return findByIdOrCode(RUNBOOKS, idOrCode);
}
export function getOpsKpi(idOrCode) {
  return findByIdOrCode(OPS_KPIS, idOrCode);
}
export function getOperationsGovernance(idOrCode) {
  return findByIdOrCode(OPERATIONS_GOVERNANCE, idOrCode);
}
export function getOfflineMode(idOrCode) {
  return findByIdOrCode(OFFLINE_MODE_CATALOG, idOrCode);
}
export function getSyncRetryPolicy(idOrCode) {
  return findByIdOrCode(SYNC_RETRY_POLICIES, idOrCode);
}
export function getEscalationThreshold(idOrCode) {
  return findByIdOrCode(ESCALATION_THRESHOLDS, idOrCode);
}
export function getCollectorStatusMessage(idOrCode) {
  return findByIdOrCode(COLLECTOR_STATUS_MESSAGES, idOrCode);
}
export function getDecisionFlowNode(idOrCode) {
  return findByIdOrCode(DECISION_FLOW_NODES, idOrCode);
}
export function getOperationsRole(idOrCode) {
  return findByIdOrCode(OPERATIONS_ROLES, idOrCode);
}

export function getIncidentSlaBySeverity(severity) {
  return INCIDENT_SLAS.find((s) => s.severity === severity) || null;
}

export function getCollectorMessageByStatus(status) {
  return COLLECTOR_STATUS_MESSAGES.find((m) => m.status === status) || null;
}

export function getOfflineModeByName(mode) {
  return OFFLINE_MODE_CATALOG.find((m) => m.mode === mode) || null;
}

export function listOfflineRunbooks() {
  return RUNBOOKS.filter((r) => r.offlineScenario === true);
}

export function assertIdUniqueness() {
  const groups = [
    ["SVC", SERVICE_CATALOG],
    ["SEV", INCIDENT_SLAS],
    ["PRB", PROBLEM_CATALOG],
    ["SRT", SERVICE_REQUEST_TYPES],
    ["KB", KNOWLEDGE_ARTICLES],
    ["RB", RUNBOOKS],
    ["OKPI", OPS_KPIS],
    ["OGOV", OPERATIONS_GOVERNANCE],
    ["OM", OFFLINE_MODE_CATALOG],
    ["RETRY", SYNC_RETRY_POLICIES],
    ["ESC", ESCALATION_THRESHOLDS],
    ["CSM", COLLECTOR_STATUS_MESSAGES],
    ["DF", DECISION_FLOW_NODES],
    ["ROLE", OPERATIONS_ROLES]
  ];
  for (const [label, list] of groups) {
    const ids = new Set();
    const codes = new Set();
    for (const item of list) {
      if (ids.has(item.id)) return err("EOS-ID-001", `Duplicate ${label} id ${item.id}`);
      if (codes.has(item.code)) return err("EOS-ID-002", `Duplicate ${label} code ${item.code}`);
      ids.add(item.id);
      codes.add(item.code);
    }
  }
  return ok();
}

export function assertSingleOwnerPerEntry() {
  const collections = [
    ...SERVICE_CATALOG,
    ...INCIDENT_SLAS,
    ...PROBLEM_CATALOG,
    ...SERVICE_REQUEST_TYPES,
    ...KNOWLEDGE_ARTICLES,
    ...RUNBOOKS,
    ...OPS_KPIS,
    ...OPERATIONS_GOVERNANCE,
    ...OFFLINE_MODE_CATALOG,
    ...SYNC_RETRY_POLICIES,
    ...ESCALATION_THRESHOLDS,
    ...COLLECTOR_STATUS_MESSAGES,
    ...DECISION_FLOW_NODES
  ];
  for (const item of collections) {
    if (!item.accountableAuthority || !String(item.accountableAuthority).trim()) {
      return err("EOS-OWN-001", `Missing accountableAuthority on ${item.id}`);
    }
  }
  return ok();
}

export function assertSingleOwnerPerProcess() {
  return assertSingleOwnerPerEntry();
}

export function assertRefsResolve() {
  const errors = [];
  const all = [
    ...SERVICE_CATALOG,
    ...INCIDENT_SLAS,
    ...PROBLEM_CATALOG,
    ...SERVICE_REQUEST_TYPES,
    ...KNOWLEDGE_ARTICLES,
    ...RUNBOOKS,
    ...OPS_KPIS,
    ...OPERATIONS_GOVERNANCE,
    ...OFFLINE_MODE_CATALOG,
    ...SYNC_RETRY_POLICIES,
    ...ESCALATION_THRESHOLDS,
    ...COLLECTOR_STATUS_MESSAGES,
    ...DECISION_FLOW_NODES
  ];
  for (const item of all) {
    if (item.roleId && !getOperationsRole(item.roleId)) {
      errors.push(`${item.id} unknown roleId ${item.roleId}`);
    }
  }
  for (const kb of KNOWLEDGE_ARTICLES) {
    for (const rbId of kb.relatedRunbookIds || []) {
      if (!getRunbook(rbId)) errors.push(`${kb.id} unknown runbook ${rbId}`);
    }
  }
  if (errors.length) return err("EOS-REF-001", "Cross-reference resolution failed", { errors });
  return ok();
}

export function assertOfflineRunbookCompleteness() {
  const requiredCodes = ["RB_OFFLINE_SYNC_RECOVERY", "RB_SYNC_CONFLICT", "RB_EOD_SYNC", "RB_QUEUE_RECOVERY"];
  const errors = [];
  for (const code of requiredCodes) {
    const rb = RUNBOOKS.find((r) => r.code === code);
    if (!rb) {
      errors.push(`Missing offline runbook ${code}`);
      continue;
    }
    if (!rb.offlineScenario) errors.push(`${rb.id} must set offlineScenario true`);
    for (const field of ["preconditions", "steps", "validation", "rollback", "successCriteria"]) {
      if (!Array.isArray(rb[field]) || rb[field].length < 1) {
        errors.push(`${rb.id} incomplete ${field}`);
      }
    }
  }
  if (errors.length) {
    return err("EOS-RB-001", "Offline runbook completeness failed", { errors });
  }
  return ok({ offlineRunbooks: listOfflineRunbooks().length });
}

export function assertCollectorMessageCoverage() {
  const statuses = new Set(COLLECTOR_STATUS_MESSAGES.map((m) => m.status));
  const missing = COLLECTOR_STATUSES.filter((s) => !statuses.has(s));
  if (missing.length) {
    return err("EOS-CSM-001", "Collector status message coverage incomplete", { missing });
  }
  if (COLLECTOR_STATUS_MESSAGES.length !== 6) {
    return err("EOS-CSM-002", "Expected exactly 6 collector status messages");
  }
  for (const m of COLLECTOR_STATUS_MESSAGES) {
    if (!m.message || !m.accessibilityLabel) {
      return err("EOS-CSM-003", `${m.id} missing message or accessibilityLabel`);
    }
  }
  return ok({ statuses: [...statuses] });
}

export function assertEscalationThresholdsAlign() {
  const e4 = getEscalationThreshold("ESC-001");
  const e24 = getEscalationThreshold("ESC-002");
  const eq = getEscalationThreshold("ESC-003");
  const es = getEscalationThreshold("ESC-004");
  const errors = [];
  if (!e4 || e4.thresholdValue !== 4) errors.push("ESC-001 must be 4h branch");
  if (!e24 || e24.thresholdValue !== 24) errors.push("ESC-002 must be 24h regional");
  if (!eq || eq.thresholdValue !== 1000) errors.push("ESC-003 must be queue >1000");
  if (!es || es.thresholdValue !== 99) errors.push("ESC-004 must be success <99%");
  if (errors.length) return err("EOS-ESC-001", "Escalation thresholds misaligned", { errors });
  return ok();
}

export function assertCrossPhaseConsistency() {
  const errors = [];
  if (SYNC_MODULE !== 15) errors.push("SYNC_MODULE must remain 15");
  if (MONITORING_MODULE !== 19) errors.push("MONITORING_MODULE must remain 19");
  if (BACKUP_ENGINE_MODULE !== 21) errors.push("BACKUP_ENGINE_MODULE must remain 21");
  if (PLATFORM_MODULE !== 30) errors.push("PLATFORM_MODULE must remain 30");
  if (JOB_ENGINE_MODULE !== 18) errors.push("JOB_ENGINE_MODULE must remain 18");

  const dash = PHASE13_DASHBOARD_REFRESH;
  if (dash.deviceOfflinePanelSeconds !== 60 || dash.syncHealthPanelSeconds !== 60) {
    errors.push("Phase 13 sync/device panel refresh must remain 60s (consumed)");
  }

  const syncSvc = getService("SVC-007");
  if (!syncSvc || syncSvc.owningModule !== 15) {
    errors.push("SVC-007 must own Module 15 reference without replacing engine");
  }

  if (OFFLINE_MODES.length !== 5) errors.push("Expected 5 offline modes");
  if (SYNC_WORKFLOW_STAGES.length !== 13) errors.push("Expected 13-stage sync workflow");

  if (errors.length) {
    return err("EOS-XP-001", "Cross-phase consistency failed", { errors });
  }
  return ok();
}

export function assertModulesNotReplaced() {
  return ok({
    syncModule: SYNC_MODULE,
    monitoringModule: MONITORING_MODULE,
    backupEngineModule: BACKUP_ENGINE_MODULE,
    jobEngineModule: JOB_ENGINE_MODULE,
    platformModule: PLATFORM_MODULE,
    note: "Phase 18 catalogs only; Module 15 sync / 19 monitoring / 21 backup / 30 platform not replaced"
  });
}

export function validateOperationsRegistry() {
  const checks = [
    assertIdUniqueness(),
    assertSingleOwnerPerEntry(),
    assertRefsResolve(),
    assertOfflineRunbookCompleteness(),
    assertCollectorMessageCoverage(),
    assertEscalationThresholdsAlign(),
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
  if (errors.length) return err("EOS-VAL-000", "Operations registry invalid", { errors });
  return ok({ counts: eossmsCounts() });
}

export function eossmsCounts() {
  return Object.freeze({
    roles: OPERATIONS_ROLES.length,
    services: SERVICE_CATALOG.length,
    incidentSlas: INCIDENT_SLAS.length,
    problems: PROBLEM_CATALOG.length,
    serviceRequests: SERVICE_REQUEST_TYPES.length,
    knowledge: KNOWLEDGE_ARTICLES.length,
    runbooks: RUNBOOKS.length,
    offlineRunbooks: listOfflineRunbooks().length,
    kpis: OPS_KPIS.length,
    governance: OPERATIONS_GOVERNANCE.length,
    offlineModes: OFFLINE_MODE_CATALOG.length,
    syncRetryPolicies: SYNC_RETRY_POLICIES.length,
    escalationThresholds: ESCALATION_THRESHOLDS.length,
    collectorStatuses: COLLECTOR_STATUS_MESSAGES.length,
    decisionFlows: DECISION_FLOW_NODES.length,
    syncWorkflowStages: SYNC_WORKFLOW_STAGES.length
  });
}
