# EMAS Supporting Matrices

Companion to [`enterprise-master-architecture.md`](./enterprise-master-architecture.md) (EMAS).  
Source of truth for dependency edges: `MODULE_CONSUME` in `src/core/module-contracts.js` (plus documented peer rules in `mayConsume`).

---

## 1. Module relationship matrix

Legend: **P** = posting owner · **Q** = query/report · **X** = cross-cutting platform · **E** = extends peer · **A** = advisory · **D** = deterministic decisions · **G** = governs

| ID | Name | Kind | Relates strongly to |
|----|------|------|---------------------|
| 1 | Authentication | X | 14, 13, 19 |
| 2 | Dashboard | Q | query consumers of domain |
| 3 | Customer CRM | X | 1, 5, 17, 13 |
| 4 | Agent Management | X | 1, 5, 3, 13 |
| 5 | Branch Management | X | 1, 14 |
| 6 | Individual Savings | **P** | 3, 4, 5, 10, 16, 17 |
| 7 | Group Susu | **P** | 3, 10, 16, 17 |
| 8 | Loans | **P** | 3, 10, 16, 17 |
| 9 | Withdrawals | **P** | 3, 10, 16, 17 |
| 10 | Accounting / GL | **P** | 6–9, 16 |
| 11 | Reports (ops UI) | Q | 10 (balances); extended by 27 |
| 12 | Notifications | X | all |
| 13 | Audit | X | events from all |
| 14 | System Admin / Config | X | 19, 18, 22; extended by 30 flags |
| 15 | Offline Sync | X | 3, 6, 8, 16, 17 |
| 16 | Payments / MoMo | X/P* | 10, 17, 12; extended by 28 |
| 17 | Receipts / Statements | X | 10, 16, 3; indexed by 26 |
| 18 | Jobs / Scheduler | X | all |
| 19 | Monitoring | X | all |
| 20 | API Gateway | X | public contracts; extended by **28** |
| 21 | Backup / DR | X | backup domain |
| 22 | Security Ops | X | 13, 19, 1, 16, 15, 23, 24 |
| 23 | Workflow | X | all |
| 24 | Rule Engine | **D** | 13, 18, 19, 20, 23 |
| 25 | Data Exchange | X | 13, 18, 19, 20, 23, 24 |
| 26 | Digital Records | X | 13, 17, 18, 19, 20, 23 |
| 27 | Enterprise BI | Q | 11, 13, 18, 19, 20, 23, 24 |
| 28 | Integration Hub | **E**20 | 13, 18, 19, 20, 16, 23, 25 |
| 29 | AI | **A** | 13, 18, 19, 20, 23, **24**, 27 |
| 30 | Platform Admin | **G** | config/flags/tenants/licenses for 1–29 |

\*Payment lifecycle may initiate provider money movement but must not create a second Susu collection posting path.

---

## 2. Module dependency matrix (`MODULE_CONSUME`)

Rows = **from** module; cells = allowed **target** modules or rule keyword.

| From | May consume |
|------|-------------|
| 1 | 14, 13, 19 |
| 2 | `queries` |
| 3 | 1, 5, 17, 13 |
| 4 | 1, 5, 3, 13 |
| 5 | 1, 14 |
| 6 | 3, 4, 5, 10, 16, 17 |
| 7 | 3, 10, 16, 17 |
| 8 | 3, 10, 16, 17 |
| 9 | 3, 10, 16, 17 |
| 10 | 6, 7, 8, 9, 16 |
| 11 | `queries` |
| 12 | `all` |
| 13 | `events` (+ `Audit.Record.v1`) |
| 14 | 19, 18, 22 |
| 15 | 3, 6, 8, 16, 17 |
| 16 | 10, 17, 12 |
| 17 | 10, 16, 3 |
| 18 | `all` |
| 19 | `all` |
| 20 | `public` |
| 21 | `backup` |
| 22 | 13, 19, 1, 16, 15, 23, 24 |
| 23 | `all` |
| 24 | 13, 18, 19, 20, 23 |
| 25 | 13, 18, 19, 20, 23, 24 |
| 26 | 13, 17, 18, 19, 20, 23 |
| 27 | 11, 13, 18, 19, 20, 23, 24 |
| 28 | 13, 18, 19, 20, **16**, 23, **25** |
| 29 | 13, 18, 19, 20, 23, **24**, **27** |
| 30 | *(no dedicated `MODULE_CONSUME` row)* — `mayConsume` allows non-owner-internal access among modules 24–30; Platform owns its contracts and governs flags/config |

### Documented sanity claims (recent modules)

| Claim | Status |
|-------|--------|
| 29 depends on 24 for rules boundary | **Yes** — listed in `MODULE_CONSUME[29]` |
| 28 depends on 20 | **Yes** |
| 30 governs config/flags | **Yes** — Module 30 spec + `platform-ops` / feature flag evaluation |

### Dependents (reverse index, high level)

| Module | Typical dependents |
|--------|-------------------|
| 10 | 6–9, 11, 16, 17 |
| 13 | nearly all (emit) |
| 18 / 19 | platform modules 21–30 |
| 20 | 24–30, partners via 28 |
| 24 | 22, 25, 27, 29 |
| 17 | 26 (index), 6–9, 15 |

---

## 3. Cross-module communication matrix

| Pattern | Mechanism | Notes |
|---------|-----------|-------|
| Command / query | `invokeContract` | Versioned contract id |
| External-style route | Module 20 `dispatchGatewayRequest` | In-process |
| Partner hub | Module 28 `hubDispatch` | May bridge to 20 |
| Domain events | `publishDomainEvent` | Owning `moduleId` must match contract |
| Audit write | Module 13 / `recordAuditEvent` | Compliance |
| Metrics / alerts | Module 19 | Ops |
| Async work | Module 18 job handlers | Named jobs per module |
| Sync offline | Module 15 | Queue + idempotency |
| Config / flags | Modules 14 + 30 | High-risk maker-checker / kill-switch |

| Prohibited | Reason |
|------------|--------|
| Direct SQL from UI | Trust / SoT |
| Private method cross-import | Boundary |
| Bypass gateway for external facades | `bypass_gateway_external` |
| AI / BI / Exchange / Hub posting collections | Dual write |

---

## 4. Responsibility matrix (RACI-style)

**R** = Responsible (does the work) · **A** = Accountable (owns outcome) · **C** = Consulted · **I** = Informed

| Concern | R | A | C | I |
|---------|---|---|---|---|
| Collection posting | 6 | Ops (Admin) | 10, 13, 17 | 11, 19 |
| Loan disbursement | 8 | Ops | 10, 23, 24 | 11, 29 |
| Journal integrity | 10 | Accountant | 6–9 | 11, 13 |
| Deterministic policy | 24 | KBA/Ops | 23, 22 | 29 |
| Advisory insight | 29 | KBA | 24, 27, 23 | Ops |
| Partner integration | 28 | Platform Eng | 20, 16 | 19, 13 |
| Platform flags / tenants | 30 | SystemOwner | 14, KBA | All modules |
| Observability | 19 | Ops | All | ARB |
| Backup / restore | 21 | SystemOwner | 30 DR | Ops |
| Security incidents | 22 | KBA/Security | 13, 19, 29 | Admin |

---

## 5. Enterprise standards index

| Standard | Location | Applies to |
|----------|----------|------------|
| EMAS | `docs/enterprise-master-architecture.md` | Enterprise |
| Module contracts | `src/core/module-contracts.js` | 1–30 |
| API schema / envelopes | `docs/api-schema.md`, `api-schema.js` | All contracts |
| Canonical data model | `docs/canonical-data-model.md` | Persistence |
| Identifiers | `docs/identifiers.md`, `identifiers.js` | All entities |
| Money (pesewas) | Money tests + cores | Financial modules |
| RBAC | `rbac.js` / `roles.js` | All actions |
| Feature flags | `system-config.js` + Module 30 rules | Progressive delivery |
| Observability | Module 19 docs | All |
| Integration hub | Module 28 docs | Partners |
| AI governance | Module 29 docs + `ai-governance.js` | Advisory ML |

---

## 6. Architecture decision summary

| ID | Decision |
|----|----------|
| AD-01 | Shared vanilla JS cores on Android / Web / Electron |
| AD-02 | In-process Module 20 gateway; no HTTP API server |
| AD-03 | localStorage primary; Supabase optional |
| AD-04 | Integer pesewas in core |
| AD-05 | Contract-only cross-module calls |
| AD-06 | Module 24 deterministic; Module 29 advisory |
| AD-07 | Module 30 final major module |
| AD-08 | Document conflicts preferred over silent contract/money/RBAC changes |

(See EMAS §15–§20 for governance and conflict log.)

---

## 7. Cross-reference index — Modules 1–30

| ID | Name | Spec doc | Primary cores (representative) | Migration (if dedicated) |
|----|------|----------|--------------------------------|--------------------------|
| 1 | Authentication | *(inferred)* | `session.js`, `system-accounts.js`, `roles.js` | auth-related early migrations |
| 2 | Dashboard | *(inferred)* | UI + dashboard tests | — |
| 3 | Customer CRM | *(inferred)* | CRM paths / customer tests | `008_customer_crm.sql` |
| 4 | Agent Management | `agent-management.md` | agent ops / app | `009_agent_ops.sql` |
| 5 | Branch Management | `branch-management.md` | `branch-ops.js` | `010_branch_ops.sql` |
| 6 | Individual Savings | `individual-savings-collection.md` | collection ops | `011_collection_ops.sql` |
| 7 | Group Susu | `group-susu-management.md` | `group-ops.js` | `012_group_ops.sql` |
| 8 | Loans | `loan-status-transitions.md` | `loans-workflow.js` | `013_loan_status.sql` |
| 9 | Withdrawals | `withdrawals-savings-redemption.md` | `withdrawal-ops.js` | `014_withdrawal_ops.sql` |
| 10 | Accounting | `accounting-general-ledger.md` | `accounting-ops.js` | `015_accounting_ops.sql` |
| 11 | Reports | `reports-analytics-bi.md` | `report-ops.js` | `016_report_ops.sql` |
| 12 | Notifications | `notification-communication.md` | `notification-ops.js` | `017`–`018` |
| 13 | Audit | `audit-compliance.md` | `audit-ops.js` | `020_audit_ops.sql` |
| 14 | System Admin | `system-administration.md` | `system-config.js` | `022_system_config.sql` |
| 15 | Offline Sync | `offline-sync.md` | `sync-ops.js`, `idempotency.js` | `021`, `023` |
| 16 | Payments | `payment-engine.md` | `payment-ops.js`, `momo-webhook.js` | `025`–`026` |
| 17 | Documents / Receipts | `document-engine.md` | `document-ops.js`, `receipts.js` | `027_documents.sql` |
| 18 | Jobs | `job-engine.md` | `job-ops.js` | `028_jobs.sql` |
| 19 | Monitoring | `monitoring-engine.md` | `monitoring-ops.js` | `029`–`030` |
| 20 | API Gateway | `api-gateway.md` | `api-gateway-ops.js`, `api-schema.js` | `031`, `034` |
| 21 | Backup / DR | `backup-recovery.md` | `backup-recovery-ops.js` | `032_backup_recovery.sql` |
| 22 | Security Ops | `security-operations.md` | `security-ops.js` | `033_security_contracts.sql` |
| 23 | Workflow | `workflow-engine.md` | `workflow-ops.js` | `035`–`036` |
| 24 | Rule Engine | `rule-engine.md` | `rule-ops.js` | `037_rule_engine.sql` |
| 25 | Data Exchange | `data-exchange.md` | `exchange-ops.js` | `038_data_exchange.sql` |
| 26 | Digital Records | `digital-records.md` | `records-ops.js` | `039_digital_records.sql` |
| 27 | Enterprise BI | `enterprise-bi.md` | `bi-ops.js` | `040_enterprise_bi.sql` |
| 28 | Integration Hub | `enterprise-integration.md` | `integration-*.js` | `041_enterprise_integration.sql` |
| 29 | AI | `enterprise-ai.md` | `ai-*.js` | `042_enterprise_ai.sql` |
| 30 | Platform Admin | `platform-administration.md` | `platform-*.js` | `043_platform_admin.sql` |

**Explicit architecture statement:** Module **29 (AI) does not own transactional posting** (collections, loan disbursement, journal posts, or withdrawal execution). Those remain with Modules **6–10** (and related payment lifecycle under **16** constraints).

---

*Matrices v1.0.0 — maintain alongside EMAS; prefer updating this file when `MODULE_CONSUME` changes.*
