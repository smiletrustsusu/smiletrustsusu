# Enterprise Canonical Database Architecture & Persistence Specification (ECDAPS)

**Product:** SMILE TRUST SUSU MANAGEMENT SYSTEM  
**Document type:** Phase 7 — Authoritative Database / Persistence Architecture  
**Status:** Authoritative  
**Version:** 1.0.0  
**Date:** 2026-09-12  
**Machine registry:** `src/core/canonical-database-registry.js`  
**Companion matrices:** [`ecdaps-catalogs.md`](./ecdaps-catalogs.md)  
**Data dictionary:** [`ecdaps-data-dictionary.md`](./ecdaps-data-dictionary.md)  
**Workflow:** `src/core/phase7-output-workflow.js` (sections 1–20)

Cross-references: Phase 1 [`enterprise-master-architecture.md`](./enterprise-master-architecture.md) / [`emas-matrices.md`](./emas-matrices.md); Phase 2 [`enterprise-consistency-review.md`](./enterprise-consistency-review.md) / [`phase2-registers.md`](./phase2-registers.md) / [`enterprise-architecture-review-workflow.md`](./enterprise-architecture-review-workflow.md) / [`enterprise-governance-validation.md`](./enterprise-governance-validation.md); Phase 3 [`enterprise-canonical-domain-model.md`](./enterprise-canonical-domain-model.md) / [`ecdm-catalogs.md`](./ecdm-catalogs.md); Phase 4 [`enterprise-canonical-state-machines.md`](./enterprise-canonical-state-machines.md) / [`ecsmls-catalogs.md`](./ecsmls-catalogs.md); Phase 5 [`enterprise-canonical-event-catalog.md`](./enterprise-canonical-event-catalog.md) / [`ececms-catalogs.md`](./ececms-catalogs.md); Phase 6 [`enterprise-canonical-api-catalog.md`](./enterprise-canonical-api-catalog.md) / [`ecacis-catalogs.md`](./ecacis-catalogs.md).

**Persistence reality (normative):** **localStorage is primary** for the vanilla JS SPA runtime; **Supabase/Postgres is optional** cloud alignment via `supabase/migrations/*.sql`. Inventory: **350** tables, **43** migrations (001–043). Registry `validateDatabaseRegistry` → ok=true. Does **not** invent a contradictory second money SoR.

---

## 1. Document Control

| Field | Value |
|-------|-------|
| Title | Enterprise Canonical Database Architecture & Persistence Specification (ECDAPS) |
| Document ID | ST-ECDAPS-001 |
| Version | 1.0.0 |
| Status | Authoritative |
| Owner | Architecture / Data Governance |
| Approver | Accountable Approver (SoD vs Primary Owner) |
| Registry | `canonical-database-registry.js` |
| Sections | 20 (cannot skip; Phase 7 workflow) |
| Sequencing | Phase 5 → Phase 6 → Phase 7 |
| Change control | ADR + registry PR; no silent money/RBAC/posting/nav edits |

---

## 2. Purpose & Scope

ECDAPS is the **single authoritative definition** of physical persistence alignment for Smile Trust across Modules **1–30**.

| In scope | Out of scope |
|----------|--------------|
| Inventory of CREATE TABLE in migrations 001–043 | Redefining ECDM entities (Phase 3) |
| Soft mapping tables → `ENT-*` when confident | Changing pesewas money math / posting |
| Ownership by module; FK / constraint / index catalogs | Rewriting RBAC permission matrices |
| Migration ordering & DR alignment | Live HTTP DB admin APIs |
| localStorage mirrors via ECDM `persistenceKeys` | New business navigation or features |

**Inventory snapshot:** 350 tables · 43 migrations · 132 indexes · 80 ECDM-mapped · 138 FK edges.

---

## 3. Input & Dependency Rules

### 3.1 Required inputs (consume only)

| Phase | Artifacts |
|------:|-----------|
| 1 | `docs/enterprise-master-architecture.md`, `docs/emas-matrices.md` |
| 2 | `docs/enterprise-consistency-review.md`, `docs/phase2-registers.md`, `docs/enterprise-architecture-review-workflow.md`, `docs/enterprise-governance-validation.md` |
| 3 | `docs/enterprise-canonical-domain-model.md`, `docs/ecdm-catalogs.md`, `src/core/canonical-domain-registry.js` |
| 4 | `docs/enterprise-canonical-state-machines.md`, `docs/ecsmls-catalogs.md`, `src/core/canonical-state-machine-registry.js` |
| 5 | `docs/enterprise-canonical-event-catalog.md`, `docs/ececms-catalogs.md`, `src/core/canonical-event-registry.js` |
| 6 | `docs/enterprise-canonical-api-catalog.md`, `docs/ecacis-catalogs.md`, `src/core/canonical-api-registry.js`, OpenAPI/GraphQL **facades only** (not live HTTP) |
| SQL | `supabase/migrations/001_*.sql` … `043_platform_admin.sql` |

### 3.2 Precedence

1. ADRs / explicit exceptions  
2. EMAS (Phase 1)  
3. Phase 2 consistency & governance  
4. ECDM (Phase 3)  
5. ECSMLS (Phase 4)  
6. ECECMS (Phase 5)  
7. ECACIS (Phase 6)  
8. Module specs 1–30  
9. Global standards (lowest)

Unresolved conflicts escalate via Architecture Review Workflow — **not** silently inside ECDAPS.

### 3.3 Dependency rules

| Rule | Statement |
|------|-----------|
| D1 | Physical tables come from migration SQL inventory (not invented) |
| D2 | If `entityId` is set it MUST resolve in ECDM |
| D3 | Owning module MUST be integer 1–30 |
| D4 | Phase 6 OpenAPI/GraphQL remain non-live facades |
| D5 | Money SoR semantics remain as implemented (local + financial migrations) |
| D6 | localStorage keys documented via ECDM `persistenceKeys` where mirrored |
| D7 | Phase **5** before **6** before **7** |

---

## 4. Design Principles

| ID | Principle | Statement |
|----|-----------|-----------|
| ECDAPS-P01 | Honest inventory | Catalog only tables present in `supabase/migrations` |
| ECDAPS-P02 | Dual persistence honesty | localStorage primary; Supabase optional |
| ECDAPS-P03 | Soft ECDM map | Map when confident; omit `entityId` when not |
| ECDAPS-P04 | Module ownership | Every table has owningModule 1–30 |
| ECDAPS-P05 | No money rewrite | Never changes posting / pesewas math |
| ECDAPS-P06 | No RBAC rewrite | Permissions by identifier only |
| ECDAPS-P07 | Migration monotonicity | Orders 001–043 strictly increasing |
| ECDAPS-P08 | Partition honesty | Partitioning planned/optional unless in SQL |
| ECDAPS-P09 | Facade fence | Phase 6 OpenAPI/GraphQL stay documentation facades |
| ECDAPS-P10 | Versioning | ECDAPS semver; breaking schema needs ADR |

---

## 5. Persistence Architecture Overview

```
[ SPA UI / Modules 1–30 ]
        |  in-process contracts / events (Phases 5–6)
        v
[ localStorage + in-memory state ]  <— primary runtime SoR for field ops
        |
        |  optional sync / cloud align
        v
[ Supabase Postgres public schema ]  <— migrations 001–043 (350 tables)
```

- **Schemas:** `public` (SCH-public).  
- **Money:** integer **pesewas** — formulas unchanged by ECDAPS.  
- **Module 20:** in-process API gateway; no live HTTP DB server introduced here.

---

## 6. Logical Data Model Mapping

Soft-map tables to ECDM when heuristics + overrides agree (e.g. `customers`→ENT-CUS-001, `collections`→ENT-SAV-003, `loans`→ENT-LON-001, `ledger_entries`→ENT-FIN-003). Validation: **IF** `entityId` present **THEN** it exists in ECDM.

| Metric | Count |
|--------|------:|
| Physical tables | 350 |
| Tables with entityId | 80 |
| Unmapped (allowed) | 270 |

| SQL table | ECDM entity | Module | Migration |
|-----------|-------------|-------:|-----------|
| `accounting_periods` | ENT-FIN-004 | 10 | `015_accounting_ops.sql` |
| `agent_attendance` | ENT-ORG-003 | 4 | `009_agent_ops.sql` |
| `agent_leave` | ENT-ORG-003 | 4 | `009_agent_ops.sql` |
| `agent_routes` | ENT-ORG-003 | 4 | `009_agent_ops.sql` |
| `ai_models` | ENT-AI-001 | 29 | `042_enterprise_ai.sql` |
| `alerts` | ENT-MON-001 | 19 | `029_monitoring.sql` |
| `api_clients` | ENT-GWY-001 | 20 | `031_api_gateway.sql` |
| `api_keys` | ENT-GWY-002 | 20 | `031_api_gateway.sql` |
| `app_users` | ENT-IDN-001 | 1 | `001_financial_core.sql` |
| `audit_activity_logs` | ENT-AUD-001 | 13 | `020_audit_ops.sql` |
| `audit_log` | ENT-AUD-001 | 1 | `001_financial_core.sql` |
| `backup_sets` | ENT-BKP-001 | 21 | `032_backup_recovery.sql` |
| `beneficiaries` | ENT-CUS-002 | 1 | `007_agency_platform.sql` |
| `branches` | ENT-ORG-002 | 1 | `001_financial_core.sql` |
| `business_cases` | ENT-WFK-004 | 23 | `035_workflow_engine.sql` |
| `businesses` | ENT-ORG-001 | 1 | `001_financial_core.sql` |
| `chart_of_accounts` | ENT-FIN-001 | 1 | `019_canonical_schema.sql` |
| `collection_adjustments` | ENT-SAV-004 | 6 | `011_collection_ops.sql` |
| `collections` | ENT-SAV-003 | 1 | `001_financial_core.sql` |
| `customers` | ENT-CUS-001 | 1 | `001_financial_core.sql` |
| `dataset_registry` | ENT-AI-002 | 29 | `042_enterprise_ai.sql` |
| `decision_tables` | ENT-RUL-001 | 24 | `037_rule_engine.sql` |
| `deployment_history` | ENT-PLT-006 | 30 | `043_platform_admin.sql` |
| `devices` | ENT-IDN-003 | 1 | `001_financial_core.sql` |
| `document_metadata` | ENT-DOC-001 | 17 | `027_documents.sql` |
| `documents` | ENT-DOC-001 | 17 | `027_documents.sql` |
| `ecm_document_metadata` | ENT-DOC-002 | 26 | `039_digital_records.sql` |
| `ecm_documents` | ENT-DOC-002 | 26 | `039_digital_records.sql` |
| `environment_registry` | ENT-PLT-003 | 30 | `043_platform_admin.sql` |
| `export_jobs` | ENT-XCH-001 | 25 | `038_data_exchange.sql` |
| `feature_flag_rules` | ENT-PLT-004 | 30 | `043_platform_admin.sql` |
| `fraud_alerts` | ENT-AI-004 | 29 | `042_enterprise_ai.sql` |
| `fraud_cases` | ENT-SEC-002 | 22 | `033_security_contracts.sql` |
| `group_meetings` | ENT-GRP-003 | 1 | `007_agency_platform.sql` |
| `idempotency_keys` | ENT-SYN-002 | 1 | `019_canonical_schema.sql` |
| `import_jobs` | ENT-XCH-001 | 25 | `038_data_exchange.sql` |
| `incidents` | ENT-MON-002 | 19 | `029_monitoring.sql` |
| `job_definitions` | ENT-JOB-001 | 18 | `028_jobs.sql` |
| `job_queue` | ENT-JOB-002 | 18 | `028_jobs.sql` |
| `journal_entries` | ENT-FIN-002 | 1 | `007_agency_platform.sql` |
| `journal_lines` | ENT-FIN-002 | 1 | `019_canonical_schema.sql` |
| `kpi_definitions` | ENT-BI-002 | 11 | `016_report_ops.sql` |
| `ledger_entries` | ENT-FIN-003 | 1 | `001_financial_core.sql` |
| `licenses` | ENT-PLT-002 | 30 | `043_platform_admin.sql` |
| `loan_disbursements` | ENT-LON-001 | 1 | `019_canonical_schema.sql` |
| `loan_repayments` | ENT-LON-002 | 1 | `019_canonical_schema.sql` |
| `loans` | ENT-LON-001 | 1 | `019_canonical_schema.sql` |
| `maintenance_windows` | ENT-PLT-005 | 30 | `043_platform_admin.sql` |
| `message_queues` | ENT-INT-003 | 28 | `041_enterprise_integration.sql` |
| `metric_definitions` | ENT-BI-001 | 27 | `040_enterprise_bi.sql` |
| `migration_jobs` | ENT-XCH-001 | 25 | `038_data_exchange.sql` |
| `model_registry` | ENT-AI-001 | 29 | `042_enterprise_ai.sql` |
| `notifications` | ENT-NTF-001 | 1 | `007_agency_platform.sql` |
| `payment_status_history` | ENT-PAY-001 | 16 | `026_payment_lifecycle.sql` |
| `payment_transactions` | ENT-PAY-001 | 16 | `025_payments.sql` |
| `permissions` | ENT-ORG-005 | 1 | `019_canonical_schema.sql` |
| `personal_savings_accounts` | ENT-SAV-002 | 6 | `004_savings_products.sql` |
| `prediction_requests` | ENT-AI-003 | 29 | `042_enterprise_ai.sql` |
| `prediction_results` | ENT-AI-003 | 29 | `042_enterprise_ai.sql` |
| `providers` | ENT-INT-001 | 28 | `041_enterprise_integration.sql` |
| `recommendation_history` | ENT-AI-005 | 29 | `042_enterprise_ai.sql` |
| `restore_operations` | ENT-BKP-001 | 21 | `032_backup_recovery.sql` |
| `role_permissions` | ENT-ORG-005 | 1 | `019_canonical_schema.sql` |
| `roles` | ENT-ORG-004 | 1 | `019_canonical_schema.sql` |
| `rule_definitions` | ENT-RUL-001 | 24 | `037_rule_engine.sql` |
| `savings_accounts` | ENT-SAV-002 | 1 | `007_agency_platform.sql` |
| `savings_products` | ENT-SAV-001 | 6 | `004_savings_products.sql` |
| `security_incidents` | ENT-SEC-001 | 22 | `033_security_contracts.sql` |
| `sessions` | ENT-IDN-002 | 1 | `019_canonical_schema.sql` |
| `susu_group_members` | ENT-GRP-002 | 7 | `002_susu_groups_pesewas.sql` |
| `susu_groups` | ENT-GRP-001 | 7 | `002_susu_groups_pesewas.sql` |
| `sync_queue` | ENT-SYN-001 | 1 | `001_financial_core.sql` |
| `system_settings` | ENT-CFG-001 | 1 | `019_canonical_schema.sql` |
| `tenants` | ENT-PLT-001 | 30 | `043_platform_admin.sql` |
| `user_roles` | ENT-ORG-004 | 1 | `019_canonical_schema.sql` |
| `webhooks` | ENT-INT-002 | 28 | `041_enterprise_integration.sql` |
| `withdrawal_requests` | ENT-WDL-001 | 1 | `007_agency_platform.sql` |
| `workflow_definitions` | ENT-WFK-001 | 23 | `035_workflow_engine.sql` |
| `workflow_instances` | ENT-WFK-002 | 23 | `035_workflow_engine.sql` |
| `workflow_tasks` | ENT-WFK-003 | 23 | `035_workflow_engine.sql` |

Logical-only entities may exist solely via ECDM `persistenceKeys` without a 1:1 SQL table.

---

## 7. Physical Schema Catalog

| Schema | Tables | Notes |
|--------|-------:|-------|
| public | 350 | All inventoried CREATE TABLE objects |

Core samples:

| Table ID | Name | Module | Entity | Migration |
|----------|------|-------:|--------|-----------|
| TBL-customers | `customers` | 1 | ENT-CUS-001 | `001_financial_core.sql` |
| TBL-collections | `collections` | 1 | ENT-SAV-003 | `001_financial_core.sql` |
| TBL-loans | `loans` | 1 | ENT-LON-001 | `019_canonical_schema.sql` |
| TBL-ledger_entries | `ledger_entries` | 1 | ENT-FIN-003 | `001_financial_core.sql` |
| TBL-branches | `branches` | 1 | ENT-ORG-002 | `001_financial_core.sql` |
| TBL-businesses | `businesses` | 1 | ENT-ORG-001 | `001_financial_core.sql` |
| TBL-app_users | `app_users` | 1 | ENT-IDN-001 | `001_financial_core.sql` |
| TBL-savings_accounts | `savings_accounts` | 1 | ENT-SAV-002 | `007_agency_platform.sql` |
| TBL-withdrawal_requests | `withdrawal_requests` | 1 | ENT-WDL-001 | `007_agency_platform.sql` |
| TBL-journal_entries | `journal_entries` | 1 | ENT-FIN-002 | `007_agency_platform.sql` |
| TBL-susu_groups | `susu_groups` | 7 | ENT-GRP-001 | `002_susu_groups_pesewas.sql` |
| TBL-payment_transactions | `payment_transactions` | 16 | ENT-PAY-001 | `025_payments.sql` |
| TBL-audit_activity_logs | `audit_activity_logs` | 13 | ENT-AUD-001 | `020_audit_ops.sql` |
| TBL-workflow_instances | `workflow_instances` | 23 | ENT-WFK-002 | `035_workflow_engine.sql` |

Authority: `DATABASE_TABLES` in `canonical-database-registry.js`.

---

## 8. Table Ownership & Module Mapping

Owning module from migration theme (043→30, 042→29, 041→28, 035/036→23, …) and ECDM owner when mapped.

| Owning Module | Table count |
|--------------:|------------:|
| 1 | 44 |
| 3 | 5 |
| 4 | 6 |
| 5 | 5 |
| 6 | 6 |
| 7 | 10 |
| 8 | 1 |
| 9 | 3 |
| 10 | 3 |
| 11 | 9 |
| 12 | 7 |
| 13 | 12 |
| 14 | 16 |
| 15 | 12 |
| 16 | 19 |
| 17 | 15 |
| 18 | 13 |
| 19 | 29 |
| 20 | 15 |
| 21 | 10 |
| 22 | 8 |
| 23 | 17 |
| 24 | 13 |
| 25 | 12 |
| 26 | 11 |
| 27 | 7 |
| 28 | 11 |
| 29 | 17 |
| 30 | 14 |

Full matrix: [`ecdaps-catalogs.md`](./ecdaps-catalogs.md).

---

## 9. Relationships & Foreign Keys

Registry captures **138** FK edges (aliases `users`→`app_users` accepted in validation). Sample:

| From table | Columns | To table | Ref columns |
|------------|---------|----------|-------------|
| `agent_attendance` | agent_id | `users` | id |
| `agent_documents` | agent_id | `users` | id |
| `agent_leave` | agent_id | `users` | id |
| `agent_routes` | agent_id | `users` | id |
| `agent_wallet_entries` | agent_id | `users` | id |
| `ai_human_feedback` | recommendation_id | `recommendation_history` | id |
| `api_keys` | client_id | `api_clients` | id |
| `api_responses` | request_id | `api_requests` | id |
| `app_users` | business_id | `businesses` | id |
| `app_users` | branch_id | `branches` | id |
| `audit_log` | business_id | `businesses` | id |
| `audit_log` | actor_id | `app_users` | id |
| `beneficiaries` | customer_id | `customers` | id |
| `branch_documents` | branch_id | `branches` | id |
| `branch_targets` | branch_id | `branches` | id |
| `branches` | business_id | `businesses` | id |
| `chart_of_accounts` | parent_code | `chart_of_accounts` | code |
| `collections` | business_id | `businesses` | id |
| `collections` | branch_id | `branches` | id |
| `collections` | customer_id | `customers` | id |
| `collections` | collector_id | `app_users` | id |
| `collections` | device_id | `devices` | id |
| `collector_assignments` | business_id | `businesses` | id |
| `collector_assignments` | from_collector_id | `app_users` | id |
| `collector_assignments` | to_collector_id | `app_users` | id |
| `collector_assignments` | approved_by | `app_users` | id |
| `customer_activity_log` | customer_id | `customers` | id |
| `customer_documents` | customer_id | `customers` | id |
| `customer_notes` | customer_id | `customers` | id |
| `customer_qr_codes` | customer_id | `customers` | id |
| `customer_status_history` | customer_id | `customers` | id |
| `customer_visit_logs` | agent_id | `users` | id |
| `customers` | business_id | `businesses` | id |
| `customers` | branch_id | `branches` | id |
| `customers` | collector_id | `app_users` | id |
| `deployment_approvals` | deployment_id | `deployment_history` | id |
| `devices` | business_id | `businesses` | id |
| `devices` | user_id | `app_users` | id |
| `exceptions` | business_id | `businesses` | id |
| `exceptions` | collector_id | `app_users` | id |
| `expenses` | business_id | `businesses` | id |
| `expenses` | branch_id | `branches` | id |
| `expenses` | recorded_by | `app_users` | id |
| `feature_versions` | feature_id | `feature_registry` | id |
| `group_distributions` | business_id | `businesses` | id |
| `group_distributions` | susu_group_id | `susu_groups` | id |
| `group_distributions` | approved_by | `app_users` | id |
| `group_distributions` | created_by | `app_users` | id |
| `group_meetings` | business_id | `businesses` | id |
| `group_meetings` | recorded_by | `app_users` | id |
| `handovers` | business_id | `businesses` | id |
| `handovers` | branch_id | `branches` | id |
| `handovers` | collector_id | `app_users` | id |
| `handovers` | verified_by | `app_users` | id |
| `idempotency_keys` | business_id | `businesses` | id |
| `idempotency_keys` | user_id | `app_users` | id |
| `idempotency_keys` | device_id | `devices` | id |
| `inference_logs` | model_version_id | `model_versions` | id |
| `integration_deadline_changes` | deliverable_code | `integration_deliverables` | code |
| `journal_entries` | business_id | `businesses` | id |
| `journal_entries` | created_by | `app_users` | id |
| `journal_lines` | journal_id | `journal_entries` | id |
| `ledger_entries` | business_id | `businesses` | id |
| `license_assignments` | license_id | `licenses` | id |
| `license_assignments` | tenant_id | `tenants` | id |
| `loan_disbursements` | loan_id | `loans` | id |
| `loan_disbursements` | ledger_id | `ledger_entries` | id |
| `loan_disbursements` | disbursed_by | `app_users` | id |
| `loan_repayments` | business_id | `businesses` | id |
| `loan_repayments` | loan_id | `loans` | id |
| `loan_repayments` | customer_id | `customers` | id |
| `loan_repayments` | ledger_id | `ledger_entries` | id |
| `loan_repayments` | recorded_by | `app_users` | id |
| `loans` | business_id | `businesses` | id |
| `loans` | customer_id | `customers` | id |
| `loans` | branch_id | `branches` | id |
| `model_deployments` | model_id | `ai_models` | id |
| `model_deployments` | model_version_id | `model_versions` | id |
| `model_registry` | model_id | `ai_models` | id |
| `model_registry` | model_version_id | `model_versions` | id |
| `model_versions` | model_id | `ai_models` | id |
| `momo_webhook_events` | business_id | `businesses` | id |
| `momo_webhook_events` | collection_id | `collections` | id |
| `notifications` | business_id | `businesses` | id |
| `notifications` | customer_id | `customers` | id |
| `notifications` | user_id | `app_users` | id |
| `personal_savings_accounts` | business_id | `businesses` | id |
| `personal_savings_accounts` | customer_id | `customers` | id |
| `personal_savings_accounts` | savings_product_id | `savings_products` | id |
| `prediction_requests` | model_id | `ai_models` | id |
| `prediction_requests` | model_version_id | `model_versions` | id |
| `prediction_results` | request_id | `prediction_requests` | id |
| `provider_configurations` | provider_id | `providers` | id |
| `provider_versions` | provider_id | `providers` | id |
| `receipt_sequences` | business_id | `businesses` | id |
| `reversals` | business_id | `businesses` | id |
| `reversals` | original_collection_id | `collections` | id |
| `reversals` | original_ledger_id | `ledger_entries` | id |
| `reversals` | reversal_ledger_id | `ledger_entries` | id |
| `reversals` | requested_by | `app_users` | id |

---

## 10. Constraints & Integrity Rules

Primary keys cataloged for inventoried tables; UNIQUE/CHECK where extracted. Money integrity remains application + ledger posting rules (unchanged).

| Constraint ID | Table | Type | Definition |
|---------------|-------|------|------------|
| `PK-account_closures` | `account_closures` | PRIMARY KEY | (id) |
| `PK-accounting_periods` | `accounting_periods` | PRIMARY KEY | (id) |
| `PK-agent_attendance` | `agent_attendance` | PRIMARY KEY | (id) |
| `PK-agent_documents` | `agent_documents` | PRIMARY KEY | (id) |
| `PK-agent_leave` | `agent_leave` | PRIMARY KEY | (id) |
| `PK-agent_routes` | `agent_routes` | PRIMARY KEY | (id) |
| `PK-agent_wallet_entries` | `agent_wallet_entries` | PRIMARY KEY | (id) |
| `PK-aggregate_locks` | `aggregate_locks` | PRIMARY KEY | (id) |
| `PK-aggregate_versions` | `aggregate_versions` | PRIMARY KEY | (id) |
| `PK-ai_human_feedback` | `ai_human_feedback` | PRIMARY KEY | (id) |
| `PK-ai_models` | `ai_models` | PRIMARY KEY | (id) |
| `PK-ai_permission_grants` | `ai_permission_grants` | PRIMARY KEY | (id) |
| `PK-alert_escalation_profiles` | `alert_escalation_profiles` | PRIMARY KEY | (id) |
| `PK-alert_history` | `alert_history` | PRIMARY KEY | (id) |
| `PK-alert_rule_versions` | `alert_rule_versions` | PRIMARY KEY | (id) |
| `PK-alert_rules` | `alert_rules` | PRIMARY KEY | (id) |
| `PK-alert_suppression_rules` | `alert_suppression_rules` | PRIMARY KEY | (id) |
| `PK-alerts` | `alerts` | PRIMARY KEY | (id) |
| `PK-analytics_snapshots` | `analytics_snapshots` | PRIMARY KEY | (id) |
| `PK-android_devices` | `android_devices` | PRIMARY KEY | (id) |
| `PK-announcements` | `announcements` | PRIMARY KEY | (id) |
| `PK-anomaly_events` | `anomaly_events` | PRIMARY KEY | (id) |
| `PK-api_audit_logs` | `api_audit_logs` | PRIMARY KEY | (id) |
| `PK-api_clients` | `api_clients` | PRIMARY KEY | (id) |
| `PK-api_keys` | `api_keys` | PRIMARY KEY | (id) |
| `PK-api_rate_limits` | `api_rate_limits` | PRIMARY KEY | (id) |
| `PK-api_requests` | `api_requests` | PRIMARY KEY | (id) |
| `PK-api_responses` | `api_responses` | PRIMARY KEY | (id) |
| `PK-api_schema_versions` | `api_schema_versions` | PRIMARY KEY | (id) |
| `PK-api_tokens` | `api_tokens` | PRIMARY KEY | (id) |
| `PK-api_usage_statistics` | `api_usage_statistics` | PRIMARY KEY | (id) |
| `PK-api_versions` | `api_versions` | PRIMARY KEY | (id) |
| `PK-app_users` | `app_users` | PRIMARY KEY | (id) |
| `PK-application_crash_reports` | `application_crash_reports` | PRIMARY KEY | (id) |
| `PK-approval_policies` | `approval_policies` | PRIMARY KEY | (id) |
| `PK-audit_activity_logs` | `audit_activity_logs` | PRIMARY KEY | (id) |
| `PK-audit_alerts` | `audit_alerts` | PRIMARY KEY | (id) |
| `PK-audit_archives` | `audit_archives` | PRIMARY KEY | (id) |
| `PK-audit_categories` | `audit_categories` | PRIMARY KEY | (id) |
| `PK-audit_changes` | `audit_changes` | PRIMARY KEY | (id) |
| `PK-audit_entities` | `audit_entities` | PRIMARY KEY | (id) |
| `PK-audit_event_types` | `audit_event_types` | PRIMARY KEY | (id) |
| `PK-audit_exports` | `audit_exports` | PRIMARY KEY | (id) |
| `PK-audit_integrity_checks` | `audit_integrity_checks` | PRIMARY KEY | (id) |
| `PK-audit_log` | `audit_log` | PRIMARY KEY | (id) |
| `PK-audit_outbox` | `audit_outbox` | PRIMARY KEY | (id) |
| `PK-audit_retention_policies` | `audit_retention_policies` | PRIMARY KEY | (id) |
| `PK-audit_sessions` | `audit_sessions` | PRIMARY KEY | (id) |
| `PK-background_jobs` | `background_jobs` | PRIMARY KEY | (id) |
| `PK-backup_files` | `backup_files` | PRIMARY KEY | (id) |

---

## 11. Indexes & Access Paths

Representative indexes from migrations (including `001_financial_core` and later ops). Catalog size: **132**.

| Index | Table | Kind | Columns | Migration |
|-------|-------|------|---------|-----------|
| `branches_collector_code_uq` | `branches` | unique | business_id, lower(collector_code | `001_financial_core.sql` |
| `app_users_username_uq` | `app_users` | unique | business_id, lower(username | `001_financial_core.sql` |
| `app_users_collector_code_uq` | `app_users` | unique | business_id, lower(collector_code | `001_financial_core.sql` |
| `customers_account_no_uq` | `customers` | unique | business_id, lower(account_no | `001_financial_core.sql` |
| `customers_collector_idx` | `customers` | non-unique | collector_id | `001_financial_core.sql` |
| `customers_branch_idx` | `customers` | non-unique | branch_id | `001_financial_core.sql` |
| `collections_date_idx` | `collections` | non-unique | business_id, collection_date | `001_financial_core.sql` |
| `collections_collector_idx` | `collections` | non-unique | collector_id, collection_date | `001_financial_core.sql` |
| `ledger_customer_idx` | `ledger_entries` | non-unique | customer_id, server_created_at | `001_financial_core.sql` |
| `ledger_business_date_idx` | `ledger_entries` | non-unique | business_id, server_created_at | `001_financial_core.sql` |
| `susu_groups_code_uq` | `susu_groups` | unique | business_id, lower(code | `002_susu_groups_pesewas.sql` |
| `susu_groups_collector_idx` | `susu_groups` | non-unique | collector_id | `002_susu_groups_pesewas.sql` |
| `businesses_legacy_code_uq` | `businesses` | unique | legacy_code | `003_rls_rpc_production.sql` |
| `branches_client_uq` | `branches` | unique | business_id, client_id | `003_rls_rpc_production.sql` |
| `app_users_client_uq` | `app_users` | unique | business_id, client_id | `003_rls_rpc_production.sql` |
| `customers_client_uq` | `customers` | unique | business_id, client_id | `003_rls_rpc_production.sql` |
| `collections_momo_ref_uq` | `collections` | unique | business_id, lower(payment_reference | `003_rls_rpc_production.sql` |
| `savings_products_business_code_uq` | `savings_products` | unique | business_id, lower(code | `004_savings_products.sql` |
| `savings_products_business_idx` | `savings_products` | non-unique | business_id | `004_savings_products.sql` |
| `savings_products_type_idx` | `savings_products` | non-unique | product_type | `004_savings_products.sql` |
| `personal_accounts_customer_idx` | `personal_savings_accounts` | non-unique | customer_id | `004_savings_products.sql` |
| `collector_assignments_entity_idx` | `collector_assignments` | non-unique | entity_id | `004_savings_products.sql` |
| `collector_assignments_to_idx` | `collector_assignments` | non-unique | to_collector_id | `004_savings_products.sql` |
| `app_users_auth_email_uq` | `app_users` | unique | business_id, lower(auth_email | `005_production_auth_rls.sql` |
| `momo_webhook_ref_idx` | `momo_webhook_events` | non-unique | business_id, lower(external_reference | `005_production_auth_rls.sql` |
| `branches_code_uq` | `branches` | unique | business_id, lower(code | `006_web_admin_compat.sql` |
| `withdrawal_requests_status_idx` | `withdrawal_requests` | non-unique | business_id, status | `007_agency_platform.sql` |
| `expenses_date_idx` | `expenses` | non-unique | business_id, expense_date | `007_agency_platform.sql` |
| `notifications_customer_idx` | `notifications` | non-unique | customer_id, created_at desc | `007_agency_platform.sql` |
| `idx_customers_phone` | `customers` | non-unique | business_id, phone | `008_customer_crm.sql` |
| `idx_customers_number` | `customers` | non-unique | business_id, customer_number | `008_customer_crm.sql` |
| `idx_customers_kyc` | `customers` | non-unique | business_id, kyc_status | `008_customer_crm.sql` |
| `idx_customer_notes_customer` | `customer_notes` | non-unique | customer_id | `008_customer_crm.sql` |
| `idx_customer_activity_customer` | `customer_activity_log` | non-unique | customer_id | `008_customer_crm.sql` |
| `idx_customer_qr_customer` | `customer_qr_codes` | non-unique | customer_id | `008_customer_crm.sql` |
| `idx_customers_id_number` | `customers` | non-unique | business_id, id_number | `008_customer_crm.sql` |
| `idx_users_agent_code` | `users` | non-unique | business_id, agent_code | `009_agent_ops.sql` |
| `idx_users_employee_number` | `users` | non-unique | business_id, employee_number | `009_agent_ops.sql` |
| `idx_agent_attendance_agent` | `agent_attendance` | non-unique | agent_id, work_date | `009_agent_ops.sql` |
| `idx_agent_routes_agent` | `agent_routes` | non-unique | agent_id | `009_agent_ops.sql` |
| `idx_visit_logs_agent` | `customer_visit_logs` | non-unique | agent_id, visit_date | `009_agent_ops.sql` |
| `idx_agent_leave_agent` | `agent_leave` | non-unique | agent_id | `009_agent_ops.sql` |
| `idx_branches_code` | `branches` | non-unique | business_id, code | `010_branch_ops.sql` |
| `idx_branches_status` | `branches` | non-unique | business_id, status | `010_branch_ops.sql` |
| `idx_branch_transfers_to` | `branch_transfers` | non-unique | to_branch_id | `010_branch_ops.sql` |
| `idx_branch_calendar_date` | `branch_calendar` | non-unique | branch_id, event_date | `010_branch_ops.sql` |
| `collection_adjustments_status_idx` | `collection_adjustments` | non-unique | status | `011_collection_ops.sql` |
| `collection_activity_logs_collection_idx` | `collection_activity_logs` | non-unique | collection_id | `011_collection_ops.sql` |
| `group_fines_group_idx` | `group_fines` | non-unique | susu_group_id | `012_group_ops.sql` |
| `group_welfare_group_idx` | `group_welfare` | non-unique | susu_group_id | `012_group_ops.sql` |
| `group_shares_group_idx` | `group_shares` | non-unique | susu_group_id | `012_group_ops.sql` |
| `idx_loan_status_history_loan` | `loan_status_history` | non-unique | loan_id, created_at | `013_loan_status.sql` |
| `idx_loan_status_history_customer` | `loan_status_history` | non-unique | customer_id, created_at | `013_loan_status.sql` |
| `idx_withdrawal_idempotency` | `withdrawal_requests` | unique | idempotency_key | `014_withdrawal_ops.sql` |
| `idx_withdrawal_activity_wd` | `withdrawal_activity_logs` | non-unique | withdrawal_id, created_at | `014_withdrawal_ops.sql` |
| `idx_withdrawal_status` | `withdrawal_requests` | non-unique | status, created_at | `014_withdrawal_ops.sql` |
| `idx_tax_definitions_code` | `tax_definitions` | unique | business_id, code | `015_accounting_ops.sql` |
| `idx_tax_history_tax` | `tax_config_history` | non-unique | tax_id, created_at | `015_accounting_ops.sql` |
| `idx_accounting_periods_dates` | `accounting_periods` | non-unique | period_from, period_to, status | `015_accounting_ops.sql` |
| `idx_report_history_user` | `report_history` | non-unique | user_id, created_at | `016_report_ops.sql` |

---

## 12. Partitioning Strategy

**Honest status:** no RANGE/LIST partitions declared in current migration SQL. Planned/optional for cloud scale:

| ID | Table | Strategy | Status | Note |
|----|-------|----------|--------|------|
| PART-PLANNED-LEDGER | `ledger_entries` | range-by-created_at | planned | Not present in current SQL; optional cloud scale |
| PART-PLANNED-AUDIT | `audit_activity_logs` | range-by-created_at | planned | Not present in current SQL; optional archival scale |
| PART-PLANNED-API-REQ | `api_requests` | range-by-created_at | planned | Not present in current SQL; optional ops scale |

---

## 13. Migration Catalog & Ordering

All **43** files 001–043 inclusive (including `038_data_exchange.sql` … `043_platform_admin.sql`):

| Order | Filename | Module | Description |
|------:|----------|-------:|-------------|
| 1 | `001_financial_core.sql` | 1 | financial core |
| 2 | `002_susu_groups_pesewas.sql` | 7 | susu groups pesewas |
| 3 | `003_rls_rpc_production.sql` | 1 | rls rpc production |
| 4 | `004_savings_products.sql` | 6 | savings products |
| 5 | `005_production_auth_rls.sql` | 1 | production auth rls |
| 6 | `006_web_admin_compat.sql` | 1 | web admin compat |
| 7 | `007_agency_platform.sql` | 1 | agency platform |
| 8 | `008_customer_crm.sql` | 3 | customer crm |
| 9 | `009_agent_ops.sql` | 4 | agent ops |
| 10 | `010_branch_ops.sql` | 5 | branch ops |
| 11 | `011_collection_ops.sql` | 6 | collection ops |
| 12 | `012_group_ops.sql` | 7 | group ops |
| 13 | `013_loan_status.sql` | 8 | loan status |
| 14 | `014_withdrawal_ops.sql` | 9 | withdrawal ops |
| 15 | `015_accounting_ops.sql` | 10 | accounting ops |
| 16 | `016_report_ops.sql` | 11 | report ops |
| 17 | `017_notification_ops.sql` | 12 | notification ops |
| 18 | `018_notification_thresholds.sql` | 12 | notification thresholds |
| 19 | `019_canonical_schema.sql` | 1 | canonical schema |
| 20 | `020_audit_ops.sql` | 13 | audit ops |
| 21 | `021_idempotency.sql` | 15 | idempotency |
| 22 | `022_system_config.sql` | 14 | system config |
| 23 | `023_offline_sync.sql` | 15 | offline sync |
| 24 | `024_identifier_standard.sql` | 1 | identifier standard |
| 25 | `025_payments.sql` | 16 | payments |
| 26 | `026_payment_lifecycle.sql` | 16 | payment lifecycle |
| 27 | `027_documents.sql` | 17 | documents |
| 28 | `028_jobs.sql` | 18 | jobs |
| 29 | `029_monitoring.sql` | 19 | monitoring |
| 30 | `030_monitoring_policy.sql` | 19 | monitoring policy |
| 31 | `031_api_gateway.sql` | 20 | api gateway |
| 32 | `032_backup_recovery.sql` | 21 | backup recovery |
| 33 | `033_security_contracts.sql` | 22 | security contracts |
| 34 | `034_api_schema.sql` | 20 | api schema |
| 35 | `035_workflow_engine.sql` | 23 | workflow engine |
| 36 | `036_workflow_contracts.sql` | 23 | workflow contracts |
| 37 | `037_rule_engine.sql` | 24 | rule engine |
| 38 | `038_data_exchange.sql` | 25 | data exchange |
| 39 | `039_digital_records.sql` | 26 | digital records |
| 40 | `040_enterprise_bi.sql` | 27 | enterprise bi |
| 41 | `041_enterprise_integration.sql` | 28 | enterprise integration |
| 42 | `042_enterprise_ai.sql` | 29 | enterprise ai |
| 43 | `043_platform_admin.sql` | 30 | platform admin |

**Rule:** order strictly monotonic; `validateDatabaseRegistry` fails if 038–043 filenames are missing.

---

## 14. Retention, Archival & Soft-Delete

| Classification / domain | Default retention label |
|-------------------------|-------------------------|
| Restricted financial | 7y-financial-or-policy |
| Confidential PII / agents | 5y-or-policy |
| Internal ops | 3y-or-ops-policy |

Per-table `retention` in registry. Soft-delete via `deleted_at` / status / `active` flags where present. Archival jobs align with Module 21 / audit Module 13 — ECDAPS does not invent purge that bypasses audit.

---

## 15. Backup, Recovery & DR Alignment

| Concern | Alignment |
|---------|-----------|
| Cloud DB backups | Module 21 / `032_backup_recovery.sql` (`backup_sets`, restore ops) |
| SPA localStorage | Device backup / export policies; complements Restricted retention |
| DR restore order | Migrations 001→043 |
| RPO/RTO | Module 21 ops docs; ECDAPS does not invent new targets |

---

## 16. Security, Classification & Access

| Classification | Table count |
|----------------|------------:|
| Internal | 276 |
| Confidential | 22 |
| Restricted | 52 |

Access via existing RLS (migrations 003/005) and app RBAC **by identifier** — ECDAPS does not rewrite permission matrices.

---

## 17. Consistency with APIs / Events / State Machines

| Artifact | Consistency rule |
|----------|------------------|
| Phase 6 APIs (ECACIS) | Endpoints reference entities/tables by id; OpenAPI/GraphQL **facades not live HTTP** |
| Phase 5 Events (ECECMS) | Emitters may persist via localStorage keys / optional SQL mirrors |
| Phase 4 SMs (ECSMLS) | State columns remain in owning module tables |
| Phase 3 ECDM | Soft `entityId` + `persistenceKeys` only |

Sequencing: **Phase 5 → Phase 6 → Phase 7**.

---

## 18. Non-Goals & Prohibited Activities

| Prohibited | Reason |
|------------|--------|
| Changing money math / posting | Financial integrity |
| Rewriting RBAC | Security governance |
| Changing business navigation | Product scope fence |
| Inventing tables not in SQL | Catalog honesty |
| Claiming live OpenAPI/GraphQL HTTP | Phase 6 facade fence |
| Skipping ECDAPS sections 1–20 | Phase 7 workflow |

---

## 19. Governance, Versioning & Change Control

| Control | Mechanism |
|---------|-----------|
| Section sequencing | `phase7-output-workflow.js` P7_SECTIONS 1–20 |
| Error codes | `P7W-xxx` |
| Registry changes | PR + `validateDatabaseRegistry` green |
| Breaking physical changes | ADR + migration number > 043 |
| Approvals | SoD: Primary Owner ≠ Accountable Approver |

---

## 20. Appendices

### A. Inventory method

Regex over `supabase/migrations/*.sql`:

- `create table if not exists public.<name> (`
- `create table if not exists <name> (`

Does **not** capture bare `public` as a table name. Filenames **001–043** sorted.

### B. Core table dictionary (short)

| Table | Entity | Module | localStorage / notes |
|-------|--------|-------:|----------------------|
| `customers` | ENT-CUS-001 | 1 | customers |
| `collections` | ENT-SAV-003 | 1 | collections |
| `loans` | ENT-LON-001 | 1 | loans |
| `ledger_entries` | ENT-FIN-003 | 1 | ledgerEntries, ledger_entries |
| `branches` | ENT-ORG-002 | 1 | branches |
| `businesses` | ENT-ORG-001 | 1 | settings.businessId, businesses |
| `app_users` | ENT-IDN-001 | 1 | users, app_users, deletedUsers |
| `savings_accounts` | ENT-SAV-002 | 1 | savingsAccounts, savings_accounts |
| `withdrawal_requests` | ENT-WDL-001 | 1 | withdrawalRequests, withdrawal_requests |
| `journal_entries` | ENT-FIN-002 | 1 | journalEntries, journal_lines |
| `susu_groups` | ENT-GRP-001 | 7 | groups, susu_groups |
| `payment_transactions` | ENT-PAY-001 | 16 | paymentTransactions, paymentStatusHistory |
| `audit_activity_logs` | ENT-AUD-001 | 13 | audit, audit_log |
| `workflow_instances` | ENT-WFK-002 | 23 | workflowInstances |

See also [`ecdaps-data-dictionary.md`](./ecdaps-data-dictionary.md).

### C. localStorage mirrors (sample)

| SQL table | persistenceKeys / mirrors | Entity |
|-----------|---------------------------|--------|
| `accounting_periods` | closings | ENT-FIN-004 |
| `agent_attendance` | agents, agentRoutes, agentAttendance, agentVisits, agentLeave | ENT-ORG-003 |
| `agent_leave` | agents, agentRoutes, agentAttendance, agentVisits, agentLeave | ENT-ORG-003 |
| `agent_routes` | agents, agentRoutes, agentAttendance, agentVisits, agentLeave | ENT-ORG-003 |
| `ai_models` | aiModels, aiModelVersions, aiModelDeployments | ENT-AI-001 |
| `alerts` | monitorAlerts, alerts | ENT-MON-001 |
| `api_clients` | apiClients, gatewayClients | ENT-GWY-001 |
| `api_keys` | apiKeys, gatewayKeys | ENT-GWY-002 |
| `app_users` | users, app_users, deletedUsers | ENT-IDN-001 |
| `audit_activity_logs` | audit, audit_log | ENT-AUD-001 |
| `audit_log` | audit, audit_log | ENT-AUD-001 |
| `backup_sets` | backupSets, restoreJobs | ENT-BKP-001 |
| `beneficiaries` | beneficiaries | ENT-CUS-002 |
| `branches` | branches | ENT-ORG-002 |
| `business_cases` | workflowCases | ENT-WFK-004 |
| `businesses` | settings.businessId, businesses | ENT-ORG-001 |
| `chart_of_accounts` | chartOfAccounts, chart_of_accounts | ENT-FIN-001 |
| `collection_adjustments` | collectionAdjustments | ENT-SAV-004 |
| `collections` | collections | ENT-SAV-003 |
| `customers` | customers | ENT-CUS-001 |
| `dataset_registry` | aiDatasets | ENT-AI-002 |
| `decision_tables` | ruleDefinitions, decisionTables | ENT-RUL-001 |
| `deployment_history` | platformDeploymentHistory, platformDeploymentApprovals | ENT-PLT-006 |
| `devices` | devices | ENT-IDN-003 |
| `document_metadata` | documentMetadata, receiptMappingHistory, receiptOutcomeHistory | ENT-DOC-001 |
| `documents` | documentMetadata, receiptMappingHistory, receiptOutcomeHistory | ENT-DOC-001 |
| `ecm_document_metadata` | digitalRecords, recordMetadata | ENT-DOC-002 |
| `ecm_documents` | digitalRecords, recordMetadata | ENT-DOC-002 |
| `environment_registry` | platformEnvironmentRegistry | ENT-PLT-003 |
| `export_jobs` | exchangeDatasets, exchangeBatches | ENT-XCH-001 |
| `feature_flag_rules` | platformFeatureFlagRules | ENT-PLT-004 |
| `fraud_alerts` | aiFraudAlerts | ENT-AI-004 |
| `fraud_cases` | fraudCases, securityFraudCases | ENT-SEC-002 |
| `group_meetings` | groupMeetings | ENT-GRP-003 |
| `idempotency_keys` | idempotency_keys, idempotencyKeys | ENT-SYN-002 |
| `import_jobs` | exchangeDatasets, exchangeBatches | ENT-XCH-001 |
| `incidents` | monitorIncidents, incidents | ENT-MON-002 |
| `job_definitions` | jobDefinitions | ENT-JOB-001 |
| `job_queue` | jobQueue, jobAttempts, jobSchedules | ENT-JOB-002 |
| `journal_entries` | journalEntries, journal_lines | ENT-FIN-002 |

### D. Related registries

- `canonical-domain-registry.js` (Phase 3)  
- `canonical-state-machine-registry.js` (Phase 4)  
- `canonical-event-registry.js` (Phase 5)  
- `canonical-api-registry.js` (Phase 6)  
- `canonical-database-registry.js` (Phase 7)

### E. Counts snapshot

| Metric | Value |
|--------|------:|
| Tables | 350 |
| Migrations | 43 |
| Constraints (catalog) | 350 |
| Indexes (catalog) | 132 |
| Planned partitions | 3 |
| FK edges | 138 |
| validateDatabaseRegistry.ok | true |
