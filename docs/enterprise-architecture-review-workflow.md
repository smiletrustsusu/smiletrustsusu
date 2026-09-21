# Enterprise Architecture Review Workflow Specification

**Product:** SMILE TRUST SUSU MANAGEMENT SYSTEM  
**Document type:** Change governance — standardized architecture review  
**Status:** Active (Phase 2)  
**Version:** 1.0.0  
**Date:** 2026-09-12  
**Implementation:** `src/core/architecture-review-workflow.js`  
**Referenced from:** [`enterprise-consistency-review.md`](./enterprise-consistency-review.md) § CHANGE GOVERNANCE  

This document is the **canonical** source for:

- **A)** Standardized Enterprise Architecture Review Workflow Specification  
- **B)** Enterprise Architecture Review Stage Entry & Exit Rules Specification  

It governs **architecture / consistency / governance reviews** (such as Phase 2). It does **not** change Modules 1–30 business posting, money math, or `SUPER_ADMIN_FORBIDDEN`.

---

## A) Standardized Enterprise Architecture Review Workflow

### A.1 Purpose

Provide a repeatable, auditable process to review enterprise architecture coherence across Modules **1–30** and EMAS, produce severity-classified findings, drive owner response and remediation verification, and record formal approval with separation of duties (SoD).

### A.2 Full workflow states (ordered)

| # | State | Intent |
|---|-------|--------|
| 1 | **Planned** | Review chartered; not started |
| 2 | **Review Initiated** | Scope, reviewers, timeline locked |
| 3 | **Evidence Collection** | Docs, cores, tests, matrices gathered |
| 4 | **Technical** | Contracts, deps, state machines, APIs |
| 5 | **Security** | RBAC, secrets, forbidden actions, boundaries |
| 6 | **Data Governance** | Ownership, checksums, migrations, SoT |
| 7 | **Integration** | Gateway, Hub, exchange, partner paths |
| 8 | **AI Governance** | Advisory bounds, permissions, vs Module 24 |
| 9 | **Findings Consolidated** | Register published; severities assigned |
| 10 | **Owner Response** | Module owners accept/reject/defer |
| 11 | **Remediation Verification** | Fixes verified or waived with ADR |
| 12 | **Final Approval Review** | Packet ready; SoD approval |
| 13 | **Approved** | Conditional or full approval recorded |
| 14 | **Closed** | Archive; audit retained |

Transitions are **strictly sequential** (advance exactly one stage). Skipping is forbidden (`ARW-002`). Failed validation may **block** the review (`ARW-004`) until cleared.

### A.3 Stage ownership table

| Stage | Primary owner | Consulted | Informed |
|-------|---------------|-----------|----------|
| Planned | ARB chair / System Owner | EMAS maintainer | Module leads |
| Review Initiated | Review lead | Security, Data, Integration, AI leads | All module owners in scope |
| Evidence Collection | Review lead | Docs owners | ARB |
| Technical | Platform Eng / Contracts | Module leads | ARB |
| Security | Security / KBA | Platform, AI | ARB |
| Data Governance | Data / BI schema owner | Accounting, Exchange | ARB |
| Integration | Integration + Gateway | Payments, Exchange | ARB |
| AI Governance | AI lead | Rule Engine (24), Security | ARB |
| Findings Consolidated | Review lead | All stage leads | Module owners |
| Owner Response | Module owners | Review lead | ARB |
| Remediation Verification | Review lead + stage leads | Module owners | ARB |
| Final Approval Review | ARB | System Owner | All |
| Approved | ARB / System Owner | — | Org |
| Closed | Review lead | Audit (13) | ARB |

### A.4 Entry / exit (high level)

- **Entry:** prior stage exit criteria met; review not blocked; actor authorized.  
- **Exit:** required deliverable flags true (see Part B); no unresolved **Critical** findings unless Explicit Risk Acceptance ADR attached; audit entry appended.

### A.5 Finding lifecycle

| State | Meaning |
|-------|---------|
| Identified | Logged with severity |
| Triaged | Severity/owner confirmed |
| Accepted | Will remediate |
| Rejected | Not a defect / out of scope |
| Deferred | Future phase / ADR |
| Remediated | Change applied (prefer docs) |
| Verified | Reviewer confirmed |
| Closed | Terminal for finding |

Allowed transitions are enforced in `ARW_FINDING_TRANSITIONS` (`ARW-007` on illegal moves).

### A.6 Approval

- Formal approval occurs at **Final Approval Review** → **Approved**.  
- **SoD:** the same user must not **solely** approve a review they **alone** conducted (`ARW-008`).  
- Approval dispositions: **Approved**, **Conditional**, **Rejected** (rejection returns governance to Findings/Owner Response via new review instance; this lightweight model records decision on the review record).

### A.7 Escalation

| Trigger | Escalation |
|---------|------------|
| Critical finding on money posting ownership | Immediate System Owner + ARB; block advance |
| SoD conflict | Assign additional reviewer |
| Owner non-response past SLA | Escalate to Admin/KBA for that domain |
| Security Critical | Module 22 incident path + ARB |

### A.8 Reporting

Minimum outputs:

1. Consistency Review Report (or delta)  
2. Registers (API / Event / Data / Security / Dependency)  
3. Governance Validation + Approval Summary  
4. Immutable audit log entries for stage/finding/approval actions  

### A.9 Audit

- Append-only audit helper (`createImmutableAuditLog`).  
- Prefer also emitting Module 13 audit when wired from UI (optional; not required for Phase 2 acceptance).  
- Tampering with prior audit entries is out of contract (`ARW-012` guidance).

---

## B) Stage Entry & Exit Rules (Stages 1–14)

### Global validation rules

1. Stage index must increase by exactly **+1** on advance.  
2. Review `blocked === true` prevents advance (`ARW-004`).  
3. Exit deliverable flags for the **current** stage must all be `true` (`ARW-003`).  
4. Unresolved **Critical** findings: default **block** before leaving Remediation Verification unless `remediationVerifiedOrWaived` with documented ADR reference in evidence pack.  
5. If `aiInScope === false`, AI Governance may be marked complete via skip flag without full AI packet.  
6. If `aiInScope === true`, AI Governance exit requires completion or explicit skip justification (`ARW-010`).  
7. Approver SoD checked at approval (`ARW-008`).  
8. Money math, posting owners, and `SUPER_ADMIN_FORBIDDEN` changes are **out of band** — require separate ADR, not silent review remediation.  
9. EMAS remains normative for enterprise organization; module contracts normative for interfaces.  
10. Prefer documenting contradictions (Recommended Corrections) over silent contract changes (EMAS AD-08).

---

### Stage 1 — Planned

| Aspect | Rule |
|--------|------|
| **Entry Criteria** | Business need for architecture/consistency review; sponsor identified |
| **Required Activities** | Draft charter; name review; list candidate module scope (default 1–30) |
| **Required Deliverables** | Charter draft |
| **Validation Checkpoints** | `charterApproved` flag |
| **Exit Criteria** | `charterApproved === true` |

### Stage 2 — Review Initiated

| Aspect | Rule |
|--------|------|
| **Entry Criteria** | Stage 1 exit met |
| **Required Activities** | Assign reviewers (≥2 preferred); lock scope; set `aiInScope`; communicate kickoff |
| **Required Deliverables** | Reviewer list; scope statement |
| **Validation Checkpoints** | `reviewersAssigned`, `scopeLocked` |
| **Exit Criteria** | Both flags true; sole-reviewer set recorded if applicable |

### Stage 3 — Evidence Collection

| Aspect | Rule |
|--------|------|
| **Entry Criteria** | Stage 2 exit met |
| **Required Activities** | Collect EMAS, matrices, module docs, cores, migrations 038–043, tests |
| **Required Deliverables** | Evidence pack index |
| **Validation Checkpoints** | `evidencePackComplete` |
| **Exit Criteria** | Evidence pack complete and referenced |

### Stage 4 — Technical

| Aspect | Rule |
|--------|------|
| **Entry Criteria** | Stage 3 exit met |
| **Required Activities** | Review contracts, `MODULE_CONSUME`, state machines, API facades vs in-process reality |
| **Required Deliverables** | Technical findings draft |
| **Validation Checkpoints** | `technicalReviewComplete` |
| **Exit Criteria** | Technical review marked complete |

### Stage 5 — Security

| Aspect | Rule |
|--------|------|
| **Entry Criteria** | Stage 4 exit met |
| **Required Activities** | RBAC / forbidden lists / owner-internal / AI coarse actions / secrets posture |
| **Required Deliverables** | Security Consistency notes |
| **Validation Checkpoints** | `securityReviewComplete` |
| **Exit Criteria** | Security review marked complete |

### Stage 6 — Data Governance

| Aspect | Rule |
|--------|------|
| **Entry Criteria** | Stage 5 exit met |
| **Required Activities** | Data ownership, checksum policy, migration alignment, SoT precedence |
| **Required Deliverables** | Data Ownership Register updates |
| **Validation Checkpoints** | `dataGovernanceReviewComplete` |
| **Exit Criteria** | Data governance review marked complete |

### Stage 7 — Integration

| Aspect | Rule |
|--------|------|
| **Entry Criteria** | Stage 6 exit met |
| **Required Activities** | Module 20 vs 28, exchange, partner webhooks, no dual posting via hub |
| **Required Deliverables** | Integration findings |
| **Validation Checkpoints** | `integrationReviewComplete` |
| **Exit Criteria** | Integration review marked complete |

### Stage 8 — AI Governance

| Aspect | Rule |
|--------|------|
| **Entry Criteria** | Stage 7 exit met |
| **Required Activities** | If AI in scope: advisory bounds, registry vs RBAC, non-posting, vs Module 24; else skip with flag |
| **Required Deliverables** | AI governance section or skip record |
| **Validation Checkpoints** | `aiGovernanceReviewCompleteOrSkipped` |
| **Exit Criteria** | Flag true; if AI in scope without completion, require justification |

### Stage 9 — Findings Consolidated

| Aspect | Rule |
|--------|------|
| **Entry Criteria** | Stage 8 exit met |
| **Required Activities** | Merge findings; assign IDs/severity; publish registers |
| **Required Deliverables** | Consistency report + registers |
| **Validation Checkpoints** | `findingsRegisterPublished` |
| **Exit Criteria** | Published findings register |

### Stage 10 — Owner Response

| Aspect | Rule |
|--------|------|
| **Entry Criteria** | Stage 9 exit met |
| **Required Activities** | Owners triage Accept/Reject/Defer; propose remediations |
| **Required Deliverables** | Owner response log |
| **Validation Checkpoints** | `ownerResponsesRecorded` |
| **Exit Criteria** | Responses recorded for all non-Informational open findings (or explicit waiver list) |

### Stage 11 — Remediation Verification

| Aspect | Rule |
|--------|------|
| **Entry Criteria** | Stage 10 exit met |
| **Required Activities** | Verify doc/code corrections; re-test; confirm no Critical unresolved |
| **Required Deliverables** | Verification record / waivers |
| **Validation Checkpoints** | `remediationVerifiedOrWaived` |
| **Exit Criteria** | Critical count = 0 **or** ADR risk acceptance attached; flag true |

### Stage 12 — Final Approval Review

| Aspect | Rule |
|--------|------|
| **Entry Criteria** | Stage 11 exit met |
| **Required Activities** | Assemble approval packet; SoD check; choose Approved vs Conditional |
| **Required Deliverables** | Approval packet |
| **Validation Checkpoints** | `approvalPacketReady` |
| **Exit Criteria** | Packet ready; SoD satisfiable |

### Stage 13 — Approved

| Aspect | Rule |
|--------|------|
| **Entry Criteria** | Stage 12 exit + formal approval with SoD |
| **Required Activities** | Record decision; communicate Conditional open items |
| **Required Deliverables** | Approval record (`formalApprovalRecorded`) |
| **Validation Checkpoints** | `formalApprovalRecorded` |
| **Exit Criteria** | Approval recorded; ready to close when archive done |

### Stage 14 — Closed

| Aspect | Rule |
|--------|------|
| **Entry Criteria** | Stage 13 exit met |
| **Required Activities** | Archive reports; retain audit; link ADRs |
| **Required Deliverables** | Closure note |
| **Validation Checkpoints** | Terminal stage (no further exit flags) |
| **Exit Criteria** | Terminal — no advance |

---

## C) Error codes (`ARW-xxx`)

| Code | Meaning |
|------|---------|
| ARW-001 | Unknown/invalid stage or review |
| ARW-002 | Non-sequential stage transition |
| ARW-003 | Exit deliverables missing |
| ARW-004 | Review blocked |
| ARW-005 | Terminal stage transition |
| ARW-006 | Invalid finding state |
| ARW-007 | Illegal finding transition |
| ARW-008 | SoD violation |
| ARW-009 | Missing actor |
| ARW-010 | AI governance incomplete |
| ARW-011 | Invalid severity |
| ARW-012 | Audit immutability guidance |

---

## D) Relation to Phase 2 execution

The Phase 2 Consistency Review documented in `enterprise-consistency-review.md` was executed under this workflow conceptually (Evidence → Technical/Security/Data/Integration/AI → Findings → Owner Response pending → Conditional Approval). Automated tests lock the machine semantics for future reviews.

---

*End of Enterprise Architecture Review Workflow Specification v1.0.0*
