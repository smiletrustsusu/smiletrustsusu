/**
 * Wave 9 — Pilot Deployment, UAT & Operational Readiness.
 * Browser-safe registries + Go/No-Go assessment. File I/O lives in
 * scripts/wave9-pilot-assess.js (Node only). Shared vanilla JS SPA —
 * no Next.js rewrite. Does not claim a live branch cutover.
 */

import { SUPER_ADMIN_FORBIDDEN } from "./rbac.js";

export const WAVE9_VERSION = "9.0.0-pilot-uat";
export const WAVE9_WAVE = "WAVE-09";

/** Catalog mapping: historical EIR name was Enterprise Features; user Wave 9 = Pilot/UAT/Ops */
export const WAVE9_CATALOG_ALIAS = Object.freeze({
  deliveryName: "Pilot Deployment, UAT & Operational Readiness",
  deliveryCode: "PILOT_UAT_OPS_READINESS",
  historicalEirName: "Enterprise Features",
  historicalEirCode: "ENTERPRISE_FEATURES",
  enterpriseFeaturesNote:
    "Notifications/monitoring/AI/BCDR catalogs remain Phase 12–18 SoT; Wave 9 executes pilot/UAT/ops readiness over Waves 1–8 + RC1",
  productionCertNote: "Full CERT-001 / live production promote remains WAVE-10"
});

export const WAVE9_MONEY_DEFAULTS = Object.freeze({
  interest: 15,
  collectionDays: 31,
  cashierLimitGhs: 1000,
  pesewas: true
});

export const WAVE9_GAP_CHECKLIST = Object.freeze([
  { id: "W9-G01", title: "Pilot environment checklist (isolated from prod)", status: "closed", severity: "critical" },
  { id: "W9-G02", title: "Participant groups + responsibilities", status: "closed", severity: "critical" },
  { id: "W9-G03", title: "Mandatory UAT scenario pack", status: "closed", severity: "critical" },
  { id: "W9-G04", title: "Operational readiness checks (Phase 18)", status: "closed", severity: "critical" },
  { id: "W9-G05", title: "Training tracks + competency templates", status: "closed", severity: "high" },
  { id: "W9-G06", title: "Feedback + issue registers", status: "closed", severity: "high" },
  { id: "W9-G07", title: "Go/No-Go evaluator with human sign-off gates", status: "closed", severity: "critical" },
  { id: "W9-G08", title: "RC1 PASS entry criterion linkage", status: "closed", severity: "critical" },
  { id: "W9-G09", title: "Pilot evidence JSON + validate:pilot", status: "closed", severity: "critical" },
  { id: "W9-G10", title: "Audit/Reports pilot panels", status: "closed", severity: "medium" },
  { id: "W9-G11", title: "docs/wave9-pilot-uat.md + training + go-nogo template", status: "closed", severity: "medium" },
  {
    id: "W9-G12",
    title: "Live pilot branch cutover / human business UAT sign-off",
    status: "deferred",
    severity: "critical",
    note: "Framework + synthetic run only; live branch execution and executive sign-off are human Wave 9/10 gates"
  },
  {
    id: "W9-G13",
    title: "Production financial reconciliation in live branch",
    status: "deferred",
    severity: "high",
    note: "Procedures + automated balance smoke only; no false prod reconciled claim"
  }
]);

export const WAVE9_PARITY_CHECKLIST = Object.freeze([
  { id: "W9-P01", title: "Same SPA entry (www/ after prepare:web)", channel: "Web↔EXE↔APK" },
  { id: "W9-P02", title: "RC1 PASS required before pilot assessment PASS path", channel: "Governance" },
  { id: "W9-P03", title: "Money: pesewas / 15 / 31 / 1000 preserved", channel: "Web↔EXE↔APK" },
  { id: "W9-P04", title: "AI advisory-only (no auto-approve)", channel: "Web↔EXE↔APK" },
  { id: "W9-P05", title: "No new top-level nav — Audit/Reports panels only", channel: "Web↔EXE↔APK" },
  { id: "W9-P06", title: "SUPER_ADMIN_FORBIDDEN retained", channel: "Web↔EXE↔APK" },
  { id: "W9-P07", title: "Framework ready ≠ live pilot executed", channel: "Governance" },
  { id: "W9-P08", title: "Executive Sponsor approval is PendingHumanSignOff until documented", channel: "Governance" }
]);

export const HUMAN_SIGNOFF_STATUS = Object.freeze({
  PENDING: "PendingHumanSignOff",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  WAIVED: "WaivedWithException"
});

export const ISSUE_SEVERITIES = Object.freeze([
  "Critical",
  "High",
  "Medium",
  "Low",
  "Enhancement"
]);

export const GO_NOGO_DECISIONS = Object.freeze([
  "Go",
  "No-Go",
  "Conditional",
  "ReadyForExecutiveReview"
]);

/* -------------------------------------------------------------------------- */
/* Pilot environment checklist                                                 */
/* -------------------------------------------------------------------------- */

export const PILOT_ENV_CHECKLIST = Object.freeze([
  {
    id: "PE-001",
    category: "tenant",
    title: "Dedicated pilot tenant provisioned",
    requirement: "Pilot tenant ID distinct from production; no shared write path to prod ledger",
    isolationFromProd: true,
    mandatory: true
  },
  {
    id: "PE-002",
    category: "region",
    title: "Pilot region / hosting slot confirmed",
    requirement: "UAT or pilot region (Phase 14 env catalog); not prod promote slot",
    isolationFromProd: true,
    mandatory: true
  },
  {
    id: "PE-003",
    category: "branch",
    title: "Pilot branch (synthetic or designated) scoped",
    requirement: "Single branch scope for pilot; tellers/devices mapped only to pilot branch",
    isolationFromProd: true,
    mandatory: true
  },
  {
    id: "PE-004",
    category: "users",
    title: "Pilot user accounts + RBAC roles seeded",
    requirement: "Role matrix covers cashier, collector, branch manager, auditor, admin; SUPER_ADMIN_FORBIDDEN enforced",
    isolationFromProd: true,
    mandatory: true
  },
  {
    id: "PE-005",
    category: "devices",
    title: "Pilot devices registered (Android + EXE + web)",
    requirement: "Device inventory tagged pilot; offline sync credentials scoped to pilot tenant",
    isolationFromProd: true,
    mandatory: true
  },
  {
    id: "PE-006",
    category: "data",
    title: "Pilot seed data / anonymized snapshot loaded",
    requirement: "No prod PII copy without approved masking; money units remain pesewas",
    isolationFromProd: true,
    mandatory: true
  },
  {
    id: "PE-007",
    category: "monitoring",
    title: "Pilot monitoring dashboards + alert routes",
    requirement: "Alerts route to pilot on-call channel (not prod page)",
    isolationFromProd: true,
    mandatory: true
  },
  {
    id: "PE-008",
    category: "backup",
    title: "Pilot backup schedule + restore drill slot",
    requirement: "Backup target isolated; Phase 15 RPO/RTO procedures applicable to pilot",
    isolationFromProd: true,
    mandatory: true
  },
  {
    id: "PE-009",
    category: "reporting",
    title: "Pilot report exports + audit trail sinks",
    requirement: "Reports labeled PILOT; exports do not overwrite prod report stores",
    isolationFromProd: true,
    mandatory: true
  },
  {
    id: "PE-010",
    category: "network",
    title: "Network / API endpoints point to pilot invokeApi",
    requirement: "Wave 3 invokeApi base URL / config.json pilot profile; no silent prod fallback",
    isolationFromProd: true,
    mandatory: true
  }
]);

/* -------------------------------------------------------------------------- */
/* Participant groups                                                          */
/* -------------------------------------------------------------------------- */

export const PILOT_PARTICIPANT_GROUPS = Object.freeze([
  {
    id: "PG-EXEC",
    name: "Executive Sponsor",
    responsibilities: [
      "Approve pilot charter and success criteria",
      "Chair Go/No-Go for Wave 10 entry (human sign-off)",
      "Escalate blocking business risks"
    ],
    humanSignOffRequired: true
  },
  {
    id: "PG-PO",
    name: "Product / Business Owner",
    responsibilities: [
      "Own UAT scenario acceptance for business flows",
      "Prioritize feedback/issues",
      "Confirm money policy invariants (15/31/1000)"
    ],
    humanSignOffRequired: true
  },
  {
    id: "PG-QA",
    name: "QA Lead",
    responsibilities: [
      "Coordinate UAT execution pack",
      "Track pass/fail/evidence",
      "Gate critical/high defects"
    ],
    humanSignOffRequired: true
  },
  {
    id: "PG-OPS",
    name: "Operations / Service Desk",
    responsibilities: [
      "Staff pilot service desk queue",
      "Execute runbooks and on-call rota",
      "Record incidents during pilot"
    ],
    humanSignOffRequired: false
  },
  {
    id: "PG-BRANCH",
    name: "Pilot Branch Staff (Cashier / Collector / Manager)",
    responsibilities: [
      "Execute role UAT scripts",
      "Validate offline/collection day workflows",
      "Provide day-in-life feedback"
    ],
    humanSignOffRequired: false
  },
  {
    id: "PG-SEC",
    name: "Security / Compliance",
    responsibilities: [
      "Validate RBAC / isolation / audit",
      "Review IR readiness",
      "Confirm AI remains advisory-only"
    ],
    humanSignOffRequired: true
  },
  {
    id: "PG-IT",
    name: "Platform / DevOps",
    responsibilities: [
      "Provision pilot env + monitoring + backup",
      "Run validate:rc / validate:pilot",
      "Support devices and sync"
    ],
    humanSignOffRequired: false
  },
  {
    id: "PG-TRAIN",
    name: "Training Lead",
    responsibilities: [
      "Deliver role curricula",
      "Record competency checklists",
      "Confirm hypercare training readiness"
    ],
    humanSignOffRequired: false
  }
]);

/* -------------------------------------------------------------------------- */
/* UAT scenarios                                                               */
/* -------------------------------------------------------------------------- */

function uatScenario({
  id,
  domain,
  title,
  mandatory = true,
  technicalSmoke = false,
  preconditions = [],
  steps = [],
  expected = [],
  wave8Proven = false
}) {
  return Object.freeze({
    id,
    domain,
    title,
    mandatory,
    technicalSmoke,
    wave8Proven,
    preconditions: Object.freeze([...preconditions]),
    steps: Object.freeze([...steps]),
    expected: Object.freeze([...expected]),
    // Result recording fields (filled in run records)
    resultTemplate: Object.freeze({
      actual: null,
      passFail: null,
      evidence: null,
      executedBy: null,
      executedAt: null,
      approver: null,
      approverStatus: HUMAN_SIGNOFF_STATUS.PENDING,
      notes: null
    })
  });
}

export const UAT_SCENARIOS = Object.freeze([
  uatScenario({
    id: "UAT-AUTH-01",
    domain: "auth",
    title: "Login, session timeout, and role-denied action",
    technicalSmoke: true,
    wave8Proven: true,
    preconditions: ["Pilot users seeded", "RBAC matrix loaded"],
    steps: ["Login as cashier", "Attempt System.Reset", "Wait for idle timeout / re-auth"],
    expected: ["Login succeeds", "System.Reset forbidden", "Session requires re-auth"]
  }),
  uatScenario({
    id: "UAT-AUTH-02",
    domain: "auth",
    title: "Multi-role switch and audit of privileged actions",
    preconditions: ["Auditor + admin pilot accounts"],
    steps: ["Login as auditor", "Open Audit panel", "Export audit sample"],
    expected: ["Access granted per RBAC", "Audit events recorded"]
  }),
  uatScenario({
    id: "UAT-CUST-01",
    domain: "customer",
    title: "Register customer and verify KYC fields",
    preconditions: ["Cashier or customer-officer role"],
    steps: ["Create customer", "Capture required ID fields", "Save and reopen"],
    expected: ["Customer persisted", "Validation errors block incomplete KYC"]
  }),
  uatScenario({
    id: "UAT-CUST-02",
    domain: "customer",
    title: "Search / update customer without corrupting balances",
    preconditions: ["Existing pilot customer with savings"],
    steps: ["Search by name/phone", "Update contact", "Confirm balances unchanged"],
    expected: ["Profile updated", "Ledger balances identical (pesewas)"]
  }),
  uatScenario({
    id: "UAT-SAVE-01",
    domain: "savings",
    title: "Open savings product and post contribution",
    preconditions: ["Savings product configured", "Customer enrolled"],
    steps: ["Open account", "Post contribution in pesewas", "View statement"],
    expected: ["Balance increases by posted pesewas", "Interest policy remains 15% default"]
  }),
  uatScenario({
    id: "UAT-COLL-01",
    domain: "collections",
    title: "Collector day cycle (31-day collection awareness)",
    preconditions: ["Collector route assigned", "Collection day calendar"],
    steps: ["Open collection sheet", "Record collections", "Submit day total"],
    expected: ["Day totals reconcile", "Collection cycle days = 31 invariant documented"]
  }),
  uatScenario({
    id: "UAT-COLL-02",
    domain: "collections",
    title: "Cashier float limit 1000 GHS enforced",
    preconditions: ["Cashier float tracking enabled"],
    steps: ["Attempt float breach above 1000", "Attempt allowed amount"],
    expected: ["Breach blocked or escalated", "Allowed post succeeds"]
  }),
  uatScenario({
    id: "UAT-TXN-01",
    domain: "deposits_withdrawals",
    title: "Deposit and withdrawal with receipt",
    preconditions: ["Active savings account"],
    steps: ["Deposit", "Withdraw within available balance", "Print/export receipt"],
    expected: ["Balances correct in pesewas", "Receipt references transaction ids"]
  }),
  uatScenario({
    id: "UAT-TXN-02",
    domain: "deposits_withdrawals",
    title: "Overdraft / insufficient funds blocked",
    preconditions: ["Known low-balance account"],
    steps: ["Attempt withdrawal exceeding balance"],
    expected: ["Transaction rejected", "No partial ledger corruption"]
  }),
  uatScenario({
    id: "UAT-LOAN-01",
    domain: "loans",
    title: "Loan application advisory AI does not auto-approve",
    preconditions: ["Loan product available", "AI advisory module present"],
    steps: ["Create loan application", "Request AI advisory", "Attempt approve without human"],
    expected: ["Advisory recommendation shown", "No autonomous approve", "Human approval path required"]
  }),
  uatScenario({
    id: "UAT-LOAN-02",
    domain: "loans",
    title: "Loan disbursement and repayment schedule",
    preconditions: ["Approved loan application"],
    steps: ["Disburse", "View schedule", "Post one repayment"],
    expected: ["Schedule generated", "Repayment reduces outstanding correctly"]
  }),
  uatScenario({
    id: "UAT-EOD-01",
    domain: "eod",
    title: "End-of-day close and till reconciliation procedure",
    preconditions: ["Day transactions posted", "Cashier till open"],
    steps: ["Run EOD checklist", "Compare till vs system", "Close day"],
    expected: ["EOD status recorded", "Variance procedure available if mismatch"]
  }),
  uatScenario({
    id: "UAT-RPT-01",
    domain: "reports",
    title: "Operational reports export (CSV/JSON)",
    technicalSmoke: true,
    wave8Proven: true,
    preconditions: ["Reports.View permission"],
    steps: ["Open Reports", "Export collections / savings summary"],
    expected: ["Export succeeds", "PILOT label or tenant id present in metadata when configured"]
  }),
  uatScenario({
    id: "UAT-DASH-01",
    domain: "dashboards",
    title: "Wave 7 analytics KPI dashboard loads",
    technicalSmoke: true,
    wave8Proven: true,
    preconditions: ["Analytics panel access"],
    steps: ["Open Audit/Reports analytics", "Verify KPI tiles"],
    expected: ["KPIs render", "No posting side effects"]
  }),
  uatScenario({
    id: "UAT-AUD-01",
    domain: "audit",
    title: "Audit trail for money-moving action",
    preconditions: ["Recent deposit posted"],
    steps: ["Locate audit events for transaction", "Verify actor + amount"],
    expected: ["Immutable audit row", "Amount in pesewas"]
  }),
  uatScenario({
    id: "UAT-NOTIF-01",
    domain: "notifications",
    title: "Notification / alert delivery smoke for pilot channel",
    preconditions: ["Pilot alert route configured"],
    steps: ["Trigger test alert", "Confirm receipt on pilot channel"],
    expected: ["Alert received", "Not routed to production on-call"]
  }),
  uatScenario({
    id: "UAT-OFF-01",
    domain: "offline",
    title: "Offline capture on Android / Capacitor path",
    technicalSmoke: true,
    wave8Proven: true,
    preconditions: ["Wave 4 sync engine", "Device offline"],
    steps: ["Capture collection offline", "Queue visible", "Reconnect"],
    expected: ["Queue retained", "No financial LWW corruption on sync"]
  }),
  uatScenario({
    id: "UAT-SYNC-01",
    domain: "sync",
    title: "Sync conflict / retry / recovery",
    technicalSmoke: true,
    wave8Proven: true,
    preconditions: ["Offline queue with pending items"],
    steps: ["Force sync", "Simulate retry", "Confirm recovery runbook path"],
    expected: ["Sync completes or escalates per Phase 18", "Balances consistent"]
  }),
  uatScenario({
    id: "UAT-ADM-01",
    domain: "admin",
    title: "Admin portal search + ops monitoring (Wave 5)",
    technicalSmoke: true,
    wave8Proven: true,
    preconditions: ["Admin role"],
    steps: ["Global search", "Open ops monitoring under Audit/Reports"],
    expected: ["Search returns scoped results", "No new top-level nav required"]
  }),
  uatScenario({
    id: "UAT-ADM-02",
    domain: "admin",
    title: "RC1 / Wave 8 certification panel visible",
    technicalSmoke: true,
    wave8Proven: true,
    preconditions: ["Audit.View or Reports.View"],
    steps: ["Open Release Certification panel", "Confirm last RC decision surface"],
    expected: ["Panel renders", "RC1 PASS visible when evidence loaded"]
  }),
  uatScenario({
    id: "UAT-RECON-01",
    domain: "eod",
    title: "Financial reconciliation procedure (pilot) — no false prod claim",
    mandatory: true,
    technicalSmoke: false,
    wave8Proven: false,
    preconditions: ["EOD closed", "Pilot ledger export available"],
    steps: [
      "Export trial balance / account balances",
      "Compare to till + collection sheets",
      "Document variances",
      "Record sign-off status as PendingHumanSignOff until business owner approves"
    ],
    expected: [
      "Reconciliation worksheet completed",
      "Status is procedure-validated or PendingHumanSignOff — never auto-claimed as production reconciled"
    ]
  })
]);

export const UAT_DOMAINS = Object.freeze([
  "auth",
  "customer",
  "savings",
  "collections",
  "deposits_withdrawals",
  "loans",
  "eod",
  "reports",
  "dashboards",
  "audit",
  "notifications",
  "offline",
  "sync",
  "admin"
]);

/* -------------------------------------------------------------------------- */
/* Operational readiness                                                       */
/* -------------------------------------------------------------------------- */

export const OPS_READINESS_CHECKS = Object.freeze([
  {
    id: "OR-001",
    category: "service_desk",
    title: "Service desk queues + SLAs for pilot",
    phaseRef: "Phase 18",
    rdyRef: "RDY-011",
    mandatory: true
  },
  {
    id: "OR-002",
    category: "runbooks",
    title: "Incident / offline / sync runbooks published",
    phaseRef: "Phase 18",
    rdyRef: "RDY-009",
    mandatory: true
  },
  {
    id: "OR-003",
    category: "monitoring",
    title: "Monitoring health + alert routes (pilot)",
    phaseRef: "Phase 13/18",
    rdyRef: "RDY-008",
    mandatory: true
  },
  {
    id: "OR-004",
    category: "backup",
    title: "Backup schedule + restore verification slot",
    phaseRef: "Phase 15",
    rdyRef: "RDY-006",
    mandatory: true
  },
  {
    id: "OR-005",
    category: "dr",
    title: "DR procedure awareness (framework; live drill Wave 10)",
    phaseRef: "Phase 15",
    rdyRef: "RDY-007",
    mandatory: true
  },
  {
    id: "OR-006",
    category: "incident_response",
    title: "IR / major incident bridge contacts",
    phaseRef: "Phase 18",
    rdyRef: "RDY-010",
    mandatory: true
  },
  {
    id: "OR-007",
    category: "escalation",
    title: "Escalation matrix + sync escalation authority",
    phaseRef: "Phase 18",
    rdyRef: "RDY-010",
    mandatory: true
  },
  {
    id: "OR-008",
    category: "knowledge_base",
    title: "KB articles linked to runbooks",
    phaseRef: "Phase 18",
    rdyRef: "RDY-009",
    mandatory: true
  },
  {
    id: "OR-009",
    category: "on_call",
    title: "Primary + secondary on-call for pilot window",
    phaseRef: "Phase 18",
    rdyRef: "RDY-010",
    mandatory: true
  },
  {
    id: "OR-010",
    category: "hypercare_staffing",
    title: "Hypercare staffing plan draft for Wave 10",
    phaseRef: "Phase 20",
    rdyRef: "RDY-020",
    mandatory: false
  }
]);

/* -------------------------------------------------------------------------- */
/* Training tracks                                                             */
/* -------------------------------------------------------------------------- */

export const TRAINING_TRACKS = Object.freeze([
  {
    id: "TR-CASHIER",
    role: "Cashier",
    durationHours: 4,
    modules: [
      "Login & till open/close",
      "Deposits/withdrawals (pesewas)",
      "Float limit 1000",
      "Receipts & exceptions"
    ],
    exercises: [
      "Post 5 deposits and 2 withdrawals",
      "Attempt float breach and document outcome",
      "Complete EOD till worksheet"
    ],
    competencyChecklist: [
      "Can post without balance errors",
      "Understands float limit",
      "Can escalate variance"
    ]
  },
  {
    id: "TR-COLLECTOR",
    role: "Collector",
    durationHours: 4,
    modules: [
      "Route sheet",
      "Offline capture",
      "Sync & retry",
      "Collection day (31) awareness"
    ],
    exercises: [
      "Capture offline collections then sync",
      "Handle one sync retry",
      "Submit day total"
    ],
    competencyChecklist: [
      "Can work offline safely",
      "Recognizes sync escalation",
      "Day totals reconcile"
    ]
  },
  {
    id: "TR-MANAGER",
    role: "Branch Manager",
    durationHours: 3,
    modules: [
      "Approvals",
      "EOD oversight",
      "Reports & dashboards",
      "Exception handling"
    ],
    exercises: [
      "Approve a loan path with human decision",
      "Review EOD variances",
      "Export daily report"
    ],
    competencyChecklist: [
      "Does not rely on AI auto-approve",
      "Can interpret daily reports",
      "Knows escalation contacts"
    ]
  },
  {
    id: "TR-AUDITOR",
    role: "Auditor / Compliance",
    durationHours: 3,
    modules: [
      "Audit search",
      "RBAC verification",
      "Wave 8/9 evidence panels",
      "Reconciliation procedures"
    ],
    exercises: [
      "Trace one money event in audit",
      "Confirm SUPER_ADMIN_FORBIDDEN sample",
      "Complete recon worksheet template"
    ],
    competencyChecklist: [
      "Can locate audit evidence",
      "Understands PendingHumanSignOff",
      "Does not claim false prod recon"
    ]
  },
  {
    id: "TR-ADMIN",
    role: "Platform Admin / Ops",
    durationHours: 5,
    modules: [
      "Pilot env isolation",
      "Monitoring & alerts",
      "Backup/restore drill slot",
      "validate:rc / validate:pilot",
      "Service desk + runbooks"
    ],
    exercises: [
      "Run validate:pilot and interpret Go/No-Go",
      "Page pilot on-call with test alert",
      "Walk one offline runbook"
    ],
    competencyChecklist: [
      "Can provision pilot isolation checks",
      "Can interpret evidence JSON",
      "Knows Wave 10 human gates"
    ]
  },
  {
    id: "TR-EXEC",
    role: "Executive Sponsor (briefing)",
    durationHours: 1.5,
    modules: [
      "Pilot vs production distinction",
      "Go/No-Go dimensions",
      "Human approval gates for Wave 10",
      "Success criteria overview"
    ],
    exercises: [
      "Review Go/No-Go draft report",
      "List open conditions",
      "Confirm PendingHumanSignOff understanding"
    ],
    competencyChecklist: [
      "Will not treat Conditional as full Go",
      "Understands RC1 ≠ CERT-001",
      "Owns executive sign-off gate"
    ]
  }
]);

/* -------------------------------------------------------------------------- */
/* Financial reconciliation checklist (HG-03 / HA-RECON / HA-FIN)              */
/* -------------------------------------------------------------------------- */

export const RECON_CHECKLIST = Object.freeze([
  {
    id: "RC-CASHBOOK-01",
    category: "cashbook",
    title: "Cashbook vs system cash postings",
    steps: [
      "Export day's cash receipts/payments from system (pesewas)",
      "Compare to physical cashbook / till worksheet totals",
      "Record variance in pesewas and GHS display"
    ],
    expected: ["Cashbook and system cash agree or variance is documented"]
  },
  {
    id: "RC-COLL-01",
    category: "collections",
    title: "Collections sheets vs posted collections",
    steps: [
      "Sum collector route sheets for the day",
      "Compare to posted collection totals in system",
      "Confirm collection-day cycle awareness (31 days)"
    ],
    expected: ["Sheet totals match posted collections or variance documented"]
  },
  {
    id: "RC-BAL-01",
    category: "balances",
    title: "Customer balances vs ledger sum",
    steps: [
      "Export customer savings balances (pesewas SoT)",
      "Compare sample and control-total sum to trial/ledger",
      "Spot-check dual GHS display equals pesewas/100"
    ],
    expected: ["Control totals agree; dual money columns consistent"]
  },
  {
    id: "RC-VAULT-01",
    category: "vault",
    title: "Vault float physical vs system",
    steps: [
      "Count vault cash physically",
      "Compare to vault float balance in system",
      "Document any difference before EOD close"
    ],
    expected: ["Vault physical equals system or variance escalated"]
  },
  {
    id: "RC-TELLER-01",
    category: "teller",
    title: "Teller / cashier floats (limit 1000 GHS)",
    steps: [
      "List each teller/cashier float balance",
      "Confirm no open float above 1000 GHS (100000 pesewas) without escalation",
      "Reconcile till cash to system float"
    ],
    expected: ["Floats within policy; limit 1000 enforced or escalated"]
  },
  {
    id: "RC-EOD-01",
    category: "eod",
    title: "EOD close and day totals",
    steps: [
      "Run EOD checklist after cashbook/collections/floats agree",
      "Capture day totals and close status",
      "Attach EOD evidence path or screenshot id"
    ],
    expected: ["EOD closed with recon worksheet attached"]
  },
  {
    id: "RC-POLICY-01",
    category: "policy",
    title: "Money policy invariants (15 / 31 / pesewas)",
    steps: [
      "Confirm default interest policy remains 15",
      "Confirm collection days remain 31",
      "Confirm amounts stored/compared in integer pesewas"
    ],
    expected: ["interest=15, collectionDays=31, pesewas authoritative"]
  },
  {
    id: "RC-VAR-01",
    category: "variances",
    title: "Variances documented and escalated",
    steps: [
      "List every non-zero variance with pesewas + GHS",
      "Assign owner and next action",
      "Do not claim productionReconciled while variances are open"
    ],
    expected: ["Variance register complete; no silent write-offs"]
  }
]);

/* -------------------------------------------------------------------------- */
/* Security acceptance checklist (HG-04 / HA-SEC)                              */
/* -------------------------------------------------------------------------- */

export const SECURITY_CHECKLIST = Object.freeze([
  {
    id: "SEC-AUTH-01",
    category: "auth",
    title: "Authentication controls (login / credential handling)",
    steps: [
      "Attempt valid login on pilot/local for a non-developer role",
      "Attempt invalid password and confirm denial without leaking account existence",
      "Confirm logout clears session and requires re-auth for protected views"
    ],
    expected: ["Valid login succeeds; invalid denied; logout requires re-auth"]
  },
  {
    id: "SEC-RBAC-01",
    category: "rbac",
    title: "RBAC — role permissions and SUPER_ADMIN_FORBIDDEN",
    steps: [
      "Log in as a restricted role (e.g. Cashier) and attempt Admin-only actions",
      "Confirm denied actions are blocked in UI and cannot be forced via deep links",
      "Confirm SUPER_ADMIN_FORBIDDEN includes System.Reset and other forbidden ops"
    ],
    expected: ["Least-privilege holds; SUPER_ADMIN_FORBIDDEN enforced"]
  },
  {
    id: "SEC-TENANT-01",
    category: "isolation",
    title: "Tenant / branch isolation",
    steps: [
      "As a branch-scoped user, open customers/collections for own branch",
      "Attempt to access another branch / tenant id via UI or URL params (pilot only)",
      "Confirm cross-tenant/branch data is not returned"
    ],
    expected: ["Users only see their tenant/branch scope"]
  },
  {
    id: "SEC-JOHN-KBA-01",
    category: "isolation",
    title: "JOHN cannot see or manage KBA (owner/developer isolation)",
    steps: [
      "Log in as JOHN (System Owner)",
      "Open user administration / account pickers used for staff management",
      "Confirm KBA (system developer) does not appear and cannot be managed"
    ],
    expected: ["JOHN never sees KBA; developer account remains isolated"]
  },
  {
    id: "SEC-SESSION-01",
    category: "session",
    title: "Session handling (timeout / revoke / concurrent use)",
    steps: [
      "Confirm idle or explicit logout ends access to Audit/Reports and money screens",
      "If device/session revoke is available in pilot, revoke a test session and confirm lockout",
      "Confirm re-login required after revoke"
    ],
    expected: ["Sessions end cleanly; revoke (if present) locks the device/session"]
  },
  {
    id: "SEC-AUDIT-01",
    category: "audit",
    title: "Audit logging of sensitive actions",
    steps: [
      "Perform a sensitive action (login failure, permission denial, or money post on pilot)",
      "Open Audit view and locate a corresponding audit/event record",
      "Confirm actor, action, and timestamp are present without secret material (passwords)"
    ],
    expected: ["Sensitive actions produce audit evidence without leaking secrets"]
  },
  {
    id: "SEC-ENCRYPT-01",
    category: "encryption",
    title: "Encryption / offline queue protection",
    steps: [
      "Capture a sample offline queue / sync payload path on pilot/local (no production)",
      "Confirm sensitive fields are not stored in cleartext where encryption is expected",
      "Confirm queue sync does not expose other tenants' data"
    ],
    expected: ["Offline queue respects encryption/isolation expectations for pilot"]
  },
  {
    id: "SEC-ISSUES-01",
    category: "issues",
    title: "No Critical/High unresolved for pilot (audit perspective)",
    steps: [
      "Review Wave 9 issue register / security findings for NORTHRISE MICRO SAVINGS pilot",
      "Confirm no open Critical or High security findings remain unresolved for pilot go",
      "Document any waived Medium/Low items with owner and date"
    ],
    expected: ["Zero open Critical/High security findings for pilot acceptance"]
  },
  {
    id: "SEC-RLS-01",
    category: "rls",
    title: "RLS notes for pilot environment (not prod migrate)",
    steps: [
      "Confirm this check runs against pilot/local only — do not apply production migrations",
      "Review RLS / row-scope notes for the pilot Supabase (or local) env used by Wave 9",
      "Record that production RLS/migrations remain out of scope and untouched"
    ],
    expected: [
      "Pilot RLS posture documented; no production migrations applied from this gate"
    ]
  }
]);

/* -------------------------------------------------------------------------- */
/* Go-live readiness dimensions                                                */
/* -------------------------------------------------------------------------- */

export const GO_LIVE_DIMENSIONS = Object.freeze([
  {
    id: "GL-RC1",
    title: "RC1 release certification",
    weight: "critical",
    humanSignOff: false,
    description: "Wave 8 RC1 evidence decision PASS"
  },
  {
    id: "GL-ENV",
    title: "Pilot environment isolation",
    weight: "critical",
    humanSignOff: false,
    description: "All mandatory PE-* isolation flags true"
  },
  {
    id: "GL-UAT",
    title: "UAT pack completeness",
    weight: "critical",
    humanSignOff: true,
    description: "Mandatory scenarios executable; business sign-off PendingHumanSignOff until humans approve"
  },
  {
    id: "GL-OPS",
    title: "Operational readiness",
    weight: "critical",
    humanSignOff: false,
    description: "Mandatory OR-* checks present / framework ready"
  },
  {
    id: "GL-TRAIN",
    title: "Training package",
    weight: "high",
    humanSignOff: true,
    description: "Tracks defined; completion recording PendingHumanSignOff"
  },
  {
    id: "GL-ISSUES",
    title: "Open critical issues",
    weight: "critical",
    humanSignOff: false,
    description: "No open Critical issues in pilot issue register"
  },
  {
    id: "GL-RECON",
    title: "Financial reconciliation procedure",
    weight: "critical",
    humanSignOff: true,
    description: "Procedure present; live recon remains human"
  },
  {
    id: "GL-EXEC",
    title: "Executive Sponsor approval",
    weight: "critical",
    humanSignOff: true,
    description: "Always PendingHumanSignOff until documented approval — never auto-faked"
  },
  {
    id: "GL-SEC",
    title: "Security / compliance acceptance",
    weight: "high",
    humanSignOff: true,
    description: "RBAC, isolation, AI advisory-only confirmed"
  },
  {
    id: "GL-W10",
    title: "Wave 10 entry readiness",
    weight: "high",
    humanSignOff: true,
    description: "Conditional OK with listed conditions; full Go requires human gates"
  }
]);

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

export function listMandatoryUatScenarios() {
  return UAT_SCENARIOS.filter((s) => s.mandatory);
}

export function listUatDomainsCovered() {
  return [...new Set(UAT_SCENARIOS.map((s) => s.domain))].sort();
}

export function assertUatDomainCoverage() {
  const covered = new Set(listUatDomainsCovered());
  const missing = UAT_DOMAINS.filter((d) => !covered.has(d));
  return { ok: missing.length === 0, missing, covered: [...covered] };
}

export function createEmptyResult(scenario) {
  return {
    scenarioId: scenario.id,
    domain: scenario.domain,
    title: scenario.title,
    mandatory: scenario.mandatory,
    technicalSmoke: scenario.technicalSmoke,
    ...scenario.resultTemplate,
    executable: true,
    status: "ReadyToExecute"
  };
}

/**
 * Seed a synthetic pilot run: marks scenarios executable; auto-passes
 * technical smoke items Wave 8 already proved; leaves business sign-off pending.
 */
export function seedSyntheticPilotRun({
  runId = "PILOT-SYNTH-001",
  startedAt = new Date().toISOString(),
  note = "Synthetic framework run — not a live branch cutover"
} = {}) {
  const scenarioResults = UAT_SCENARIOS.map((scenario) => {
    const base = createEmptyResult(scenario);
    if (scenario.technicalSmoke && scenario.wave8Proven) {
      return {
        ...base,
        actual: "Wave 8 / RC1 technical smoke already proved artifact presence and invariants",
        passFail: "pass",
        evidence: "docs/release-evidence/rc1-evidence.json",
        executedBy: "wave9-synthetic-seeder",
        executedAt: startedAt,
        approver: null,
        approverStatus: HUMAN_SIGNOFF_STATUS.PENDING,
        notes: "Technical auto-pass only; business UAT sign-off still required",
        status: "TechnicalPassPendingBusinessSignOff"
      };
    }
    return {
      ...base,
      actual: null,
      passFail: null,
      evidence: null,
      notes: "Awaiting human pilot execution",
      status: "ReadyToExecute"
    };
  });

  const envResults = PILOT_ENV_CHECKLIST.map((item) => ({
    id: item.id,
    category: item.category,
    title: item.title,
    isolationFromProd: item.isolationFromProd,
    mandatory: item.mandatory,
    status: "FrameworkReady",
    checked: true,
    evidence: "Pilot isolation checklist documented in docs/wave9-pilot-uat.md",
    note: "Checklist present for operators; live env confirmation is human"
  }));

  const opsResults = OPS_READINESS_CHECKS.map((item) => ({
    id: item.id,
    category: item.category,
    title: item.title,
    mandatory: item.mandatory,
    phaseRef: item.phaseRef,
    rdyRef: item.rdyRef,
    status: "FrameworkReady",
    checked: true,
    evidence: "Phase 18 / Phase 20 catalogs + wave9 ops registry"
  }));

  const trainingResults = TRAINING_TRACKS.map((track) => ({
    trackId: track.id,
    role: track.role,
    completionStatus: HUMAN_SIGNOFF_STATUS.PENDING,
    completedAt: null,
    completedBy: null,
    competencyPassed: null,
    notes: "Curriculum defined; attendance/competency recording is human"
  }));

  const feedbackRegister = [
    {
      id: "FB-0001",
      source: "synthetic",
      severity: "Enhancement",
      title: "Add printable pilot attendance sheet",
      status: "open",
      createdAt: startedAt
    }
  ];

  const issueRegister = [
    {
      id: "ISS-0001",
      severity: "Enhancement",
      title: "Live branch UAT not yet executed",
      status: "open",
      blocking: false,
      createdAt: startedAt,
      note: "Expected — framework delivery only"
    }
  ];

  const humanApprovals = [
    {
      id: "HA-EXEC",
      role: "Executive Sponsor",
      status: HUMAN_SIGNOFF_STATUS.PENDING,
      requiredFor: "Full Go / Wave 10 production entry"
    },
    {
      id: "HA-PO",
      role: "Product / Business Owner",
      status: HUMAN_SIGNOFF_STATUS.PENDING,
      requiredFor: "Business UAT acceptance"
    },
    {
      id: "HA-QA",
      role: "QA Lead",
      status: HUMAN_SIGNOFF_STATUS.PENDING,
      requiredFor: "UAT pack sign-off"
    },
    {
      id: "HA-SEC",
      role: "Security / Compliance",
      status: HUMAN_SIGNOFF_STATUS.PENDING,
      requiredFor: "Security acceptance"
    },
    {
      id: "HA-RECON",
      role: "Finance / Branch Manager",
      status: HUMAN_SIGNOFF_STATUS.PENDING,
      requiredFor: "Financial reconciliation acceptance"
    }
  ];

  return {
    runId,
    kind: "synthetic",
    liveBranchCutover: false,
    frameworkReady: true,
    livePilotExecuted: false,
    startedAt,
    note,
    scenarioResults,
    envResults,
    opsResults,
    trainingResults,
    feedbackRegister,
    issueRegister,
    humanApprovals,
    moneyDefaults: WAVE9_MONEY_DEFAULTS
  };
}

export function loadRc1EntryCriterion(rc1Evidence) {
  if (!rc1Evidence || typeof rc1Evidence !== "object") {
    return {
      ok: false,
      decision: null,
      readyForWave9: false,
      reason: "rc1_evidence_missing"
    };
  }
  const decision = String(rc1Evidence.decision || "").toUpperCase();
  const ready = Boolean(rc1Evidence.readyForWave9) || decision === "PASS";
  const ok = decision === "PASS" && ready;
  return {
    ok,
    decision,
    readyForWave9: ready,
    reason: ok ? null : "rc1_not_pass",
    certificationScope: rc1Evidence.certificationScope || null,
    notProductionCert001: rc1Evidence.notProductionCert001 !== false
  };
}

export function scoreOpsReadiness(opsResults = []) {
  const mandatory = OPS_READINESS_CHECKS.filter((c) => c.mandatory);
  const byId = new Map((opsResults || []).map((r) => [r.id, r]));
  const passed = mandatory.filter((c) => {
    const row = byId.get(c.id);
    return row && (row.checked || row.status === "FrameworkReady" || row.status === "Pass");
  });
  const score =
    mandatory.length === 0 ? 100 : Math.round((passed.length / mandatory.length) * 10000) / 100;
  return {
    mandatoryTotal: mandatory.length,
    mandatoryReady: passed.length,
    score,
    ok: passed.length === mandatory.length
  };
}

export function scoreUatPack(scenarioResults = []) {
  const mandatory = listMandatoryUatScenarios();
  const byId = new Map((scenarioResults || []).map((r) => [r.scenarioId || r.id, r]));
  const executable = mandatory.filter((s) => {
    const row = byId.get(s.id);
    return row && row.executable !== false;
  });
  const technicalPassed = mandatory.filter((s) => {
    const row = byId.get(s.id);
    return row && (row.passFail === "pass" || row.status === "TechnicalPassPendingBusinessSignOff");
  });
  const businessSigned = mandatory.filter((s) => {
    const row = byId.get(s.id);
    return row && row.approverStatus === HUMAN_SIGNOFF_STATUS.APPROVED;
  });
  return {
    mandatoryTotal: mandatory.length,
    executableCount: executable.length,
    technicalPassedCount: technicalPassed.length,
    businessSignedCount: businessSigned.length,
    packComplete: executable.length === mandatory.length,
    businessAcceptanceComplete: businessSigned.length === mandatory.length
  };
}

export function countOpenIssues(issueRegister = [], severity = "Critical") {
  return (issueRegister || []).filter(
    (i) => i.status === "open" && String(i.severity) === severity
  ).length;
}

/**
 * evaluateGoNoGo — produces Go / No-Go / Conditional / ReadyForExecutiveReview.
 * Never fabricates Executive Sponsor approval.
 */
export function evaluateGoNoGo({
  rc1Evidence = null,
  pilotRun = null,
  forceExecutiveApproved = false
} = {}) {
  const reasons = [];
  const conditions = [];
  const dimensions = [];

  const rc1 = loadRc1EntryCriterion(rc1Evidence);
  dimensions.push({
    id: "GL-RC1",
    pass: rc1.ok,
    detail: rc1.ok ? `RC1 ${rc1.decision}` : rc1.reason
  });
  if (!rc1.ok) reasons.push("rc1_entry_criterion_failed");

  const run = pilotRun || seedSyntheticPilotRun();
  const envMandatory = PILOT_ENV_CHECKLIST.filter((e) => e.mandatory);
  const envReady =
    (run.envResults || []).filter((e) => {
      const def = envMandatory.find((d) => d.id === e.id);
      return def && e.checked && e.isolationFromProd;
    }).length === envMandatory.length;
  dimensions.push({
    id: "GL-ENV",
    pass: envReady,
    detail: envReady ? "Pilot isolation checklist ready" : "Pilot environment isolation incomplete"
  });
  if (!envReady) reasons.push("pilot_env_isolation_incomplete");

  const uat = scoreUatPack(run.scenarioResults);
  dimensions.push({
    id: "GL-UAT",
    pass: uat.packComplete,
    detail: `executable ${uat.executableCount}/${uat.mandatoryTotal}; business signed ${uat.businessSignedCount}/${uat.mandatoryTotal}`
  });
  if (!uat.packComplete) reasons.push("uat_pack_incomplete");
  if (!uat.businessAcceptanceComplete) {
    conditions.push("business_uat_signoff_pending");
  }

  const ops = scoreOpsReadiness(run.opsResults);
  dimensions.push({
    id: "GL-OPS",
    pass: ops.ok,
    detail: `ops readiness ${ops.score}% (${ops.mandatoryReady}/${ops.mandatoryTotal})`
  });
  if (!ops.ok) reasons.push("ops_readiness_incomplete");

  const trainingDefined = (run.trainingResults || []).length === TRAINING_TRACKS.length;
  const trainingAllComplete =
    trainingDefined &&
    (run.trainingResults || []).every(
      (t) =>
        t.completionStatus === HUMAN_SIGNOFF_STATUS.APPROVED &&
        Boolean(String(t.completedBy || "").trim())
    );
  const trainingPending = !trainingAllComplete;
  dimensions.push({
    id: "GL-TRAIN",
    pass: trainingDefined,
    detail: trainingDefined
      ? trainingPending
        ? "Training curricula ready; completion PendingHumanSignOff"
        : "Training completion recorded with named completers"
      : "Training tracks missing"
  });
  if (!trainingDefined) reasons.push("training_package_incomplete");
  else if (trainingPending) conditions.push("training_completion_pending");

  const openCritical = countOpenIssues(run.issueRegister, "Critical");
  dimensions.push({
    id: "GL-ISSUES",
    pass: openCritical === 0,
    detail: `open Critical=${openCritical}`
  });
  if (openCritical > 0) reasons.push("open_critical_issues");

  dimensions.push({
    id: "GL-RECON",
    pass: true,
    detail: "Reconciliation procedure present; live recon PendingHumanSignOff"
  });
  conditions.push("financial_reconciliation_human_signoff_pending");

  const humanApprovals = run.humanApprovals || [];
  const exec = humanApprovals.find((a) => a.id === "HA-EXEC") || {
    status: HUMAN_SIGNOFF_STATUS.PENDING
  };
  // Never fabricate Executive Sponsor approval. forceExecutiveApproved is ignored unless
  // the approval object itself carries Approved (tests may set that explicitly).
  void forceExecutiveApproved;
  const execStatus =
    exec.status === HUMAN_SIGNOFF_STATUS.APPROVED
      ? HUMAN_SIGNOFF_STATUS.APPROVED
      : HUMAN_SIGNOFF_STATUS.PENDING;
  dimensions.push({
    id: "GL-EXEC",
    pass: execStatus === HUMAN_SIGNOFF_STATUS.APPROVED,
    detail: `Executive Sponsor: ${execStatus}`
  });
  if (execStatus !== HUMAN_SIGNOFF_STATUS.APPROVED) {
    conditions.push("executive_sponsor_pending_human_signoff");
  }

  const sec = humanApprovals.find((a) => a.id === "HA-SEC");
  dimensions.push({
    id: "GL-SEC",
    pass: sec?.status === HUMAN_SIGNOFF_STATUS.APPROVED,
    detail: `Security: ${sec?.status || HUMAN_SIGNOFF_STATUS.PENDING}`
  });
  if (sec?.status !== HUMAN_SIGNOFF_STATUS.APPROVED) {
    conditions.push("security_acceptance_pending");
  }

  const domainCoverage = assertUatDomainCoverage();
  if (!domainCoverage.ok) reasons.push("uat_domain_coverage_gap");

  const isolationFlagsOk = PILOT_ENV_CHECKLIST.every((e) => e.isolationFromProd === true);
  if (!isolationFlagsOk) reasons.push("isolation_flags_invalid");

  // Decision tree
  let decision = "Go";
  let readyForWave10 = "yes";

  if (reasons.length > 0) {
    decision = "No-Go";
    readyForWave10 = "no";
  } else if (conditions.length > 0) {
    // Technical/UAT pack complete but human gates remain → Conditional (Ready for Executive Review)
    decision = "Conditional";
    readyForWave10 = "conditional";
    dimensions.push({
      id: "GL-W10",
      pass: false,
      detail: "Ready for Executive Review — Wave 10 entry only with listed conditions + human approvals"
    });
  } else {
    dimensions.push({
      id: "GL-W10",
      pass: true,
      detail: "All automated + human gates satisfied"
    });
  }

  return {
    decision,
    recommendation: decision,
    readyForWave10,
    frameworkReady: Boolean(run.frameworkReady !== false),
    livePilotExecuted: Boolean(run.livePilotExecuted),
    liveBranchCutover: Boolean(run.liveBranchCutover),
    reasons,
    conditions,
    dimensions,
    rc1,
    uat,
    ops,
    openCritical,
    humanApprovals: humanApprovals.map((a) => ({
      id: a.id,
      role: a.role,
      status: a.status === HUMAN_SIGNOFF_STATUS.APPROVED ? a.status : HUMAN_SIGNOFF_STATUS.PENDING,
      requiredFor: a.requiredFor
    })),
    meaning: explainDecision(decision, reasons, conditions),
    moneyDefaults: WAVE9_MONEY_DEFAULTS,
    forbiddenSample: SUPER_ADMIN_FORBIDDEN.slice(0, 3)
  };
}

function explainDecision(decision, reasons, conditions) {
  if (decision === "Go") {
    return "All automated gates and recorded human approvals are complete. Production promote still follows Wave 10 CERT-001.";
  }
  if (decision === "No-Go") {
    return `Mandatory gaps block pilot readiness: ${reasons.join(", ") || "see reasons"}.`;
  }
  return `Pilot/UAT framework is ready for executive review. Conditions remaining: ${conditions.join(", ")}. Not a live branch cutover; Executive Sponsor remains ${HUMAN_SIGNOFF_STATUS.PENDING}.`;
}

export function analyzeWave9Gaps() {
  const items = WAVE9_GAP_CHECKLIST.map((g) => ({ ...g }));
  const openCritical = items.filter((g) => g.severity === "critical" && g.status !== "closed" && g.status !== "deferred");
  return {
    wave: WAVE9_WAVE,
    version: WAVE9_VERSION,
    architecture: "shared-spa-pilot-uat-ops",
    notNextJsRewrite: true,
    catalogAlias: WAVE9_CATALOG_ALIAS,
    items,
    closedCount: items.filter((g) => g.status === "closed").length,
    deferredCount: items.filter((g) => g.status === "deferred").length,
    openCritical: openCritical.length,
    frameworkReady: openCritical.length === 0,
    moneyDefaults: WAVE9_MONEY_DEFAULTS,
    parity: WAVE9_PARITY_CHECKLIST.slice(),
    counts: {
      uatScenarios: UAT_SCENARIOS.length,
      mandatoryUat: listMandatoryUatScenarios().length,
      opsChecks: OPS_READINESS_CHECKS.length,
      trainingTracks: TRAINING_TRACKS.length,
      envChecks: PILOT_ENV_CHECKLIST.length,
      participantGroups: PILOT_PARTICIPANT_GROUPS.length,
      goLiveDimensions: GO_LIVE_DIMENSIONS.length
    }
  };
}

export function wave9SmokeChecklist() {
  const gaps = analyzeWave9Gaps();
  const domains = assertUatDomainCoverage();
  return {
    wave: WAVE9_WAVE,
    version: WAVE9_VERSION,
    architecture: "shared-spa-pilot-uat-ops",
    notNextJsRewrite: true,
    catalogAlias: WAVE9_CATALOG_ALIAS,
    frameworkReady: gaps.frameworkReady,
    domainCoverageOk: domains.ok,
    moneyDefaults: gaps.moneyDefaults,
    validatePilotHint: "npm run validate:pilot",
    counts: gaps.counts
  };
}

export function buildPilotEvidencePackage({
  rc1Evidence = null,
  pilotRun = null,
  startedAt = new Date().toISOString(),
  finishedAt = new Date().toISOString(),
  packageJson = null
} = {}) {
  const run = pilotRun || seedSyntheticPilotRun({ startedAt });
  const goNoGo = evaluateGoNoGo({ rc1Evidence, pilotRun: run });
  const gaps = analyzeWave9Gaps();
  const domains = assertUatDomainCoverage();

  const scripts = (packageJson && packageJson.scripts) || {};
  const scriptChecks = {
    validatePilot: Boolean(scripts["validate:pilot"] || scripts["wave9:assess"]),
    validateRc: Boolean(scripts["validate:rc"]),
    prepareWeb: Boolean(scripts["prepare:web"]),
    test: Boolean(scripts.test)
  };

  return {
    schemaVersion: "wave9-pilot-evidence/1.0",
    wave: WAVE9_WAVE,
    version: WAVE9_VERSION,
    catalogAlias: WAVE9_CATALOG_ALIAS,
    startedAt,
    finishedAt,
    claim: {
      frameworkReady: true,
      livePilotExecuted: false,
      liveBranchCutover: false,
      productionReconciled: false,
      note: "Evidence pack for operators; synthetic run only — not a live bank branch cutover"
    },
    rc1Entry: goNoGo.rc1,
    goNoGo: {
      decision: goNoGo.decision,
      recommendation: goNoGo.recommendation,
      readyForWave10: goNoGo.readyForWave10,
      reasons: goNoGo.reasons,
      conditions: goNoGo.conditions,
      meaning: goNoGo.meaning,
      dimensions: goNoGo.dimensions,
      humanApprovals: goNoGo.humanApprovals
    },
    pilotRun: {
      runId: run.runId,
      kind: run.kind,
      liveBranchCutover: run.liveBranchCutover,
      frameworkReady: run.frameworkReady,
      livePilotExecuted: run.livePilotExecuted,
      note: run.note
    },
    uatMatrix: {
      domains: domains.covered,
      domainCoverageOk: domains.ok,
      scenarios: run.scenarioResults,
      scores: goNoGo.uat
    },
    pilotEnvironment: {
      checklist: run.envResults,
      isolationRequired: true,
      allIsolationFlagsTrue: PILOT_ENV_CHECKLIST.every((e) => e.isolationFromProd)
    },
    operationalReadiness: {
      checks: run.opsResults,
      scores: goNoGo.ops
    },
    training: {
      tracks: TRAINING_TRACKS.map((t) => ({
        id: t.id,
        role: t.role,
        durationHours: t.durationHours,
        moduleCount: t.modules.length,
        exerciseCount: t.exercises.length,
        competencyCount: t.competencyChecklist.length
      })),
      results: run.trainingResults
    },
    participants: PILOT_PARTICIPANT_GROUPS.map((g) => ({
      id: g.id,
      name: g.name,
      humanSignOffRequired: g.humanSignOffRequired,
      responsibilityCount: g.responsibilities.length
    })),
    feedbackRegister: run.feedbackRegister,
    issueRegister: run.issueRegister,
    openIssues: {
      critical: countOpenIssues(run.issueRegister, "Critical"),
      high: countOpenIssues(run.issueRegister, "High"),
      medium: countOpenIssues(run.issueRegister, "Medium"),
      low: countOpenIssues(run.issueRegister, "Low"),
      enhancement: countOpenIssues(run.issueRegister, "Enhancement")
    },
    moneyDefaults: WAVE9_MONEY_DEFAULTS,
    gaps,
    parity: WAVE9_PARITY_CHECKLIST.slice(),
    scriptChecks,
    registries: {
      uatScenarioCount: UAT_SCENARIOS.length,
      mandatoryUatCount: listMandatoryUatScenarios().length,
      opsCheckCount: OPS_READINESS_CHECKS.length,
      trainingTrackCount: TRAINING_TRACKS.length,
      reconChecklistCount: RECON_CHECKLIST.length,
      securityChecklistCount: SECURITY_CHECKLIST.length,
      envCheckCount: PILOT_ENV_CHECKLIST.length,
      goLiveDimensionCount: GO_LIVE_DIMENSIONS.length
    },
    links: {
      rc1Evidence: "docs/release-evidence/rc1-evidence.json",
      pilotDoc: "docs/wave9-pilot-uat.md",
      uatPack: "docs/wave9-uat-pack.md",
      training: "docs/wave9-training-package.md",
      reconGuide: "docs/reconciliation/wave9-financial-recon-execution-guide.md",
      reconRunSheet: "docs/release-evidence/wave9-recon-run-sheet.json",
      securityGuide: "docs/security/wave9-security-acceptance-execution-guide.md",
      securityRunSheet: "docs/release-evidence/wave9-security-run-sheet.json",
      executiveGuide: "docs/governance/wave9-executive-sponsor-execution-guide.md",
      executiveRunSheet: "docs/release-evidence/wave9-executive-run-sheet.json",
      goNoGoReport: "docs/wave9-go-nogo-report.md"
    }
  };
}

export function renderGoNoGoReportMarkdown(evidence) {
  const g = evidence?.goNoGo || {};
  const lines = [
    "# Wave 9 — Pilot Completion / Go-No-Go Report (Draft)",
    "",
    `**Generated:** ${evidence?.finishedAt || new Date().toISOString()}`,
    `**Run:** ${evidence?.pilotRun?.runId || "n/a"} (${evidence?.pilotRun?.kind || "unknown"})`,
    `**Decision:** ${g.decision || "n/a"}`,
    `**Ready for Wave 10:** ${g.readyForWave10 || "n/a"}`,
    "",
    "> This is an automated draft from the pilot evidence pack. It does **not** claim a live branch cutover or Executive Sponsor approval.",
    "",
    "## Meaning",
    "",
    g.meaning || "",
    "",
    "## RC1 entry criterion",
    "",
    `- Decision: ${evidence?.rc1Entry?.decision || "missing"}`,
    `- Ready for Wave 9: ${evidence?.rc1Entry?.ok ? "yes" : "no"}`,
    "",
    "## Conditions / human gates",
    ""
  ];
  for (const c of g.conditions || []) lines.push(`- [ ] ${c}`);
  if (!(g.conditions || []).length) lines.push("- (none)");
  lines.push("", "## Blocking reasons", "");
  for (const r of g.reasons || []) lines.push(`- ${r}`);
  if (!(g.reasons || []).length) lines.push("- (none)");
  lines.push("", "## Human approvals", "");
  for (const a of g.humanApprovals || []) {
    lines.push(`- **${a.role}** (${a.id}): \`${a.status}\` — ${a.requiredFor || ""}`);
  }
  lines.push(
    "",
    "## Claim boundaries",
    "",
    `- Framework ready: ${evidence?.claim?.frameworkReady ? "yes" : "no"}`,
    `- Live pilot executed: ${evidence?.claim?.livePilotExecuted ? "yes" : "no"}`,
    `- Live branch cutover: ${evidence?.claim?.liveBranchCutover ? "yes" : "no"}`,
    `- Production reconciled: ${evidence?.claim?.productionReconciled ? "yes" : "no"}`,
    "",
    "## Next steps for humans",
    "",
    "1. Execute business UAT scenarios and record pass/fail + evidence.",
    "2. Complete training attendance and competency checklists.",
    "3. Perform pilot financial reconciliation and obtain Finance/PO sign-off.",
    "4. Executive Sponsor records HA-EXEC / HA-W9-EXEC Full Go, Conditional Go, or No-Go (never auto-assumed) via docs/governance/wave9-executive-sponsor-execution-guide.md.",
    "5. Proceed to Wave 10 only when conditions are cleared or formally accepted — cutover remains blocked until real human approvals.",
    ""
  );
  return lines.join("\n");
}

/**
 * SPA helper — evidence loaded from sessionStorage by the UI.
 */
export function loadLastPilotEvidence() {
  if (typeof sessionStorage === "undefined") return null;
  try {
    return JSON.parse(sessionStorage.getItem("wave9_last_pilot") || "null");
  } catch {
    return null;
  }
}

export {
  listMandatoryUatScenarios as getMandatoryUatScenarios
};
