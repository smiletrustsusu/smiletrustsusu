# ECDAPS Catalogs (Phase 7 Companion Matrices)

**Parent:** [`enterprise-canonical-database-architecture.md`](./enterprise-canonical-database-architecture.md)  
**Registry:** `src/core/canonical-database-registry.js`  
**Version:** 1.0.0  
**Date:** 2026-09-12  

**Scope:** Physical SQL from `supabase/migrations` + logical ECDM persistenceKeys. Modules 1–30. Phases 1–6 inputs.

**Reality:** localStorage primary; optional Supabase. OpenAPI/GraphQL remain Phase 6 **facades** (no live HTTP).

**Counts:** tables=350, migrations=43, indexes=132, entity-mapped=80

---

## 1. Schema / Table Ownership Matrix

Owning module assigned from introducing migration family. Full list in `DATABASE_TABLES`.

| Module | Approx tables | Migration families |
|-------:|--------------:|--------------------|
| 1 | 44 | 001–007, 019, 024 core |
| 3–12 | CRM through notifications | 008–018 |
| 13–22 | Audit through security | 020–034 |
| 23–30 | Workflow through platform | 035–043 |

---

## 2. Entity–Table Map (ECDM)

Major mapped tables (see registry for complete set of 80):

| Table | Entity | Module |
|-------|--------|-------:|
| businesses | ENT-ORG-001 | 1 |
| branches | ENT-ORG-002 | 1 |
| app_users | ENT-IDN-001 | 1 |
| customers | ENT-CUS-001 | 1 |
| collections | ENT-SAV-003 | 1 |
| susu_groups | ENT-GRP-001 | 7 |
| loans | ENT-LON-001 | 1 |
| withdrawal_requests | ENT-WDL-001 | 1 |
| ledger_entries | ENT-FIN-003 | 1 |
| payment_transactions | ENT-PAY-001 | 16 |
| workflow_definitions | ENT-WFK-001 | 23 |
| documents | ENT-DOC-001 | 17 |
| audit_log | ENT-AUD-001 | 1 |
| sync_queue | ENT-SYN-001 | 1 |
| job_queue | ENT-JOB-002 | 18 |
| api_clients | ENT-GWY-001 | 20 |
| backup_sets | ENT-BKP-001 | 21 |
| security_incidents | ENT-SEC-001 | 22 |
| rule_definitions | ENT-RUL-001 | 24 |
| migration_jobs | ENT-XCH-001 | 25 |
| ecm_documents | ENT-DOC-002 | 26 |
| metric_definitions | ENT-BI-001 | 27 |
| providers | ENT-INT-001 | 28 |
| ai_models | ENT-AI-001 | 29 |
| tenants | ENT-PLT-001 | 30 |

localStorage mirrors: when `entityId` is set, `localStorageMirror=true` and ECDM `persistenceKeys` document SPA keys.

---

## 3. Relationships (physical FK summary)

Parsed from CREATE TABLE `references` clauses (138 edges). Aliases: `users`→`app_users`, `members`→`customers`. External `auth.*` tolerated.

Core graph: businesses → branches → customers → collections / loans / withdrawals; roles ↔ permissions; payments → payment_status_history; workflow_definitions → workflow_instances → workflow_tasks.

---

## 4. Constraints Catalog

- Primary keys: `PK-<table>` in registry  
- Unique indexes: `DATABASE_INDEXES` where `unique=true`  
- Check constraints: role/status enums in SQL  
- Soft-delete: `active` columns on master data  

---

## 5. Indexes Catalog

132 indexes from migrations. Use `listIndexes(tableName)`.

Representative: `customers_account_no_uq`, `customers_collector_idx`, `app_users_username_uq`, `branches_collector_code_uq`.

---

## 6. Partitions

All **planned/optional** — not present in SQL DDL:

| Id | Table | Strategy | Status |
|----|-------|----------|--------|
| PART-PLANNED-LEDGER | ledger_entries | range(created_at) | planned |
| PART-PLANNED-AUDIT | audit_activity_logs | range(created_at) | planned |
| PART-PLANNED-API-REQ | api_requests | range(created_at) | planned |

---

## 7. Migration Catalog

| Order | Id | File |
|------:|----|------|
| 1 | MIG-001 | 001_financial_core.sql |
| 2 | MIG-002 | 002_susu_groups_pesewas.sql |
| 3 | MIG-003 | 003_rls_rpc_production.sql |
| 4 | MIG-004 | 004_savings_products.sql |
| 5 | MIG-005 | 005_production_auth_rls.sql |
| 6 | MIG-006 | 006_web_admin_compat.sql |
| 7 | MIG-007 | 007_agency_platform.sql |
| 8 | MIG-008 | 008_customer_crm.sql |
| 9 | MIG-009 | 009_agent_ops.sql |
| 10 | MIG-010 | 010_branch_ops.sql |
| 11 | MIG-011 | 011_collection_ops.sql |
| 12 | MIG-012 | 012_group_ops.sql |
| 13 | MIG-013 | 013_loan_status.sql |
| 14 | MIG-014 | 014_withdrawal_ops.sql |
| 15 | MIG-015 | 015_accounting_ops.sql |
| 16 | MIG-016 | 016_report_ops.sql |
| 17 | MIG-017 | 017_notification_ops.sql |
| 18 | MIG-018 | 018_notification_thresholds.sql |
| 19 | MIG-019 | 019_canonical_schema.sql |
| 20 | MIG-020 | 020_audit_ops.sql |
| 21 | MIG-021 | 021_idempotency.sql |
| 22 | MIG-022 | 022_system_config.sql |
| 23 | MIG-023 | 023_offline_sync.sql |
| 24 | MIG-024 | 024_identifier_standard.sql |
| 25 | MIG-025 | 025_payments.sql |
| 26 | MIG-026 | 026_payment_lifecycle.sql |
| 27 | MIG-027 | 027_documents.sql |
| 28 | MIG-028 | 028_jobs.sql |
| 29 | MIG-029 | 029_monitoring.sql |
| 30 | MIG-030 | 030_monitoring_policy.sql |
| 31 | MIG-031 | 031_api_gateway.sql |
| 32 | MIG-032 | 032_backup_recovery.sql |
| 33 | MIG-033 | 033_security_contracts.sql |
| 34 | MIG-034 | 034_api_schema.sql |
| 35 | MIG-035 | 035_workflow_engine.sql |
| 36 | MIG-036 | 036_workflow_contracts.sql |
| 37 | MIG-037 | 037_rule_engine.sql |
| 38 | MIG-038 | 038_data_exchange.sql |
| 39 | MIG-039 | 039_digital_records.sql |
| 40 | MIG-040 | 040_enterprise_bi.sql |
| 41 | MIG-041 | 041_enterprise_integration.sql |
| 42 | MIG-042 | 042_enterprise_ai.sql |
| 43 | MIG-043 | 043_platform_admin.sql |

**Required coverage:** migrations 038–043 inclusive must appear in `DATABASE_MIGRATIONS`.

---

## 8. Retention Matrix

| Classification | Retention hint | Examples |
|----------------|----------------|----------|
| Restricted | 7y-financial-or-policy | ledger_entries, payment_transactions, audit_log |
| Confidential | 5y-or-policy | customers, app_users, beneficiaries |
| Internal | 3y-or-ops-policy | metrics, job_queue, sync_queue |
| Public | 1y-or-ops-policy | rare reference lists |

Archival helpers: `audit_archives`, `document_archives`, `document_retention_policies`, `retention_policies`.

---

## 9. Backup / DR Map (Module 21)

| Table | Role |
|-------|------|
| backup_sets / backup_jobs / backup_files | Backup catalog |
| restore_operations / restore_requests | Restore |
| disaster_recovery_sites / recovery_tests | DR |
| backup_policies (config) | Policy |

---

## 10. Security / Classification Map

Registry field `classification` per table. RLS policies remain in migrations 003/005. **No RBAC forbidden-list rewrite** in Phase 7.

---

## 11. Cross-References (Phases 1–6 / Modules 1–30)

| Artifact | Reference |
|----------|-----------|
| Phase 1 | enterprise-master-architecture.md |
| Phase 2 | phase2-registers / governance docs |
| Phase 3 | enterprise-canonical-domain-model.md, canonical-domain-registry.js |
| Phase 4 | enterprise-canonical-state-machines.md |
| Phase 5 | enterprise-canonical-event-catalog.md, canonical-event-registry.js |
| Phase 6 | enterprise-canonical-api-catalog.md, canonical-api-registry.js (facades only) |
| Modules 1–30 | owningModule on each table |

---

*End of ECDAPS companion catalogs v1.0.0*
