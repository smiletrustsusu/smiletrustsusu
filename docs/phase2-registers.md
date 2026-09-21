# Phase 2 Registers

**Product:** SMILE TRUST SUSU MANAGEMENT SYSTEM  
**Parent:** [`enterprise-consistency-review.md`](./enterprise-consistency-review.md)  
**Version:** 1.0.0  
**Date:** 2026-09-12  

---

## 1. API Conflict Register

| ID | Topic | Artifact A | Artifact B | Conflict class | Normative | Status |
|----|-------|------------|------------|----------------|-----------|--------|
| API-01 | REST/GraphQL as network APIs | `workflow-engine.md` path tables | EMAS GP-02 / Module 20 in-process | Terminology | EMAS + gateway | Open (ECR-M01) |
| API-02 | Schema applies to 1–24 only | `api-schema.md` | `CONTRACT_CATALOG` 1–30 | Scope drift | Catalog + EMAS | Open (ECR-M05 / RC-01) |
| API-03 | Gateway vs Hub entry | `api-gateway.md` “only integration entry” | Hub partner dispatch | Soft overlap | 28 extends 20 | Accepted (ECR-L03) |
| API-04 | GraphQL field maps | Gateway `executeGraphQL` | No GraphQL HTTP listener | Facade only | Module 20 | Accepted |
| API-05 | Canonical CDM API examples | `canonical-data-model.md` `POST /api/v1/...` | “not implemented in this phase” | Historical aspirational | Live = invokeContract | Informational |
| API-06 | Events invoked as commands | N/A | `invokeContract` rejects events | None | Contracts | Pass |

**Critical API conflicts:** none.

---

## 2. Event Conflict Register

| ID | Name A | Name B | Modules | Issue | Disposition |
|----|--------|--------|---------|-------|-------------|
| EVT-01 | `NotificationDelivered` | `NotificationSent` (prose) | 12 vs payment-engine narrative | Alias drift | Catalog wins; RC-03 |
| EVT-02 | `UserAuthenticated` | `AuthenticationSucceeded` (prose) | 1 vs payment-engine narrative | Alias drift | Catalog wins; RC-03 |
| EVT-03 | `FraudDetected` | `FraudAlertCreated` | 22 vs 29 | Similar vocabulary, different owners | Keep both; document |
| EVT-04 | `TaskAssigned` | `WorkflowTaskAssigned` | 23 | Near-duplicate in catalog | Prefer prefixed; ECR-L04 |
| EVT-05 | `CaseOpened` | `WorkflowCaseOpened` | 23 | Near-duplicate | Prefer prefixed |
| EVT-06 | `ClientRegistered` | `IntegrationClientRegistered` | 20 vs 28 | Distinct intentionally | Keep |
| EVT-07 | `FeatureFlagUpdated` | `FeatureFlagKilled` | 14 vs 30 | Complementary | Keep |
| EVT-08 | Global Event Catalog | Per-module lists | All | Not consolidated | Deferred ECR-I03 |

**Publish rule:** `publishDomainEvent` requires owning `moduleId` match when name is a catalog `event` contract.

---

## 3. Data Ownership Register

| Data / concern | Owner module | Writers | Readers (typical) | Must not write |
|----------------|--------------|---------|-------------------|----------------|
| Customer master | 3 | CRM paths | 4–9, 15, 17 | AI, Platform, Hub |
| Agent / branch | 4 / 5 | Ops | 6–9 | AI posting |
| Savings collections | **6** | Collection posting | 10, 11, 17, 27 | **29, 30, 28, 25, 27** |
| Group Susu | **7** | Group ops | 10, 11 | Same non-posters |
| Loans | **8** | Loan workflow | 10, 11, 29 (score only) | AI auto-disburse |
| Withdrawals | **9** | Withdrawal ops | 10, 11 | Non-posters |
| GL / journals | **10** | Accounting | 11, 27 | Dual journals from Hub/AI |
| Notifications | 12 | Notify engine | All | — |
| Audit trail | 13 | `recordAuditEvent` | Compliance | Bypass audit |
| Config / base flags | 14 | system-config | All | Silent high-risk without draft |
| Offline queue | 15 | sync-ops | — | Corrupt money offline without idempotency |
| MoMo payments | 16 | payment-ops | 10, 28 | Second Susu collection post |
| Receipts / statements | 17 | document-ops | 26 | — |
| Jobs | 18 | job-ops | — | Jobs must not invent posting owners |
| Metrics / alerts | 19 | monitoring | Ops | — |
| Gateway clients/keys | 20 | gateway-ops | 28 | HTTP server process |
| Backups | 21 | backup-ops | 30 DR views | — |
| Security incidents | 22 | security-ops | 13, 19 | — |
| Workflow instances | 23 | workflow-ops | — | Direct money mutate |
| Rules / decisions | 24 | rule-ops | 29 (consult) | Side-effectful evaluate |
| Exchange datasets | 25 | exchange-ops | — | Unapproved export |
| Digital records | 26 | records-ops | — | Bypass retention |
| Metrics/KPI/schemas | 27 | bi-ops | 11, 29 | Posting |
| Partner integrations | 28 | integration-ops | 20 | Posting / MoMo PINs |
| AI models/predictions | 29 | ai-ops | 27, 24 boundary | **Transactional posting** |
| Tenants/flags/licenses | 30 | platform-ops | All | Domain posting |

**Spot-check:** Collections posting ownership → Module **6** (not AI/Platform). **Pass / no Critical.**

---

## 4. Security Consistency Register

| ID | Control | Expected | Observed | Status |
|----|---------|----------|----------|--------|
| SEC-01 | Super Admin forbidden | No Owner.Transfer / System.Reset / Export.All | `SUPER_ADMIN_FORBIDDEN` matches | Pass |
| SEC-02 | Cashier limit default | GHS 1000 | `approval.cashierLimitGhs` + rbac map | Pass |
| SEC-03 | MFA / high-risk config | Maker-checker drafts | Module 14 docs + system-config | Pass |
| SEC-04 | AI entry RBAC | Coarse `Ai.*` | Present in rbac allow-lists | Pass |
| SEC-05 | AI fine permissions | Registry SoT | `ai-permission-registry.js` | Pass w/ ECR-M03 |
| SEC-06 | Owner-internal auth | Module 1 commands | `ownerInternal: true` | Pass |
| SEC-07 | External bypass | Prohibited | `bypass_gateway_external` | Pass |
| SEC-08 | Platform kill-switch | Emergency flag off | `evaluateFeatureFlag` kill paths | Pass |
| SEC-09 | Integration secrets | No MoMo PINs in hub | Module 28 boundary docs | Pass (doc) |
| SEC-10 | Audit on commands | Contract `audit: true` for commands | Catalog default | Pass |

---

## 5. Dependency Validation Matrix

### 5.1 `MODULE_CONSUME` (from → to)

| From | To / rule | Notes |
|------|-----------|-------|
| 1 | 14, 13, 19 | |
| 2 | `queries` | |
| 3 | 1, 5, 17, 13 | Cycle with 17 |
| 4 | 1, 5, 3, 13 | |
| 5 | 1, 14 | |
| 6 | 3, 4, 5, 10, 16, 17 | Cycle with 10 |
| 7 | 3, 10, 16, 17 | Cycle with 10 |
| 8 | 3, 10, 16, 17 | Cycle with 10 |
| 9 | 3, 10, 16, 17 | Cycle with 10 |
| 10 | 6, 7, 8, 9, 16 | Cycles with 6–9, 16 |
| 11 | `queries` | |
| 12 | `all` | Broad |
| 13 | `events` | |
| 14 | 19, 18, 22 | |
| 15 | 3, 6, 8, 16, 17 | |
| 16 | 10, 17, 12 | Cycles with 10, 17 |
| 17 | 10, 16, 3 | Cycles with 10, 16, 3 |
| 18 | `all` | Broad |
| 19 | `all` | Broad |
| 20 | `public` | |
| 21 | `backup` | |
| 22 | 13, 19, 1, 16, 15, 23, 24 | |
| 23 | `all` | Broad |
| 24 | 13, 18, 19, 20, 23 | |
| 25 | 13, 18, 19, 20, 23, 24 | |
| 26 | 13, 17, 18, 19, 20, 23 | |
| 27 | 11, 13, 18, 19, 20, 23, 24 | |
| 28 | 13, 18, 19, 20, 16, 23, 25 | **depends on 20** |
| 29 | 13, 18, 19, 20, 23, 24, 27 | **depends on 24** |
| 30 | *(no row)* | `mayConsume` peer exception |

### 5.2 Special-case `mayConsume`

- Targets **24–30**: non-owner-internal, non-event contracts freely consumable (ECR-M06).  
- Module **13** may consume events.  
- Self-module always allowed.

### 5.3 Circular dependency flag list

| Flag | Cycle | Severity for ops | ADR |
|------|-------|------------------|-----|
| CIRC-01 | 6↔10 | Expected GL↔collections | ADR-DEP-01 proposed |
| CIRC-02 | 7↔10 | Expected | ADR-DEP-01 |
| CIRC-03 | 8↔10 | Expected | ADR-DEP-01 |
| CIRC-04 | 9↔10 | Expected | ADR-DEP-01 |
| CIRC-05 | 10↔16 | Expected | ADR-DEP-01 |
| CIRC-06 | 16↔17 | Expected | ADR-DEP-01 |
| CIRC-07 | 3↔17 | Expected | ADR-DEP-01 |

**No circular dependency is treated as a Phase 2 Critical blocker**; they reflect approved financial/document coupling pending formal ADR text.

### 5.4 Sanity claims

| Claim | Validated |
|-------|-----------|
| 28 → 20 | Yes |
| 29 → 24 | Yes |
| 30 governs flags (with 14) | Yes / Conditional RACI |
| AI non-posting | Yes |
| Platform non-posting | Yes |

---

*End of Phase 2 Registers v1.0.0*
