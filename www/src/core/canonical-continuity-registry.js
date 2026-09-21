/**
 * Phase 15 — Canonical Continuity Registry (EBCBDRS).
 * Catalog of business services, backup policies, recovery plans, and disaster
 * classes that operationalize Phase 14 RPO/RTO policy.
 * Execution remains Module 21 (backup-recovery-ops); DR governance remains
 * Module 30 (platform-ops). Catalog only: no money posts, no RBAC rewrite, no new nav.
 */

export const EBCBDRS_VERSION = "1.0.0";
export const EBCBDRS_STATUS = "Authoritative";
export const BACKUP_ENGINE_MODULE = 21;
export const BACKUP_ENGINE_REF = "src/core/backup-recovery-ops.js";
export const DR_GOVERNANCE_MODULE = 30;
export const DR_GOVERNANCE_REF = "src/core/platform-ops.js";
export const PHASE14_POLICY_REF = "src/core/canonical-deployment-registry.js#RPO_RTO_TARGETS";
export const PHASE14_MEASUREMENT_REF = "src/core/phase14-recovery-governance.js";

export const SERVICE_ID_PATTERN = /^SVC-[0-9]{3}$/;
export const BACKUP_POLICY_ID_PATTERN = /^BKP-[0-9]{3}$/;
export const RECOVERY_PLAN_ID_PATTERN = /^RCP-[0-9]{3}$/;
export const DISASTER_CLASS_ID_PATTERN = /^DIS-[0-9]{3}$/;
export const CODE_PATTERN = /^[A-Z][A-Z0-9_]{2,63}$/;

export const CONTINUITY_TIERS = Object.freeze([
  "tier0_mission_critical",
  "tier1_business_critical",
  "tier2_important",
  "tier3_standard"
]);

export const CRITICALITY = Object.freeze(["critical", "high", "standard", "low"]);

export const COMPLIANCE_STATES = Object.freeze([
  "compliant",
  "at_risk",
  "breached",
  "exception_approved",
  "not_measured"
]);

export const READINESS_STATES = Object.freeze([
  "ready",
  "degraded",
  "not_ready",
  "unknown"
]);

/** Aligns with Phase 14 CRITICAL_SERVICES + high-priority payment domain. */
export const CRITICAL_CONTINUITY_SERVICES = Object.freeze([
  "database",
  "application",
  "auth",
  "payments"
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

// ─── Business services (align RPO/RTO with Phase 14 RRT-* — do not redefine) ─

export const BUSINESS_SERVICES = Object.freeze([
  freezeEntry({
    id: "SVC-001",
    code: "SVC_DATABASE",
    name: "Persistence / Database",
    domain: "persistence",
    serviceKey: "database",
    tier: "tier0_mission_critical",
    criticality: "critical",
    rpoMinutes: 60,
    rtoMinutes: 240,
    measurementRpoTargetMinutes: 5,
    measurementRtoTargetMinutes: 240,
    recoveryPriority: 1,
    phase14TargetId: "RRT-001",
    phase14TargetCode: "RPO_RTO_DATABASE",
    backupPolicyIds: Object.freeze(["BKP-001", "BKP-002", "BKP-003"]),
    recoveryPlanIds: Object.freeze(["RCP-001", "RCP-004"]),
    owningModule: 21,
    relatedModules: Object.freeze([7, 21, 30]),
    accountableAuthority: "Data Platform Lead",
    responsibleParty: "Backup Steward",
    auditAuthority: "Internal Auditor",
    readinessMetric: "db_backup_verify_pass_rate",
    complianceStateDefault: "not_measured",
    description: "Optional Supabase + localStorage dual persistence; Module 21 execute restore."
  }),
  freezeEntry({
    id: "SVC-002",
    code: "SVC_APPLICATION",
    name: "Application runtime (SPA / APK / EXE)",
    domain: "runtime",
    serviceKey: "application",
    tier: "tier0_mission_critical",
    criticality: "critical",
    rpoMinutes: 60,
    rtoMinutes: 120,
    measurementRpoTargetMinutes: 5,
    measurementRtoTargetMinutes: 120,
    recoveryPriority: 2,
    phase14TargetId: "RRT-002",
    phase14TargetCode: "RPO_RTO_APPLICATION",
    backupPolicyIds: Object.freeze(["BKP-005"]),
    recoveryPlanIds: Object.freeze(["RCP-002", "RCP-004"]),
    owningModule: 30,
    relatedModules: Object.freeze([19, 21, 30]),
    accountableAuthority: "Platform Operations Lead",
    responsibleParty: "Release Manager",
    auditAuthority: "Internal Auditor",
    readinessMetric: "last_known_good_release_redeployable",
    complianceStateDefault: "not_measured",
    description: "Redeploy www/ APK / EXE from last known-good release (EDDIES ART-001/002/003)."
  }),
  freezeEntry({
    id: "SVC-003",
    code: "SVC_AUTH",
    name: "Authentication / session",
    domain: "identity",
    serviceKey: "auth",
    tier: "tier0_mission_critical",
    criticality: "critical",
    rpoMinutes: 15,
    rtoMinutes: 60,
    measurementRpoTargetMinutes: 5,
    measurementRtoTargetMinutes: 60,
    recoveryPriority: 1,
    phase14TargetId: "RRT-003",
    phase14TargetCode: "RPO_RTO_AUTH",
    backupPolicyIds: Object.freeze(["BKP-005"]),
    recoveryPlanIds: Object.freeze(["RCP-003"]),
    owningModule: 22,
    relatedModules: Object.freeze([1, 21, 22, 30]),
    accountableAuthority: "Security Operations Lead",
    responsibleParty: "Platform Engineering Lead",
    auditAuthority: "Internal Auditor",
    readinessMetric: "auth_config_restore_ok",
    complianceStateDefault: "not_measured",
    description: "Auth config + session policy restore; Module 22 signals."
  }),
  freezeEntry({
    id: "SVC-004",
    code: "SVC_SYNC",
    name: "Offline synchronization queue",
    domain: "offline_queue",
    serviceKey: "synchronization",
    tier: "tier1_business_critical",
    criticality: "high",
    rpoMinutes: 30,
    rtoMinutes: 180,
    measurementRpoTargetMinutes: 30,
    measurementRtoTargetMinutes: 180,
    recoveryPriority: 3,
    phase14TargetId: "RRT-004",
    phase14TargetCode: "RPO_RTO_SYNC_QUEUE",
    backupPolicyIds: Object.freeze(["BKP-004"]),
    recoveryPlanIds: Object.freeze(["RCP-005"]),
    owningModule: 15,
    relatedModules: Object.freeze([15, 19, 21]),
    accountableAuthority: "Sync Steward",
    responsibleParty: "Mobile Ops Lead",
    auditAuthority: "Internal Auditor",
    readinessMetric: "android_offline_backup_age_minutes",
    complianceStateDefault: "not_measured",
    description: "Android encrypted offline backup (Module 21 android_offline)."
  }),
  freezeEntry({
    id: "SVC-005",
    code: "SVC_PAYMENTS",
    name: "Payment / MoMo integration",
    domain: "integration",
    serviceKey: "payments",
    tier: "tier0_mission_critical",
    criticality: "critical",
    rpoMinutes: 15,
    rtoMinutes: 90,
    measurementRpoTargetMinutes: 15,
    measurementRtoTargetMinutes: 90,
    recoveryPriority: 2,
    phase14TargetId: "RRT-005",
    phase14TargetCode: "RPO_RTO_PAYMENTS",
    backupPolicyIds: Object.freeze(["BKP-005"]),
    recoveryPlanIds: Object.freeze(["RCP-006"]),
    owningModule: 28,
    relatedModules: Object.freeze([16, 21, 28, 30]),
    accountableAuthority: "Integration Steward",
    responsibleParty: "Payment Ops Lead",
    auditAuthority: "Internal Auditor",
    readinessMetric: "payment_provider_config_restore_ok",
    complianceStateDefault: "not_measured",
    description: "Provider config restore only; no money rewrite."
  }),
  freezeEntry({
    id: "SVC-006",
    code: "SVC_MONITORING",
    name: "Monitoring / observability",
    domain: "telemetry",
    serviceKey: "monitoring",
    tier: "tier2_important",
    criticality: "high",
    rpoMinutes: 120,
    rtoMinutes: 240,
    measurementRpoTargetMinutes: 120,
    measurementRtoTargetMinutes: 240,
    recoveryPriority: 4,
    phase14TargetId: "RRT-006",
    phase14TargetCode: "RPO_RTO_MONITORING",
    backupPolicyIds: Object.freeze(["BKP-005"]),
    recoveryPlanIds: Object.freeze(["RCP-002"]),
    owningModule: 19,
    relatedModules: Object.freeze([19, 30]),
    accountableAuthority: "Platform Operations Lead",
    responsibleParty: "Monitoring Steward",
    auditAuthority: "Internal Auditor",
    readinessMetric: "monitoring_buffer_rehydrate_ok",
    complianceStateDefault: "not_measured",
    description: "Module 19 buffers; catalog rehydrate from EMOOIS/EDDIES."
  }),
  freezeEntry({
    id: "SVC-007",
    code: "SVC_COLLECTIONS",
    name: "Savings collection operations",
    domain: "savings_collection",
    serviceKey: "collections",
    tier: "tier1_business_critical",
    criticality: "critical",
    rpoMinutes: 60,
    rtoMinutes: 240,
    measurementRpoTargetMinutes: 60,
    measurementRtoTargetMinutes: 240,
    recoveryPriority: 2,
    phase14TargetId: "RRT-001",
    phase14TargetCode: "RPO_RTO_DATABASE",
    backupPolicyIds: Object.freeze(["BKP-001", "BKP-002"]),
    recoveryPlanIds: Object.freeze(["RCP-001", "RCP-007"]),
    owningModule: 6,
    relatedModules: Object.freeze([6, 21, 27]),
    accountableAuthority: "Savings Operations Lead",
    responsibleParty: "Branch Ops Lead",
    auditAuthority: "Internal Auditor",
    readinessMetric: "collections_continuity_drill_pass",
    complianceStateDefault: "not_measured",
    description: "Business continuity for collections; restore via Module 21 without rewrite of posting rules."
  }),
  freezeEntry({
    id: "SVC-008",
    code: "SVC_LOANS",
    name: "Loan servicing",
    domain: "loan_servicing",
    serviceKey: "loans",
    tier: "tier1_business_critical",
    criticality: "critical",
    rpoMinutes: 60,
    rtoMinutes: 240,
    measurementRpoTargetMinutes: 60,
    measurementRtoTargetMinutes: 240,
    recoveryPriority: 2,
    phase14TargetId: "RRT-001",
    phase14TargetCode: "RPO_RTO_DATABASE",
    backupPolicyIds: Object.freeze(["BKP-001", "BKP-002"]),
    recoveryPlanIds: Object.freeze(["RCP-001", "RCP-008"]),
    owningModule: 8,
    relatedModules: Object.freeze([8, 21, 27]),
    accountableAuthority: "Credit Operations Lead",
    responsibleParty: "Loan Ops Lead",
    auditAuthority: "Internal Auditor",
    readinessMetric: "loan_continuity_drill_pass",
    complianceStateDefault: "not_measured",
    description: "Loan servicing continuity; interest/cycle formulas remain Module 27 authority."
  }),
  freezeEntry({
    id: "SVC-009",
    code: "SVC_ACCOUNTING",
    name: "Accounting / ledger continuity",
    domain: "accounting",
    serviceKey: "accounting",
    tier: "tier1_business_critical",
    criticality: "high",
    rpoMinutes: 60,
    rtoMinutes: 240,
    measurementRpoTargetMinutes: 60,
    measurementRtoTargetMinutes: 240,
    recoveryPriority: 3,
    phase14TargetId: "RRT-001",
    phase14TargetCode: "RPO_RTO_DATABASE",
    backupPolicyIds: Object.freeze(["BKP-001", "BKP-003"]),
    recoveryPlanIds: Object.freeze(["RCP-001", "RCP-009"]),
    owningModule: 10,
    relatedModules: Object.freeze([10, 13, 21]),
    accountableAuthority: "Finance Controller",
    responsibleParty: "Accounting Ops Lead",
    auditAuthority: "Internal Auditor",
    readinessMetric: "journal_restore_reconcile_ok",
    complianceStateDefault: "not_measured",
    description: "Journal/ledger restore with reconcile gate; no silent money posts."
  }),
  freezeEntry({
    id: "SVC-010",
    code: "SVC_BRANCH_OPS",
    name: "Branch / customer service operations",
    domain: "branch_operations",
    serviceKey: "branch_operations",
    tier: "tier2_important",
    criticality: "standard",
    rpoMinutes: 120,
    rtoMinutes: 480,
    measurementRpoTargetMinutes: 120,
    measurementRtoTargetMinutes: 480,
    recoveryPriority: 5,
    phase14TargetId: "RRT-002",
    phase14TargetCode: "RPO_RTO_APPLICATION",
    backupPolicyIds: Object.freeze(["BKP-005", "BKP-006"]),
    recoveryPlanIds: Object.freeze(["RCP-002", "RCP-010"]),
    owningModule: 30,
    relatedModules: Object.freeze([1, 21, 30]),
    accountableAuthority: "Branch Network Lead",
    responsibleParty: "Customer Service Lead",
    auditAuthority: "Internal Auditor",
    readinessMetric: "branch_manual_ops_playbook_ready",
    complianceStateDefault: "not_measured",
    description: "Manual/branch fallback playbooks while primary app recovers."
  })
]);

// ─── Backup policies (catalog; Module 21 executes) ───────────────────────────

export const BACKUP_POLICIES = Object.freeze([
  freezeEntry({
    id: "BKP-001",
    code: "BKP_FULL_DAILY",
    name: "Full daily backup",
    backupType: "full",
    scheduleHint: "daily",
    retentionDays: 30,
    encryptionRequired: true,
    rpoContributionMinutes: 60,
    engineRef: "backup-recovery-ops.createBackup",
    owningModule: 21,
    relatedModules: Object.freeze([18, 21, 30]),
    accountableAuthority: "Backup Steward",
    appliesToServiceIds: Object.freeze(["SVC-001", "SVC-007", "SVC-008", "SVC-009"])
  }),
  freezeEntry({
    id: "BKP-002",
    code: "BKP_INCREMENTAL",
    name: "Incremental backup",
    backupType: "incremental",
    scheduleHint: "hourly_business",
    retentionDays: 14,
    encryptionRequired: true,
    rpoContributionMinutes: 60,
    engineRef: "backup-recovery-ops.createBackup",
    owningModule: 21,
    relatedModules: Object.freeze([18, 21]),
    accountableAuthority: "Backup Steward",
    appliesToServiceIds: Object.freeze(["SVC-001", "SVC-007", "SVC-008"])
  }),
  freezeEntry({
    id: "BKP-003",
    code: "BKP_TXN_LOG",
    name: "Transaction log / audit trail backup",
    backupType: "transaction_log",
    scheduleHint: "continuous_window",
    retentionDays: 90,
    encryptionRequired: true,
    rpoContributionMinutes: 15,
    engineRef: "backup-recovery-ops.createBackup",
    owningModule: 21,
    relatedModules: Object.freeze([13, 21]),
    accountableAuthority: "Backup Steward",
    appliesToServiceIds: Object.freeze(["SVC-001", "SVC-009"])
  }),
  freezeEntry({
    id: "BKP-004",
    code: "BKP_ANDROID_OFFLINE",
    name: "Android offline encrypted backup",
    backupType: "android_offline",
    scheduleHint: "device_bound",
    retentionDays: 7,
    encryptionRequired: true,
    rpoContributionMinutes: 30,
    engineRef: "backup-recovery-ops.createBackup",
    owningModule: 21,
    relatedModules: Object.freeze([15, 21]),
    accountableAuthority: "Mobile Ops Lead",
    appliesToServiceIds: Object.freeze(["SVC-004"])
  }),
  freezeEntry({
    id: "BKP-005",
    code: "BKP_APPLICATION_CONFIG",
    name: "Application / config / flags backup",
    backupType: "application",
    scheduleHint: "on_release_and_daily",
    retentionDays: 60,
    encryptionRequired: true,
    rpoContributionMinutes: 60,
    engineRef: "backup-recovery-ops.createBackup",
    owningModule: 21,
    relatedModules: Object.freeze([21, 30]),
    accountableAuthority: "Platform Operations Lead",
    appliesToServiceIds: Object.freeze([
      "SVC-002",
      "SVC-003",
      "SVC-005",
      "SVC-006",
      "SVC-010"
    ])
  }),
  freezeEntry({
    id: "BKP-006",
    code: "BKP_SNAPSHOT",
    name: "Point-in-time snapshot",
    backupType: "snapshot",
    scheduleHint: "pre_migration_and_weekly",
    retentionDays: 21,
    encryptionRequired: true,
    rpoContributionMinutes: 60,
    engineRef: "backup-recovery-ops.createBackup",
    owningModule: 21,
    relatedModules: Object.freeze([21, 30]),
    accountableAuthority: "Backup Steward",
    appliesToServiceIds: Object.freeze(["SVC-001", "SVC-010"])
  })
]);

// ─── Recovery plans (catalog; Module 21 execute / Module 30 govern failover) ─

export const RECOVERY_PLANS = Object.freeze([
  freezeEntry({
    id: "RCP-001",
    code: "RCP_DATABASE_RESTORE",
    name: "Database restore & reconcile",
    disasterClassIds: Object.freeze(["DIS-001", "DIS-002", "DIS-003"]),
    serviceIds: Object.freeze(["SVC-001", "SVC-007", "SVC-008", "SVC-009"]),
    phase14TargetIds: Object.freeze(["RRT-001"]),
    strategy: "restore_from_backup_set",
    failoverRole: "secondary",
    failbackRequired: true,
    module21Action: "requestRestore / activate after verify",
    module30Action: "record DR metadata; approve production activate",
    rtoBudgetMinutes: 240,
    rpoBudgetMinutes: 60,
    accountableAuthority: "Data Platform Lead",
    testingFrequency: "monthly"
  }),
  freezeEntry({
    id: "RCP-002",
    code: "RCP_APP_REDEPLOY",
    name: "Application redeploy last known-good",
    disasterClassIds: Object.freeze(["DIS-001", "DIS-004", "DIS-005"]),
    serviceIds: Object.freeze(["SVC-002", "SVC-006", "SVC-010"]),
    phase14TargetIds: Object.freeze(["RRT-002", "RRT-006"]),
    strategy: "redeploy_artifact",
    failoverRole: "secondary",
    failbackRequired: true,
    module21Action: "verify backup of config if needed",
    module30Action: "executeDeployment / promote",
    rtoBudgetMinutes: 120,
    rpoBudgetMinutes: 60,
    accountableAuthority: "Platform Operations Lead",
    testingFrequency: "quarterly"
  }),
  freezeEntry({
    id: "RCP-003",
    code: "RCP_AUTH_RECOVERY",
    name: "Auth / session policy recovery",
    disasterClassIds: Object.freeze(["DIS-002", "DIS-003", "DIS-005"]),
    serviceIds: Object.freeze(["SVC-003"]),
    phase14TargetIds: Object.freeze(["RRT-003"]),
    strategy: "config_restore",
    failoverRole: "primary",
    failbackRequired: false,
    module21Action: "application backup restore for auth config",
    module30Action: "declare window; post-facto audit",
    rtoBudgetMinutes: 60,
    rpoBudgetMinutes: 15,
    accountableAuthority: "Security Operations Lead",
    testingFrequency: "monthly"
  }),
  freezeEntry({
    id: "RCP-004",
    code: "RCP_DR_SITE_FAILOVER",
    name: "Production → DR site failover",
    disasterClassIds: Object.freeze(["DIS-001", "DIS-004"]),
    serviceIds: Object.freeze(["SVC-001", "SVC-002"]),
    phase14TargetIds: Object.freeze(["RRT-001", "RRT-002"]),
    strategy: "site_failover",
    failoverRole: "secondary",
    failbackRequired: true,
    module21Action: "restore onto DR; recovery drill if non-prod",
    module30Action: "approve_production_failover; declare_disaster",
    rtoBudgetMinutes: 240,
    rpoBudgetMinutes: 60,
    accountableAuthority: "DR Steward",
    testingFrequency: "semi_annual"
  }),
  freezeEntry({
    id: "RCP-005",
    code: "RCP_SYNC_QUEUE",
    name: "Offline sync queue recovery",
    disasterClassIds: Object.freeze(["DIS-002", "DIS-005"]),
    serviceIds: Object.freeze(["SVC-004"]),
    phase14TargetIds: Object.freeze(["RRT-004"]),
    strategy: "device_bound_restore",
    failoverRole: "primary",
    failbackRequired: false,
    module21Action: "android_offline backup restore",
    module30Action: "record incident metadata",
    rtoBudgetMinutes: 180,
    rpoBudgetMinutes: 30,
    accountableAuthority: "Sync Steward",
    testingFrequency: "quarterly"
  }),
  freezeEntry({
    id: "RCP-006",
    code: "RCP_PAYMENTS_CONTINUITY",
    name: "Payment provider continuity",
    disasterClassIds: Object.freeze(["DIS-005", "DIS-004"]),
    serviceIds: Object.freeze(["SVC-005"]),
    phase14TargetIds: Object.freeze(["RRT-005"]),
    strategy: "provider_config_restore",
    failoverRole: "primary",
    failbackRequired: false,
    module21Action: "application backup of integration config",
    module30Action: "maintenance window if needed",
    rtoBudgetMinutes: 90,
    rpoBudgetMinutes: 15,
    accountableAuthority: "Integration Steward",
    testingFrequency: "monthly"
  }),
  freezeEntry({
    id: "RCP-007",
    code: "RCP_COLLECTIONS_BC",
    name: "Collections business continuity",
    disasterClassIds: Object.freeze(["DIS-001", "DIS-004"]),
    serviceIds: Object.freeze(["SVC-007"]),
    phase14TargetIds: Object.freeze(["RRT-001"]),
    strategy: "manual_ops_then_restore",
    failoverRole: "secondary",
    failbackRequired: true,
    module21Action: "restore collections scope keys",
    module30Action: "crisis communications metadata",
    rtoBudgetMinutes: 240,
    rpoBudgetMinutes: 60,
    accountableAuthority: "Savings Operations Lead",
    testingFrequency: "quarterly"
  }),
  freezeEntry({
    id: "RCP-008",
    code: "RCP_LOANS_BC",
    name: "Loan servicing business continuity",
    disasterClassIds: Object.freeze(["DIS-001", "DIS-002"]),
    serviceIds: Object.freeze(["SVC-008"]),
    phase14TargetIds: Object.freeze(["RRT-001"]),
    strategy: "manual_ops_then_restore",
    failoverRole: "secondary",
    failbackRequired: true,
    module21Action: "restore loans scope; no formula rewrite",
    module30Action: "crisis communications metadata",
    rtoBudgetMinutes: 240,
    rpoBudgetMinutes: 60,
    accountableAuthority: "Credit Operations Lead",
    testingFrequency: "quarterly"
  }),
  freezeEntry({
    id: "RCP-009",
    code: "RCP_ACCOUNTING_BC",
    name: "Accounting reconcile after restore",
    disasterClassIds: Object.freeze(["DIS-002", "DIS-003"]),
    serviceIds: Object.freeze(["SVC-009"]),
    phase14TargetIds: Object.freeze(["RRT-001"]),
    strategy: "restore_and_reconcile",
    failoverRole: "primary",
    failbackRequired: false,
    module21Action: "restore journalEntries; verify checksums",
    module30Action: "post-restore audit flag",
    rtoBudgetMinutes: 240,
    rpoBudgetMinutes: 60,
    accountableAuthority: "Finance Controller",
    testingFrequency: "semi_annual"
  }),
  freezeEntry({
    id: "RCP-010",
    code: "RCP_BRANCH_MANUAL",
    name: "Branch manual operations fallback",
    disasterClassIds: Object.freeze(["DIS-001", "DIS-004", "DIS-005"]),
    serviceIds: Object.freeze(["SVC-010"]),
    phase14TargetIds: Object.freeze(["RRT-002"]),
    strategy: "manual_playbook",
    failoverRole: "primary",
    failbackRequired: true,
    module21Action: "none required for paper fallback",
    module30Action: "declare ops mode; communicate",
    rtoBudgetMinutes: 480,
    rpoBudgetMinutes: 120,
    accountableAuthority: "Branch Network Lead",
    testingFrequency: "annual"
  })
]);

// ─── Disaster classification ─────────────────────────────────────────────────

export const DISASTER_CLASSES = Object.freeze([
  freezeEntry({
    id: "DIS-001",
    code: "DIS_SITE_FAILURE",
    name: "Primary site / host failure",
    severityDefault: "Level3",
    category: "infrastructure",
    typicalPlans: Object.freeze(["RCP-004", "RCP-001", "RCP-002"]),
    declareViaModule30: true,
    description: "Loss of primary compute/storage hosting SPA static host or DB."
  }),
  freezeEntry({
    id: "DIS-002",
    code: "DIS_DATA_CORRUPTION",
    name: "Data corruption / inconsistent restore point",
    severityDefault: "Level3",
    category: "data",
    typicalPlans: Object.freeze(["RCP-001", "RCP-009", "RCP-005"]),
    declareViaModule30: true,
    description: "Logical corruption requiring verified backup set selection."
  }),
  freezeEntry({
    id: "DIS-003",
    code: "DIS_RANSOMWARE",
    name: "Ransomware / destructive malware",
    severityDefault: "Level4",
    category: "security",
    typicalPlans: Object.freeze(["RCP-001", "RCP-003", "RCP-004"]),
    declareViaModule30: true,
    description: "Integrity incident; prefer offline verified backups; Security + DR Steward."
  }),
  freezeEntry({
    id: "DIS-004",
    code: "DIS_REGIONAL_OUTAGE",
    name: "Regional / network outage",
    severityDefault: "Level2",
    category: "availability",
    typicalPlans: Object.freeze(["RCP-004", "RCP-010", "RCP-006"]),
    declareViaModule30: true,
    description: "Connectivity or regional provider outage affecting production/DR reachability."
  }),
  freezeEntry({
    id: "DIS-005",
    code: "DIS_DEPENDENCY_FAILURE",
    name: "Critical dependency failure",
    severityDefault: "Level2",
    category: "dependency",
    typicalPlans: Object.freeze(["RCP-006", "RCP-003", "RCP-002"]),
    declareViaModule30: false,
    description: "Payment provider, auth dependency, or build artifact registry unavailable."
  })
]);

// ─── Continuity tests & communication (catalog seeds) ────────────────────────

export const CONTINUITY_TESTS = Object.freeze([
  freezeEntry({
    id: "TST-001",
    code: "TST_BACKUP_VERIFY",
    name: "Backup verification drill",
    planIds: Object.freeze(["RCP-001"]),
    frequency: "monthly",
    engine: "Module 21 backup_verify",
    passCriteria: "verification.status === verified"
  }),
  freezeEntry({
    id: "TST-002",
    code: "TST_RTO_DRILL",
    name: "Non-production recovery time drill",
    planIds: Object.freeze(["RCP-001", "RCP-002"]),
    frequency: "quarterly",
    engine: "Module 21 recovery_test",
    passCriteria: "rtoCompliant && applyToProduction === false"
  }),
  freezeEntry({
    id: "TST-003",
    code: "TST_FAILOVER_TABLETOP",
    name: "DR failover tabletop",
    planIds: Object.freeze(["RCP-004"]),
    frequency: "semi_annual",
    engine: "Module 30 DR governance metadata",
    passCriteria: "decision_rights + communication checklist complete"
  }),
  freezeEntry({
    id: "TST-004",
    code: "TST_ANDROID_OFFLINE",
    name: "Android offline restore drill",
    planIds: Object.freeze(["RCP-005"]),
    frequency: "quarterly",
    engine: "Module 21 android_offline",
    passCriteria: "queue restored; no private phone content"
  })
]);

export const COMMUNICATION_CHANNELS = Object.freeze([
  freezeEntry({
    id: "COM-001",
    code: "COM_INTERNAL_OPS",
    name: "Internal operations bridge",
    audience: "ops_engineering",
    triggerSeverities: Object.freeze(["Level2", "Level3", "Level4"]),
    owner: "Platform Operations Lead"
  }),
  freezeEntry({
    id: "COM-002",
    code: "COM_EXEC_ESCALATION",
    name: "Executive escalation",
    audience: "executive",
    triggerSeverities: Object.freeze(["Level3", "Level4"]),
    owner: "SystemOwner"
  }),
  freezeEntry({
    id: "COM-003",
    code: "COM_BRANCH_NETWORK",
    name: "Branch network advisory",
    audience: "branch_staff",
    triggerSeverities: Object.freeze(["Level2", "Level3", "Level4"]),
    owner: "Branch Network Lead"
  }),
  freezeEntry({
    id: "COM-004",
    code: "COM_AUDIT_NOTICE",
    name: "Audit / compliance notice",
    audience: "audit",
    triggerSeverities: Object.freeze(["Level2", "Level3", "Level4"]),
    owner: "Internal Auditor"
  })
]);

// ─── Indexes & helpers ───────────────────────────────────────────────────────

function indexByIdAndCode(list) {
  const map = new Map();
  for (const item of list) {
    map.set(item.id, item);
    map.set(item.code, item);
  }
  return map;
}

const SVC_INDEX = indexByIdAndCode(BUSINESS_SERVICES);
const BKP_INDEX = indexByIdAndCode(BACKUP_POLICIES);
const RCP_INDEX = indexByIdAndCode(RECOVERY_PLANS);
const DIS_INDEX = indexByIdAndCode(DISASTER_CLASSES);
const TST_INDEX = indexByIdAndCode(CONTINUITY_TESTS);
const COM_INDEX = indexByIdAndCode(COMMUNICATION_CHANNELS);

export function listBusinessServices() {
  return [...BUSINESS_SERVICES];
}
export function listBackupPolicies() {
  return [...BACKUP_POLICIES];
}
export function listRecoveryPlans() {
  return [...RECOVERY_PLANS];
}
export function listDisasterClasses() {
  return [...DISASTER_CLASSES];
}
export function listContinuityTests() {
  return [...CONTINUITY_TESTS];
}
export function listCommunicationChannels() {
  return [...COMMUNICATION_CHANNELS];
}

export function getBusinessService(idOrCode) {
  return SVC_INDEX.get(idOrCode) || null;
}
export function getBackupPolicy(idOrCode) {
  return BKP_INDEX.get(idOrCode) || null;
}
export function getRecoveryPlan(idOrCode) {
  return RCP_INDEX.get(idOrCode) || null;
}
export function getDisasterClass(idOrCode) {
  return DIS_INDEX.get(idOrCode) || null;
}
export function getContinuityTest(idOrCode) {
  return TST_INDEX.get(idOrCode) || null;
}
export function getCommunicationChannel(idOrCode) {
  return COM_INDEX.get(idOrCode) || null;
}

export function servicesByTier(tier) {
  return BUSINESS_SERVICES.filter((s) => s.tier === tier);
}

export function servicesByPhase14Target(targetId) {
  return BUSINESS_SERVICES.filter((s) => s.phase14TargetId === targetId);
}

export function operationalRpoRtoMatrix(services = BUSINESS_SERVICES) {
  return services.map((s) =>
    Object.freeze({
      serviceId: s.id,
      code: s.code,
      serviceKey: s.serviceKey,
      tier: s.tier,
      criticality: s.criticality,
      rpoMinutes: s.rpoMinutes,
      rtoMinutes: s.rtoMinutes,
      measurementRpoTargetMinutes: s.measurementRpoTargetMinutes,
      measurementRtoTargetMinutes: s.measurementRtoTargetMinutes,
      recoveryPriority: s.recoveryPriority,
      phase14TargetId: s.phase14TargetId,
      readinessMetric: s.readinessMetric,
      complianceStateDefault: s.complianceStateDefault,
      backupPolicyIds: s.backupPolicyIds,
      recoveryPlanIds: s.recoveryPlanIds
    })
  );
}

export function assertIdUniqueness() {
  const groups = [
    ["SVC", BUSINESS_SERVICES],
    ["BKP", BACKUP_POLICIES],
    ["RCP", RECOVERY_PLANS],
    ["DIS", DISASTER_CLASSES],
    ["TST", CONTINUITY_TESTS],
    ["COM", COMMUNICATION_CHANNELS]
  ];
  for (const [label, list] of groups) {
    const ids = new Set();
    const codes = new Set();
    for (const item of list) {
      if (ids.has(item.id)) return err("EBC-ID-001", `Duplicate ${label} id ${item.id}`);
      if (codes.has(item.code)) return err("EBC-ID-002", `Duplicate ${label} code ${item.code}`);
      ids.add(item.id);
      codes.add(item.code);
    }
  }
  return ok();
}

export function assertPhase14Alignment(phase14Targets = null) {
  const errors = [];
  for (const svc of BUSINESS_SERVICES) {
    if (!svc.phase14TargetId) {
      errors.push(`${svc.id} missing phase14TargetId`);
      continue;
    }
    if (phase14Targets) {
      const t = phase14Targets.find(
        (x) => x.id === svc.phase14TargetId || x.code === svc.phase14TargetCode
      );
      if (!t) {
        errors.push(`${svc.id} phase14TargetId ${svc.phase14TargetId} not found`);
        continue;
      }
      // Critical technical services must match Phase 14 minutes exactly
      if (["database", "application", "auth", "synchronization", "payments", "monitoring"].includes(svc.serviceKey)) {
        if (svc.rpoMinutes !== t.rpoMinutes) {
          errors.push(`${svc.id} rpoMinutes ${svc.rpoMinutes} != Phase14 ${t.rpoMinutes}`);
        }
        if (svc.rtoMinutes !== t.rtoMinutes) {
          errors.push(`${svc.id} rtoMinutes ${svc.rtoMinutes} != Phase14 ${t.rtoMinutes}`);
        }
      }
    }
  }
  if (errors.length) return err("EBC-P14-001", "Phase 14 alignment failed", { errors });
  return ok();
}

export function assertRefsResolve() {
  const errors = [];
  for (const svc of BUSINESS_SERVICES) {
    for (const bid of svc.backupPolicyIds || []) {
      if (!getBackupPolicy(bid)) errors.push(`${svc.id} unknown backupPolicy ${bid}`);
    }
    for (const rid of svc.recoveryPlanIds || []) {
      if (!getRecoveryPlan(rid)) errors.push(`${svc.id} unknown recoveryPlan ${rid}`);
    }
  }
  for (const plan of RECOVERY_PLANS) {
    for (const sid of plan.serviceIds || []) {
      if (!getBusinessService(sid)) errors.push(`${plan.id} unknown service ${sid}`);
    }
    for (const did of plan.disasterClassIds || []) {
      if (!getDisasterClass(did)) errors.push(`${plan.id} unknown disasterClass ${did}`);
    }
  }
  if (errors.length) return err("EBC-REF-001", "Cross-reference resolution failed", { errors });
  return ok();
}

export function assertModulesNotReplaced() {
  if (BACKUP_ENGINE_MODULE !== 21) {
    return err("EBC-MOD-001", "Backup engine module must remain 21");
  }
  if (DR_GOVERNANCE_MODULE !== 30) {
    return err("EBC-MOD-002", "DR governance module must remain 30");
  }
  if (!String(BACKUP_ENGINE_REF).includes("backup-recovery")) {
    return err("EBC-MOD-003", "BACKUP_ENGINE_REF must point at Module 21");
  }
  if (!String(DR_GOVERNANCE_REF).includes("platform-ops")) {
    return err("EBC-MOD-004", "DR_GOVERNANCE_REF must point at Module 30");
  }
  return ok({
    backupEngineModule: BACKUP_ENGINE_MODULE,
    drGovernanceModule: DR_GOVERNANCE_MODULE
  });
}

export function assertCriticalServicesPresent(services = BUSINESS_SERVICES) {
  const keys = new Set(services.map((s) => s.serviceKey));
  for (const required of CRITICAL_CONTINUITY_SERVICES) {
    if (!keys.has(required)) {
      return err("EBC-CRIT-001", `Missing critical continuity service ${required}`);
    }
  }
  return ok();
}

export function validateContinuityRegistry(options = {}) {
  const checks = [
    assertIdUniqueness(),
    assertRefsResolve(),
    assertModulesNotReplaced(),
    assertCriticalServicesPresent(),
    assertPhase14Alignment(options.phase14Targets || null)
  ];
  const errors = [];
  for (const c of checks) {
    if (!c.ok) {
      errors.push(c.message);
      if (c.errors) errors.push(...c.errors);
    }
  }
  if (errors.length) return err("EBC-VAL-000", "Continuity registry invalid", { errors });
  return ok({ counts: ebcbdrsCounts() });
}

export function ebcbdrsCounts() {
  return Object.freeze({
    services: BUSINESS_SERVICES.length,
    backupPolicies: BACKUP_POLICIES.length,
    recoveryPlans: RECOVERY_PLANS.length,
    disasterClasses: DISASTER_CLASSES.length,
    continuityTests: CONTINUITY_TESTS.length,
    communicationChannels: COMMUNICATION_CHANNELS.length
  });
}
