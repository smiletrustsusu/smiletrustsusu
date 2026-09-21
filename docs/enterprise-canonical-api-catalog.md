# Enterprise Canonical API Catalog & Interface Specification (ECACIS)

**Product:** SMILE TRUST SUSU MANAGEMENT SYSTEM  
**Document type:** Phase 6 — Authoritative API / Interface Catalog  
**Status:** Authoritative  
**Version:** 1.0.0  
**Date:** 2026-09-12  
**Machine registry:** `src/core/canonical-api-registry.js`  
**Companion matrices:** [`ecacis-catalogs.md`](./ecacis-catalogs.md)  
**Facades:** [`openapi-enterprise-facade.json`](./openapi-enterprise-facade.json), [`graphql-enterprise-facade.graphql`](./graphql-enterprise-facade.graphql)  
**Governance workflow:** `src/core/phase6-deliverable-workflow.js`

Cross-references: Phase 1 [`enterprise-master-architecture.md`](./enterprise-master-architecture.md); Phase 2 registers / governance; Phase 3 ECDM; Phase 4 ECSMLS; Phase 5 ECECMS [`enterprise-canonical-event-catalog.md`](./enterprise-canonical-event-catalog.md).

---

## DISCLAIMER — Facade only (normative)

**OpenAPI and GraphQL artifacts in this pack are documentation facades** over in-process `invokeContract` / Module **20** gateway routes.

- There is **NO live REST HTTP server** exposing these paths in production SPA mode.
- There is **NO live GraphQL HTTP server**.
- Runtime authority remains `module-contracts.js` (`CONTRACT_CATALOG` / `invokeContract`) and `api-gateway-lifecycle.js` (`ROUTE_CATALOG`).
- Path templates such as `/contracts/{contractId}` and `/gateway/{route}` are **catalog aliases**, not networked endpoints.

---

## 1. Authoritative status & design principles

| ID | Principle | Statement |
|----|-----------|-----------|
| ECACIS-P01 | Catalog actual contracts | Endpoints generated from real `CONTRACT_CATALOG` kinds command/query/admin/batch/health — **not** events |
| ECACIS-P02 | Gateway aliases | `ROUTE_CATALOG` entries appear as facade aliases owned by Module 20 |
| ECACIS-P03 | Phase 5 events by id | APIs may list related `EVT-*` / event names; they do not redefine ECECMS |
| ECACIS-P04 | ECDM / ECSMLS soft links | Optional entity/SM hints only; registries remain authorities |
| ECACIS-P05 | In-process Module 20 | Gateway remains in-process |
| ECACIS-P06 | No money / RBAC / posting changes | Identifier references only |
| ECACIS-P07 | Facade honesty | OpenAPI/GraphQL marked non-live |
| ECACIS-P08 | Governance workflow | Stage sequencing + 16 statuses via Phase 6 workflow module |
| ECACIS-P09 | Versioning | Contract semver / route version tags |
| ECACIS-P10 | Authz by action | `action` from contract / route — no new RBAC matrices |

---

## 2. IMPLEMENTATION BOUNDARY

| In scope | Out of scope |
|----------|--------------|
| Canonical API/endpoint registry + docs | Standing up REST/GraphQL servers |
| Facade OpenAPI 3.1 + thin GraphQL schema | Changing invokeContract money paths |
| Deliverable governance workflow (stages/statuses/SoD/AWC) | New business features / navigation |
| Consistency tests | Phase 7+ work |
| Cross-refs to Phases 1–5 | Redefining events/entities/SMs |

---

## 3. Phase Input & Dependency Rules Specification

### 3.1 Required inputs (consume only)

| Input | Artifact |
|-------|----------|
| Phase 1 EMAS | enterprise-master-architecture.md, emas-matrices.md |
| Phase 2 | enterprise-consistency-review.md, phase2-registers.md, enterprise-architecture-review-workflow.md, enterprise-governance-validation.md |
| Phase 3 ECDM | enterprise-canonical-domain-model.md, ecdm-catalogs.md, canonical-domain-registry.js |
| Phase 4 ECSMLS | enterprise-canonical-state-machines.md, ecsmls-catalogs.md, canonical-state-machine-registry.js |
| Phase 5 ECECMS | enterprise-canonical-event-catalog.md, ececms-catalogs.md, canonical-event-registry.js |
| Contracts / gateway | module-contracts.js, api-gateway-lifecycle.js |

**Sequencing:** Phase **5** (ECECMS) MUST be complete before Phase **6** (ECACIS) baselines event-linked API fields.

### 3.2 Precedence (conflicts)

1. ADRs / explicit exceptions  
2. EMAS (Phase 1)  
3. Phase 2 governance  
4. ECDM (Phase 3)  
5. ECSMLS (Phase 4)  
6. ECECMS (Phase 5)  
7. Module contracts / gateway catalogs  
8. Global standards  

### 3.3 Dependency rules

| Rule | Statement |
|------|-----------|
| D1 | API facades MUST map to real contract ids or gateway route ids |
| D2 | Event links MUST use ECECMS / contract event identifiers only |
| D3 | Entity/SM hints MUST NOT invent new ECDM/ECSMLS rows |
| D4 | OpenAPI/GraphQL MUST declare facade-only disclaimer |
| D5 | Workflow module enforces stages/statuses without changing domain money logic |

### 3.4 Output constraints

| Deliverable | Constraint |
|-------------|------------|
| enterprise-canonical-api-catalog.md | Primary ECACIS + governance sections |
| ecacis-catalogs.md | Matrices only |
| canonical-api-registry.js | Machine-readable endpoints |
| openapi-enterprise-facade.json / graphql-enterprise-facade.graphql | Facades only |
| phase6-deliverable-workflow.js | Governance enforcement |
| tests/ecacis-consistency.test.js, tests/phase6-deliverable-workflow.test.js | Invariants |

### 3.5 Prohibited activities

- Claim live REST/GraphQL servers exist  
- Change money math, RBAC forbidden lists, or posting  
- Redefine Phase 3–5 registries  
- Skip Phase 5 before baselining event-linked APIs  
- Start Phase 7+  

### 3.6 Traceability / validation

Every endpoint records: id, method, uriTemplate/contractId, owningModule, auth/permissions, version, lifecycle, optional entity/SM/events/rateLimit/idempotent. Validated by `validateApiRegistry()`.

---

## 4. Catalog summary

| Metric | Count |
|--------|-------|
| Total facade endpoints | **426** |
| Contract facades (command/query/admin/batch/health) | 312 |
| Gateway route facades | 114 |
| By contract kind | command:195, query:117 |
| Live HTTP server | **false** |
| Registry validation | ok=true |

---

## 5. Stage sequencing specification (1–11)

| Stage | Code | Name | Completion criteria (flags) |
|------:|------|------|-----------------------------|
| 1 | INPUT_VALIDATION | Input Validation | Phases 1-5 inputs present; contracts load |
| 2 | API_OWNERSHIP_REGISTRY | API Ownership Registry | Owning module 1-30 assigned per endpoint |
| 3 | ENDPOINT_REGISTRY | Endpoint Registry | canonical-api-registry covers contracts + gateway |
| 4 | CANONICAL_INTERFACE_CONTRACTS | Canonical Interface Contracts | Contract ids resolve via module-contracts |
| 5 | SCHEMA_REGISTRY | Schema Registry | Request/response schema refs documented |
| 6 | SECURITY_AUTHORIZATION | Security & Authorization | Actions referenced; no RBAC rewrite |
| 7 | OPERATIONAL_CHARACTERISTICS | Operational Characteristics | SLA / rate / idempotency notes present |
| 8 | VERSIONING_LIFECYCLE | Versioning & Lifecycle | Semver / lifecycle on endpoints |
| 9 | MACHINE_READABLE_SPECS | Machine-Readable Specs | OpenAPI 3.1 + GraphQL facades only (no live HTTP) |
| 10 | TRACEABILITY_CROSS_REFERENCES | Traceability & Cross-References | Entity/SM/event soft links checked |
| 11 | FINAL_QUALITY_REVIEW | Final Quality Review | Consistency tests green; ready to baseline |

**Rule:** stages cannot be skipped; `completeStage` requires prior stages complete and `criteriaMet: true` (`phase6-deliverable-workflow.js`).

### Output Sequencing Specification

1. Validate inputs (Phases 1–5)  
2. Generate `canonical-api-registry.js` from catalogs  
3. Author primary ECACIS + companion matrices  
4. Emit OpenAPI / GraphQL facades with disclaimer  
5. Wire Phase 6 workflow helpers  
6. Run consistency + workflow tests  
7. Approvals → baseline → publish (governance statuses)

### Required Stage Completion Criteria

Each stage requires explicit `criteriaMet` evidence in the workflow audit log. Missing criteria → `P6W-063`.

---

## 6. Approval Roles & Sign-Off Rules

| Role | Duty |
|------|------|
| Primary Owner | Authors catalog; cannot be Accountable Approver |
| Accountable Approver | Accepts scope & correctness; ≠ Primary Owner |
| Independent Reviewer | Independent of Primary Owner; required before publish |
| Final Quality | Confirms tests/facade disclaimers before publish |

SoD: Primary Owner ≠ Accountable Approver; owner ≠ sole independent reviewer (`P6W-010`, `P6W-011`).

### Approved-with-Conditions Workflow

1. No open **Critical** findings (`P6W-030`)  
2. Conditions recorded with open/closed lifecycle  
3. Status path: `ApprovedWithConditions` → `ConditionsInProgress` → (all closed) → `Approved` → `BaselineCandidate` → `Baselined`  
4. **Cannot baseline or publish** while conditions remain open (`P6W-040`)

---

## 7. Deliverable Status Transition Specification (16 statuses)

| # | Status |
|---|--------|
| 1 | NotStarted |
| 2 | Draft |
| 3 | InAuthoring |
| 4 | Submitted |
| 5 | UnderReview |
| 6 | ChangesRequested |
| 7 | PendingApproval |
| 8 | Approved |
| 9 | ApprovedWithConditions |
| 10 | ConditionsInProgress |
| 11 | Rejected |
| 12 | BaselineCandidate |
| 13 | Baselined |
| 14 | Published |
| 15 | Deprecated |
| 16 | Retired |

Allowed transitions (matrix authority: `P6_STATUS_TRANSITIONS`):

| From | Allowed to |
|------|------------|
| NotStarted | Draft |
| Draft | InAuthoring, Rejected |
| InAuthoring | Submitted, Draft, Rejected |
| Submitted | UnderReview, ChangesRequested, Rejected |
| UnderReview | ChangesRequested, PendingApproval, Rejected |
| ChangesRequested | InAuthoring, Submitted, Rejected |
| PendingApproval | Approved, ApprovedWithConditions, Rejected, ChangesRequested |
| Approved | BaselineCandidate, Deprecated |
| ApprovedWithConditions | ConditionsInProgress, Rejected |
| ConditionsInProgress | ApprovedWithConditions, Approved, Rejected |
| Rejected | Draft |
| BaselineCandidate | Baselined, Approved, Rejected |
| Baselined | Published, Deprecated |
| Published | Deprecated |
| Deprecated | Retired, Published |
| Retired | ∅ |

### Deliverable Status Entry & Exit Criteria (all 16)

| Status | Entry criteria | Exit criteria |
|--------|----------------|---------------|
| NotStarted | Deliverable created with SoD roles (owner != approver) | Transition to Draft |
| Draft | From NotStarted or Rejected; scope known | Move to InAuthoring or Rejected |
| InAuthoring | Draft accepted for authoring; inputs available | Submit for review or return to Draft / Rejected |
| Submitted | Authoring complete enough for review | UnderReview, ChangesRequested, or Rejected |
| UnderReview | Independent review started | PendingApproval, ChangesRequested, or Rejected |
| ChangesRequested | Review findings require rework | Return to InAuthoring / re-Submit / Rejected |
| PendingApproval | Review passed; awaiting formal decision | Approved, ApprovedWithConditions, ChangesRequested, or Rejected |
| Approved | Approver accepts with no open conditions | BaselineCandidate or Deprecated |
| ApprovedWithConditions | Approver accepts with recorded conditions; no open Critical findings (P6W-030) | ConditionsInProgress or Rejected |
| ConditionsInProgress | Condition work underway under AWC | Return to ApprovedWithConditions, promote to Approved when all closed, or Rejected |
| Rejected | Formal rejection recorded | Restart at Draft |
| BaselineCandidate | Approved and ready for baseline gate; conditions closed | Baselined, return to Approved, or Rejected |
| Baselined | From BaselineCandidate; no open conditions (P6W-040) | Published or Deprecated |
| Published | Baselined + required approvals with SoD (P6W-050) | Deprecated |
| Deprecated | Superseded or withdrawn from active use | Retired or reinstated Published |
| Retired | Terminal archival of deprecated deliverable | None (terminal) |

Cannot **publish** without approvals (`P6W-050`).

Immutable audit log: `appendAudit` / `getAuditLog`.

Error codes: `P6W-xxx` (see workflow module).

---

## 8. Endpoint template fields

| Field | Meaning |
|-------|---------|
| id | `API-CTR-*` or `API-GWY-*` |
| method | QUERY/COMMAND or HTTP facade GET/POST/… |
| uriTemplate / contractId | Facade path or contract id |
| owningModule | 1–30 |
| entityId / stateMachineId | Soft hints |
| events | Related event ids/names |
| auth / permissions | Action from contract/route |
| version / lifecycle | Semver / draft|active|deprecated|retired |
| rateLimit / idempotent | Optional |

Runtime invocation remains `invokeContract(contractId, …)` — not HTTP.

---

*End of ECACIS primary specification v1.0.0*
