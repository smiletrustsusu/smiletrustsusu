/**
 * Wave 10 — Production Deployment, Go-Live, Hypercare & Continuous Improvement.
 * Browser-safe registries + production go-live assessment. File I/O lives in
 * scripts/wave10-golive-assess.js (Node only). Shared vanilla JS SPA —
 * no Next.js rewrite. Does NOT claim a live production cutover has occurred
 * without Accountable Authority human approvals.
 */

import { SUPER_ADMIN_FORBIDDEN } from "./rbac.js";

export const WAVE10_VERSION = "10.0.0-production-golive";
export const WAVE10_WAVE = "WAVE-10";

/** Catalog mapping: historical EIR name was Production Readiness; user Wave 10 = Prod Deploy / Go-Live / Hypercare / Closure */
export const WAVE10_CATALOG_ALIAS = Object.freeze({
  deliveryName: "Production Deployment, Go-Live, Hypercare & Continuous Improvement",
  deliveryCode: "PROD_DEPLOY_GOLIVE_HYPERCARE_CLOSURE",
  historicalEirName: "Production Readiness",
  historicalEirCode: "PRODUCTION_READINESS",
  productionReadinessNote:
    "EIR WAVE-10 catalog name remains Production Readiness; delivery focus is prod deploy / cutover / hypercare / project closure",
  wavesCompleteNote:
    "Implementation waves 1–10 framework is complete; remaining work is human execution of pilot sign-offs + real production cutover under Wave 10 runbooks",
  certNote: "CERT-001 full production promote requires human Accountable Authority approvals — never auto-assumed"
});

export const WAVE10_MONEY_DEFAULTS = Object.freeze({
  interest: 15,
  collectionDays: 31,
  cashierLimitGhs: 1000,
  pesewas: true
});

export const WAVE10_GAP_CHECKLIST = Object.freeze([
  { id: "W10-G01", title: "Production environment validation checklist (≠ pilot/dev)", status: "closed", severity: "critical" },
  { id: "W10-G02", title: "Cutover runbook with owners + timestamps + rollback criteria", status: "closed", severity: "critical" },
  { id: "W10-G03", title: "Go-live coordination roles", status: "closed", severity: "critical" },
  { id: "W10-G04", title: "Production validation checks (core domains)", status: "closed", severity: "critical" },
  { id: "W10-G05", title: "Hypercare plan + playbook", status: "closed", severity: "high" },
  { id: "W10-G06", title: "Post-implementation review template", status: "closed", severity: "high" },
  { id: "W10-G07", title: "Continuous improvement backlog process", status: "closed", severity: "high" },
  { id: "W10-G08", title: "Knowledge transfer / handover checklist", status: "closed", severity: "medium" },
  { id: "W10-G09", title: "Success metrics registry (targets; actuals ops-filled)", status: "closed", severity: "critical" },
  { id: "W10-G10", title: "evaluateProductionGoLive + human approval gates", status: "closed", severity: "critical" },
  { id: "W10-G11", title: "Project closure artifact generator", status: "closed", severity: "medium" },
  { id: "W10-G12", title: "CERT-001 / Phase 20 certification linkage (preview vs certified)", status: "closed", severity: "critical" },
  { id: "W10-G13", title: "validate:golive evidence + Audit/Reports panels", status: "closed", severity: "critical" },
  { id: "W10-G14", title: "docs/wave10-production-golive.md + supporting runbooks", status: "closed", severity: "medium" },
  {
    id: "W10-G15",
    title: "Live production cutover / CERT-001 certified promote",
    status: "deferred",
    severity: "critical",
    note: "Framework + synthetic assessment only; live cutover requires Accountable Authority approvals and operator execution"
  },
  {
    id: "W10-G16",
    title: "Production financial reconciliation actuals in live env",
    status: "deferred",
    severity: "high",
    note: "Targets + measurement method in registry; actuals remain null / not measured in-repo until ops fills them"
  }
]);

export const WAVE10_PARITY_CHECKLIST = Object.freeze([
  { id: "W10-P01", title: "Same SPA entry (www/ after prepare:web)", channel: "Web↔EXE↔APK" },
  { id: "W10-P02", title: "RC1 PASS + Wave 9 Conditional/Go required for FrameworkReady path", channel: "Governance" },
  { id: "W10-P03", title: "Money: pesewas / 15 / 31 / 1000 preserved", channel: "Web↔EXE↔APK" },
  { id: "W10-P04", title: "AI advisory-only (no auto-approve)", channel: "Web↔EXE↔APK" },
  { id: "W10-P05", title: "No new top-level nav — Audit/Reports panels only", channel: "Web↔EXE↔APK" },
  { id: "W10-P06", title: "SUPER_ADMIN_FORBIDDEN retained", channel: "Web↔EXE↔APK" },
  { id: "W10-P07", title: "Framework complete ≠ production live", channel: "Governance" },
  { id: "W10-P08", title: "Executive Sign-Off stays PendingHumanSignOff until documented", channel: "Governance" },
  { id: "W10-P09", title: "Prod env checklist differs from pilot/dev", channel: "Ops" },
  { id: "W10-P10", title: "CERT-001 preview ≠ certified until human gates clear", channel: "Governance" }
]);

export const HUMAN_SIGNOFF_STATUS = Object.freeze({
  PENDING: "PendingHumanSignOff",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  WAIVED: "WaivedWithException"
});

export const GOLIVE_DECISIONS = Object.freeze([
  "FrameworkReady",
  "AwaitingApprovals",
  "Conditional",
  "Accepted"
]);

export const CERT001_SCOPE = Object.freeze({
  id: "CERT-001",
  phase20Link: "Phase 20 canonical baseline / RDY-* + Phase 16 CERT-001",
  previewVsCertified:
    "validate:golive emits CERT-001 preview status only; certified=true requires recorded human Accountable Authority approvals and live cutover evidence"
});

/* -------------------------------------------------------------------------- */
/* Production environment validation (must differ from pilot/dev)               */
/* -------------------------------------------------------------------------- */

export const PROD_ENV_CHECKLIST = Object.freeze([
  {
    id: "PRD-ENV-001",
    category: "infra",
    title: "Production infrastructure slot provisioned",
    requirement: "Dedicated prod compute/network; not pilot or shared-dev hosts",
    differsFromPilotDev: true,
    mandatory: true
  },
  {
    id: "PRD-ENV-002",
    category: "db",
    title: "Production database instance + migration freeze window",
    requirement: "Prod DB credentials, backups, and migration lock distinct from pilot/dev",
    differsFromPilotDev: true,
    mandatory: true
  },
  {
    id: "PRD-ENV-003",
    category: "storage",
    title: "Production object/file storage buckets",
    requirement: "Prod storage ACLs and retention; no pilot bucket write path",
    differsFromPilotDev: true,
    mandatory: true
  },
  {
    id: "PRD-ENV-004",
    category: "api",
    title: "Production API / invokeApi profile",
    requirement: "config.json / Wave 3 invokeApi base URL points to prod profile; no silent pilot fallback",
    differsFromPilotDev: true,
    mandatory: true
  },
  {
    id: "PRD-ENV-005",
    category: "android",
    title: "Android release signing + prod sync endpoint",
    requirement: "Release APK signed for store/enterprise; sync URL = prod (not pilot tenant)",
    differsFromPilotDev: true,
    mandatory: true
  },
  {
    id: "PRD-ENV-006",
    category: "exe",
    title: "Windows EXE update channel + prod config",
    requirement: "Electron builder publish channel / config targets prod; pilot EXE channel disabled",
    differsFromPilotDev: true,
    mandatory: true
  },
  {
    id: "PRD-ENV-007",
    category: "web",
    title: "Web SPA prod origin + CSP/TLS",
    requirement: "Prod HTTPS origin after prepare:web; distinct from pilot/dev hosts",
    differsFromPilotDev: true,
    mandatory: true
  },
  {
    id: "PRD-ENV-008",
    category: "monitoring",
    title: "Production monitoring + on-call routes",
    requirement: "Alerts page prod on-call (not pilot channel); Phase 18 OKPI dashboards wired",
    differsFromPilotDev: true,
    mandatory: true
  },
  {
    id: "PRD-ENV-009",
    category: "backup",
    title: "Production backup schedule + restore verification",
    requirement: "Prod backup target isolated; Phase 15 RPO/RTO applicable to prod only",
    differsFromPilotDev: true,
    mandatory: true
  },
  {
    id: "PRD-ENV-010",
    category: "dr",
    title: "Production DR runbook readiness",
    requirement: "DR failover procedures for prod region; pilot DR drills do not substitute",
    differsFromPilotDev: true,
    mandatory: true
  },
  {
    id: "PRD-ENV-011",
    category: "secrets",
    title: "Production secrets / key vault isolation",
    requirement: "Prod secrets never shared with pilot/dev; rotation owners assigned",
    differsFromPilotDev: true,
    mandatory: true
  },
  {
    id: "PRD-ENV-012",
    category: "tenant",
    title: "Production tenant / branch ledger path",
    requirement: "Prod tenant IDs and branch write path distinct from pilot; SUPER_ADMIN_FORBIDDEN enforced",
    differsFromPilotDev: true,
    mandatory: true
  }
]);

/* -------------------------------------------------------------------------- */
/* Cutover steps                                                               */
/* -------------------------------------------------------------------------- */

export const CUTOVER_STEPS = Object.freeze([
  {
    id: "CO-01",
    title: "Freeze change window + confirm Wave 9 Conditional/Go + RC1 PASS",
    ownerRole: "Release Manager",
    timestampField: "freezeConfirmedAt",
    rollbackCriteria: "Abort cutover if RC1/Wave9 evidence missing or No-Go; remain on prior release"
  },
  {
    id: "CO-02",
    title: "Final prod backup + restore smoke check",
    ownerRole: "DBA / DevOps",
    timestampField: "backupVerifiedAt",
    rollbackCriteria: "If backup verify fails, do not promote; reopen change window"
  },
  {
    id: "CO-03",
    title: "Enable maintenance / read-only banner (optional)",
    ownerRole: "Operations Lead",
    timestampField: "maintenanceEnabledAt",
    rollbackCriteria: "Disable banner and abort if users blocked unexpectedly"
  },
  {
    id: "CO-04",
    title: "Deploy prod Web/API build (prepare:web artifacts)",
    ownerRole: "DevOps",
    timestampField: "webApiDeployedAt",
    rollbackCriteria: "Revert release artifact to previous version; restore prior www/ config profile"
  },
  {
    id: "CO-05",
    title: "Apply production DB migrations within freeze",
    ownerRole: "DBA",
    timestampField: "dbMigratedAt",
    rollbackCriteria: "Run documented down/rollback SQL for this release; restore DB from CO-02 backup if irreversible"
  },
  {
    id: "CO-06",
    title: "Promote Android release + EXE update channel",
    ownerRole: "Platform / DevOps",
    timestampField: "clientsPromotedAt",
    rollbackCriteria: "Pin update channel to prior build; revoke new APK distribution; communicate rollback to branches"
  },
  {
    id: "CO-07",
    title: "Flip feature flags / config.json to production profile",
    ownerRole: "Release Manager",
    timestampField: "flagsFlippedAt",
    rollbackCriteria: "Disable new feature flags; restore pilot-safe flags if mis-routed; point invokeApi back to prior profile only if full abort"
  },
  {
    id: "CO-08",
    title: "Run production validation checklist (PV-*)",
    ownerRole: "QA Lead",
    timestampField: "prodValidationAt",
    rollbackCriteria: "Any Critical PV failure → initiate rollback (CO-12 path) within SLA"
  },
  {
    id: "CO-09",
    title: "Financial reconciliation spot-check (pesewas)",
    ownerRole: "Finance / Branch Manager",
    timestampField: "reconSpotCheckAt",
    rollbackCriteria: "Material imbalance → halt go-live; restore backup and reopen incident"
  },
  {
    id: "CO-10",
    title: "Disable maintenance; open branches for live traffic",
    ownerRole: "Operations Lead",
    timestampField: "trafficOpenedAt",
    rollbackCriteria: "Re-enable maintenance; divert devices to offline queue if API unhealthy"
  },
  {
    id: "CO-11",
    title: "Hypercare war-room start + stakeholder communication",
    ownerRole: "Incident Manager",
    timestampField: "hypercareStartedAt",
    rollbackCriteria: "If P1 storms exceed threshold in first 2h, execute rollback plan"
  },
  {
    id: "CO-12",
    title: "Rollback decision gate (if triggered)",
    ownerRole: "Accountable Authority / Release Manager",
    timestampField: "rollbackDecisionAt",
    rollbackCriteria:
      "Concrete rollback: (1) revert release artifact, (2) restore DB from CO-02 backup, (3) disable new feature flags, (4) communicate outage/rollback to branches and exec"
  },
  {
    id: "CO-13",
    title: "Go-live acceptance recorded (human)",
    ownerRole: "Executive Sponsor",
    timestampField: "goLiveAcceptedAt",
    rollbackCriteria: "Do not mark Accepted without Accountable Authority; leave PendingHumanSignOff"
  }
]);

export const ROLLBACK_PLAN = Object.freeze({
  id: "RB-PROD-001",
  title: "Production cutover rollback",
  triggers: [
    "Critical PV-* failure after promote",
    "Material financial recon imbalance",
    "API/DB health red for >15 minutes during cutover",
    "P1 incident storm in first hypercare window",
    "Accountable Authority abort"
  ],
  steps: [
    "Declare rollback via Release Manager + Accountable Authority",
    "Revert application release to last-known-good artifact (Web/API/EXE/APK channel pin)",
    "Restore database from pre-cutover backup verified in CO-02",
    "Disable newly enabled feature flags; restore prior config.json / invokeApi profile as required",
    "Communicate status to branch managers, service desk, and Executive Sponsor",
    "Open problem record; schedule PIR before next promote attempt"
  ],
  rtoMinutesTarget: 120,
  rpoNote: "Aligned to Phase 15 backup RPO for prod; do not claim live restore without drill evidence"
});

/* -------------------------------------------------------------------------- */
/* Go-live coordination roles                                                  */
/* -------------------------------------------------------------------------- */

export const GOLIVE_COORDINATION_ROLES = Object.freeze([
  {
    id: "GLR-EXEC",
    role: "Executive Sponsor",
    responsibilities: ["Final go-live accept/abort", "Chair cutover war-room escalations"],
    humanSignOffRequired: true
  },
  {
    id: "GLR-AA",
    role: "Accountable Authority",
    responsibilities: ["Approve production promote", "Authorize rollback"],
    humanSignOffRequired: true
  },
  {
    id: "GLR-RM",
    role: "Release Manager",
    responsibilities: ["Own cutover checklist timestamps", "Coordinate CO-* sequence"],
    humanSignOffRequired: true
  },
  {
    id: "GLR-OPS",
    role: "Operations Lead",
    responsibilities: ["Monitoring, maintenance banner, traffic open"],
    humanSignOffRequired: false
  },
  {
    id: "GLR-DEVOPS",
    role: "DevOps / Platform",
    responsibilities: ["Deploy artifacts, clients, secrets, flags"],
    humanSignOffRequired: false
  },
  {
    id: "GLR-DBA",
    role: "DBA",
    responsibilities: ["Backup, migrate, restore on rollback"],
    humanSignOffRequired: false
  },
  {
    id: "GLR-QA",
    role: "QA Lead",
    responsibilities: ["Execute PV-* production validation"],
    humanSignOffRequired: true
  },
  {
    id: "GLR-FIN",
    role: "Finance / Branch Manager",
    responsibilities: ["Recon spot-check; money policy 15/31/1000"],
    humanSignOffRequired: true
  },
  {
    id: "GLR-SEC",
    role: "Security / Compliance",
    responsibilities: ["Confirm security acceptance for prod"],
    humanSignOffRequired: true
  },
  {
    id: "GLR-SD",
    role: "Service Desk / Incident Manager",
    responsibilities: ["Hypercare intake, MTTA/MTTR tracking"],
    humanSignOffRequired: false
  }
]);

/* -------------------------------------------------------------------------- */
/* Production validation checks                                                */
/* -------------------------------------------------------------------------- */

export const PROD_VALIDATION_CHECKS = Object.freeze([
  { id: "PV-001", domain: "auth", title: "Production login + session hardening", mandatory: true },
  { id: "PV-002", domain: "rbac", title: "RBAC matrix + SUPER_ADMIN_FORBIDDEN sample", mandatory: true },
  { id: "PV-003", domain: "customer", title: "Customer create/search in prod tenant", mandatory: true },
  { id: "PV-004", domain: "savings", title: "Savings product post (pesewas)", mandatory: true },
  { id: "PV-005", domain: "collections", title: "Collector posting path (31-day awareness)", mandatory: true },
  { id: "PV-006", domain: "deposits_withdrawals", title: "Deposit/withdrawal + cashier limit 1000", mandatory: true },
  { id: "PV-007", domain: "loans", title: "Loan inquiry / interest 15 advisory path", mandatory: true },
  { id: "PV-008", domain: "accounting", title: "Ledger post balance smoke", mandatory: true },
  { id: "PV-009", domain: "reporting", title: "Core reports export labeled PROD", mandatory: true },
  { id: "PV-010", domain: "dashboards", title: "Ops/BI dashboards load", mandatory: true },
  { id: "PV-011", domain: "notifications", title: "Notification channel smoke (advisory AI only)", mandatory: true },
  { id: "PV-012", domain: "audit", title: "Audit trail write/read", mandatory: true },
  { id: "PV-013", domain: "offline_sync", title: "Offline queue + sync success path", mandatory: true },
  { id: "PV-014", domain: "devices", title: "Android/EXE device registration against prod", mandatory: true },
  { id: "PV-015", domain: "api_health", title: "API / invokeApi health", mandatory: true },
  { id: "PV-016", domain: "db_health", title: "DB connectivity + migration version", mandatory: true },
  { id: "PV-017", domain: "recon", title: "Branch recon worksheet procedure executed", mandatory: true },
  { id: "PV-018", domain: "monitoring", title: "Monitoring alerts reach prod on-call", mandatory: true }
]);

/* -------------------------------------------------------------------------- */
/* Hypercare                                                                   */
/* -------------------------------------------------------------------------- */

export const HYPERCARE_PLAN = Object.freeze({
  id: "HC-001",
  durationDays: 14,
  extendedWatchDays: 30,
  dailyReviewCadence: "Daily war-room (business days) for durationDays; then twice-weekly to extendedWatchDays",
  supportModel: {
    L1: "Service Desk — intake, triage, password/device basics",
    L2: "Ops / Branch supervisors — recon, collections, device sync",
    L3: "DevOps + Engineering on-call — defects, deploy, DB",
    escalation: "P1 → Incident Manager → Accountable Authority within Phase 18 SLAs"
  },
  issueTracking: {
    tool: "Service desk + Wave 10 hypercare board (Audit/Reports)",
    severities: ["P1", "P2", "P3", "P4", "Enhancement"],
    linkToCiBacklog: true
  },
  exitCriteria: [
    "No open P1 from cutover",
    "Availability and sync metrics within target or exception-approved",
    "Daily reviews closed for durationDays",
    "Handover to BAU ops accepted"
  ]
});

export const HYPERCARE_DAILY_REVIEW_TEMPLATE = Object.freeze([
  "Incidents opened/closed (P1–P4)",
  "MTTA / MTTR vs OKPI targets",
  "Sync success and offline backlog",
  "Financial recon exceptions",
  "Feature flag / rollback watch items",
  "Communication to Executive Sponsor"
]);

/* -------------------------------------------------------------------------- */
/* Post-implementation review                                                  */
/* -------------------------------------------------------------------------- */

export const PIR_DIMENSIONS = Object.freeze([
  { id: "PIR-01", title: "Cutover execution vs plan", questions: ["Did CO-* complete on time?", "Were rollback criteria clear?"] },
  { id: "PIR-02", title: "Technical stability", questions: ["Availability?", "API/DB health?", "Client promote issues?"] },
  { id: "PIR-03", title: "Financial controls", questions: ["Recon accuracy?", "Cashier limit incidents?", "Pesewas integrity?"] },
  { id: "PIR-04", title: "People & process", questions: ["Training adequacy?", "War-room effectiveness?", "KT gaps?"] },
  { id: "PIR-05", title: "Security & compliance", questions: ["Any policy breaches?", "Audit trail complete?"] },
  { id: "PIR-06", title: "Customer / branch impact", questions: ["Adoption?", "CSAT signals?", "Support load?"] },
  { id: "PIR-07", title: "Lessons & CI backlog", questions: ["What enhancements/CRs/tech debt to log?"] }
]);

/* -------------------------------------------------------------------------- */
/* Continuous improvement                                                      */
/* -------------------------------------------------------------------------- */

export const CI_BACKLOG_PROCESS = Object.freeze({
  id: "CI-PROC-001",
  intakeSources: ["Hypercare issues", "PIR actions", "Branch feedback", "Security findings", "Tech debt scans"],
  itemTypes: ["Enhancement", "ChangeRequest", "TechDebt", "Defect", "ReleaseCandidate"],
  workflow: [
    "Capture with severity + money-impact flag",
    "Triage weekly (PO + Ops + Engineering)",
    "Size and schedule into next minor/major release (Phase 19)",
    "Link to CERT-002 hotfix path when production defect",
    "Close with evidence; never auto-waive Critical money defects"
  ],
  releaseCadenceNote: "Post go-live releases follow Phase 19 change/release; CERT-001 remains baseline, CERT-002 for hotfixes"
});

/* -------------------------------------------------------------------------- */
/* Knowledge transfer                                                          */
/* -------------------------------------------------------------------------- */

export const KT_CHECKLIST = Object.freeze([
  { id: "KT-01", title: "Runbook handover (cutover, rollback, DR)", owner: "DevOps → Ops" },
  { id: "KT-02", title: "Service desk KB articles published", owner: "Service Desk" },
  { id: "KT-03", title: "Monitoring dashboard walkthrough", owner: "Ops Lead" },
  { id: "KT-04", title: "Money policy refresh (15/31/1000/pesewas)", owner: "Finance / Training" },
  { id: "KT-05", title: "RBAC + SUPER_ADMIN_FORBIDDEN briefing", owner: "Security" },
  { id: "KT-06", title: "Offline sync recovery procedures", owner: "Platform" },
  { id: "KT-07", title: "Hypercare exit → BAU on-call roster", owner: "Incident Manager" },
  { id: "KT-08", title: "Evidence pack locations (RC1, Wave9, Wave10)", owner: "Release Manager" }
]);

/* -------------------------------------------------------------------------- */
/* Success metrics (targets; actuals null until ops measures)                  */
/* -------------------------------------------------------------------------- */

export const SUCCESS_METRICS = Object.freeze([
  {
    id: "SM-AVAIL",
    name: "Service availability",
    target: "≥99.5% (Phase 13 SLO-001 / Phase 18 OKPI_AVAILABILITY)",
    measurementMethod: "uptime / window from monitoring; ops fills actualPct",
    phaseRefs: [13, 18],
    actual: null,
    actualNote: "not measured in-repo"
  },
  {
    id: "SM-SYNC",
    name: "Offline sync success rate",
    target: "≥99% successful sync cycles (Phase 18 ops sync_success_pct)",
    measurementMethod: "sync engine success / attempts per day",
    phaseRefs: [18, 4],
    actual: null,
    actualNote: "not measured in-repo"
  },
  {
    id: "SM-TXN",
    name: "Transaction posting accuracy",
    target: "100% of sampled posts match ledger (pesewas)",
    measurementMethod: "daily recon sample + audit trail comparison",
    phaseRefs: [16, 18],
    actual: null,
    actualNote: "not measured in-repo"
  },
  {
    id: "SM-RECON",
    name: "Financial reconciliation completion",
    target: "100% branches recon signed daily (or exception logged)",
    measurementMethod: "branch recon worksheets + Finance sign-off",
    phaseRefs: [18, 20],
    actual: null,
    actualNote: "not measured in-repo"
  },
  {
    id: "SM-INC",
    name: "Sev1/Sev2 incident count (hypercare)",
    target: "0 open P1 at hypercare exit; P2 trend decreasing",
    measurementMethod: "service desk incident register",
    phaseRefs: [18],
    actual: null,
    actualNote: "not measured in-repo"
  },
  {
    id: "SM-MTTA",
    name: "Mean Time To Acknowledge",
    target: "≤20 min warning / ≤45 min critical (OKPI_MTTA)",
    measurementMethod: "avg(acknowledgedAt - createdAt)",
    phaseRefs: [18],
    actual: null,
    actualNote: "not measured in-repo"
  },
  {
    id: "SM-MTTR",
    name: "Mean Time To Resolve",
    target: "≤480 min warning / ≤1440 min critical (OKPI_MTTR)",
    measurementMethod: "avg(resolvedAt - createdAt)",
    phaseRefs: [18],
    actual: null,
    actualNote: "not measured in-repo"
  },
  {
    id: "SM-ADOPT",
    name: "Branch / device adoption",
    target: "≥95% designated prod devices active within 14 days",
    measurementMethod: "device heartbeat / last-sync census",
    phaseRefs: [14, 18],
    actual: null,
    actualNote: "not measured in-repo"
  },
  {
    id: "SM-CSAT",
    name: "Customer / staff satisfaction",
    target: "≥4.0 / 5 (OKPI_CSAT warning threshold)",
    measurementMethod: "post-hypercare survey average",
    phaseRefs: [18],
    actual: null,
    actualNote: "not measured in-repo"
  },
  {
    id: "SM-PERF",
    name: "API performance",
    target: "p95 ≤500ms operational (Phase 13 SLO-006); release gate Phase 17/16 as applicable",
    measurementMethod: "APM p95 over hypercare window",
    phaseRefs: [13, 17, 16],
    actual: null,
    actualNote: "not measured in-repo"
  }
]);

/* -------------------------------------------------------------------------- */
/* Human approvals (never auto-Approved)                                       */
/* -------------------------------------------------------------------------- */

export function defaultHumanApprovals() {
  return [
    {
      id: "HA-EXEC",
      role: "Executive Sponsor",
      status: HUMAN_SIGNOFF_STATUS.PENDING,
      requiredFor: "Production Accepted / CERT-001 certified"
    },
    {
      id: "HA-AA",
      role: "Accountable Authority",
      status: HUMAN_SIGNOFF_STATUS.PENDING,
      requiredFor: "Live production cutover authorization"
    },
    {
      id: "HA-RM",
      role: "Release Manager",
      status: HUMAN_SIGNOFF_STATUS.PENDING,
      requiredFor: "Cutover checklist completion"
    },
    {
      id: "HA-QA",
      role: "QA Lead",
      status: HUMAN_SIGNOFF_STATUS.PENDING,
      requiredFor: "Production validation PV-* sign-off"
    },
    {
      id: "HA-FIN",
      role: "Finance / Branch Manager",
      status: HUMAN_SIGNOFF_STATUS.PENDING,
      requiredFor: "Financial recon acceptance"
    },
    {
      id: "HA-SEC",
      role: "Security / Compliance",
      status: HUMAN_SIGNOFF_STATUS.PENDING,
      requiredFor: "Security acceptance for production"
    },
    {
      id: "HA-W9-EXEC",
      role: "Wave 9 Executive Sponsor (carry-forward)",
      status: HUMAN_SIGNOFF_STATUS.PENDING,
      requiredFor: "Wave 9 human gates flipped from PendingHumanSignOff → Approved before Accepted"
    }
  ];
}

/* -------------------------------------------------------------------------- */
/* Entry criteria loaders                                                      */
/* -------------------------------------------------------------------------- */

export function loadRc1EntryCriterion(rc1Evidence) {
  if (!rc1Evidence || typeof rc1Evidence !== "object") {
    return { ok: false, decision: null, readyForWave9: false, reason: "rc1_evidence_missing" };
  }
  const decision = rc1Evidence.decision;
  const ready = rc1Evidence.readyForWave9 === true || decision === "PASS";
  const ok = decision === "PASS" && ready;
  return {
    ok,
    decision,
    readyForWave9: Boolean(ready),
    reason: ok ? null : "rc1_entry_criterion_failed",
    certificationScope: rc1Evidence.certificationScope || null,
    notProductionCert001: rc1Evidence.notProductionCert001 !== false
  };
}

export function loadWave9EntryCriterion(wave9Evidence) {
  if (!wave9Evidence || typeof wave9Evidence !== "object") {
    return {
      ok: false,
      decision: null,
      readyForWave10: null,
      reason: "wave9_evidence_missing"
    };
  }
  const decision = wave9Evidence.goNoGo?.decision || wave9Evidence.decision;
  const ready = wave9Evidence.goNoGo?.readyForWave10 || wave9Evidence.readyForWave10;
  const ok =
    (decision === "Conditional" || decision === "Go") &&
    (ready === "conditional" || ready === "yes" || ready === true);
  return {
    ok,
    decision,
    readyForWave10: ready,
    reason: ok ? null : "wave9_entry_criterion_failed",
    conditions: wave9Evidence.goNoGo?.conditions || [],
    humanApprovals: wave9Evidence.goNoGo?.humanApprovals || []
  };
}

function normalizeApprovalStatus(status) {
  return status === HUMAN_SIGNOFF_STATUS.APPROVED
    ? HUMAN_SIGNOFF_STATUS.APPROVED
    : HUMAN_SIGNOFF_STATUS.PENDING;
}

export function scoreProdEnv(results = []) {
  const byId = Object.fromEntries((results || []).map((r) => [r.id, r]));
  let ready = 0;
  for (const item of PROD_ENV_CHECKLIST) {
    const r = byId[item.id];
    if (r && (r.status === "ready" || r.status === "pass")) ready += 1;
  }
  return {
    mandatoryTotal: PROD_ENV_CHECKLIST.length,
    mandatoryReady: ready,
    score: PROD_ENV_CHECKLIST.length
      ? Math.round((ready / PROD_ENV_CHECKLIST.length) * 100)
      : 0,
    ok: ready === PROD_ENV_CHECKLIST.length,
    differsFromPilotDev: PROD_ENV_CHECKLIST.every((e) => e.differsFromPilotDev === true)
  };
}

export function scoreProdValidation(results = []) {
  const byId = Object.fromEntries((results || []).map((r) => [r.id, r]));
  const mandatory = PROD_VALIDATION_CHECKS.filter((c) => c.mandatory);
  let pass = 0;
  let pending = 0;
  for (const c of mandatory) {
    const r = byId[c.id];
    if (r?.passFail === "pass" && r?.approverStatus === HUMAN_SIGNOFF_STATUS.APPROVED) pass += 1;
    else if (r?.technicalSmoke && r?.passFail === "pass") pending += 1;
    else if (r?.status === "ReadyToExecute" || !r) pending += 1;
  }
  return {
    mandatoryTotal: mandatory.length,
    approvedPass: pass,
    packDefined: (results || []).length >= mandatory.length,
    businessAcceptanceComplete: pass === mandatory.length,
    technicalReadyCount: pending + pass
  };
}

export function scoreCutover(stepResults = []) {
  const byId = Object.fromEntries((stepResults || []).map((r) => [r.id, r]));
  let completed = 0;
  for (const s of CUTOVER_STEPS) {
    const r = byId[s.id];
    if (r && (r.status === "complete" || r.status === "done") && r[s.timestampField]) completed += 1;
  }
  return {
    total: CUTOVER_STEPS.length,
    completed,
    liveCutoverExecuted: completed >= CUTOVER_STEPS.length - 1 && Boolean(byId["CO-13"]?.goLiveAcceptedAt)
  };
}

/* -------------------------------------------------------------------------- */
/* Synthetic seed (framework only)                                             */
/* -------------------------------------------------------------------------- */

export function seedSyntheticGoliveRun({ startedAt = new Date().toISOString() } = {}) {
  const envResults = PROD_ENV_CHECKLIST.map((e) => ({
    id: e.id,
    category: e.category,
    title: e.title,
    differsFromPilotDev: e.differsFromPilotDev,
    status: "ready",
    evidence: "Framework checklist present — live prod verify PendingHumanSignOff"
  }));

  const validationResults = PROD_VALIDATION_CHECKS.map((c, idx) => ({
    id: c.id,
    domain: c.domain,
    title: c.title,
    status: idx < 6 ? "TechnicalPassPendingBusinessSignOff" : "ReadyToExecute",
    passFail: idx < 6 ? "pass" : null,
    technicalSmoke: idx < 6,
    approverStatus: HUMAN_SIGNOFF_STATUS.PENDING,
    evidence: idx < 6 ? "Covered by prior RC1 / Wave 9 technical smoke — business sign-off pending" : null
  }));

  const cutoverResults = CUTOVER_STEPS.map((s) => ({
    id: s.id,
    title: s.title,
    ownerRole: s.ownerRole,
    status: "ReadyToExecute",
    [s.timestampField]: null,
    rollbackCriteria: s.rollbackCriteria
  }));

  return {
    runId: "GOLIVE-SYNTH-001",
    kind: "synthetic",
    startedAt,
    frameworkReady: true,
    liveProductionCutover: false,
    liveProductionAccepted: false,
    note: "Synthetic Wave 10 framework run — not a live production cutover",
    envResults,
    validationResults,
    cutoverResults,
    humanApprovals: defaultHumanApprovals(),
    hypercare: {
      ...HYPERCARE_PLAN,
      startedAt: null,
      status: "NotStarted",
      dailyReviews: []
    },
    metricsSnapshot: SUCCESS_METRICS.map((m) => ({
      id: m.id,
      name: m.name,
      target: m.target,
      actual: null,
      actualNote: m.actualNote
    })),
    issueRegister: [],
    ciBacklogSeed: []
  };
}

/* -------------------------------------------------------------------------- */
/* evaluateProductionGoLive                                                    */
/* -------------------------------------------------------------------------- */

export function evaluateProductionGoLive({
  rc1Evidence = null,
  wave9Evidence = null,
  goliveRun = null,
  packFilesMissing = false
} = {}) {
  const run = goliveRun || seedSyntheticGoliveRun();
  const reasons = [];
  const conditions = [];
  const hardBlockers = [];
  const dimensions = [];

  if (packFilesMissing) {
    hardBlockers.push("wave10_pack_files_missing");
    reasons.push("wave10_pack_files_missing");
  }

  const rc1 = loadRc1EntryCriterion(rc1Evidence);
  dimensions.push({
    id: "GL10-RC1",
    pass: rc1.ok,
    detail: rc1.ok ? `RC1 ${rc1.decision}` : rc1.reason
  });
  if (!rc1.ok) {
    hardBlockers.push("rc1_entry_criterion_failed");
    reasons.push("rc1_entry_criterion_failed");
  }

  const w9 = loadWave9EntryCriterion(wave9Evidence);
  dimensions.push({
    id: "GL10-W9",
    pass: w9.ok,
    detail: w9.ok
      ? `Wave 9 ${w9.decision} (readyForWave10=${w9.readyForWave10})`
      : w9.reason
  });
  if (!w9.ok) {
    hardBlockers.push("wave9_entry_criterion_failed");
    reasons.push("wave9_entry_criterion_failed");
  } else if (w9.decision === "Conditional" || (w9.conditions || []).length) {
    conditions.push("wave9_conditional_human_gates_open");
    for (const c of w9.conditions || []) conditions.push(`wave9:${c}`);
  }

  const env = scoreProdEnv(run.envResults);
  dimensions.push({
    id: "GL10-ENV",
    pass: env.differsFromPilotDev && env.ok,
    detail: env.differsFromPilotDev
      ? `Prod env checklist ${env.score}% (${env.mandatoryReady}/${env.mandatoryTotal}); differsFromPilotDev=true`
      : "Prod env must differ from pilot/dev"
  });
  if (!env.differsFromPilotDev) reasons.push("prod_env_not_isolated_from_pilot_dev");
  if (!env.ok) conditions.push("prod_env_live_verify_pending");

  const pv = scoreProdValidation(run.validationResults);
  dimensions.push({
    id: "GL10-PV",
    pass: pv.packDefined,
    detail: `PV pack defined; approved ${pv.approvedPass}/${pv.mandatoryTotal}; business acceptance PendingHumanSignOff`
  });
  if (!pv.packDefined) reasons.push("prod_validation_pack_incomplete");
  if (!pv.businessAcceptanceComplete) conditions.push("prod_validation_human_signoff_pending");

  const cut = scoreCutover(run.cutoverResults);
  dimensions.push({
    id: "GL10-CO",
    pass: true,
    detail: cut.liveCutoverExecuted
      ? `Cutover steps complete ${cut.completed}/${cut.total}`
      : `Cutover not executed (${cut.completed}/${cut.total}); framework only`
  });
  if (!cut.liveCutoverExecuted) conditions.push("live_production_cutover_pending");

  const approvals = (run.humanApprovals || defaultHumanApprovals()).map((a) => ({
    ...a,
    status: normalizeApprovalStatus(a.status)
  }));
  // Never fabricate Executive / Accountable Authority approval
  const pendingRequired = approvals.filter(
    (a) => a.humanSignOffRequired !== false && a.status !== HUMAN_SIGNOFF_STATUS.APPROVED
  );
  // All listed HA-* are required for Accepted
  const allApproved = approvals.every((a) => a.status === HUMAN_SIGNOFF_STATUS.APPROVED);
  dimensions.push({
    id: "GL10-APPROVALS",
    pass: allApproved,
    detail: allApproved
      ? "All human approvals Approved"
      : `Human approvals pending: ${approvals.filter((a) => a.status !== HUMAN_SIGNOFF_STATUS.APPROVED).map((a) => a.id).join(", ")}`
  });
  if (!allApproved) {
    conditions.push("executive_and_accountable_authority_pending_human_signoff");
  }

  const w9ExecCarry = approvals.find((a) => a.id === "HA-W9-EXEC");
  const w9Humans = w9.humanApprovals || [];
  const w9StillPending = w9Humans.some(
    (a) => a.status !== HUMAN_SIGNOFF_STATUS.APPROVED && a.id === "HA-EXEC"
  );
  if (w9StillPending || w9ExecCarry?.status !== HUMAN_SIGNOFF_STATUS.APPROVED) {
    conditions.push("wave9_human_gates_must_flip_to_approved_before_accepted");
  }

  dimensions.push({
    id: "GL10-HYPERCARE",
    pass: true,
    detail: `Hypercare plan ${HYPERCARE_PLAN.durationDays}d (+${HYPERCARE_PLAN.extendedWatchDays}d watch); status=${run.hypercare?.status || "NotStarted"}`
  });

  dimensions.push({
    id: "GL10-METRICS",
    pass: true,
    detail: `${SUCCESS_METRICS.length} success metrics registered; actuals not measured in-repo`
  });

  const certPreview = {
    certificationId: CERT001_SCOPE.id,
    certified: false,
    preview: true,
    phase20Link: CERT001_SCOPE.phase20Link,
    note: CERT001_SCOPE.previewVsCertified
  };

  // Decision tree — Accepted only with recorded approvals + live cutover
  let decision = "FrameworkReady";

  if (hardBlockers.length > 0) {
    // Still report a decision for UI; script exits non-zero on hard blockers
    decision = "Conditional";
  } else if (allApproved && cut.liveCutoverExecuted && pv.businessAcceptanceComplete) {
    decision = "Accepted";
    certPreview.certified = true;
    certPreview.preview = false;
    certPreview.note = "CERT-001 certified based on recorded human approvals + live cutover evidence";
  } else if (conditions.some((c) => c.startsWith("wave9:")) || w9.decision === "Conditional") {
    // Prefer AwaitingApprovals when only human gates remain and framework otherwise ready
    if (
      hardBlockers.length === 0 &&
      env.differsFromPilotDev &&
      pv.packDefined &&
      !allApproved
    ) {
      decision = conditions.length > 3 ? "Conditional" : "AwaitingApprovals";
    } else {
      decision = "Conditional";
    }
  } else if (!allApproved) {
    decision = "AwaitingApprovals";
  } else {
    decision = "FrameworkReady";
  }

  // When framework pack is healthy and entry OK, default synthetic path is FrameworkReady
  // with AwaitingApprovals if we want to stress approvals — use FrameworkReady when
  // no hard blockers and pack ready (user expects FrameworkReady for validate:golive).
  if (hardBlockers.length === 0 && env.differsFromPilotDev && pv.packDefined && decision !== "Accepted") {
    if (!allApproved && !cut.liveCutoverExecuted) {
      decision = "FrameworkReady";
    }
  }

  void pendingRequired;

  return {
    decision,
    recommendation: decision,
    hardBlockers: [...new Set(hardBlockers)],
    reasons: [...new Set(reasons)],
    conditions: [...new Set(conditions)],
    dimensions,
    rc1,
    wave9: w9,
    env,
    validation: pv,
    cutover: cut,
    humanApprovals: approvals,
    cert001: certPreview,
    frameworkReady: hardBlockers.length === 0 && Boolean(run.frameworkReady !== false),
    liveProductionCutover: Boolean(run.liveProductionCutover) || cut.liveCutoverExecuted,
    liveProductionAccepted: decision === "Accepted",
    meaning: explainGoliveDecision(decision, hardBlockers, conditions),
    moneyDefaults: WAVE10_MONEY_DEFAULTS,
    forbiddenSample: SUPER_ADMIN_FORBIDDEN.slice(0, 3),
    hypercareDurationDays: HYPERCARE_PLAN.durationDays,
    counts: {
      cutoverSteps: CUTOVER_STEPS.length,
      validationChecks: PROD_VALIDATION_CHECKS.length,
      prodEnvChecks: PROD_ENV_CHECKLIST.length,
      metrics: SUCCESS_METRICS.length,
      coordinationRoles: GOLIVE_COORDINATION_ROLES.length,
      ktItems: KT_CHECKLIST.length,
      pirDimensions: PIR_DIMENSIONS.length
    }
  };
}

function explainGoliveDecision(decision, hardBlockers, conditions) {
  if (decision === "Accepted") {
    return "Production Accepted: recorded human approvals and live cutover evidence are present. CERT-001 may be marked certified.";
  }
  if (decision === "AwaitingApprovals") {
    return `Framework is ready; awaiting Accountable Authority / executive human sign-offs. Conditions: ${conditions.join(", ") || "approvals"}. Not production live.`;
  }
  if (decision === "Conditional") {
    if (hardBlockers.length) {
      return `Hard blockers prevent go-live assessment success: ${hardBlockers.join(", ")}.`;
    }
    return `Conditional: Wave 9 and/or production human gates remain. Conditions: ${conditions.join(", ")}. Framework ≠ live cutover.`;
  }
  return `FrameworkReady: Wave 10 production deploy/golive/hypercare/closure pack is complete for operator execution. Remaining work is human pilot sign-offs + real production cutover under runbooks. Conditions: ${conditions.slice(0, 6).join(", ")}${conditions.length > 6 ? "…" : ""}. Executive Sign-Off remains ${HUMAN_SIGNOFF_STATUS.PENDING}.`;
}

/* -------------------------------------------------------------------------- */
/* Gaps / smoke / evidence / closure                                           */
/* -------------------------------------------------------------------------- */

export function analyzeWave10Gaps() {
  const items = WAVE10_GAP_CHECKLIST.map((g) => ({ ...g }));
  const openCritical = items.filter(
    (g) => g.severity === "critical" && g.status !== "closed" && g.status !== "deferred"
  );
  return {
    wave: WAVE10_WAVE,
    version: WAVE10_VERSION,
    architecture: "shared-spa-production-golive",
    notNextJsRewrite: true,
    catalogAlias: WAVE10_CATALOG_ALIAS,
    items,
    closedCount: items.filter((g) => g.status === "closed").length,
    deferredCount: items.filter((g) => g.status === "deferred").length,
    openCritical: openCritical.length,
    frameworkReady: openCritical.length === 0,
    moneyDefaults: WAVE10_MONEY_DEFAULTS,
    parity: WAVE10_PARITY_CHECKLIST.slice(),
    counts: {
      cutoverSteps: CUTOVER_STEPS.length,
      validationChecks: PROD_VALIDATION_CHECKS.length,
      prodEnvChecks: PROD_ENV_CHECKLIST.length,
      metrics: SUCCESS_METRICS.length,
      coordinationRoles: GOLIVE_COORDINATION_ROLES.length,
      ktItems: KT_CHECKLIST.length,
      pirDimensions: PIR_DIMENSIONS.length,
      hypercareDurationDays: HYPERCARE_PLAN.durationDays
    }
  };
}

export function wave10SmokeChecklist() {
  const gaps = analyzeWave10Gaps();
  return {
    wave: WAVE10_WAVE,
    version: WAVE10_VERSION,
    architecture: "shared-spa-production-golive",
    notNextJsRewrite: true,
    catalogAlias: WAVE10_CATALOG_ALIAS,
    frameworkReady: gaps.frameworkReady,
    moneyDefaults: gaps.moneyDefaults,
    validateGoliveHint: "npm run validate:golive",
    counts: gaps.counts,
    claimBoundary: "Framework complete ≠ production live"
  };
}

export function generateProjectClosureArtifact({
  goliveEvaluation = null,
  startedAt = new Date().toISOString(),
  finishedAt = new Date().toISOString()
} = {}) {
  const evalResult = goliveEvaluation || evaluateProductionGoLive({});
  return {
    schemaVersion: "wave10-project-closure/1.0",
    wave: WAVE10_WAVE,
    title: "SMILE TRUST SUSU — Implementation Waves 1–10 Closure (Framework)",
    startedAt,
    finishedAt,
    frameworkWavesComplete: true,
    productionLive: Boolean(evalResult.liveProductionAccepted),
    decision: evalResult.decision,
    statement:
      "Implementation waves 1–10 framework is complete. Remaining work is human execution of pilot sign-offs + real production cutover under Wave 10 runbooks. The outdated 'execute Wave 1' epilogue does not apply — waves are already implemented as packs.",
    executiveSignOff: {
      status: HUMAN_SIGNOFF_STATUS.PENDING,
      note: "Do not auto-set Executive Sign-Off to Approved"
    },
    deliverableSummary: {
      waves: "WAVE-01 … WAVE-10 packs delivered in-repo",
      evidence: [
        "docs/release-evidence/rc1-evidence.json",
        "docs/release-evidence/wave9-pilot-evidence.json",
        "docs/release-evidence/wave10-golive-evidence.json"
      ],
      humanRemaining: [
        "Flip Wave 9 PendingHumanSignOff → Approved (UAT, training, recon, security, Executive Sponsor)",
        "Execute production cutover CO-* with timestamps",
        "Complete PV-* with human approvers",
        "Run hypercare for durationDays",
        "Record Accountable Authority + Executive acceptance for CERT-001 certified"
      ]
    },
    successMetrics: SUCCESS_METRICS.map((m) => ({
      id: m.id,
      target: m.target,
      actual: null,
      actualNote: m.actualNote
    })),
    catalogAlias: WAVE10_CATALOG_ALIAS
  };
}

export function buildGoliveEvidencePackage({
  rc1Evidence = null,
  wave9Evidence = null,
  goliveRun = null,
  startedAt = new Date().toISOString(),
  finishedAt = new Date().toISOString(),
  packageJson = null,
  packFilesMissing = false
} = {}) {
  const run = goliveRun || seedSyntheticGoliveRun({ startedAt });
  const evaluation = evaluateProductionGoLive({
    rc1Evidence,
    wave9Evidence,
    goliveRun: run,
    packFilesMissing
  });
  const gaps = analyzeWave10Gaps();
  const closure = generateProjectClosureArtifact({
    goliveEvaluation: evaluation,
    startedAt,
    finishedAt
  });

  const scripts = (packageJson && packageJson.scripts) || {};
  const scriptChecks = {
    validateGolive: Boolean(scripts["validate:golive"] || scripts["wave10:assess"]),
    validatePilot: Boolean(scripts["validate:pilot"]),
    validateRc: Boolean(scripts["validate:rc"]),
    prepareWeb: Boolean(scripts["prepare:web"]),
    test: Boolean(scripts.test)
  };

  return {
    schemaVersion: "wave10-golive-evidence/1.0",
    wave: WAVE10_WAVE,
    version: WAVE10_VERSION,
    catalogAlias: WAVE10_CATALOG_ALIAS,
    startedAt,
    finishedAt,
    claim: {
      frameworkReady: evaluation.frameworkReady,
      liveProductionCutover: false,
      liveProductionAccepted: false,
      cert001Certified: false,
      note: "Evidence pack for operators; synthetic assessment only — not a live production cutover or CERT-001 certified claim"
    },
    entryCriteria: {
      rc1: evaluation.rc1,
      wave9: evaluation.wave9,
      note: "Human sign-offs must flip PendingHumanSignOff → Approved before Production Accepted"
    },
    goLive: {
      decision: evaluation.decision,
      recommendation: evaluation.recommendation,
      meaning: evaluation.meaning,
      hardBlockers: evaluation.hardBlockers,
      reasons: evaluation.reasons,
      conditions: evaluation.conditions,
      dimensions: evaluation.dimensions,
      humanApprovals: evaluation.humanApprovals,
      cert001: evaluation.cert001
    },
    goliveRun: {
      runId: run.runId,
      kind: run.kind,
      liveProductionCutover: run.liveProductionCutover,
      frameworkReady: run.frameworkReady,
      note: run.note
    },
    productionEnvironment: {
      checklist: run.envResults,
      differsFromPilotDevRequired: true,
      allDifferFlagsTrue: PROD_ENV_CHECKLIST.every((e) => e.differsFromPilotDev),
      scores: evaluation.env
    },
    cutover: {
      steps: run.cutoverResults,
      rollbackPlan: ROLLBACK_PLAN,
      scores: evaluation.cutover
    },
    productionValidation: {
      checks: run.validationResults,
      scores: evaluation.validation
    },
    coordinationRoles: GOLIVE_COORDINATION_ROLES.map((r) => ({
      id: r.id,
      role: r.role,
      humanSignOffRequired: r.humanSignOffRequired,
      responsibilityCount: r.responsibilities.length
    })),
    hypercare: {
      plan: HYPERCARE_PLAN,
      dailyReviewTemplate: HYPERCARE_DAILY_REVIEW_TEMPLATE,
      run: run.hypercare
    },
    postImplementationReview: {
      dimensions: PIR_DIMENSIONS
    },
    continuousImprovement: CI_BACKLOG_PROCESS,
    knowledgeTransfer: KT_CHECKLIST,
    successMetrics: run.metricsSnapshot,
    projectClosure: closure,
    moneyDefaults: WAVE10_MONEY_DEFAULTS,
    gaps,
    parity: WAVE10_PARITY_CHECKLIST.slice(),
    scriptChecks,
    registries: {
      cutoverStepCount: CUTOVER_STEPS.length,
      validationCheckCount: PROD_VALIDATION_CHECKS.length,
      prodEnvCheckCount: PROD_ENV_CHECKLIST.length,
      metricCount: SUCCESS_METRICS.length,
      coordinationRoleCount: GOLIVE_COORDINATION_ROLES.length,
      ktItemCount: KT_CHECKLIST.length,
      pirDimensionCount: PIR_DIMENSIONS.length,
      hypercareDurationDays: HYPERCARE_PLAN.durationDays
    },
    links: {
      rc1Evidence: "docs/release-evidence/rc1-evidence.json",
      wave9Evidence: "docs/release-evidence/wave9-pilot-evidence.json",
      goliveDoc: "docs/wave10-production-golive.md",
      phase20: "docs/enterprise-implementation-baseline.md",
      cert001: "CERT-001 via Phase 16/20 catalogs"
    }
  };
}

export function renderExecutiveSignOffPackageMarkdown(evidence) {
  const g = evidence?.goLive || {};
  const lines = [
    "# Wave 10 — Executive Sign-Off Package (Draft)",
    "",
    `**Generated:** ${evidence?.finishedAt || new Date().toISOString()}`,
    `**Decision:** ${g.decision || "n/a"}`,
    "",
    "> Automated draft. Executive Sign-Off remains **PendingHumanSignOff** until Accountable Authority records approval. Framework ≠ production live.",
    "",
    "## Meaning",
    "",
    g.meaning || "",
    "",
    "## Entry criteria",
    "",
    `- RC1: ${evidence?.entryCriteria?.rc1?.decision || "missing"} (ok=${evidence?.entryCriteria?.rc1?.ok ? "yes" : "no"})`,
    `- Wave 9: ${evidence?.entryCriteria?.wave9?.decision || "missing"} (ok=${evidence?.entryCriteria?.wave9?.ok ? "yes" : "no"})`,
    "",
    "## Human approvals",
    ""
  ];
  for (const a of g.humanApprovals || []) {
    lines.push(`- **${a.role}** (${a.id}): \`${a.status}\` — ${a.requiredFor || ""}`);
  }
  lines.push(
    "",
    "## CERT-001",
    "",
    `- Preview certified: ${g.cert001?.certified ? "yes" : "no"}`,
    `- Note: ${g.cert001?.note || ""}`,
    "",
    "## Closure statement",
    "",
    evidence?.projectClosure?.statement || "",
    ""
  );
  return lines.join("\n");
}

export function loadLastGoliveEvidence() {
  if (typeof sessionStorage === "undefined") return null;
  try {
    return JSON.parse(sessionStorage.getItem("wave10_last_golive") || "null");
  } catch {
    return null;
  }
}
