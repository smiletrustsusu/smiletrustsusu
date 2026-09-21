/**
 * One-shot generator: ECDM markdown docs from canonical-domain-registry.js
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  CANONICAL_ENTITIES,
  CANONICAL_RELATIONSHIPS,
  listAggregateRoots,
  MONEY_TRANSACTION_ENTITY_CODES,
  ECDM_VERSION,
  CLASSIFICATIONS,
  validateDomainRegistry
} from "../src/core/canonical-domain-registry.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DOCS = path.join(ROOT, "docs");

const MODULE_NAMES = {
  1: "Authentication & Session",
  2: "Dashboard",
  3: "Customer CRM",
  4: "Agent Management",
  5: "Branch Management",
  6: "Individual Savings Collection",
  7: "Group Susu Management",
  8: "Loans",
  9: "Withdrawals",
  10: "Accounting & GL",
  11: "Reports (ops)",
  12: "Notification",
  13: "Audit",
  14: "System Admin & Config",
  15: "Offline Sync",
  16: "Payments / MoMo",
  17: "Receipts & Documents",
  18: "Jobs",
  19: "Monitoring",
  20: "API Gateway",
  21: "Backup/DR",
  22: "Security Ops",
  23: "Workflow",
  24: "Rule Engine",
  25: "Data Exchange",
  26: "Digital Records",
  27: "Enterprise BI",
  28: "Integration Hub",
  29: "AI",
  30: "Platform Admin"
};

const lifecycleByCode = {
  "ENT-SAV-003": "Initiated → Pending → Validated → Posted → (Reversal)",
  "ENT-WDL-001": "Requested → Verified → Approved → Paid → (Reversed)",
  "ENT-LON-001":
    "Pending → (Verified) → Approved → Active → Completed | Defaulted/Written Off/Recovered/Restructured",
  "ENT-PAY-001": "payment-lifecycle.js stage machine (Module 16)",
  "ENT-WFK-002": "Started → Running → Suspended → Completed/Cancelled",
  "ENT-IDN-002": "Created → Active → Expired/Revoked",
  "ENT-PLT-001": "Registered → Active → Suspended → Decommissioned",
  "ENT-AI-001": "Draft → Approved → Deployed → Retired",
  "ENT-JOB-002": "Queued → Running → Succeeded/Failed/DeadLetter"
};

const eventsByCode = {
  "ENT-SAV-003": "CollectionPosted / CollectionReversed (Module 6)",
  "ENT-LON-001": "LoanApproved / LoanDisbursed / LoanCompleted (Module 8)",
  "ENT-WDL-001": "WithdrawalRequested / Approved / Paid / Reversed (Module 9)",
  "ENT-FIN-002": "JournalPosted (Module 10)",
  "ENT-PAY-001": "Payment* lifecycle events (Module 16)",
  "ENT-NTF-001": "NotificationDelivered (Module 12)",
  "ENT-AUD-001": "consumes catalog events (Module 13)",
  "ENT-AI-003": "AiPredictionProduced (advisory)",
  "ENT-AI-004": "FraudAlertCreated (advisory; distinct from Module 22)",
  "ENT-PLT-001": "TenantRegistered / TenantTransitioned"
};

function relsFor(code) {
  return (
    CANONICAL_RELATIONSHIPS.filter((r) => r.from === code || r.to === code)
      .map((r) =>
        r.from === code
          ? `→ ${r.to} (${r.cardinality} ${r.kind})`
          : `← ${r.from} (${r.cardinality} ${r.kind})`
      )
      .join("; ") || "—"
  );
}

function childrenOf(code) {
  return (
    CANONICAL_RELATIONSHIPS.filter((r) => r.to === code)
      .map((r) => r.from)
      .join(", ") || "—"
  );
}

function entitySection(e) {
  const money = MONEY_TRANSACTION_ENTITY_CODES.includes(e.code);
  const moneyNote = money
    ? `**Transactional money entity** — mutation owned exclusively by Module ${e.owningModuleId}; Modules 28/29/30 must not post.`
    : "Non-posting or supporting entity.";
  return `### ${e.code} — ${e.name}

| Field | Value |
|-------|-------|
| **Entity ID** | ${e.code} |
| **Canonical Name** | ${e.name} |
| **Version** | ${e.version} |
| **Domain** | ${e.domain} |
| **Purpose** | ${e.purpose} |
| **Description** | Maps to platform concept(s): \`${(e.persistenceKeys || []).join("`, `")}\`. Pesewas money where financial. ${moneyNote} |
| **Owning Module** | Module ${e.owningModuleId} — ${MODULE_NAMES[e.owningModuleId] || ""} |
| **Aggregate Root** | ${e.aggregateRoot ? "Yes" : "No"} |
| **Parent / Children** | Related children (incoming): ${childrenOf(e.code)} |
| **Relationships** | ${relsFor(e.code)} |
| **Cardinality** | As listed in relationships |
| **Lifecycle Owner** | Module ${e.owningModuleId} |
| **Primary ID** | ${e.primaryIdType} |
| **Alternate IDs / Business Keys** | ${e.businessKey} |
| **State Machine Ref** | ${lifecycleByCode[e.code] || "Active/Inactive or module lifecycle docs"} |
| **Validation Rules (summary)** | Required ids; module contracts; money in integer pesewas where applicable; no dual write by non-owners |
| **Security Classification** | ${e.classification} |
| **Retention / Archival** | Per Module 26 records policy / Module 21 backups; financial never silent-delete |
| **Audit** | Privileged mutations emit Module 13 audit (Class A for money) |
| **Events pub/sub** | ${eventsByCode[e.code] || "Module-owned domain events via publishDomainEvent"} |
| **Owned APIs / Tables (logical)** | Contracts under Module ${e.owningModuleId}; persistence: ${(e.persistenceKeys || []).join(", ")} (localStorage snapshot + optional SQL) |
| **Dependent Modules** | Readers/reporters per Phase 2 Data Ownership Register; AI/Platform/Hub read-only for money |
`;
}

const validation = validateDomainRegistry();
const roots = listAggregateRoots();
const ownerDist = {};
for (const e of CANONICAL_ENTITIES) {
  ownerDist[e.owningModuleId] = (ownerDist[e.owningModuleId] || 0) + 1;
}

const byDomain = {};
for (const e of CANONICAL_ENTITIES) {
  byDomain[e.domain] = byDomain[e.domain] || [];
  byDomain[e.domain].push(e);
}

const main = `# Enterprise Canonical Domain Model (ECDM)

**Product:** SMILE TRUST SUSU MANAGEMENT SYSTEM  
**Document type:** Phase 3 — Authoritative Business Entity Specification  
**Status:** ${validation.ok ? "Authoritative" : "INVALID"}  
**Version:** ${ECDM_VERSION}  
**Date:** 2026-09-12  
**Machine registry:** \`src/core/canonical-domain-registry.js\`  
**Companion matrices:** [\`ecdm-catalogs.md\`](./ecdm-catalogs.md)  

Cross-references: [\`enterprise-master-architecture.md\`](./enterprise-master-architecture.md) (EMAS), [\`emas-matrices.md\`](./emas-matrices.md), Phase 2 [\`enterprise-consistency-review.md\`](./enterprise-consistency-review.md) / [\`phase2-registers.md\`](./phase2-registers.md) / [\`enterprise-governance-validation.md\`](./enterprise-governance-validation.md).

This document is the **single authoritative definition of every business entity** used across **Modules 1–30**. It eliminates duplicate entity definitions and establishes ownership, relationships, identifiers, and governance.

---

## 1. Hard boundaries

| In scope | Out of scope |
|----------|--------------|
| Canonical **business entities** only | Redefining APIs, DB schemas, workflows, or business logic |
| Ownership, aggregates, IDs, classification, cross-module usage | New functional requirements, new nav |
| Mapping to **actual** Susu platform concepts (\`customers\`, \`collections\`, \`loans\`, \`ledgerEntries\`, …) | Inventing a separate retail-banking product model |
| Logical persistence ownership (localStorage + optional SQL tables) | Schema redesign or money-math / RBAC / posting changes |
| Alignment with EMAS + Phase 2 | Rewriting Modules 1–30 specs |

**Project reality (normative):** vanilla JS SPA; Module **20** in-process gateway (no HTTP API server); integer **pesewas**; Admin = Branch Manager; KBA = Super Admin; SystemOwner = \`john\`; Modules **28** Integration Hub, **29** AI (advisory), **30** Platform Admin.

**Explicit non-ownership:** AI entities are **advisory**. Transactional entities (collections, loans, ledger, withdrawals, payments lifecycle) are owned by operational modules (**6–10**, **16**). Modules **28 / 29 / 30** must **not** own mutation of money entities.

**Not entities (configuration):** Cashier float / approval limit (default GHS 1,000), loan interest (15%), collection days (31) live as \`SystemSetting\` / config keys — not separate business entities.

---

## 2. Authoritative status & principles

| ID | Principle | Statement |
|----|-----------|-----------|
| ECDM-P01 | DDD language | One ubiquitous name per concept; aliases (Member→Customer, Contribution→Collection) map to the canonical name |
| ECDM-P02 | Single source of truth | Entity ownership is exclusive; writers are the owning module only |
| ECDM-P03 | Aggregate consistency | Within an aggregate root, invariants are consistent after each owner command |
| ECDM-P04 | Cross-module eventual | Across modules, consistency is via contracts/events; no private dual writes |
| ECDM-P05 | Audit first | Privileged and financial mutations are attributable (Module 13) |
| ECDM-P06 | Versioning | Entity definitions version \`MAJOR.MINOR.PATCH\`; breaking renames need ADR |
| ECDM-P07 | Naming | \`ENT-{DOMAIN}-{NNN}\` codes; PascalCase canonical names; persistence keys document reality |
| ECDM-P08 | Classification | Public / Internal / Confidential / Restricted (Phase 2 / AI governance) |
| ECDM-P09 | Money unit | Core engines store **pesewas**; UI may display GHS |
| ECDM-P10 | Advisory AI | Module 29 may recommend; Module 24 remains deterministic policy authority |

**Precedence:** Live posting paths → module contracts → module specs → this ECDM → EMAS organization → optional SQL migrations.

**Relation to \`canonical-data-model.md\`:** That doc is the PostgreSQL physical/logical table phase. ECDM is the **business entity** SoT. Table names cited here are **references**, not a redesign.

---

## 3. Catalog summary

| Metric | Count |
|--------|-------|
| Canonical entities | ${CANONICAL_ENTITIES.length} |
| Aggregate roots | ${roots.length} |
| Relationships | ${CANONICAL_RELATIONSHIPS.length} |
| Money/transaction codes guarded | ${MONEY_TRANSACTION_ENTITY_CODES.length} |
| Registry validation | ${validation.ok ? "PASS" : "FAIL"} |

### Owning-module distribution

| Module | Name | Entity count |
|--------|------|--------------|
${Object.keys(ownerDist)
  .map(Number)
  .sort((a, b) => a - b)
  .map((id) => `| ${id} | ${MODULE_NAMES[id]} | ${ownerDist[id]} |`)
  .join("\n")}

### Domains covered

${Object.keys(byDomain)
  .sort()
  .map((d) => `- **${d}** (${byDomain[d].length}): ${byDomain[d].map((e) => e.name).join(", ")}`)
  .join("\n")}

---

## 4. Business Entity Catalog

Each entity uses the ECDM definition template. Full compact matrices live in [\`ecdm-catalogs.md\`](./ecdm-catalogs.md).

${CANONICAL_ENTITIES.map(entitySection).join("\n")}

---

## 5. Entity relationships

### 5.1 Cardinality legend

| Notation | Meaning |
|----------|---------|
| 1:1 | Exactly one each side |
| 1:N / N:1 | One-to-many |
| M:N | Many-to-many (via join or role_permissions style) |
| 0..1 | Optional |

### 5.2 Aggregates (roots)

Aggregate roots (${roots.length}): ${roots.map((r) => `\`${r.code}\` ${r.name}`).join("; ")}.

Children update/delete only through the owning module of the root (or explicit child owner when the child is itself a root). **Cascade delete of posted money is forbidden** — use reversal / tombstone patterns already in the app.

### 5.3 Relationship list

| From | To | Cardinality | Kind |
|------|----|-------------|------|
${CANONICAL_RELATIONSHIPS.map((r) => `| ${r.from} | ${r.to} | ${r.cardinality} | ${r.kind} |`).join("\n")}

---

## 6. Identifier standards

Aligned with [\`identifiers.md\`](./identifiers.md) and \`src/core/identifiers.js\` — ECDM does **not** invent a second scheme.

| Kind | Rule |
|------|------|
| Technical ID | UUID v7 preferred; legacy \`prefix-…\` (\`cus-\`, \`col-\`, \`u-owner\`) remain valid |
| Business ID | Prefix catalog (CUS, COL, LON, WDL, RCP, …) |
| Correlation ID | Workflow groups a process; does not replace entity ids |
| Idempotency key | Client-delegated; required for collections |
| External reference | MoMo/SMS ids stored separately, never rewritten |
| Money | Integer pesewas in core; never dual float balances |

Primary ID types in the registry (\`primaryIdType\`) map to \`IDENTIFIER_OWNERS\` / \`BUSINESS_PREFIXES\` where applicable.

---

## 7. Data governance

### 7.1 Classification classes

| Class | Handling | Entity assignments |
|-------|----------|-------------------|
| **Public** | May appear in non-auth marketing surfaces | ${CANONICAL_ENTITIES.filter((e) => e.classification === "Public").map((e) => e.code).join(", ") || "(none in v1.0.0 — Susu ops data is at least Internal)"} |
| **Internal** | Authenticated staff | ${CANONICAL_ENTITIES.filter((e) => e.classification === "Internal").map((e) => e.code).join(", ")} |
| **Confidential** | Need-to-know / PII | ${CANONICAL_ENTITIES.filter((e) => e.classification === "Confidential").map((e) => e.code).join(", ")} |
| **Restricted** | Financial / security / AI restricted datasets | ${CANONICAL_ENTITIES.filter((e) => e.classification === "Restricted").map((e) => e.code).join(", ")} |

Allowed classification vocabulary: ${CLASSIFICATIONS.join(", ")}.

### 7.2 Retention

- Posted money entities: retain; reverse rather than delete; tombstones via \`deletedRecords\` where used.
- Audit: append-only.
- AI Restricted datasets: masking; UI requires \`Ai.Govern\` / \`Ai.Admin\` / SystemOwner (Module 29 docs).
- Platform tenant deletion: retention policy rows in Module 30.

---

## 8. Versioning policy

| Change type | Version bump | Process |
|-------------|--------------|---------|
| Editorial / clarification | PATCH | Doc + registry comment |
| New optional attribute / relationship | MINOR | Update ECDM + catalogs + registry + tests |
| Rename, owner change, split/merge entity | MAJOR | ADR + Architecture Review Workflow; Phase 2 Change Governance |
| Money owner change | **Forbidden** without ADR + contract tests | Must preserve Modules 6–10 / 16 posting exclusivity |

Entity field \`version\` starts at \`1.0.0\` for all catalog rows.

---

## 9. Cross-module usage

| Usage | Modules | Rule |
|-------|---------|------|
| **Own / mutate** | Owning module only | Exclusive write |
| **Read (ops)** | Dependents in \`MODULE_CONSUME\` / Phase 2 register | Via contracts/queries |
| **Report** | 11, 27 | Query aggregates; do not recalculate foreign balances as SoT |
| **AI** | 29 | Advisory read of features/predictions; **no** posting |
| **Integration** | 28 (extends 20) | Partner dispatch/transform; **no** Susu collection post |
| **Platform** | 30 | Tenants/flags/licenses/envs; **no** domain posting |
| **Exchange / Records** | 25 / 26 | Bulk metadata / retention; no unapproved financial apply |

Money codes: \`${MONEY_TRANSACTION_ENTITY_CODES.join("`, `")}\`.

---

## 10. Traceability

| Artifact | Role |
|----------|------|
| EMAS | Architecture organization for Modules 1–30 |
| Phase 2 registers | Data ownership / conflicts baseline |
| Module docs under \`docs/*.md\` | Detailed behavior (unchanged by ECDM) |
| \`src/core/*\` | Live engines & state keys |
| \`canonical-domain-registry.js\` | Machine-readable ECDM |
| \`tests/ecdm-consistency.test.js\` | Invariants |

---

*End of ECDM v${ECDM_VERSION}*
`;

const catalogs = `# ECDM Catalogs (Phase 3 Companion Matrices)

**Parent:** [\`enterprise-canonical-domain-model.md\`](./enterprise-canonical-domain-model.md)  
**Registry:** \`src/core/canonical-domain-registry.js\`  
**Version:** ${ECDM_VERSION}  
**Date:** 2026-09-12  
**Scope:** Modules 1–30 · EMAS · Phase 2 alignment  

---

## 1. Canonical Entity Catalog

| Entity ID | Canonical Name | Domain | Owner Module | Aggregate Root | Primary ID | Classification | Persistence keys |
|-----------|----------------|--------|--------------|----------------|------------|----------------|------------------|
${CANONICAL_ENTITIES.map(
  (e) =>
    `| ${e.code} | ${e.name} | ${e.domain} | ${e.owningModuleId} | ${e.aggregateRoot ? "Y" : "N"} | ${e.primaryIdType} | ${e.classification} | ${(e.persistenceKeys || []).join(", ")} |`
).join("\n")}

**Totals:** ${CANONICAL_ENTITIES.length} entities · ${roots.length} aggregate roots.

---

## 2. Aggregate Root Catalog

| Entity ID | Name | Owner | Purpose |
|-----------|------|-------|---------|
${roots.map((e) => `| ${e.code} | ${e.name} | ${e.owningModuleId} | ${e.purpose} |`).join("\n")}

---

## 3. Relationship Matrix

| From | To | Cardinality | Kind |
|------|----|-------------|------|
${CANONICAL_RELATIONSHIPS.map((r) => `| ${r.from} | ${r.to} | ${r.cardinality} | ${r.kind} |`).join("\n")}

---

## 4. Ownership Matrix

| Entity ID | Name | Business owner (module) | Technical owner (core) | Lifecycle owner | DB/persistence owner | API/contract owner | Event owner |
|-----------|------|-------------------------|------------------------|-----------------|----------------------|--------------------|-------------|
${CANONICAL_ENTITIES.map((e) => {
  const tech = `Module ${e.owningModuleId} cores`;
  return `| ${e.code} | ${e.name} | ${e.owningModuleId} | ${tech} | ${e.owningModuleId} | ${e.owningModuleId} | ${e.owningModuleId} | ${e.owningModuleId} |`;
}).join("\n")}

**Money posting owners (exclusive):** Modules 6, 7, 8, 9, 10 (+16 payment lifecycle). **Must not write money:** 28, 29, 30 (and BI/exchange/records/rules/workflow for posting).

---

## 5. Identifier Registry

| Entity ID | Primary ID type | Business key / prefix notes |
|-----------|-----------------|-----------------------------|
${CANONICAL_ENTITIES.map((e) => `| ${e.code} | ${e.primaryIdType} | ${e.businessKey} |`).join("\n")}

See also [\`identifiers.md\`](./identifiers.md) and \`BUSINESS_PREFIXES\` in \`identifiers.js\`.

---

## 6. Entity Dependency Matrix (selected)

High-level **depends on** (child → parent / required peer):

| Entity | Depends on |
|--------|------------|
| Customer | Branch, optional SusuGroup |
| SavingsAccount | Customer, SavingsProduct |
| Collection | Customer, Branch; optional Agent, SavingsAccount |
| Loan | Customer |
| LoanRepayment | Loan |
| WithdrawalRequest | Customer; optional SavingsAccount |
| LedgerEntry | JournalEntry; may reference Collection/Loan/Withdrawal |
| PaymentTransaction | optional Customer |
| WorkflowTask | WorkflowInstance → WorkflowDefinition |
| AiPrediction | AiModel; optional AiDataset |
| License | Tenant |
| IntegrationWebhook | IntegrationProvider |
| ApiKey | ApiClient |

Full edges: Relationship Matrix §3.

---

## 7. Entity Lifecycle Catalog

| Entity ID | Lifecycle (summary) | Owner |
|-----------|---------------------|-------|
${CANONICAL_ENTITIES.map(
  (e) =>
    `| ${e.code} | ${lifecycleByCode[e.code] || "Active/Inactive or module-specific lifecycle"} | ${e.owningModuleId} |`
).join("\n")}

---

## 8. Entity Classification Register

| Classification | Count | Entity IDs |
|----------------|-------|------------|
${CLASSIFICATIONS.map((c) => {
  const list = CANONICAL_ENTITIES.filter((e) => e.classification === c);
  return `| ${c} | ${list.length} | ${list.map((e) => e.code).join(", ") || "—"} |`;
}).join("\n")}

---

## 9. Canonical Naming Standard

| Rule | Example |
|------|---------|
| Entity code | \`ENT-{DOMAIN}-{NNN}\` — \`ENT-CUS-001\` |
| Domain tokens | ORG, IDN, CUS, SAV, GRP, LON, WDL, FIN, PAY, WFK, DOC, NTF, AUD, CFG, SYN, JOB, MON, GWY, BKP, SEC, RUL, XCH, BI, INT, AI, PLT |
| Canonical name | PascalCase noun — \`SavingsAccount\`, \`WithdrawalRequest\` |
| Persistence keys | Document real state keys — \`collections\`, \`ledgerEntries\`, \`platformTenants\` |
| Aliases (non-canonical) | Member→Customer; Contribution→Collection; Organization→businesses/\`businessId\` |
| Forbidden | Parallel \`members\`/\`organizations\`/\`users\` tables reinventing SoT |

---

## 10. Cross-Reference Index to Modules 1–30

| Module | Name | ECDM entities owned |
|--------|------|---------------------|
${Object.keys(MODULE_NAMES)
  .map(Number)
  .sort((a, b) => a - b)
  .map((id) => {
    const owned = CANONICAL_ENTITIES.filter((e) => e.owningModuleId === id);
    return `| ${id} | ${MODULE_NAMES[id]} | ${owned.length ? owned.map((e) => e.code).join(", ") : "—(query/report/cross-cutting; no exclusive entity in v1.0.0)"} |`;
  })
  .join("\n")}

**Note:** Modules **2** (Dashboard) and **11** (Reports) are query/report surfaces over owned entities; they do not introduce duplicate entity definitions.

---

## 11. Money / advisory boundary checklist

| Check | Status |
|-------|--------|
| Money entities not owned by 28/29/30 | Enforced in registry + tests |
| AI entities advisory only | ENT-AI-* owned by 29; no money codes |
| Integration owns hub metadata only | ENT-INT-* |
| Platform owns tenants/flags/licenses only | ENT-PLT-* |
| EMAS Modules 1–30 referenced | Yes |
| Phase 2 Data Ownership Register aligned | Yes |

---

*End of ECDM Catalogs v${ECDM_VERSION}*
`;

fs.writeFileSync(path.join(DOCS, "enterprise-canonical-domain-model.md"), main, "utf8");
fs.writeFileSync(path.join(DOCS, "ecdm-catalogs.md"), catalogs, "utf8");
console.log(
  JSON.stringify(
    {
      written: ["enterprise-canonical-domain-model.md", "ecdm-catalogs.md"],
      entityCount: CANONICAL_ENTITIES.length,
      aggregateRootCount: roots.length,
      validation
    },
    null,
    2
  )
);
