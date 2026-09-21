# Enterprise AI Automation Decision & Identifier Specification (EAIADIS) — Phase 12

**Product:** SMILE TRUST SUSU MANAGEMENT SYSTEM  
**Status:** Authoritative for Phase 12 AI Capability Registry refinements  
**Version:** 1.0.0  
**Date:** 2026-09-14  
**Owning module:** 29 — Enterprise AI (not Module 30)  
**Deterministic authority:** Module 24 — Rule Engine  
**Companion:** [`enterprise-ai.md`](./enterprise-ai.md)  
**Schemas:** [`schemas/manifest.json`](./schemas/manifest.json)  
**Code:** `src/core/canonical-ai-registry.js`, `src/core/phase12-identifier-governance.js`, `src/core/phase12-document-envelope.js`

---

## Document control

| Field | Value |
|-------|-------|
| Document type | EAIADIS |
| Envelope example | `docs/schemas/examples/document-envelope-example.json` |
| Accountable authority | Risk Manager (capability pack); Architecture for envelope prose |
| Decision mode | **advisory** only |
| Money posts | **Forbidden** for AI capabilities |
| Auto loan approval | **Forbidden** |
| Nav changes | **None** |

**Non-regression:** Phases 8–11 artifacts (when present under `docs/schemas/`, envelope helpers, and prior EAIADIS sections) remain authoritative for their scope. Phase 12 **adds** capability registry, governance/audit schemas, and identifier governance without rewriting Module 1–30 business math, RBAC forbidden lists, or Module 24 rules.

---

## 1. AI Capability Registry Specification

### 1.1 Purpose

The AI Capability Registry is the **single catalog** of production-facing AI behaviors. Every advisory prediction, fraud signal, risk score, recommendation, forecast, or anomaly detector that operators may invoke must appear exactly once with stable `id` + `code`.

### 1.2 Field table

| Field | Type | Required | Constraints / notes |
|-------|------|----------|---------------------|
| `id` | string | Yes | Pattern `^AI-CAP-[0-9]{3}$` |
| `code` | string | Yes | `UPPER_SNAKE`, unique, pattern `^[A-Z][A-Z0-9_]{2,63}$` |
| `name` | string | Yes | Human title ≤ 200 |
| `description` | string | Yes | Purpose, limits, non-goals ≤ 4000 |
| `category` | enum | Yes | See §1.3 |
| `subcategory` | string | No | Fine-grained tag |
| `version` | semver | Yes | `MAJOR.MINOR.PATCH` |
| `lifecycleState` | enum | Yes | Proposed → … → Active / Suspended / Retired |
| `decisionMode` | const | Yes | Must be `advisory` |
| `humanReviewRequired` | boolean | Yes | Must be `true` |
| `autoExecuteAllowed` | boolean | Yes | Must be `false` |
| `canPostMoney` | boolean | Yes | Must be `false` |
| `canApproveLoans` | boolean | Yes | Must be `false` |
| `replacesRuleEngine` | boolean | Yes | Must be `false` (Module 24 remains SoT for deterministic policy) |
| `owningModule` | integer | Yes | Must be **29** (never 30) |
| `relatedModules` | int[] | Yes | Unique module numbers 1–30; loan default includes **8** and **29** |
| `accountableAuthority` | string | Yes | **Exactly one** party (see §10) |
| `businessOwner` | string | Yes | Business RACI owner |
| `technicalOwner` | string | Yes | Technical builder (typically ML Engineer) |
| `riskLevel` | enum | Yes | Low / Medium / High / Critical |
| `dataClassification` | enum | Yes | Public / Internal / Confidential / Restricted |
| `inputs` | object[] | No | Named inputs with types |
| `outputs` | object[] | No | Named outputs; probabilistic |
| `modelRefs` | string[] | No | Model registry references |
| `featureRefs` | string[] | No | Feature registry references |
| `crossReferences` | object | No | Contracts, events, permissions, documents, `ruleEngineModule: 24` |
| `validationRules` | object[] | No | Registry-level validation statements |
| `effectiveFrom` / `effectiveTo` | date-time | No | Validity window |
| `governance` | object | Yes | `$ref` governance schema (§4–5) |
| `audit` | object | Yes | `$ref` audit schema (§4–5) |
| `metadata` | object | Yes | Absolute `$ref` common metadata |

### 1.3 Categories

| Category | Intent |
|----------|--------|
| Prediction | Probabilistic forecasts (e.g. default probability) |
| FraudDetection | Suspicious pattern alerts (no ledger mutation) |
| RiskScoring | Entity risk scores |
| Recommendation | Advisory actions; accept/reject/override with justification |
| Forecasting | Time-horizon aggregates (pesewas where money-related) |
| AnomalyDetection | Metric / behavior outliers |
| Explainability | XAI packaging for predictions |
| MLOps | Training / deploy / drift support capabilities |
| GovernanceSupport | Registry, policy, and oversight tooling |

### 1.4 Ownership

| Concern | Owner |
|---------|--------|
| Registry SoT (code) | `src/core/canonical-ai-registry.js` |
| Registry schema | `docs/schemas/ai/ai-capability-registry.schema.json` |
| Module ownership | Module **29** |
| Related domain modules | Declared in `relatedModules` (e.g. Loan = **8**) |
| Deterministic policy | Module **24** (never replaced) |
| Platform (30) | May host infra flags; **does not** own AI-CAP entries |

### 1.5 Lifecycle

`Proposed` → `Registered` → `Validated` → `Approved` → `Active` ⇄ `Suspended` → `Retired`

Transitions that enable production inference require governance `approvalStatus=Approved`, human oversight, and audit trail.

### 1.6 Cross-references

Capabilities must cross-link:

- Module 29 contracts (`Ai.Predict.v1`, …)
- Events (`PredictionGenerated`, …)
- Permissions from `ai-permission-registry.js`
- Documents (`enterprise-ai.md`, this EAIADIS)
- Rule Engine module **24**

### 1.7 Validation

Machine validation:

1. Schema: `ai-capability-registry.schema.json` (+ governance/audit/metadata absolute `$ref`s)
2. Runtime: `validateAiCapabilityEntry` / `assertAiCapabilityRegistryIntegrity`
3. Identifier + SoD: `validateCapabilityGovernanceBundle`

### 1.8 Audit

Every capability carries an `audit` block (`AI-AUD-NNN`) with independent `auditor`, immutable log reference, retention ≥ 365 days, and control results. Approver ≠ auditor (§9).

---

## 2. Complete AI Capability Registry JSON Example

**Capability:** Loan Default Prediction  
**Id:** `AI-CAP-001`  
**Code:** `LOAN_DEFAULT_PREDICTION`  
**relatedModules:** Loan = **8**, AI = **29** (not 30)

Full example (authoritative file):

[`docs/schemas/examples/ai-cap-001-loan-default-prediction.json`](./schemas/examples/ai-cap-001-loan-default-prediction.json)

Seeded in code as `AI_CAP_001` / `AI_CAPABILITY_REGISTRY` in `canonical-ai-registry.js`.

Highlights:

- `decisionMode: "advisory"`
- `humanReviewRequired: true`
- `canPostMoney: false`, `canApproveLoans: false`, `replacesRuleEngine: false`
- `accountableAuthority: "Risk Manager"` (matches `governance.accountableAuthority`)
- `governance.approvingAuthority: "Model Validator"`
- `audit.auditor: "Internal Auditor"` (SoD vs approver)

---

## 3. Matching JSON Schema

| Property | Value |
|----------|-------|
| Path | `docs/schemas/ai/ai-capability-registry.schema.json` |
| `$id` | `https://schemas.smiletrust.com/ai/ai-capability-registry.schema.json` |
| Id pattern | `^AI-CAP-[0-9]{3}$` |
| Metadata `$ref` | `https://schemas.smiletrust.com/common/metadata.schema.json` (absolute) |
| Governance `$ref` | `https://schemas.smiletrust.com/ai/governance.schema.json` |
| Audit `$ref` | `https://schemas.smiletrust.com/ai/audit.schema.json` |

---

## 4. Governance & Audit Field Definitions

### 4.1 Governance fields

| Field | Definition |
|-------|------------|
| `governanceId` | `AI-GOV-NNN` governance record id |
| `riskClass` | Low / Medium / High / Critical |
| `approvalStatus` | Draft → … → Approved / Rejected / Suspended / Retired |
| `approvingAuthority` | Party that may approve use (≠ auditor) |
| `accountableAuthority` | Single RACI **A** (must match root) |
| `responsibleParty` | RACI **R** (does the work) |
| `consultedParties` / `informedParties` | RACI C / I |
| `humanOversightRequired` | Always `true` |
| `exceptionRequired` | Whether an exception path is active |
| `exceptionApprovalAuthority` | **Conditional** — required when `exceptionRequired=true` **or** `riskClass=Critical` |
| `exceptionJustification` | Text when exception path used |
| `sodProfile` | Hard flags: approver≠auditor, developer≠validator |
| `policyReferences` | Policy / EMAS pointers |

**Example (standard):** [`schemas/examples/governance-example.json`](./schemas/examples/governance-example.json)  
**Example (exception / Critical):** [`schemas/examples/governance-exception-example.json`](./schemas/examples/governance-exception-example.json)

### 4.2 Audit fields

| Field | Definition |
|-------|------------|
| `auditId` | `AI-AUD-NNN` |
| `auditStatus` | NotStarted → Passed / Failed / … |
| `auditor` | Independent party (≠ approvingAuthority) |
| `auditTrailRequired` | Always `true` |
| `retentionDays` | ≥ 365 |
| `lastAuditAt` / `nextAuditDue` | Schedule |
| `findingsOpen` | Count of open findings |
| `controlsChecked` | Control id + Pass/Fail/… |
| `immutableLogReference` | Pointer into Module 29 / audit stream |

**Example:** [`schemas/examples/audit-example.json`](./schemas/examples/audit-example.json)

---

## 5. Governance & Audit JSON Schemas

| Schema | `$id` |
|--------|-------|
| `docs/schemas/ai/governance.schema.json` | `https://schemas.smiletrust.com/ai/governance.schema.json` |
| `docs/schemas/ai/audit.schema.json` | `https://schemas.smiletrust.com/ai/audit.schema.json` |

Capability registry wires both via absolute `$ref`.

**Conditional `exceptionApprovalAuthority`:** governance schema `allOf` / `if`–`then` requires the field when `exceptionRequired === true` or `riskClass === "Critical"`. Runtime mirror: `assertGovernanceConditionals` in `phase12-identifier-governance.js`.

---

## 6. Identifier & Format Handling

| Kind | Pattern | Example |
|------|---------|---------|
| Capability ID | `^AI-CAP-[0-9]{3}$` | `AI-CAP-001` |
| Capability code | `^[A-Z][A-Z0-9_]{2,63}$` | `LOAN_DEFAULT_PREDICTION` |
| Governance ID | `^AI-GOV-[0-9]{3}$` | `AI-GOV-001` |
| Audit ID | `^AI-AUD-[0-9]{3}$` | `AI-AUD-001` |
| Envelope ID | `^ENV-[0-9]{3}$` | `ENV-012` |
| Authority slot | `^AUTH-[A-Z]{2,8}-[0-9]{3}$` | `AUTH-RISK-001` |
| Semver | `^\d+\.\d+\.\d+$` | `1.0.0` |

Shared defs: `docs/schemas/common/identifiers.schema.json`  
Validators: `validateIdentifierFormat` / `ID_FORMATS`.

Checksums in metadata are **lowercase** SHA-256 hex (64 chars), consistent with enterprise checksum policy.

---

## 7. Identifier Generation Rules

| Namespace | Width | Start | Reuse after retire | Allocator |
|-----------|-------|-------|--------------------|-----------|
| `AI-CAP` | 3 | 001 | **No** | `canonical-ai-registry` |
| `AI-GOV` | 3 | 001 | **No** | `ai-governance` |
| `AI-AUD` | 3 | 001 | **No** | `ai-audit` |
| `ENV` | 3 | 001 | **No** | `phase12-document-envelope` |

Rules:

1. Allocate next free sequence via `nextSequentialId(namespace, existingIds)`.
2. Never reuse an id after `Retired` / supersession.
3. Codes (`LOAN_DEFAULT_PREDICTION`) are stable; changing a code is a breaking change requiring change control.
4. Module 24 and Module 30 must not mint `AI-CAP-*`.
5. Generation is recorded in audit metadata (`createdBy`, `correlationId`).

---

## 8. Identifier Ownership Boundaries

See `IDENTIFIER_OWNERSHIP_MATRIX` in `phase12-identifier-governance.js`.

| Kind | Minting owner | May not mint |
|------|---------------|--------------|
| AI Capability ID | Module 29 | Modules 24, 30, 8 |
| AI Capability Code | Module 29 | Modules 24, 30 |
| Governance ID | Module 29 AI Governance | ML Engineer, Collector |
| Audit ID | Internal Audit (+ Module 22 coord.) | Model Validator, ML Engineer, MLOps |
| Envelope ID | Architecture / EAIADIS stewards | Collector, Branch Manager |
| Authority slot | Governance | AI runtime, Rule Engine |

**Boundary clarification:** Module **8** (Loans) **consumes** `AI-CAP-001` outputs through human/Workflow paths; it does **not** own or mint the capability id. Module **30** may gate feature flags but does **not** own the capability registry.

---

## 9. Authority vs Responsibility Clarification (SoD)

| Role slot | RACI | Meaning |
|-----------|------|---------|
| `accountableAuthority` | **A** | Single owner of outcome; exactly one |
| `responsibleParty` | **R** | Performs build/operate work |
| `approvingAuthority` | Approve | Grants use / go-live approval |
| `auditor` | Assure | Independent review |

**Hard SoD rules (AI capabilities):**

1. `approvingAuthority` ≠ `auditor`
2. Developer / `technicalOwner` ≠ validator / approving Model Validator
3. AI output never self-authorizes money movement or loan approval
4. Module 24 remains deterministic; AI is advisory input only

Helpers: `clarifyAuthorityVsResponsibility`, `assertSegregationOfDuties`.

---

## 10. Accountable Authority Consistency

**Rule:** Exactly **one** `accountableAuthority` per capability (and per envelope).

Enforcement:

1. Field is a single string (not array, not comma/semicolon list).
2. Root `accountableAuthority` **must equal** `governance.accountableAuthority`.
3. Schema + `assertSingleAccountableAuthority` reject multiples / mismatches.
4. For `AI-CAP-001`, accountable authority is **Risk Manager**.

---

## Schema package inventory

Complete package under `docs/schemas/`:

| Area | Files |
|------|-------|
| `common/` | `metadata`, `identifiers`, `classification`, `module-ref` |
| `envelope/` | `document-envelope`, `section-envelope` |
| `ai/` | `ai-capability-registry`, `governance`, `audit` |
| `examples/` | capability, governance (± exception), audit, envelope |
| Root | `manifest.json` with absolute `$id`s |

All `$id` values use host `schemas.smiletrust.com` — **no placeholders**.

---

## Acceptance (Phase 12)

- [x] Capability registry specification (§1)
- [x] `AI-CAP-001` example with modules 8 + 29
- [x] Matching schema `$id` + pattern + absolute metadata `$ref`
- [x] Governance & audit field defs + examples
- [x] Governance & audit schemas + conditional exception authority
- [x] Identifier formats, generation, ownership
- [x] Authority vs responsibility SoD
- [x] Exactly one accountableAuthority
- [x] Code seeds + uniqueness + advisory flags
- [x] Tests in `tests/phase12-capability-registry.test.js`
- [x] No new nav; no money/loan auto posts; Module 24 preserved

---

## Version history

| Version | Notes |
|---------|--------|
| 1.0.0 | Phase 12 AI Capability Registry refinements |
