/**
 * Audit gap → MIB work items (2026-09-17 enterprise project audit reconciliation).
 * Planning artifacts only — does not implement production features.
 * Every GAP-001…GAP-027 maps to ≥1 backlog identifier via auditGapRefs.
 * buildBacklogItem / nextId / seedLeaf are injected by the registry assembler.
 */

/**
 * Gap definitions used to seed backlog items. Identifiers assigned at seed time via nextId.
 * @typedef {{
 *   gapId: string,
 *   kind: "TASK"|"BUG"|"CR"|"RISK"|"TEST"|"FEAT",
 *   workCategory: string,
 *   title: string,
 *   description: string,
 *   priority: string,
 *   riskLevel: string,
 *   complexity: string,
 *   storyPoints: number,
 *   status: string,
 *   owner: string,
 *   team: string,
 *   module: string|null,
 *   enterprisePhase: string|null,
 *   deliveryWave: number,
 *   mibWave: number|null,
 *   blockers: string[],
 *   acceptanceCriteria: string[],
 *   documentationReferences: string[],
 *   testCases: string[],
 *   relatedGaps: string[]
 * }} GapSeedDef
 */

/** @type {ReadonlyArray<GapSeedDef>} */
export const AUDIT_GAP_SEED_DEFS = Object.freeze([
  Object.freeze({
    gapId: "GAP-003",
    kind: "TASK",
    workCategory: "Governance",
    title: "Wave 9 human gates — HA-* PendingHumanSignOff → Approved",
    description:
      "Business UAT, training, financial recon, executive sponsor, and security acceptance remain PendingHumanSignOff. Flip HA-* to Approved with evidence (audit GAP-003).",
    priority: "Critical",
    riskLevel: "Critical",
    complexity: "M",
    storyPoints: 8,
    status: "Ready",
    owner: "Release Manager",
    team: "Ops",
    module: "MOD-030",
    enterprisePhase: "PH-018",
    deliveryWave: 9,
    mibWave: 20,
    blockers: ["Pending human sign-off (business UAT, training, recon, security, exec)"],
    acceptanceCriteria: [
      "All Wave 9 HA-* gates Approved with evidence artifacts",
      "wave9-pilot-evidence.json reflects Conditional→Go or Conditional with approved residuals"
    ],
    documentationReferences: [
      "docs/audit/gap-register.md",
      "docs/release-evidence/wave9-pilot-evidence.json",
      "docs/backlog/human-gates-runbook.md"
    ],
    testCases: ["validate:pilot"],
    relatedGaps: ["GAP-015"]
  }),
  Object.freeze({
    gapId: "GAP-015",
    kind: "TASK",
    workCategory: "Security",
    title: "Prove MFA enroll/challenge path in UAT + PV",
    description:
      "MFA schema (user_mfa_secrets) exists; production UX/enforcement completeness must be proven vs catalog (GAP-015).",
    priority: "Medium",
    riskLevel: "High",
    complexity: "M",
    storyPoints: 5,
    status: "Ready",
    owner: "Security Governance Lead",
    team: "Security",
    module: "MOD-001",
    enterprisePhase: "PH-009",
    deliveryWave: 9,
    mibWave: 16,
    blockers: ["Depends on Wave 9 security acceptance gate"],
    acceptanceCriteria: [
      "MFA enroll + challenge demonstrated in UAT evidence",
      "PV security checks reference MFA proof"
    ],
    documentationReferences: ["docs/audit/gap-register.md", "supabase/migrations"],
    testCases: [],
    relatedGaps: ["GAP-003"]
  }),
  Object.freeze({
    gapId: "GAP-006",
    kind: "TASK",
    workCategory: "Documentation",
    title: "Update PRODUCTION.md migrations list to 001–044 (+ rls.sql)",
    description:
      "PRODUCTION.md / early ops docs list migrations only through 007; repo has 001–044 (GAP-006).",
    priority: "High",
    riskLevel: "High",
    complexity: "S",
    storyPoints: 3,
    status: "Completed",
    owner: "Release Manager",
    team: "DevOps",
    module: "MOD-014",
    enterprisePhase: "PH-014",
    deliveryWave: 10,
    mibWave: 19,
    blockers: [],
    acceptanceCriteria: [
      "PRODUCTION.md ordered migration list matches 001–044 + rls.sql",
      "Working cutover steps preserved"
    ],
    documentationReferences: ["PRODUCTION.md", "docs/audit/gap-register.md"],
    testCases: ["tests/gap-production-rbac.test.js"],
    relatedGaps: ["GAP-016"]
  }),
  Object.freeze({
    gapId: "GAP-016",
    kind: "TASK",
    workCategory: "Ops",
    title: "Populate deploy/ manifests for prod ≠ pilot profiles",
    description:
      "deploy/ profiles for prod ≠ pilot (GAP-016). Non-secret manifests only; secrets remain in org env stores.",
    priority: "Medium",
    riskLevel: "Medium",
    complexity: "S",
    storyPoints: 5,
    status: "Completed",
    owner: "Release Manager",
    team: "DevOps",
    module: "MOD-030",
    enterprisePhase: "PH-014",
    deliveryWave: 10,
    mibWave: 19,
    blockers: [],
    acceptanceCriteria: [
      "deploy/ contains prod and pilot config profiles",
      "PRD-ENV checklist can cite manifests"
    ],
    documentationReferences: [
      "deploy/README.md",
      "deploy/profiles/pilot.json",
      "deploy/profiles/prod.json",
      "docs/audit/gap-register.md"
    ],
    testCases: ["tests/gap-ci-channels.test.js"],
    relatedGaps: ["GAP-006"]
  }),
  Object.freeze({
    gapId: "GAP-005",
    kind: "BUG",
    workCategory: "TechDebt",
    title: "Defect: dual money model — numeric GHS vs integer-pesewas SoT",
    description:
      "Core tables use numeric(14,2) GHS with generated pesewas; later migrations still use numeric amounts — conflicts with integer-pesewas SoT (GAP-005).",
    priority: "High",
    riskLevel: "Critical",
    complexity: "L",
    storyPoints: 13,
    status: "In Progress",
    owner: "CIO",
    team: "Data",
    module: "MOD-006",
    enterprisePhase: "PH-007",
    deliveryWave: 2,
    mibWave: 4,
    blockers: ["Full SQL column rewrite still requires migration freeze / CIO sign-off"],
    acceptanceCriteria: [
      "Additive migration plan: integer pesewas write path authoritative",
      "Float authoritative writes stopped; recon tests pass"
    ],
    documentationReferences: [
      "docs/audit/gap-register.md",
      "docs/money-dual-model-plan.md",
      "src/core/money.js"
    ],
    testCases: ["tests/money.test.js"],
    relatedGaps: ["GAP-010", "GAP-019"]
  }),
  Object.freeze({
    gapId: "GAP-010",
    kind: "BUG",
    workCategory: "Security",
    title: "Defect: app_users.role CHECK lags full JS agency RBAC",
    description:
      "SQL app_users.role CHECK still early roles vs full JS agency RBAC matrix (GAP-010).",
    priority: "High",
    riskLevel: "High",
    complexity: "M",
    storyPoints: 8,
    status: "Completed",
    owner: "Security Governance Lead",
    team: "Security",
    module: "MOD-001",
    enterprisePhase: "PH-009",
    deliveryWave: 2,
    mibWave: 2,
    blockers: [],
    acceptanceCriteria: [
      "Additive migration expands role CHECK / mapping aligned to src/core/roles.js + rbac.js",
      "No SUPER_ADMIN_FORBIDDEN regression"
    ],
    documentationReferences: [
      "docs/audit/gap-register.md",
      "src/core/rbac.js",
      "supabase/migrations/045_app_users_role_rbac_align.sql"
    ],
    testCases: ["tests/gap-production-rbac.test.js"],
    relatedGaps: ["GAP-005"]
  }),
  Object.freeze({
    gapId: "GAP-019",
    kind: "BUG",
    workCategory: "TechDebt",
    title: "Defect: MoMo webhook amount numeric vs pesewas invariant",
    description:
      "MoMo webhook amount numeric(14,2) and early collections float columns vs pesewas invariant (GAP-019). Inventory + JS boundary hooks in progress; SQL rewrite freeze-gated.",
    priority: "Medium",
    riskLevel: "High",
    complexity: "M",
    storyPoints: 5,
    status: "In Progress",
    owner: "CIO",
    team: "Domain",
    module: "MOD-016",
    enterprisePhase: "PH-007",
    deliveryWave: 2,
    mibWave: 4,
    blockers: ["Coordinate with GAP-005 money migration plan", "SQL momo_webhook_events.amount rewrite under freeze"],
    acceptanceCriteria: [
      "Webhook amounts aligned to integer pesewas",
      "Payment ops tests cover webhook path",
      "Inventory documented in docs/backlog/momo-gap-inventory.md"
    ],
    documentationReferences: [
      "docs/audit/gap-register.md",
      "docs/backlog/momo-gap-inventory.md",
      "docs/money-dual-model-plan.md"
    ],
    testCases: ["tests/momo.test.js", "tests/payment-ops.test.js"],
    relatedGaps: ["GAP-005"]
  }),
  Object.freeze({
    gapId: "GAP-004",
    kind: "TASK",
    workCategory: "Ops",
    title: "Android Capacitor Gradle project — reproducible APK path",
    description:
      "android/app Gradle tree not in repo; only README + plugins-src scaffold (GAP-004). Reproducible path via android:ensure / pilot:android.",
    priority: "High",
    riskLevel: "High",
    complexity: "M",
    storyPoints: 8,
    status: "In Progress",
    owner: "Platform Administrator",
    team: "Platform",
    module: "MOD-015",
    enterprisePhase: "PH-014",
    deliveryWave: 4,
    mibWave: 6,
    blockers: ["Signed release APK for GAP-012 still needs org keystore secrets"],
    acceptanceCriteria: [
      "Reproducible APK path: generate/commit Gradle tree or CI artifact",
      "Release signing verify documented"
    ],
    documentationReferences: [
      "android/README.md",
      "scripts/check-android-path.js",
      "scripts/ensure-android-platform.js",
      "scripts/pilot-android.js",
      "docs/audit/gap-register.md"
    ],
    testCases: ["tests/gap-ci-channels.test.js"],
    relatedGaps: ["GAP-012", "GAP-025"]
  }),
  Object.freeze({
    gapId: "GAP-008",
    kind: "TASK",
    workCategory: "Security",
    title: "Electron code signing + production update channel",
    description:
      "signAndEditExecutable false; placeholder update feeds blocked; check:electron-signing smoke (GAP-008). Real CSC_* still ops.",
    priority: "High",
    riskLevel: "High",
    complexity: "M",
    storyPoints: 8,
    status: "In Progress",
    owner: "Platform Administrator",
    team: "Platform",
    module: "MOD-030",
    enterprisePhase: "PH-014",
    deliveryWave: 6,
    mibWave: 10,
    blockers: ["Signing certificate procurement — human/ops; CSC_* env not inventable"],
    acceptanceCriteria: [
      "Real signing certs configured for release builds",
      "Production update channel URL replaces placeholder"
    ],
    documentationReferences: [
      "docs/audit/gap-register.md",
      "docs/wave6-windows-exe.md",
      "electron/updater.js",
      "scripts/check-electron-signing.js"
    ],
    testCases: ["tests/gap-ci-channels.test.js"],
    relatedGaps: ["GAP-012", "GAP-014"]
  }),
  Object.freeze({
    gapId: "GAP-012",
    kind: "TASK",
    workCategory: "Ops",
    title: "Produce signed release APK/EXE artifacts + evidence hashes",
    description:
      "hash:artifacts script writes docs/release-evidence when APK/EXE exist; signed production binaries still pending (GAP-012).",
    priority: "High",
    riskLevel: "High",
    complexity: "M",
    storyPoints: 8,
    status: "In Progress",
    owner: "Release Manager",
    team: "DevOps",
    module: "MOD-030",
    enterprisePhase: "PH-015",
    deliveryWave: 10,
    mibWave: 20,
    blockers: ["Needs signed release APK + signed EXE with org certs"],
    acceptanceCriteria: [
      "Signed release APK and EXE produced",
      "Hashes recorded under docs/release-evidence/"
    ],
    documentationReferences: [
      "docs/audit/gap-register.md",
      "scripts/hash-release-artifacts.js",
      "docs/release-evidence/artifact-hash-checklist.md"
    ],
    testCases: ["tests/gap-ci-channels.test.js"],
    relatedGaps: ["GAP-004", "GAP-008"]
  }),
  Object.freeze({
    gapId: "GAP-001",
    kind: "TASK",
    workCategory: "Ops",
    title: "Execute live production cutover CO-01…CO-13",
    description:
      "Live production cutover not executed; CO-* steps remain ReadyToExecute with null timestamps (0/13) (GAP-001).",
    priority: "Critical",
    riskLevel: "Critical",
    complexity: "L",
    storyPoints: 13,
    status: "Blocked",
    owner: "Release Manager",
    team: "Ops",
    module: "MOD-030",
    enterprisePhase: "PH-020",
    deliveryWave: 10,
    mibWave: 20,
    blockers: ["Wave 9 human gates (GAP-003) — GAP-006 PRODUCTION.md Complete 2026-09-18"],
    acceptanceCriteria: [
      "CO-01…CO-13 completed with owners, timestamps, rollback readiness",
      "wave10-golive-evidence.json liveProductionCutover true"
    ],
    documentationReferences: [
      "docs/audit/gap-register.md",
      "docs/release-evidence/wave10-golive-evidence.json"
    ],
    testCases: ["validate:golive"],
    relatedGaps: ["GAP-002", "GAP-003", "GAP-006", "GAP-009"]
  }),
  Object.freeze({
    gapId: "GAP-009",
    kind: "TASK",
    workCategory: "Governance",
    title: "Execute PV-* business acceptance (0/18) + fill SM-* actuals",
    description:
      "Production validation PV-* business acceptance 0/18; only PV-001…006 technical smoke; metrics actuals null (GAP-009).",
    priority: "High",
    riskLevel: "High",
    complexity: "L",
    storyPoints: 13,
    status: "Blocked",
    owner: "Release Manager",
    team: "QA",
    module: "MOD-030",
    enterprisePhase: "PH-016",
    deliveryWave: 10,
    mibWave: 20,
    blockers: ["Depends on cutover (GAP-001) and Wave 9 gates (GAP-003)"],
    acceptanceCriteria: [
      "Remaining PV checks executed with human approvers",
      "SM-* actuals filled in golive evidence"
    ],
    documentationReferences: ["docs/audit/gap-register.md"],
    testCases: [],
    relatedGaps: ["GAP-001", "GAP-003"]
  }),
  Object.freeze({
    gapId: "GAP-011",
    kind: "TASK",
    workCategory: "Ops",
    title: "Start hypercare HC-001 after cutover — daily reviews + exit criteria",
    description:
      "Hypercare HC-001 status NotStarted; no daily reviews; success metrics not measured in-repo (GAP-011).",
    priority: "High",
    riskLevel: "High",
    complexity: "M",
    storyPoints: 8,
    status: "Blocked",
    owner: "Release Manager",
    team: "Ops",
    module: "MOD-019",
    enterprisePhase: "PH-018",
    deliveryWave: 10,
    mibWave: 20,
    blockers: ["Requires live cutover (GAP-001)"],
    acceptanceCriteria: [
      "Hypercare started with P1–P4 tracking",
      "14d / 30d exit criteria documented"
    ],
    documentationReferences: ["docs/audit/gap-register.md"],
    testCases: [],
    relatedGaps: ["GAP-001"]
  }),
  Object.freeze({
    gapId: "GAP-002",
    kind: "TASK",
    workCategory: "Governance",
    title: "CERT-001 Accountable Authority certification (certified: true)",
    description:
      "CERT-001 remains preview (certified: false); AA + Executive Sponsor PendingHumanSignOff (GAP-002).",
    priority: "Critical",
    riskLevel: "Critical",
    complexity: "S",
    storyPoints: 5,
    status: "Blocked",
    owner: "Governance Board Chair",
    team: "Governance",
    module: "MOD-022",
    enterprisePhase: "PH-020",
    deliveryWave: 10,
    mibWave: 20,
    blockers: ["Requires live cutover evidence (GAP-001) and Wave 9 gates (GAP-003)"],
    acceptanceCriteria: [
      "Human AA approvals recorded",
      "cert001.certified true with evidence linkage"
    ],
    documentationReferences: ["docs/audit/gap-register.md", "docs/release-evidence/wave10-golive-evidence.json"],
    testCases: [],
    relatedGaps: ["GAP-001", "GAP-003"]
  }),
  Object.freeze({
    gapId: "GAP-007",
    kind: "TASK",
    workCategory: "Ops",
    title: "Establish VCS remote + CI (test + wave validators on PR)",
    description:
      "CI workflow scaffolded (.github/workflows/ci.yml); org VCS remote still required (GAP-007). See docs/ci-remote-connect.md.",
    priority: "High",
    riskLevel: "High",
    complexity: "M",
    storyPoints: 8,
    status: "In Progress",
    owner: "Platform Administrator",
    team: "DevOps",
    module: "MOD-030",
    enterprisePhase: "PH-014",
    deliveryWave: 1,
    mibWave: 1,
    blockers: ["Org process for VCS remote / GitHub enablement"],
    acceptanceCriteria: [
      "Git remote established",
      "CI runs npm test + wave validators on PR"
    ],
    documentationReferences: [
      "docs/audit/gap-register.md",
      ".github/workflows/ci.yml",
      "docs/ci-remote-connect.md"
    ],
    testCases: ["npm test", "tests/gap-ci-channels.test.js"],
    relatedGaps: ["GAP-018"]
  }),
  Object.freeze({
    gapId: "GAP-018",
    kind: "TASK",
    workCategory: "TechDebt",
    title: "CI guard: forbid hand-edits to www/; regenerate via prepare:web",
    description:
      "www/ mirrors full src/ — edit-SoT confusion risk (GAP-018). check:www-sot sample-hash guard wired in CI.",
    priority: "Medium",
    riskLevel: "Medium",
    complexity: "S",
    storyPoints: 3,
    status: "Completed",
    owner: "Platform Administrator",
    team: "Platform",
    module: "MOD-030",
    enterprisePhase: "PH-002",
    deliveryWave: 1,
    mibWave: 1,
    blockers: [],
    acceptanceCriteria: [
      "CI fails on hand-edits to www/src without matching src/",
      "prepare:web remains regenerate path"
    ],
    documentationReferences: [
      "docs/audit/gap-register.md",
      "docs/enterprise-development-standards.md",
      "scripts/check-www-sot.js"
    ],
    testCases: ["tests/gap-ci-channels.test.js"],
    relatedGaps: ["GAP-007"]
  }),
  Object.freeze({
    gapId: "GAP-020",
    kind: "TASK",
    workCategory: "Documentation",
    title: "MIB hygiene — reconcile open items with enterprise audit gaps",
    description:
      "Open MIB items ~272 vs released-like lag; refresh statuses from audit gap register (GAP-020). Satisfied by this reconciliation pass.",
    priority: "Medium",
    riskLevel: "Medium",
    complexity: "M",
    storyPoints: 5,
    status: "Completed",
    owner: "Platform Administrator",
    team: "Platform",
    module: "MOD-030",
    enterprisePhase: "PH-020",
    deliveryWave: 1,
    mibWave: 1,
    blockers: [],
    acceptanceCriteria: [
      "Every GAP-001…027 maps to ≥1 backlog item",
      "validateMasterBacklog critical=0",
      "docs/backlog/* registers published"
    ],
    documentationReferences: [
      "docs/audit/gap-register.md",
      "docs/master-implementation-backlog.md",
      "docs/backlog/gap-register-reconciled.md"
    ],
    testCases: ["tests/master-backlog-consistency.test.js"],
    relatedGaps: []
  }),
  Object.freeze({
    gapId: "GAP-013",
    kind: "TASK",
    workCategory: "TechDebt",
    title: "Extend invokeApi controllers for remaining posting paths",
    description:
      "Not all domain surfaces routed exclusively via invokeApi; some SPA→ops paths may bypass API middleware (GAP-013).",
    priority: "Medium",
    riskLevel: "Medium",
    complexity: "L",
    storyPoints: 13,
    status: "Deferred",
    owner: "CIO",
    team: "Integration",
    module: "MOD-020",
    enterprisePhase: "PH-006",
    deliveryWave: 3,
    mibWave: 5,
    blockers: [],
    acceptanceCriteria: [
      "Remaining posting paths exposed via controllers/services",
      "Engines remain shared SoT"
    ],
    documentationReferences: ["docs/audit/gap-register.md", "src/api/gateway.js"],
    testCases: [],
    relatedGaps: ["GAP-026"]
  }),
  Object.freeze({
    gapId: "GAP-014",
    kind: "TASK",
    workCategory: "Security",
    title: "Tighten Electron CSP — remove unsafe-inline/unsafe-eval where SPA allows",
    description: "Electron CSP allows unsafe-inline and unsafe-eval (GAP-014).",
    priority: "Medium",
    riskLevel: "High",
    complexity: "M",
    storyPoints: 5,
    status: "Planned",
    owner: "Security Governance Lead",
    team: "Security",
    module: "MOD-022",
    enterprisePhase: "PH-009",
    deliveryWave: 6,
    mibWave: 16,
    blockers: ["SPA bundling constraints"],
    acceptanceCriteria: [
      "CSP tightened where SPA allows",
      "Residual exceptions documented"
    ],
    documentationReferences: ["docs/audit/gap-register.md", "electron/main.js"],
    testCases: [],
    relatedGaps: ["GAP-008"]
  }),
  Object.freeze({
    gapId: "GAP-017",
    kind: "CR",
    workCategory: "TechDebt",
    title: "CR: deep loan state-machine / CoA-GL rewrite (Modules 8 & 10)",
    description:
      "Deep loan SM / CoA-GL rewrite deferred; Modules 8 & 10 Mostly Complete by design (GAP-017). Do not confuse with Wave restart.",
    priority: "Medium",
    riskLevel: "Medium",
    complexity: "XL",
    storyPoints: 34,
    status: "Deferred",
    owner: "CIO",
    team: "Domain",
    module: "MOD-008",
    enterprisePhase: "PH-003",
    deliveryWave: 6,
    mibWave: 10,
    blockers: ["Product priority decision"],
    acceptanceCriteria: [
      "Remaining FEAT/TASK ticketed without Wave 1–10 restart",
      "Existing loan/accounting workflows preserved until CR approved"
    ],
    documentationReferences: ["docs/audit/gap-register.md"],
    testCases: [],
    relatedGaps: []
  }),
  Object.freeze({
    gapId: "GAP-021",
    kind: "TASK",
    workCategory: "TechDebt",
    title: "Resolve package.json MODULE_TYPELESS (type:module or .mjs) safely",
    description:
      "package.json lacks type:module causing Node MODULE_TYPELESS warnings (GAP-021).",
    priority: "Low",
    riskLevel: "Low",
    complexity: "XS",
    storyPoints: 2,
    status: "Deferred",
    owner: "Platform Administrator",
    team: "Platform",
    module: "MOD-030",
    enterprisePhase: "PH-002",
    deliveryWave: 1,
    mibWave: 1,
    blockers: ["Must not break Electron packaging"],
    acceptanceCriteria: [
      "Warning eliminated without breaking Electron/Web smoke",
      "EDSM stack constraints preserved"
    ],
    documentationReferences: ["docs/audit/gap-register.md", "package.json"],
    testCases: [],
    relatedGaps: []
  }),
  Object.freeze({
    gapId: "GAP-022",
    kind: "TASK",
    workCategory: "Documentation",
    title: "Document EIR historical catalog name aliases for agents",
    description:
      "Historical EIR catalog names (Loan Platform, Accounting Platform, Production Readiness) vs delivery names confuse agents (GAP-022). Closed via docs/backlog/eir-catalog-aliases.md — engines not renamed.",
    priority: "Low",
    riskLevel: "Low",
    complexity: "S",
    storyPoints: 2,
    status: "Completed",
    owner: "Platform Administrator",
    team: "Platform",
    module: "MOD-030",
    enterprisePhase: "PH-001",
    deliveryWave: 1,
    mibWave: 1,
    blockers: [],
    acceptanceCriteria: [
      "Alias notes kept; engines not renamed",
      "User delivery wave names linked from EIR docs"
    ],
    documentationReferences: [
      "docs/enterprise-implementation-roadmap.md",
      "docs/eir-catalogs.md",
      "docs/backlog/eir-catalog-aliases.md",
      "docs/backlog/wave-execution-plan.md"
    ],
    testCases: ["tests/gap-docs-readiness.test.js"],
    relatedGaps: []
  }),
  Object.freeze({
    gapId: "GAP-023",
    kind: "TASK",
    workCategory: "Documentation",
    title: "Define PWA / web-offline support level vs Capacitor offline",
    description:
      "PWA service worker / offline web parity less evidenced than Capacitor offline engine (GAP-023). Limits documented — Capacitor is field SoT; PWA is shell cache only.",
    priority: "Low",
    riskLevel: "Low",
    complexity: "S",
    storyPoints: 3,
    status: "Completed",
    owner: "Platform Administrator",
    team: "Platform",
    module: "MOD-015",
    enterprisePhase: "PH-005",
    deliveryWave: 5,
    mibWave: 6,
    blockers: [],
    acceptanceCriteria: [
      "Support level defined or web-offline limits documented",
      "No false parity claim vs Capacitor"
    ],
    documentationReferences: [
      "docs/audit/gap-register.md",
      "docs/backlog/pwa-web-offline-support.md",
      "docs/offline-sync.md"
    ],
    testCases: ["tests/gap-docs-readiness.test.js"],
    relatedGaps: []
  }),
  Object.freeze({
    gapId: "GAP-024",
    kind: "TASK",
    workCategory: "Security",
    title: "Automated productionMode fail-closed for bootstrap default passwords",
    description:
      "Default owner/dev passwords documented for bootstrap — residual if productionMode not enforced (GAP-024). Fail-closed wired in production-guards + readiness assessor.",
    priority: "Low",
    riskLevel: "High",
    complexity: "S",
    storyPoints: 3,
    status: "Completed",
    owner: "Security Governance Lead",
    team: "Security",
    module: "MOD-001",
    enterprisePhase: "PH-009",
    deliveryWave: 10,
    mibWave: 20,
    blockers: [],
    acceptanceCriteria: [
      "Automated prod guard fail-closed when productionMode",
      "Bootstrap defaults rejected in production config"
    ],
    documentationReferences: [
      "PRODUCTION.md",
      "docs/audit/gap-register.md",
      "src/core/production-guards.js"
    ],
    testCases: ["tests/production-guards.test.js"],
    relatedGaps: ["GAP-001"]
  }),
  Object.freeze({
    gapId: "GAP-025",
    kind: "FEAT",
    workCategory: "Feature",
    title: "Optional thin Kotlin bridges (biometrics, WorkManager)",
    description: "Optional thin Kotlin bridges beyond stubs (GAP-025 Enhancement).",
    priority: "Low",
    riskLevel: "Low",
    complexity: "M",
    storyPoints: 8,
    status: "Deferred",
    owner: "Platform Administrator",
    team: "Platform",
    module: "MOD-015",
    enterprisePhase: "PH-014",
    deliveryWave: 4,
    mibWave: 6,
    blockers: ["Requires GAP-004 Android Gradle path"],
    acceptanceCriteria: [
      "Bridges implemented only as adapters around SPA",
      "No Compose primary rewrite"
    ],
    documentationReferences: ["docs/audit/gap-register.md", "android/plugins-src/"],
    testCases: [],
    relatedGaps: ["GAP-004"]
  }),
  Object.freeze({
    gapId: "GAP-026",
    kind: "TASK",
    workCategory: "Documentation",
    title: "Broader OpenAPI coverage export from route-registry",
    description: "Broader OpenAPI coverage export for all Module ops (GAP-026 Enhancement).",
    priority: "Low",
    riskLevel: "Low",
    complexity: "S",
    storyPoints: 5,
    status: "Deferred",
    owner: "CIO",
    team: "Integration",
    module: "MOD-020",
    enterprisePhase: "PH-006",
    deliveryWave: 3,
    mibWave: 5,
    blockers: [],
    acceptanceCriteria: [
      "OpenAPI generated/expanded from route-registry",
      "wave3-api.openapi.json remains facade-compatible"
    ],
    documentationReferences: ["docs/openapi/wave3-api.openapi.json", "docs/audit/gap-register.md"],
    testCases: [],
    relatedGaps: ["GAP-013"]
  }),
  Object.freeze({
    gapId: "GAP-027",
    kind: "CR",
    workCategory: "Ops",
    title: "CR: post-go-live continuous improvement → MIB identifiers",
    description:
      "Wire service-desk → MIB identifiers for Phase 19 CRs (GAP-027 Enhancement).",
    priority: "Low",
    riskLevel: "Low",
    complexity: "M",
    storyPoints: 5,
    status: "Deferred",
    owner: "Change Manager",
    team: "Governance",
    module: "MOD-030",
    enterprisePhase: "PH-019",
    deliveryWave: 10,
    mibWave: 20,
    blockers: ["Requires live cutover (GAP-001)"],
    acceptanceCriteria: [
      "CI-PROC-001 linked to MIB identifiers",
      "Service-desk tickets can cite TASK/BUG/CR IDs"
    ],
    documentationReferences: ["docs/audit/gap-register.md"],
    testCases: [],
    relatedGaps: ["GAP-001"]
  })
]);

export const AUDIT_GAP_COUNT = AUDIT_GAP_SEED_DEFS.length;

/**
 * Seed epic/features/items for audit gaps. nextId/buildBacklogItem injected to avoid circular imports.
 * @param {{
 *   program: object,
 *   waveEpics: object[],
 *   modules: object[],
 *   nextId: (prefix: string, width: number) => string,
 *   buildBacklogItem: Function,
 *   seedLeaf: Function
 * }} ctx
 */
export function seedAuditGapReconciliation(ctx) {
  const { program, waveEpics, modules, nextId, buildBacklogItem: build, seedLeaf } = ctx;
  const items = [];
  const prodWave = waveEpics.find((e) => e.wave === 20) || program;
  const byMod = (id) => modules.find((m) => m.identifier === id) || modules[0];

  const epic = build({
    identifier: nextId("EPC", 6),
    parentIdentifier: program.identifier,
    module: "MOD-030",
    enterprisePhase: "PH-020",
    title: "Enterprise Audit Gap Reconciliation (2026-09-17)",
    description:
      "Cross-cutting epic mapping docs/audit gap register GAP-001…027 into executable MIB items. Planning only — not a Wave 1–10 restart.",
    businessObjective: "Close production readiness and debt gaps without re-implementing framework packs.",
    businessValue: "Single audit→backlog traceability for go-live critical path.",
    priority: "Critical",
    riskLevel: "Critical",
    complexity: "L",
    storyPoints: 21,
    estimatedHours: 80,
    owner: "Governance Board Chair",
    team: "Governance",
    status: "In Progress",
    wave: null,
    deliveryWave: 10,
    workCategory: "Governance",
    documentationReferences: [
      "docs/audit/enterprise-project-audit.md",
      "docs/audit/gap-register.md",
      "docs/backlog/gap-register-reconciled.md"
    ],
    relatedEnterprisePhaseReferences: ["PH-018", "PH-019", "PH-020"],
    relatedModuleReferences: ["MOD-030"],
    acceptanceCriteria: [
      "All 27 audit gaps mapped",
      "No duplicate active work per gap",
      "validateMasterBacklog critical=0"
    ],
    validationRequirements: ["tests/master-backlog-consistency.test.js"],
    notes: "Audit reconciliation 2026-09-17"
  });
  items.push(epic);

  const categoryTitles = {
    Ops: "Ops & cutover gaps",
    Governance: "Governance & human gates",
    Security: "Security improvements",
    TechDebt: "Technical debt",
    Documentation: "Documentation improvements",
    Feature: "Enhancement backlog",
    Testing: "Testing improvements",
    Performance: "Performance improvements"
  };

  const categories = [...new Set(AUDIT_GAP_SEED_DEFS.map((d) => d.workCategory))];
  /** @type {Map<string, object>} */
  const featByCategory = new Map();
  for (const cat of categories) {
    const feat = build({
      identifier: nextId("FEAT", 6),
      parentIdentifier: epic.identifier,
      module: "MOD-030",
      enterprisePhase: "PH-020",
      title: `Audit gaps: ${categoryTitles[cat] || cat}`,
      description: `Feature bucket for workCategory=${cat} from enterprise audit.`,
      businessObjective: cat,
      businessValue: epic.businessValue,
      priority: "High",
      riskLevel: "High",
      complexity: "M",
      storyPoints: 8,
      estimatedHours: 16,
      owner: epic.owner,
      team: epic.team,
      status: "In Progress",
      wave: null,
      deliveryWave: 10,
      workCategory: cat,
      documentationReferences: epic.documentationReferences,
      relatedEnterprisePhaseReferences: epic.relatedEnterprisePhaseReferences,
      relatedModuleReferences: ["MOD-030"],
      acceptanceCriteria: [`All ${cat} gap items parented under this feature`]
    });
    items.push(feat);
    featByCategory.set(cat, feat);
  }

  /** @type {Map<string, string>} gapId → backlog identifier */
  const gapToId = new Map();

  for (const def of AUDIT_GAP_SEED_DEFS) {
    const parent = featByCategory.get(def.workCategory) || epic;
    const mod = def.module || parent.module;
    const id = nextId(def.kind, 6);
    gapToId.set(def.gapId, id);
    items.push(
      build({
        identifier: id,
        parentIdentifier: parent.identifier,
        module: mod,
        enterprisePhase: def.enterprisePhase || parent.enterprisePhase,
        title: `[${def.gapId}] ${def.title}`,
        description: def.description,
        businessObjective: `Close ${def.gapId}`,
        businessValue: "Production readiness / risk reduction per enterprise audit",
        priority: def.priority,
        riskLevel: def.riskLevel,
        complexity: def.complexity,
        storyPoints: def.storyPoints,
        estimatedHours: def.storyPoints * 2,
        owner: def.owner,
        team: def.team,
        status: def.status,
        wave: def.mibWave,
        deliveryWave: def.deliveryWave,
        workCategory: def.workCategory,
        auditGapRefs: [def.gapId],
        blockers: def.blockers,
        acceptanceCriteria: def.acceptanceCriteria,
        validationRequirements: [`Trace ${def.gapId} → ${id}`],
        testCases: def.testCases,
        documentationReferences: def.documentationReferences,
        relatedEnterprisePhaseReferences: def.enterprisePhase ? [def.enterprisePhase] : [],
        relatedModuleReferences: mod ? [mod] : [],
        notes: `Audit ${def.gapId}; related=${(def.relatedGaps || []).join(",")}`
      })
    );
  }

  // Wire prerequisites among gap items (second pass — rebuild with deps)
  const byGap = Object.fromEntries(
    items.filter((i) => i.auditGapRefs?.length).map((i) => [i.auditGapRefs[0], i])
  );

  const depEdges = [
    ["GAP-001", ["GAP-003", "GAP-006"]],
    ["GAP-002", ["GAP-001", "GAP-003"]],
    ["GAP-009", ["GAP-001", "GAP-003"]],
    ["GAP-011", ["GAP-001"]],
    ["GAP-012", ["GAP-004", "GAP-008"]],
    ["GAP-015", ["GAP-003"]],
    ["GAP-016", ["GAP-006"]],
    ["GAP-018", ["GAP-007"]],
    ["GAP-019", ["GAP-005"]],
    ["GAP-024", ["GAP-001"]],
    ["GAP-025", ["GAP-004"]],
    ["GAP-027", ["GAP-001"]]
  ];

  const rebuilt = items.map((item) => {
    const gap = item.auditGapRefs?.[0];
    if (!gap) return item;
    const edge = depEdges.find(([g]) => g === gap);
    if (!edge) return item;
    const prereqs = edge[1].map((g) => byGap[g]?.identifier).filter(Boolean);
    if (!prereqs.length) return item;
    return build({
      ...item,
      dependencies: {
        prerequisites: prereqs,
        dependentTasks: [],
        blockingTasks: [],
        relatedTasks: edge[1]
          .map((g) => byGap[g]?.identifier)
          .filter((id) => id && !prereqs.includes(id)),
        crossModule: item.module ? [item.module] : [],
        crossPhase: item.enterprisePhase ? [item.enterprisePhase] : []
      }
    });
  });

  // Supersede duplicate placeholder payment BUG if present — mark related, keep Deferred
  // Additional TEST for gap mapping coverage
  rebuilt.push(
    seedLeaf("TEST", prodWave, {
      title: "Audit gap → backlog mapping coverage (GAP-001…027)",
      status: "Completed",
      storyPoints: 2,
      complexity: "XS",
      module: "MOD-030",
      enterprisePhase: "PH-020",
      deliveryWave: 8,
      workCategory: "Testing",
      auditGapRefs: [],
      testCases: ["tests/master-backlog-consistency.test.js"],
      acceptanceCriteria: [
        "Every GAP-001…027 has ≥1 active (non-Cancelled) backlog item",
        "No two active primary items for the same gap"
      ],
      documentationReferences: ["docs/backlog/gap-register-reconciled.md"]
    })
  );

  // Cancelled sentinel for obsolete “restart waves” misconception (documentation hygiene)
  rebuilt.push(
    build({
      identifier: nextId("TASK", 6),
      parentIdentifier: epic.identifier,
      module: "MOD-030",
      enterprisePhase: "PH-020",
      title: "[Obsolete] Restart Waves 1–10 from zero",
      description:
        "Superseded by audit framing: Waves 1–10 framework packs are Mostly Complete. Do not re-implement from scratch.",
      businessObjective: "Prevent duplicate greenfield work",
      businessValue: "Protect existing framework investment",
      priority: "Low",
      riskLevel: "Low",
      complexity: "XS",
      storyPoints: 1,
      estimatedHours: 0,
      owner: "Governance Board Chair",
      team: "Governance",
      status: "Cancelled",
      wave: null,
      deliveryWave: 10,
      workCategory: "Governance",
      acceptanceCriteria: ["Remains Cancelled; work routed to gap items instead"],
      validationRequirements: [],
      documentationReferences: ["docs/audit/enterprise-project-audit.md"],
      notes: "Cancelled — obsolete duplicate of framework packs"
    })
  );

  // Touch byMod to avoid unused if tree-shaken — keep for future parent overrides
  void byMod;

  return { items: rebuilt, gapToId: Object.fromEntries(gapToId) };
}
