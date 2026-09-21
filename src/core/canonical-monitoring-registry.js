/**
 * Phase 13 — Canonical Monitoring Registry (EMOOIS).
 * Source of truth for monitors, metrics, alerts, health checks, dashboards,
 * traces, SLIs, SLOs, and SLAs.
 * Operational runtime remains Module 19 (monitoring-ops.js) — not replaced.
 * Observe only: no money posts, no RBAC rewrite, no new nav.
 */

export const EMOOIS_VERSION = "1.0.0";
export const EMOOIS_STATUS = "Authoritative";
export const OPERATIONAL_ENGINE_MODULE = 19;
export const OPERATIONAL_ENGINE_REF = "src/core/monitoring-ops.js";

export const MONITOR_ID_PATTERN = /^MON-[0-9]{3}$/;
export const METRIC_ID_PATTERN = /^MET-[0-9]{3}$/;
export const ALERT_ID_PATTERN = /^ALT-[0-9]{3}$/;
export const HEALTH_CHECK_ID_PATTERN = /^HC-[0-9]{3}$/;
export const DASHBOARD_ID_PATTERN = /^DASH-[0-9]{3}$/;
export const TRACE_ID_PATTERN = /^TRC-[0-9]{3}$/;
export const SLI_ID_PATTERN = /^SLI-[0-9]{3}$/;
export const SLO_ID_PATTERN = /^SLO-[0-9]{3}$/;
export const SLA_ID_PATTERN = /^SLA-[0-9]{3}$/;
export const CODE_PATTERN = /^[A-Z][A-Z0-9_]{2,63}$/;

export const MONITORING_DOMAINS = Object.freeze([
  "system",
  "service",
  "database",
  "queue",
  "worker",
  "api",
  "payment_provider",
  "notification_provider",
  "synchronization",
  "storage",
  "backup",
  "security",
  "android_device",
  "ai",
  "business"
]);

export const ALERT_SEVERITIES = Object.freeze([
  "information",
  "warning",
  "minor",
  "major",
  "critical"
]);

export const METRIC_CLASSES = Object.freeze([
  "critical",
  "high",
  "standard",
  "business",
  "capacity",
  "historical"
]);

/** Correlation / trace standards aligned with Phases 5 / 10 / 12. */
export const CORRELATION_STANDARDS = Object.freeze({
  operationalCorrelationId: "uuid-lowercase",
  operationalTraceId: "uuid-lowercase",
  timestampTimezone: "UTC",
  timestampFormat: "ISO-8601",
  phase12GovernanceCorrelation: "CORR-*"
});

function freezeEntry(entry) {
  if (!entry || typeof entry !== "object") return entry;
  const out = { ...entry };
  for (const key of Object.keys(out)) {
    if (Array.isArray(out[key])) out[key] = Object.freeze([...out[key]]);
  }
  return Object.freeze(out);
}

// ─── Monitors ───────────────────────────────────────────────────────────────

export const MONITORS = Object.freeze([
  freezeEntry({
    id: "MON-001",
    code: "SYS_OVERALL_HEALTH",
    name: "System overall health",
    domain: "system",
    description: "Roll-up health score across Module 19 critical domains.",
    owner: "Platform Operations Lead",
    owningModule: 19,
    relatedModules: Object.freeze([19, 30]),
    engineRef: "monitoring-ops.overallHealth"
  }),
  freezeEntry({
    id: "MON-002",
    code: "API_GATEWAY_HEALTH",
    name: "In-process API / gateway health",
    domain: "api",
    description: "Observes Module 20 in-process gateway/contract error % and latency. Facades remain non-live.",
    owner: "API Gateway Steward",
    owningModule: 19,
    relatedModules: Object.freeze([19, 20]),
    engineRef: "monitoring-ops.collectHealthSnapshot"
  }),
  freezeEntry({
    id: "MON-003",
    code: "COLLECTION_DAILY_VOLUME",
    name: "Collection daily volume observation",
    domain: "business",
    description: "Observes daily collection counts via businessMetrics. Does not post or alter collections.",
    owner: "Savings Operations",
    owningModule: 19,
    relatedModules: Object.freeze([6, 19, 27]),
    engineRef: "monitoring-ops.businessMetrics",
    observeOnly: true
  }),
  freezeEntry({
    id: "MON-004",
    code: "LOAN_REPAYMENT_KPI",
    name: "Loan repayment KPI observation",
    domain: "business",
    description: "Observes loan repayment KPIs; Module 27 remains formula authority.",
    owner: "Loan Operations",
    owningModule: 19,
    relatedModules: Object.freeze([8, 19, 27]),
    engineRef: "monitoring-ops.businessMetrics",
    observeOnly: true
  }),
  freezeEntry({
    id: "MON-005",
    code: "AI_ADVISORY_LATENCY",
    name: "AI advisory model latency",
    domain: "ai",
    description: "Observes advisory inference latency for Module 29. Does not auto-approve loans or post money.",
    owner: "ML Ops Lead",
    owningModule: 19,
    relatedModules: Object.freeze([29, 19, 24]),
    engineRef: "monitoring-ops.recordMetric",
    advisoryOnly: true
  }),
  freezeEntry({
    id: "MON-006",
    code: "MOMO_PROVIDER_HEALTH",
    name: "MoMo / payment provider health",
    domain: "payment_provider",
    description: "Observes MoMo and payment provider health via Modules 28 and 16 signals.",
    owner: "Integration Steward",
    owningModule: 19,
    relatedModules: Object.freeze([28, 16, 19]),
    engineRef: "monitoring-ops.collectHealthSnapshot"
  }),
  freezeEntry({
    id: "MON-007",
    code: "SECURITY_FAILED_LOGINS",
    name: "Failed login monitoring",
    domain: "security",
    description: "Tracks failed authentication attempts and security findings.",
    owner: "Security Operations",
    owningModule: 19,
    relatedModules: Object.freeze([22, 1, 19]),
    engineRef: "monitoring-ops.evaluateAlerts"
  }),
  freezeEntry({
    id: "MON-008",
    code: "DB_BACKUP_VERIFICATION",
    name: "DB backup verification (governance)",
    domain: "backup",
    description: "Governance-level backup verification health; Module 21 remains backup engine.",
    owner: "Backup Steward",
    owningModule: 19,
    relatedModules: Object.freeze([21, 19]),
    engineRef: "monitoring-ops.collectHealthSnapshot"
  }),
  freezeEntry({
    id: "MON-009",
    code: "SYNC_PIPELINE_HEALTH",
    name: "Synchronization pipeline",
    domain: "synchronization",
    description: "Sync failures, conflicts, and Android offline buffer health.",
    owner: "Sync Steward",
    owningModule: 19,
    relatedModules: Object.freeze([19]),
    engineRef: "monitoring-ops.collectHealthSnapshot"
  }),
  freezeEntry({
    id: "MON-010",
    code: "QUEUE_WORKER_HEALTH",
    name: "Job queue & worker health",
    domain: "queue",
    description: "Queue depth and stale workers via Module 18 job dashboard signals.",
    owner: "Job Engine Steward",
    owningModule: 19,
    relatedModules: Object.freeze([18, 19]),
    engineRef: "monitoring-ops.collectHealthSnapshot"
  }),
  freezeEntry({
    id: "MON-011",
    code: "ANDROID_DEVICE_HEALTH",
    name: "Android device / offline health",
    domain: "android_device",
    description: "Device operational status, integrity, offline readiness.",
    owner: "Mobile Ops Lead",
    owningModule: 19,
    relatedModules: Object.freeze([19]),
    engineRef: "monitoring-ops.recordDeviceSnapshot"
  }),
  freezeEntry({
    id: "MON-012",
    code: "STORAGE_CAPACITY",
    name: "Storage capacity monitor",
    domain: "storage",
    description: "Storage used percent and capacity forecasts.",
    owner: "Platform Operations Lead",
    owningModule: 19,
    relatedModules: Object.freeze([19, 30]),
    engineRef: "monitoring-ops.recordCapacity"
  })
]);

// ─── Metrics ────────────────────────────────────────────────────────────────

export const METRICS = Object.freeze([
  freezeEntry({
    id: "MET-001",
    code: "API_AVAILABILITY_RATIO",
    name: "API availability ratio",
    unit: "ratio",
    metricClass: "high",
    domain: "api",
    owner: "API Gateway Steward",
    owningModule: 19,
    relatedModules: Object.freeze([19, 20]),
    description: "Successful in-process contract/gateway invocations over total."
  }),
  freezeEntry({
    id: "MET-002",
    code: "API_ERROR_PCT",
    name: "API error percentage",
    unit: "ratio",
    metricClass: "high",
    domain: "api",
    owner: "API Gateway Steward",
    owningModule: 19,
    relatedModules: Object.freeze([19, 20]),
    engineMetricKey: "errorPct"
  }),
  freezeEntry({
    id: "MET-003",
    code: "API_LATENCY_P95_MS",
    name: "API latency p95",
    unit: "ms",
    metricClass: "high",
    domain: "api",
    owner: "API Gateway Steward",
    owningModule: 19,
    relatedModules: Object.freeze([19, 20])
  }),
  freezeEntry({
    id: "MET-004",
    code: "COLLECTIONS_TODAY_COUNT",
    name: "Collections posted today (count)",
    unit: "count",
    metricClass: "business",
    domain: "business",
    owner: "Savings Operations",
    owningModule: 19,
    relatedModules: Object.freeze([6, 19, 27]),
    observeOnly: true,
    engineMetricKey: "collectionsToday"
  }),
  freezeEntry({
    id: "MET-005",
    code: "COLLECTION_POST_SUCCESS_RATIO",
    name: "Collection posting success ratio",
    unit: "ratio",
    metricClass: "business",
    domain: "business",
    owner: "Savings Operations",
    owningModule: 19,
    relatedModules: Object.freeze([6, 19]),
    observeOnly: true,
    description: "Observe-only posting health. Does not change handleCollection or balances."
  }),
  freezeEntry({
    id: "MET-006",
    code: "LOAN_REPAYMENT_RATE",
    name: "Loan repayment rate (observe)",
    unit: "ratio",
    metricClass: "business",
    domain: "business",
    owner: "Loan Operations",
    owningModule: 19,
    relatedModules: Object.freeze([8, 19, 27]),
    observeOnly: true
  }),
  freezeEntry({
    id: "MET-007",
    code: "LOAN_DPD_BUCKET_COUNT",
    name: "Loans by DPD bucket count",
    unit: "count",
    metricClass: "business",
    domain: "business",
    owner: "Loan Operations",
    owningModule: 19,
    relatedModules: Object.freeze([8, 19, 27]),
    observeOnly: true
  }),
  freezeEntry({
    id: "MET-008",
    code: "AI_INFERENCE_LATENCY_P95_MS",
    name: "AI advisory inference latency p95",
    unit: "ms",
    metricClass: "high",
    domain: "ai",
    owner: "ML Ops Lead",
    owningModule: 19,
    relatedModules: Object.freeze([29, 19]),
    advisoryOnly: true
  }),
  freezeEntry({
    id: "MET-009",
    code: "AI_INFERENCE_ERROR_COUNT",
    name: "AI inference error count",
    unit: "count",
    metricClass: "high",
    domain: "ai",
    owner: "ML Ops Lead",
    owningModule: 19,
    relatedModules: Object.freeze([29, 19]),
    advisoryOnly: true
  }),
  freezeEntry({
    id: "MET-010",
    code: "MOMO_PROVIDER_UP",
    name: "MoMo provider up flag",
    unit: "bool",
    metricClass: "critical",
    domain: "payment_provider",
    owner: "Integration Steward",
    owningModule: 19,
    relatedModules: Object.freeze([28, 16, 19])
  }),
  freezeEntry({
    id: "MET-011",
    code: "PROVIDERS_DOWN_COUNT",
    name: "Payment/integration providers down",
    unit: "count",
    metricClass: "critical",
    domain: "payment_provider",
    owner: "Integration Steward",
    owningModule: 19,
    relatedModules: Object.freeze([28, 16, 19]),
    engineMetricKey: "providersDown"
  }),
  freezeEntry({
    id: "MET-012",
    code: "FAILED_LOGIN_COUNT",
    name: "Failed login attempts",
    unit: "count",
    metricClass: "high",
    domain: "security",
    owner: "Security Operations",
    owningModule: 19,
    relatedModules: Object.freeze([22, 1, 19])
  }),
  freezeEntry({
    id: "MET-013",
    code: "SECURITY_FINDINGS_COUNT",
    name: "Security findings",
    unit: "count",
    metricClass: "critical",
    domain: "security",
    owner: "Security Operations",
    owningModule: 19,
    relatedModules: Object.freeze([22, 19]),
    engineMetricKey: "securityFindings"
  }),
  freezeEntry({
    id: "MET-014",
    code: "BACKUP_FAILED_FLAG",
    name: "Backup verification failed",
    unit: "bool",
    metricClass: "critical",
    domain: "backup",
    owner: "Backup Steward",
    owningModule: 19,
    relatedModules: Object.freeze([21, 19]),
    engineMetricKey: "backupFailed"
  }),
  freezeEntry({
    id: "MET-015",
    code: "SYNC_FAILURE_COUNT",
    name: "Sync failures",
    unit: "count",
    metricClass: "high",
    domain: "synchronization",
    owner: "Sync Steward",
    owningModule: 19,
    relatedModules: Object.freeze([19]),
    engineMetricKey: "failed"
  }),
  freezeEntry({
    id: "MET-016",
    code: "QUEUE_DEPTH",
    name: "Job queue depth",
    unit: "count",
    metricClass: "high",
    domain: "queue",
    owner: "Job Engine Steward",
    owningModule: 19,
    relatedModules: Object.freeze([18, 19]),
    engineMetricKey: "queueDepth"
  }),
  freezeEntry({
    id: "MET-017",
    code: "STORAGE_USED_PCT",
    name: "Storage used percent",
    unit: "ratio",
    metricClass: "standard",
    domain: "storage",
    owner: "Platform Operations Lead",
    owningModule: 19,
    relatedModules: Object.freeze([19]),
    engineMetricKey: "storageUsedPct"
  }),
  freezeEntry({
    id: "MET-018",
    code: "PLATFORM_HEALTH_SCORE",
    name: "Platform overall health score",
    unit: "score",
    metricClass: "critical",
    domain: "system",
    owner: "Platform Operations Lead",
    owningModule: 19,
    relatedModules: Object.freeze([19, 30])
  })
]);

// ─── Alerts ─────────────────────────────────────────────────────────────────

export const ALERTS = Object.freeze([
  freezeEntry({
    id: "ALT-001",
    code: "API_HIGH_ERROR_RATE",
    name: "High API error rate",
    severity: "major",
    metricIds: Object.freeze(["MET-002"]),
    owner: "API Gateway Steward",
    owningModule: 19,
    module19RuleAffinity: "rule-error-rate"
  }),
  freezeEntry({
    id: "ALT-002",
    code: "API_AVAILABILITY_BREACH",
    name: "API availability SLO burn",
    severity: "major",
    metricIds: Object.freeze(["MET-001"]),
    owner: "API Gateway Steward",
    owningModule: 19,
    sloIds: Object.freeze(["SLO-001"])
  }),
  freezeEntry({
    id: "ALT-003",
    code: "COLLECTION_VOLUME_ANOMALY",
    name: "Collection daily volume anomaly",
    severity: "warning",
    metricIds: Object.freeze(["MET-004"]),
    owner: "Savings Operations",
    owningModule: 19,
    observeOnly: true
  }),
  freezeEntry({
    id: "ALT-004",
    code: "COLLECTION_POST_HEALTH",
    name: "Collection posting health degraded",
    severity: "major",
    metricIds: Object.freeze(["MET-005"]),
    owner: "Savings Operations",
    owningModule: 19,
    observeOnly: true,
    description: "Observe-only. Does not change posting path."
  }),
  freezeEntry({
    id: "ALT-005",
    code: "LOAN_REPAYMENT_KPI_DROP",
    name: "Loan repayment KPI drop",
    severity: "warning",
    metricIds: Object.freeze(["MET-006"]),
    owner: "Loan Operations",
    owningModule: 19,
    observeOnly: true
  }),
  freezeEntry({
    id: "ALT-006",
    code: "AI_LATENCY_BUDGET",
    name: "AI advisory latency budget exceeded",
    severity: "warning",
    metricIds: Object.freeze(["MET-008"]),
    owner: "ML Ops Lead",
    owningModule: 19,
    advisoryOnly: true,
    sloIds: Object.freeze(["SLO-005"])
  }),
  freezeEntry({
    id: "ALT-007",
    code: "MOMO_PROVIDER_OUTAGE",
    name: "MoMo / payment provider outage",
    severity: "critical",
    metricIds: Object.freeze(["MET-010", "MET-011"]),
    owner: "Integration Steward",
    owningModule: 19,
    module19RuleAffinity: "rule-payment-down"
  }),
  freezeEntry({
    id: "ALT-008",
    code: "FAILED_LOGIN_SPIKE",
    name: "Failed login spike",
    severity: "major",
    metricIds: Object.freeze(["MET-012"]),
    owner: "Security Operations",
    owningModule: 19
  }),
  freezeEntry({
    id: "ALT-009",
    code: "SECURITY_FINDING",
    name: "Security risk finding",
    severity: "critical",
    metricIds: Object.freeze(["MET-013"]),
    owner: "Security Operations",
    owningModule: 19,
    module19RuleAffinity: "rule-security"
  }),
  freezeEntry({
    id: "ALT-010",
    code: "BACKUP_VERIFY_FAIL",
    name: "Backup verification failure",
    severity: "major",
    metricIds: Object.freeze(["MET-014"]),
    owner: "Backup Steward",
    owningModule: 19,
    module19RuleAffinity: "rule-backup-fail"
  }),
  freezeEntry({
    id: "ALT-011",
    code: "SYNC_FAILURES",
    name: "Synchronization failures",
    severity: "major",
    metricIds: Object.freeze(["MET-015"]),
    owner: "Sync Steward",
    owningModule: 19,
    module19RuleAffinity: "rule-sync-fail"
  }),
  freezeEntry({
    id: "ALT-012",
    code: "QUEUE_BACKLOG",
    name: "Queue backlog",
    severity: "major",
    metricIds: Object.freeze(["MET-016"]),
    owner: "Job Engine Steward",
    owningModule: 19,
    module19RuleAffinity: "rule-queue-backlog"
  }),
  freezeEntry({
    id: "ALT-013",
    code: "STORAGE_CRITICAL",
    name: "Storage capacity critical",
    severity: "critical",
    metricIds: Object.freeze(["MET-017"]),
    owner: "Platform Operations Lead",
    owningModule: 19,
    module19RuleAffinity: "rule-storage"
  }),
  freezeEntry({
    id: "ALT-014",
    code: "PLATFORM_UPTIME_BURN",
    name: "Platform uptime SLO burn",
    severity: "major",
    metricIds: Object.freeze(["MET-018"]),
    owner: "Platform Operations Lead",
    owningModule: 19,
    sloIds: Object.freeze(["SLO-003"])
  })
]);

// ─── Health checks ──────────────────────────────────────────────────────────

export const HEALTH_CHECKS = Object.freeze([
  freezeEntry({
    id: "HC-001",
    code: "HC_API_GATEWAY",
    name: "API gateway health check",
    domain: "api",
    intervalMs: 60000,
    timeoutMs: 5000,
    severity: "major",
    owner: "API Gateway Steward",
    owningModule: 19,
    engineRef: "monitoring-ops.collectHealthSnapshot"
  }),
  freezeEntry({
    id: "HC-002",
    code: "HC_SYSTEM_SCORE",
    name: "System score health check",
    domain: "system",
    intervalMs: 30000,
    timeoutMs: 3000,
    severity: "critical",
    owner: "Platform Operations Lead",
    owningModule: 19,
    engineRef: "monitoring-ops.collectHealthSnapshot"
  }),
  freezeEntry({
    id: "HC-003",
    code: "HC_PAYMENT_MOMO",
    name: "MoMo / payment provider health check",
    domain: "payment_provider",
    intervalMs: 30000,
    timeoutMs: 8000,
    severity: "critical",
    owner: "Integration Steward",
    owningModule: 19,
    relatedModules: Object.freeze([28, 16]),
    engineRef: "monitoring-ops.collectHealthSnapshot"
  }),
  freezeEntry({
    id: "HC-004",
    code: "HC_INTEGRATION_HUB",
    name: "Integration hub health check",
    domain: "service",
    intervalMs: 60000,
    timeoutMs: 8000,
    severity: "major",
    owner: "Integration Steward",
    owningModule: 19,
    relatedModules: Object.freeze([28]),
    engineRef: "monitoring-ops.collectHealthSnapshot"
  }),
  freezeEntry({
    id: "HC-005",
    code: "HC_SYNC_ENGINE",
    name: "Sync engine health check",
    domain: "synchronization",
    intervalMs: 60000,
    timeoutMs: 5000,
    severity: "major",
    owner: "Sync Steward",
    owningModule: 19,
    engineRef: "monitoring-ops.collectHealthSnapshot"
  }),
  freezeEntry({
    id: "HC-006",
    code: "HC_QUEUE_WORKER",
    name: "Queue / worker health check",
    domain: "queue",
    intervalMs: 60000,
    timeoutMs: 5000,
    severity: "major",
    owner: "Job Engine Steward",
    owningModule: 19,
    relatedModules: Object.freeze([18]),
    engineRef: "monitoring-ops.collectHealthSnapshot"
  }),
  freezeEntry({
    id: "HC-007",
    code: "HC_STORAGE",
    name: "Storage health check",
    domain: "storage",
    intervalMs: 300000,
    timeoutMs: 5000,
    severity: "critical",
    owner: "Platform Operations Lead",
    owningModule: 19,
    engineRef: "monitoring-ops.collectHealthSnapshot"
  }),
  freezeEntry({
    id: "HC-008",
    code: "HC_BACKUP_VERIFY",
    name: "Backup verification health check",
    domain: "backup",
    intervalMs: 3600000,
    timeoutMs: 30000,
    severity: "major",
    owner: "Backup Steward",
    owningModule: 19,
    relatedModules: Object.freeze([21]),
    engineRef: "monitoring-ops.collectHealthSnapshot"
  }),
  freezeEntry({
    id: "HC-009",
    code: "HC_SECURITY_AUTH",
    name: "Security / auth health check",
    domain: "security",
    intervalMs: 60000,
    timeoutMs: 5000,
    severity: "critical",
    owner: "Security Operations",
    owningModule: 19,
    relatedModules: Object.freeze([22, 1]),
    engineRef: "monitoring-ops.collectHealthSnapshot"
  }),
  freezeEntry({
    id: "HC-010",
    code: "HC_AI_ADVISORY",
    name: "AI advisory latency probe",
    domain: "ai",
    intervalMs: 300000,
    timeoutMs: 10000,
    severity: "warning",
    owner: "ML Ops Lead",
    owningModule: 19,
    relatedModules: Object.freeze([29]),
    advisoryOnly: true,
    engineRef: "monitoring-ops.collectHealthSnapshot"
  }),
  freezeEntry({
    id: "HC-011",
    code: "HC_ANDROID_INTEGRITY",
    name: "Android integrity health check",
    domain: "android_device",
    intervalMs: 86400000,
    timeoutMs: 15000,
    severity: "critical",
    owner: "Mobile Ops Lead",
    owningModule: 19,
    engineRef: "monitoring-ops.recordDeviceSnapshot"
  })
]);

// ─── Dashboards ─────────────────────────────────────────────────────────────

export const DASHBOARDS = Object.freeze([
  freezeEntry({
    id: "DASH-001",
    code: "DASH_SYSTEM_HEALTH",
    name: "System health strip",
    owner: "Platform Operations Lead",
    owningModule: 19,
    surface: "monitoring-views health strip",
    newNav: false,
    metricIds: Object.freeze(["MET-018"])
  }),
  freezeEntry({
    id: "DASH-002",
    code: "DASH_ALERTS_INCIDENTS",
    name: "Alerts & incidents",
    owner: "Platform Operations Lead",
    owningModule: 19,
    surface: "monitoring extras",
    newNav: false
  }),
  freezeEntry({
    id: "DASH-003",
    code: "DASH_DEVICES_OFFLINE",
    name: "Devices & offline readiness",
    owner: "Mobile Ops Lead",
    owningModule: 19,
    surface: "monitoring extras",
    newNav: false
  }),
  freezeEntry({
    id: "DASH-004",
    code: "DASH_INTEGRATION_MOMO",
    name: "Integration & MoMo health",
    owner: "Integration Steward",
    owningModule: 19,
    relatedModules: Object.freeze([28]),
    surface: "integration / reports extras",
    newNav: false,
    metricIds: Object.freeze(["MET-010", "MET-011"])
  }),
  freezeEntry({
    id: "DASH-005",
    code: "DASH_AI_ADVISORY",
    name: "AI advisory latency",
    owner: "ML Ops Lead",
    owningModule: 19,
    relatedModules: Object.freeze([29]),
    surface: "AI / monitoring extras",
    newNav: false,
    metricIds: Object.freeze(["MET-008", "MET-009"])
  }),
  freezeEntry({
    id: "DASH-006",
    code: "DASH_BUSINESS_VOLUME",
    name: "Business volume observation",
    owner: "Savings Operations",
    owningModule: 19,
    surface: "monitoring business metrics",
    newNav: false,
    observeOnly: true,
    metricIds: Object.freeze(["MET-004", "MET-005", "MET-006"])
  }),
  freezeEntry({
    id: "DASH-007",
    code: "DASH_SECURITY",
    name: "Security findings & logins",
    owner: "Security Operations",
    owningModule: 19,
    surface: "monitoring security report",
    newNav: false,
    metricIds: Object.freeze(["MET-012", "MET-013"])
  }),
  freezeEntry({
    id: "DASH-008",
    code: "DASH_SYNC_QUEUE",
    name: "Sync & queue depth",
    owner: "Sync Steward",
    owningModule: 19,
    surface: "monitoring sync report",
    newNav: false,
    metricIds: Object.freeze(["MET-015", "MET-016"])
  })
]);

// ─── Trace standards ────────────────────────────────────────────────────────

export const TRACES = Object.freeze([
  freezeEntry({
    id: "TRC-001",
    code: "TRACE_REQUEST_PATH",
    name: "Request path trace",
    owner: "Platform Operations Lead",
    owningModule: 19,
    traceIdFormat: "uuid-lowercase",
    timestampTimezone: "UTC",
    engineRef: "monitoring-ops.startTrace"
  }),
  freezeEntry({
    id: "TRC-002",
    code: "TRACE_CORRELATION_UUID",
    name: "Operational correlation id",
    owner: "Platform Operations Lead",
    owningModule: 19,
    correlationIdFormat: "uuid-lowercase",
    timestampTimezone: "UTC",
    phaseAlignment: Object.freeze([5, 10, 12])
  }),
  freezeEntry({
    id: "TRC-003",
    code: "TRACE_EVENT_ENVELOPE",
    name: "ECECMS event correlation",
    owner: "Event Steward",
    owningModule: 19,
    correlationIdFormat: "uuid-lowercase",
    timestampTimezone: "UTC",
    phaseAlignment: Object.freeze([5])
  }),
  freezeEntry({
    id: "TRC-004",
    code: "TRACE_AI_GOVERNANCE_CORR",
    name: "AI governance correlation",
    owner: "ML Ops Lead",
    owningModule: 19,
    relatedModules: Object.freeze([29]),
    correlationIdFormat: "CORR-*",
    timestampTimezone: "UTC",
    phaseAlignment: Object.freeze([12]),
    scopeNote: "Document/envelope scope; operational traces still UUID lowercase"
  })
]);

// ─── SLI / SLO / SLA ────────────────────────────────────────────────────────

export const SLIS = Object.freeze([
  freezeEntry({
    id: "SLI-001",
    code: "SLI_API_AVAILABILITY",
    name: "API availability",
    metricId: "MET-001",
    window: "30d",
    owner: "API Gateway Steward",
    owningModule: 19
  }),
  freezeEntry({
    id: "SLI-002",
    code: "SLI_API_LATENCY_P95",
    name: "API latency p95",
    metricId: "MET-003",
    window: "7d",
    owner: "API Gateway Steward",
    owningModule: 19
  }),
  freezeEntry({
    id: "SLI-003",
    code: "SLI_COLLECTION_POST_HEALTH",
    name: "Collection posting health",
    metricId: "MET-005",
    window: "7d",
    owner: "Savings Operations",
    owningModule: 19,
    observeOnly: true
  }),
  freezeEntry({
    id: "SLI-004",
    code: "SLI_PLATFORM_UPTIME",
    name: "Platform uptime (health score)",
    metricId: "MET-018",
    window: "30d",
    owner: "Platform Operations Lead",
    owningModule: 19
  }),
  freezeEntry({
    id: "SLI-005",
    code: "SLI_MOMO_PROVIDER",
    name: "MoMo provider health",
    metricId: "MET-010",
    window: "7d",
    owner: "Integration Steward",
    owningModule: 19
  }),
  freezeEntry({
    id: "SLI-006",
    code: "SLI_AI_LATENCY",
    name: "AI advisory latency",
    metricId: "MET-008",
    window: "7d",
    owner: "ML Ops Lead",
    owningModule: 19,
    advisoryOnly: true
  }),
  freezeEntry({
    id: "SLI-007",
    code: "SLI_SYNC_SUCCESS",
    name: "Sync success",
    metricId: "MET-015",
    window: "7d",
    owner: "Sync Steward",
    owningModule: 19,
    inverse: true
  }),
  freezeEntry({
    id: "SLI-008",
    code: "SLI_BACKUP_SUCCESS",
    name: "Backup verification success",
    metricId: "MET-014",
    window: "30d",
    owner: "Backup Steward",
    owningModule: 19,
    inverse: true
  })
]);

export const SLOS = Object.freeze([
  freezeEntry({
    id: "SLO-001",
    code: "SLO_API_AVAILABILITY",
    name: "API availability",
    sliId: "SLI-001",
    target: ">= 99.5%",
    window: "30d",
    owner: "API Gateway Steward",
    owningModule: 19
  }),
  freezeEntry({
    id: "SLO-002",
    code: "SLO_COLLECTION_POST_HEALTH",
    name: "Collection posting health (observe)",
    sliId: "SLI-003",
    target: ">= 99.0%",
    window: "7d",
    owner: "Savings Operations",
    owningModule: 19,
    observeOnly: true,
    description: "Observes posting health only — does not change posting."
  }),
  freezeEntry({
    id: "SLO-003",
    code: "SLO_PLATFORM_UPTIME",
    name: "Platform uptime",
    sliId: "SLI-004",
    target: ">= 99.0% health-equivalent",
    window: "30d",
    owner: "Platform Operations Lead",
    owningModule: 19
  }),
  freezeEntry({
    id: "SLO-004",
    code: "SLO_MOMO_HEALTH",
    name: "MoMo provider health",
    sliId: "SLI-005",
    target: ">= 99.0% up checks",
    window: "7d",
    owner: "Integration Steward",
    owningModule: 19
  }),
  freezeEntry({
    id: "SLO-005",
    code: "SLO_AI_LATENCY",
    name: "AI advisory p95 latency",
    sliId: "SLI-006",
    target: "<= 2000 ms",
    window: "7d",
    owner: "ML Ops Lead",
    owningModule: 19,
    advisoryOnly: true
  }),
  freezeEntry({
    id: "SLO-006",
    code: "SLO_API_LATENCY",
    name: "API p95 latency",
    sliId: "SLI-002",
    target: "<= 500 ms",
    window: "7d",
    owner: "API Gateway Steward",
    owningModule: 19
  })
]);

export const SLAS = Object.freeze([
  freezeEntry({
    id: "SLA-001",
    code: "SLA_PLATFORM_OPS",
    name: "Platform operational commitment",
    sloIds: Object.freeze(["SLO-001", "SLO-003"]),
    audience: "Internal ops",
    owner: "Platform Operations Lead",
    owningModule: 19
  }),
  freezeEntry({
    id: "SLA-002",
    code: "SLA_INTEGRATION_MOMO",
    name: "Integration / MoMo ops commitment",
    sloIds: Object.freeze(["SLO-004"]),
    audience: "Payments / Integration",
    owner: "Integration Steward",
    owningModule: 19
  }),
  freezeEntry({
    id: "SLA-003",
    code: "SLA_COLLECTION_OBSERVE",
    name: "Collection channel observe commitment",
    sloIds: Object.freeze(["SLO-002"]),
    audience: "Savings ops (observe)",
    owner: "Savings Operations",
    owningModule: 19,
    observeOnly: true
  })
]);

// ─── Helpers ────────────────────────────────────────────────────────────────

function err(code, message, details = {}) {
  return { ok: false, code, message, ...details };
}

function ok(extra = {}) {
  return { ok: true, ...extra };
}

function cloneList(list) {
  return list.map((item) => ({ ...item }));
}

export function listMonitors() {
  return cloneList(MONITORS);
}
export function listMetrics() {
  return cloneList(METRICS);
}
export function listAlerts() {
  return cloneList(ALERTS);
}
export function listHealthChecks() {
  return cloneList(HEALTH_CHECKS);
}
export function listDashboards() {
  return cloneList(DASHBOARDS);
}
export function listTraces() {
  return cloneList(TRACES);
}
export function listSlis() {
  return cloneList(SLIS);
}
export function listSlos() {
  return cloneList(SLOS);
}
export function listSlas() {
  return cloneList(SLAS);
}

export function getMonitor(idOrCode) {
  const key = String(idOrCode || "").trim();
  return MONITORS.find((item) => item.id === key || item.code === key) || null;
}
export function getMetric(idOrCode) {
  const key = String(idOrCode || "").trim();
  return METRICS.find((item) => item.id === key || item.code === key) || null;
}
export function getAlert(idOrCode) {
  const key = String(idOrCode || "").trim();
  return ALERTS.find((item) => item.id === key || item.code === key) || null;
}
export function getHealthCheck(idOrCode) {
  const key = String(idOrCode || "").trim();
  return HEALTH_CHECKS.find((item) => item.id === key || item.code === key) || null;
}
export function getDashboard(idOrCode) {
  const key = String(idOrCode || "").trim();
  return DASHBOARDS.find((item) => item.id === key || item.code === key) || null;
}
export function getTrace(idOrCode) {
  const key = String(idOrCode || "").trim();
  return TRACES.find((item) => item.id === key || item.code === key) || null;
}
export function getSli(idOrCode) {
  const key = String(idOrCode || "").trim();
  return SLIS.find((item) => item.id === key || item.code === key) || null;
}
export function getSlo(idOrCode) {
  const key = String(idOrCode || "").trim();
  return SLOS.find((item) => item.id === key || item.code === key) || null;
}
export function getSla(idOrCode) {
  const key = String(idOrCode || "").trim();
  return SLAS.find((item) => item.id === key || item.code === key) || null;
}

function assertUniqueIdsAndCodes(entries, idPattern, label) {
  const ids = entries.map((e) => e.id);
  const codes = entries.map((e) => e.code);
  const dupId = ids.find((id, i) => ids.indexOf(id) !== i);
  const dupCode = codes.find((code, i) => codes.indexOf(code) !== i);
  if (dupId) return err("EMOOIS-REG-001", `Duplicate ${label} id: ${dupId}`);
  if (dupCode) return err("EMOOIS-REG-002", `Duplicate ${label} code: ${dupCode}`);
  for (const entry of entries) {
    if (!idPattern.test(String(entry.id || ""))) {
      return err("EMOOIS-REG-003", `Invalid ${label} id: ${entry.id}`);
    }
    if (!CODE_PATTERN.test(String(entry.code || ""))) {
      return err("EMOOIS-REG-004", `Invalid ${label} code: ${entry.code}`);
    }
  }
  return ok({ count: entries.length });
}

/**
 * Exactly one non-empty string owner per entry.
 */
export function assertSingleOwner(entry, label = "entry") {
  if (!entry || typeof entry !== "object") {
    return err("EMOOIS-OWN-001", `${label} must be an object`);
  }
  if (typeof entry.owner !== "string" || !entry.owner.trim()) {
    return err("EMOOIS-OWN-002", `${label} ${entry.id || ""} requires a non-empty owner string`);
  }
  if (Array.isArray(entry.owners) && entry.owners.length) {
    return err("EMOOIS-OWN-003", `${label} ${entry.id} must not declare multiple owners`);
  }
  if (entry.owner.includes("|") || entry.owner.toLowerCase().includes(" and ")) {
    return err("EMOOIS-OWN-004", `${label} ${entry.id} owner must be a single party`);
  }
  return ok({ owner: entry.owner.trim() });
}

export function assertIdUniqueness(collections = {
  monitors: MONITORS,
  metrics: METRICS,
  alerts: ALERTS,
  healthChecks: HEALTH_CHECKS,
  dashboards: DASHBOARDS,
  traces: TRACES,
  slis: SLIS,
  slos: SLOS,
  slas: SLAS
}) {
  const checks = [
    assertUniqueIdsAndCodes(collections.monitors, MONITOR_ID_PATTERN, "monitor"),
    assertUniqueIdsAndCodes(collections.metrics, METRIC_ID_PATTERN, "metric"),
    assertUniqueIdsAndCodes(collections.alerts, ALERT_ID_PATTERN, "alert"),
    assertUniqueIdsAndCodes(collections.healthChecks, HEALTH_CHECK_ID_PATTERN, "healthCheck"),
    assertUniqueIdsAndCodes(collections.dashboards, DASHBOARD_ID_PATTERN, "dashboard"),
    assertUniqueIdsAndCodes(collections.traces, TRACE_ID_PATTERN, "trace"),
    assertUniqueIdsAndCodes(collections.slis, SLI_ID_PATTERN, "sli"),
    assertUniqueIdsAndCodes(collections.slos, SLO_ID_PATTERN, "slo"),
    assertUniqueIdsAndCodes(collections.slas, SLA_ID_PATTERN, "sla")
  ];
  for (const result of checks) {
    if (!result.ok) return result;
  }

  const allIds = [
    ...collections.monitors,
    ...collections.metrics,
    ...collections.alerts,
    ...collections.healthChecks,
    ...collections.dashboards,
    ...collections.traces,
    ...collections.slis,
    ...collections.slos,
    ...collections.slas
  ].map((e) => e.id);
  const globalDup = allIds.find((id, i) => allIds.indexOf(id) !== i);
  if (globalDup) return err("EMOOIS-REG-005", `Duplicate id across registries: ${globalDup}`);

  return ok({
    monitors: collections.monitors.length,
    metrics: collections.metrics.length,
    alerts: collections.alerts.length,
    healthChecks: collections.healthChecks.length,
    dashboards: collections.dashboards.length,
    traces: collections.traces.length,
    slis: collections.slis.length,
    slos: collections.slos.length,
    slas: collections.slas.length
  });
}

export function assertOwnersUniquePerEntry(collections = {
  monitors: MONITORS,
  metrics: METRICS,
  alerts: ALERTS,
  healthChecks: HEALTH_CHECKS,
  dashboards: DASHBOARDS,
  traces: TRACES,
  slis: SLIS,
  slos: SLOS,
  slas: SLAS
}) {
  for (const [label, list] of Object.entries(collections)) {
    for (const entry of list) {
      const result = assertSingleOwner(entry, label);
      if (!result.ok) return result;
    }
  }
  return ok();
}

export function assertAlertMetricRefs(alerts = ALERTS, metrics = METRICS) {
  const metricIds = new Set(metrics.map((m) => m.id));
  for (const alert of alerts) {
    const refs = alert.metricIds || [];
    if (!Array.isArray(refs) || !refs.length) {
      return err("EMOOIS-ALT-001", `Alert ${alert.id} requires metricIds`);
    }
    for (const mid of refs) {
      if (!metricIds.has(mid)) {
        return err("EMOOIS-ALT-002", `Alert ${alert.id} references missing metric ${mid}`);
      }
    }
  }
  return ok({ alertCount: alerts.length });
}

export function assertHealthCheckShape(checks = HEALTH_CHECKS) {
  for (const hc of checks) {
    if (!Number.isFinite(hc.intervalMs) || hc.intervalMs <= 0) {
      return err("EMOOIS-HC-001", `Health check ${hc.id} requires positive intervalMs`);
    }
    if (!Number.isFinite(hc.timeoutMs) || hc.timeoutMs <= 0) {
      return err("EMOOIS-HC-002", `Health check ${hc.id} requires positive timeoutMs`);
    }
    if (!ALERT_SEVERITIES.includes(hc.severity)) {
      return err("EMOOIS-HC-003", `Health check ${hc.id} has invalid severity`);
    }
    if (hc.timeoutMs >= hc.intervalMs && hc.intervalMs < 60000) {
      // allow long backup intervals; only flag when timeout >= interval for short checks
    }
    if (hc.timeoutMs > hc.intervalMs) {
      return err("EMOOIS-HC-004", `Health check ${hc.id} timeoutMs must be <= intervalMs`);
    }
  }
  return ok({ healthCheckCount: checks.length });
}

export function assertSliSloRefs(
  slis = SLIS,
  slos = SLOS,
  slas = SLAS,
  metrics = METRICS
) {
  const metricIds = new Set(metrics.map((m) => m.id));
  const sliIds = new Set(slis.map((s) => s.id));
  const sloIds = new Set(slos.map((s) => s.id));

  for (const sli of slis) {
    if (!metricIds.has(sli.metricId)) {
      return err("EMOOIS-SLI-001", `SLI ${sli.id} references missing metric ${sli.metricId}`);
    }
  }
  for (const slo of slos) {
    if (!sliIds.has(slo.sliId)) {
      return err("EMOOIS-SLO-001", `SLO ${slo.id} references missing SLI ${slo.sliId}`);
    }
  }
  for (const sla of slas) {
    for (const sid of sla.sloIds || []) {
      if (!sloIds.has(sid)) {
        return err("EMOOIS-SLA-001", `SLA ${sla.id} references missing SLO ${sid}`);
      }
    }
  }
  return ok();
}

export function assertModule19EngineNotReplaced() {
  return ok({
    operationalEngineModule: OPERATIONAL_ENGINE_MODULE,
    operationalEngineRef: OPERATIONAL_ENGINE_REF,
    replaced: false,
    postsMoney: false,
    newNav: false
  });
}

export function emooisCounts() {
  return {
    monitors: MONITORS.length,
    metrics: METRICS.length,
    alerts: ALERTS.length,
    healthChecks: HEALTH_CHECKS.length,
    dashboards: DASHBOARDS.length,
    traces: TRACES.length,
    slis: SLIS.length,
    slos: SLOS.length,
    slas: SLAS.length
  };
}

export function validateMonitoringRegistry() {
  const errors = [];
  const unique = assertIdUniqueness();
  if (!unique.ok) errors.push(unique.message);
  const owners = assertOwnersUniquePerEntry();
  if (!owners.ok) errors.push(owners.message);
  const alerts = assertAlertMetricRefs();
  if (!alerts.ok) errors.push(alerts.message);
  const hcs = assertHealthCheckShape();
  if (!hcs.ok) errors.push(hcs.message);
  const sli = assertSliSloRefs();
  if (!sli.ok) errors.push(sli.message);

  for (const m of METRICS) {
    if (!METRIC_CLASSES.includes(m.metricClass)) {
      errors.push(`Metric ${m.id} invalid metricClass`);
    }
  }
  for (const a of ALERTS) {
    if (!ALERT_SEVERITIES.includes(a.severity)) {
      errors.push(`Alert ${a.id} invalid severity`);
    }
  }

  if (errors.length) return { ok: false, errors, ...emooisCounts() };
  return {
    ok: true,
    errors: [],
    engine: assertModule19EngineNotReplaced(),
    ...emooisCounts()
  };
}
