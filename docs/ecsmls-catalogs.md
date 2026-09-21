# ECSMLS Catalogs (Phase 4 Companion Matrices)

**Parent:** [`enterprise-canonical-state-machines.md`](./enterprise-canonical-state-machines.md)  
**Registry:** `src/core/canonical-state-machine-registry.js`  
**ECDM:** `src/core/canonical-domain-registry.js`  
**Version:** 1.0.0  
**Date:** 2026-09-12  
**Scope:** Modules 1–30 · Phases 1–3 alignment  

---

## 1. Enterprise State Machine Catalog (compact)

| Machine ID | Name | Owner Mod | Entity ID | Initial | Terminal (primary) | Source |
|------------|------|-----------|-----------|---------|-------------------|--------|
| SM-CUS-001 | CustomerLifecycle | 3 | ENT-CUS-001 | Pending Verification | Deceased | customer-crm |
| SM-CUS-002 | CustomerKycVerification | 3 | ENT-CUS-001 | Pending | — | customer-crm |
| SM-SAV-001 | SavingsAccountLifecycle | 6 | ENT-SAV-002 | Active | Closed | customer-kyc |
| SM-SAV-002 | CollectionFinancialLifecycle | 6 | ENT-SAV-003 | Draft | Cancelled, Reversed | txn-lifecycle |
| SM-GRP-001 | SusuGroupLifecycle | 7 | ENT-GRP-001 | Pending | Closed, Completed | group-ops |
| SM-GRP-002 | GroupMembershipLifecycle | 7 | ENT-GRP-002 | Active | Closed, Transferred | group-ops |
| SM-GRP-003 | GroupMeetingLifecycle | 7 | ENT-GRP-003 | Open | Closed | group-ops |
| SM-LON-001 | LoanLifecycle | 8 | ENT-LON-001 | Pending | Completed, Settled, Rejected, Cancelled | loans-workflow |
| SM-WDL-001 | WithdrawalRequestLifecycle | 9 | ENT-WDL-001 | Requested | Rejected, Cancelled, Reversed | withdrawals-workflow |
| SM-FIN-001 | JournalEntryLifecycle | 10 | ENT-FIN-002 | Draft | Reversed, Cancelled | accounting |
| SM-FIN-002 | AccountingPeriodLifecycle | 10 | ENT-FIN-004 | Open | — (Closed recoverable) | accounting |
| SM-PAY-001 | PaymentTransactionLifecycle | 16 | ENT-PAY-001 | created | validation_failed, failed, cancelled, expired, fully_* | payment-lifecycle |
| SM-WFK-001 | WorkflowDefinitionLifecycle | 23 | ENT-WFK-001 | draft | retired | workflow-lifecycle |
| SM-WFK-002 | WorkflowInstanceLifecycle | 23 | ENT-WFK-002 | draft | completed, cancelled | workflow-lifecycle |
| SM-WFK-003 | WorkflowTaskLifecycle | 23 | ENT-WFK-003 | pending | completed, cancelled | workflow-lifecycle |
| SM-WFK-004 | WorkflowCaseLifecycle | 23 | ENT-WFK-004 | open | closed, cancelled | workflow-lifecycle |
| SM-DOC-001 | ReceiptDocumentLifecycle | 17 | ENT-DOC-001 | draft | archived, superseded, cancelled | document-lifecycle |
| SM-DOC-002 | ReceiptOutcomeLifecycle | 17 | ENT-DOC-001 | valid | rejected, cancelled, fully_*, superseded | document-lifecycle |
| SM-DOC-003 | TempReceiptSyncLifecycle | 17 | ENT-DOC-001 | created | reconciled, rejected, cancelled | document-lifecycle |
| SM-DOC-004 | DigitalRecordLifecycle | 26 | ENT-DOC-002 | uploaded | retired, superseded, deleted | records-lifecycle |
| SM-JOB-001 | JobInstanceLifecycle | 18 | ENT-JOB-002 | created | completed, cancelled, expired | job-lifecycle |
| SM-MON-001 | OperationalIncidentLifecycle | 19 | ENT-MON-002 | detected | closed | monitoring-lifecycle |
| SM-SEC-001 | SecurityIncidentLifecycle | 22 | ENT-SEC-001 | open | closed | security-lifecycle |
| SM-SEC-002 | FraudCaseLifecycle | 22 | ENT-SEC-002 | detected | dismissed, confirmed→dismissed | security-lifecycle |
| SM-BKP-001 | BackupSetLifecycle | 21 | ENT-BKP-001 | created | expired, failed | backup-recovery |
| SM-BKP-002 | RestoreJobLifecycle | 21 | ENT-BKP-001 | requested | activated, rejected | backup-recovery |
| SM-RUL-001 | BusinessRuleLifecycle | 24 | ENT-RUL-001 | draft | retired | rule-lifecycle |
| SM-XCH-001 | ExchangeJobLifecycle | 25 | ENT-XCH-001 | draft | cancelled, rolled_back | exchange-lifecycle |
| SM-BI-001 | KpiDefinitionLifecycle | 27 | ENT-BI-002 | draft | retired | bi-lifecycle |
| SM-INT-001 | IntegrationProviderLifecycle | 28 | ENT-INT-001 | registered | retired | integration-lifecycle |
| SM-INT-002 | IntegrationWebhookLifecycle | 28 | ENT-INT-002 | draft | retired | integration-lifecycle |
| SM-INT-003 | WebhookDeliveryLifecycle | 28 | ENT-INT-002 | queued | replayed | integration-lifecycle |
| SM-INT-004 | IntegrationMessageLifecycle | 28 | ENT-INT-003 | queued | acked, replayed | integration-lifecycle |
| SM-AI-001 | AiModelLifecycle | 29 | ENT-AI-001 | draft | retired | ai-lifecycle |
| SM-AI-002 | AiDatasetLifecycle | 29 | ENT-AI-002 | draft | retired | ai-lifecycle |
| SM-AI-003 | AiRecommendationDecision | 29 | ENT-AI-005 | pending | accepted, rejected, overridden | ai-lifecycle |
| SM-PLT-001 | TenantLifecycle | 30 | ENT-PLT-001 | registered | deleted | platform-lifecycle |
| SM-PLT-002 | LicenseLifecycle | 30 | ENT-PLT-002 | draft | revoked | platform-lifecycle |
| SM-PLT-003 | DeploymentRecordLifecycle | 30 | ENT-PLT-006 | planned | completed, cancelled, rolled_back | platform-lifecycle |
| SM-PLT-004 | MaintenanceWindowLifecycle | 30 | ENT-PLT-005 | planned | completed, cancelled | platform-lifecycle |
| SM-PLT-005 | FeatureFlagRuleLifecycle | 30 | ENT-PLT-004 | draft | retired | platform |
| SM-ORG-001 | RoleDefinitionLifecycle | 1 | ENT-ORG-004 | Draft | Retired | ECDM Role |
| SM-IDN-001 | UserAccountLifecycle | 1 | ENT-IDN-001 | Active | Disabled | Module 1 |
| SM-CFG-001 | SystemSettingPublishLifecycle | 14 | ENT-CFG-001 | draft | retired | Module 14 |
| SM-SYN-001 | OfflineQueueItemLifecycle | 15 | ENT-SYN-001 | pending | applied, cancelled | sync-ops |

**Machine count:** 45

---

## 2. Transition Matrix (selected machines)

### SM-LON-001 (from `LOAN_TRANSITIONS`)

| From | Allowed targets |
|------|-----------------|
| Draft | Submitted, Cancelled |
| Submitted | Under Review, Draft, Cancelled |
| Under Review | Pending Approval, Rejected |
| Pending Approval | Approved, Rejected, Under Review |
| Approved | Ready for Disbursement, Cancelled, Disbursed, Active |
| Ready for Disbursement | Disbursed, Cancelled |
| Disbursed | Active |
| Active | Completed, Defaulted, Restructured, Settled |
| Restructured | Active, Completed, Defaulted, Settled |
| Defaulted | Recovered, Written Off |
| Written Off | Recovered |
| Recovered | Active, Completed |
| Completed / Settled / Rejected / Cancelled | ∅ |
| Pending | Approved, Rejected, Under Review, Draft, Cancelled, Submitted, Pending Approval |
| Verified | Pending Approval, Rejected, Approved |

### SM-PAY-001 (from `PAYMENT_TRANSITION_MATRIX`)

| From | Allowed targets |
|------|-----------------|
| created | validated, validation_failed, cancelled |
| validated | pending_customer_authorization, pending_provider, cancelled |
| pending_customer_authorization | authorized, failed, cancelled, expired |
| pending_provider | authorized, processing, failed, expired |
| authorized | processing, failed, cancelled |
| processing | completed, failed |
| completed | partially_refunded, fully_refunded, partially_reversed, fully_reversed |
| partially_refunded | fully_refunded |
| partially_reversed | fully_reversed |
| validation_failed / failed / cancelled / expired / fully_refunded / fully_reversed | ∅ |

### SM-WFK-002 (from `WORKFLOW_TRANSITION_MATRIX`)

| From | Allowed targets |
|------|-----------------|
| draft | created, cancelled |
| created | ready, cancelled |
| ready | running, cancelled |
| running | waiting, completed, suspended, failed, cancelled |
| waiting | running, completed, suspended, failed, cancelled |
| suspended | running, cancelled |
| failed | retrying, cancelled |
| retrying | running, completed, failed, cancelled |
| completed / cancelled | ∅ |

### SM-AI-001 (from `MODEL_TRANSITIONS`)

| From | Allowed targets |
|------|-----------------|
| draft | registered, retired |
| registered | approved, retired |
| approved | deployed, shadow, canary, retired |
| deployed | rolled_back, retired, canary |
| shadow | deployed, retired, rolled_back |
| canary | deployed, rolled_back, retired |
| rolled_back | approved, retired |
| retired | ∅ |

### SM-PLT-001 (from `TENANT_TRANSITIONS`)

| From | Allowed targets |
|------|-----------------|
| registered | active, archived, pending_deletion |
| active | suspended, archived, pending_deletion |
| suspended | reactivating, archived, pending_deletion |
| reactivating | active, suspended |
| archived | pending_deletion, active |
| pending_deletion | deleted, archived |
| deleted | ∅ |

*All other machines: see `CANONICAL_STATE_MACHINES[].matrix` in the registry.*

---

## 3. State Ownership Matrix

| Domain | Machine IDs | Owning Module | Mutation authority |
|--------|-------------|---------------|--------------------|
| Customer | SM-CUS-001, SM-CUS-002 | 3 | Module 3 only |
| Savings account / collection | SM-SAV-001, SM-SAV-002 | 6 | Module 6 only |
| Groups | SM-GRP-001..003 | 7 | Module 7 only |
| Loans | SM-LON-001 | 8 | Module 8 only |
| Withdrawals | SM-WDL-001 | 9 | Module 9 only |
| Accounting | SM-FIN-001, SM-FIN-002 | 10 | Module 10 only |
| Payments | SM-PAY-001 | 16 | Module 16 only |
| Documents | SM-DOC-001..003 | 17 | Module 17 |
| Records | SM-DOC-004 | 26 | Module 26 |
| Workflow | SM-WFK-001..004 | 23 | Module 23 (orchestration) |
| Jobs | SM-JOB-001 | 18 | Module 18 |
| Monitoring | SM-MON-001 | 19 | Module 19 |
| Security | SM-SEC-001, SM-SEC-002 | 22 | Module 22 |
| Backup | SM-BKP-001, SM-BKP-002 | 21 | Module 21 |
| Rules | SM-RUL-001 | 24 | Module 24 |
| Exchange | SM-XCH-001 | 25 | Module 25 |
| BI | SM-BI-001 | 27 | Module 27 |
| Integration | SM-INT-001..004 | 28 | Module 28 (no money) |
| AI | SM-AI-001..003 | 29 | Module 29 (advisory only) |
| Platform | SM-PLT-001..005 | 30 | Module 30 (no Susu post) |
| Identity/Org/Config/Sync | SM-ORG-001, SM-IDN-001, SM-CFG-001, SM-SYN-001 | 1 / 14 / 15 | Respective owners |

---

## 4. Lifecycle Dependency Matrix

| Upstream lifecycle | Downstream consumer | Dependency |
|--------------------|---------------------|------------|
| SM-CUS-001 Active | SM-SAV-001, SM-LON-001, SM-WDL-001 | Customer must be operable |
| SM-LON-001 Approved/Active | SM-WFK-002 / SM-WFK-003 | Loan approvals may be orchestrated |
| SM-PAY-001 completed | SM-FIN-001, SM-DOC-001 | Accounting post + receipt (owners unchanged) |
| SM-WDL-001 Paid | SM-DOC-001 | Withdrawal receipt |
| SM-SAV-002 Posted | SM-FIN-001 / ledger | Collection posting path |
| SM-WFK-001 published | SM-WFK-002 | Instances require published definitions |
| SM-RUL-001 published | SM-WFK-*, decisions | Deterministic evaluation |
| SM-AI-001 deployed | SM-AI-003 | Recommendations from production models |
| SM-AI-004/SEC escalate | SM-SEC-002 | Advisory → security case (ECDM rel) |
| SM-PLT-004 active | All modules | Maintenance may block writes |
| SM-PLT-005 flags | Feature-gated modules | Kill switches |
| SM-SYN-001 applied | Financial owners | Offline apply order |
| SM-INT-001 healthy | SM-PAY-001 provider path | Provider availability |
| SM-BKP-002 activated | Platform restore | DR continuity |

---

## 5. Terminal State Register

| Machine | Terminal states | Approved recovery outbound |
|---------|-----------------|----------------------------|
| SM-CUS-001 | Deceased | — |
| SM-SAV-001 | Closed | — |
| SM-SAV-002 | Cancelled, Reversed | — |
| SM-GRP-001 | Closed, Completed | — |
| SM-GRP-002 | Closed, Transferred | — |
| SM-GRP-003 | Closed | — |
| SM-LON-001 | Completed, Settled, Rejected, Cancelled | — |
| SM-WDL-001 | Rejected, Cancelled, Reversed | — |
| SM-FIN-001 | Reversed, Cancelled | — |
| SM-PAY-001 | validation_failed, failed, cancelled, expired, fully_refunded, fully_reversed | — |
| SM-WFK-001 | retired | — |
| SM-WFK-002 | completed, cancelled | — |
| SM-WFK-003 | completed, cancelled | — |
| SM-WFK-004 | closed, cancelled | — |
| SM-DOC-001 | archived, superseded, cancelled | — |
| SM-DOC-003 | reconciled, rejected, cancelled | — |
| SM-DOC-004 | retired, superseded, deleted | — |
| SM-JOB-001 | completed, cancelled, expired | dead_letter → queued (recovery; dead_letter not treated as hard terminal) |
| SM-MON-001 | closed | — |
| SM-SEC-001 | closed | — |
| SM-SEC-002 | dismissed | — |
| SM-BKP-001 | failed, expired | — |
| SM-BKP-002 | activated, rejected | failed → requested |
| SM-RUL-001 | retired | — |
| SM-XCH-001 | cancelled, rolled_back | — |
| SM-BI-001 | retired | — |
| SM-INT-001 | retired | — |
| SM-INT-002 | retired | — |
| SM-INT-003 | replayed | dead_letter → queued/replayed |
| SM-INT-004 | acked, replayed | dead_letter → replayed |
| SM-AI-001 | retired | — |
| SM-AI-002 | retired | — |
| SM-AI-003 | accepted, rejected, overridden | — |
| SM-PLT-001 | deleted | — |
| SM-PLT-002 | revoked | — |
| SM-PLT-003 | completed, cancelled, rolled_back | — |
| SM-PLT-004 | completed, cancelled | — |
| SM-PLT-005 | retired | — |
| SM-ORG-001 | Retired | — |
| SM-IDN-001 | Disabled | — |
| SM-CFG-001 | retired | — |
| SM-SYN-001 | applied, cancelled | — |
| SM-FIN-002 | — | Closed → Open (period re-open) |

---

## 6. Transition Authorization Matrix

| Machine | Auth / action identifier (reference only) | Typical initiator |
|---------|-------------------------------------------|-------------------|
| SM-CUS-001 | Customer.Update | CRM roles |
| SM-CUS-002 | Customer.KYC | KYC officers |
| SM-SAV-001 | Savings.Update | Savings ops |
| SM-SAV-002 | Collection.Post | Collectors / cashiers |
| SM-GRP-* | Group.* | Group officers |
| SM-LON-001 | Loan.Transition | Loan officers / approvers |
| SM-WDL-001 | Withdrawal.Transition | CS / BM / Cashier |
| SM-FIN-* | Accounting.Post / ClosePeriod | Accountants |
| SM-PAY-001 | Payment.Transition | Payment Engine |
| SM-WFK-* | Workflow.Admin / Execute / Task / Case | Workflow Engine |
| SM-DOC-* | Document.* / Records.Manage | Document / records |
| SM-JOB-001 | Job.Manage | Scheduler |
| SM-MON-001 | Monitor.Incident | Ops |
| SM-SEC-* | Security.* | Security ops |
| SM-BKP-* | Backup.* | DR admins |
| SM-RUL-001 | Rule.Admin | Rule stewards |
| SM-XCH-001 | Exchange.Manage | Data exchange |
| SM-BI-001 | BI.Admin | BI stewards |
| SM-INT-* | Integration.* | Integration Hub |
| SM-AI-* | Ai.Admin / Ai.Govern | AI governance (advisory) |
| SM-PLT-* | Platform.* | Platform Admin |
| SM-ORG-001 / SM-IDN-001 | Auth.* | Identity admin |
| SM-CFG-001 | Config.Publish | System admin |
| SM-SYN-001 | Sync.Manage | Device sync |

---

## 7. Timeout / Compensation / Rollback Registers

### Timeout / Retry

| Machine | Timeout / retry behavior (source module) |
|---------|------------------------------------------|
| SM-PAY-001 | Provider callbacks; expired state |
| SM-JOB-001 | Exponential/fixed retry; DLQ |
| SM-INT-003 / SM-INT-004 | Delivery retry → dead_letter → replay |
| SM-SYN-001 | retrying ↔ pending/uploading |
| SM-WFK-002 | failed → retrying |
| SM-XCH-001 | failed → queued |

### Compensation / Rollback

| Machine | Compensation path |
|---------|-------------------|
| SM-PAY-001 | partially/fully refunded or reversed from completed |
| SM-LON-001 | Restructure / Recovered / Settled |
| SM-WDL-001 | Paid → Reversed |
| SM-FIN-001 | Posted → Reversed |
| SM-DOC-002 | Outcome refund/reverse overlays |
| SM-XCH-001 | completed → rolled_back |
| SM-AI-001 | deployed/canary/shadow → rolled_back |
| SM-PLT-003 | in_progress/verified → rolled_back |
| SM-BKP-002 | failed → requested (retry) |

---

## 8. Cross-Reference Index (Modules 1–30 & Phases 1–3)

### Phases

| Phase | Artifact | ECSMLS use |
|-------|----------|------------|
| 1 EMAS | enterprise-master-architecture.md, emas-matrices.md | Module boundaries |
| 2 | enterprise-consistency-review.md, phase2-registers.md, enterprise-architecture-review-workflow.md | Ownership / conflict precedence |
| 3 ECDM | enterprise-canonical-domain-model.md, ecdm-catalogs.md, canonical-domain-registry.js | Entity IDs |
| 4 ECSMLS | This pack | Lifecycles |

### Modules

| Mod | Machines |
|-----|----------|
| 1 | SM-ORG-001, SM-IDN-001 |
| 3 | SM-CUS-001, SM-CUS-002 |
| 6 | SM-SAV-001, SM-SAV-002 |
| 7 | SM-GRP-001, SM-GRP-002, SM-GRP-003 |
| 8 | SM-LON-001 |
| 9 | SM-WDL-001 |
| 10 | SM-FIN-001, SM-FIN-002 |
| 14 | SM-CFG-001 |
| 15 | SM-SYN-001 |
| 16 | SM-PAY-001 |
| 17 | SM-DOC-001, SM-DOC-002, SM-DOC-003 |
| 18 | SM-JOB-001 |
| 19 | SM-MON-001 |
| 21 | SM-BKP-001, SM-BKP-002 |
| 22 | SM-SEC-001, SM-SEC-002 |
| 23 | SM-WFK-001..004 |
| 24 | SM-RUL-001 |
| 25 | SM-XCH-001 |
| 26 | SM-DOC-004 |
| 27 | SM-BI-001 |
| 28 | SM-INT-001..004 |
| 29 | SM-AI-001..003 |
| 30 | SM-PLT-001..005 |

Modules **2, 5, 11, 12, 13, 20** have no dedicated ECSMLS machine in v1.0.0 (static/reference, report, notification append-only, audit append-only, or gateway pipeline without entity status graph). Escalate if a module lifecycle is later required.

---

*End of ECSMLS catalogs v1.0.0*
