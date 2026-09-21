# ECDAPS Data Dictionary (compact)

**Parent:** [`enterprise-canonical-database-architecture.md`](./enterprise-canonical-database-architecture.md)  
**Version:** 1.0.0  

Machine-readable detail lives in `canonical-database-registry.js`. This dictionary summarizes major ECDM-mapped tables (80 of 350 inventoried).

| Table | PK | Entity | Module |
|-------|----|--------|-------:|
| accounting_periods | id | ENT-FIN-004 | 10 |
| agent_attendance | id | ENT-ORG-003 | 4 |
| agent_leave | id | ENT-ORG-003 | 4 |
| agent_routes | id | ENT-ORG-003 | 4 |
| ai_models | id | ENT-AI-001 | 29 |
| alerts | id | ENT-MON-001 | 19 |
| api_clients | id | ENT-GWY-001 | 20 |
| api_keys | id | ENT-GWY-002 | 20 |
| app_users | id | ENT-IDN-001 | 1 |
| audit_activity_logs | id | ENT-AUD-001 | 13 |
| audit_log | id | ENT-AUD-001 | 1 |
| backup_sets | id | ENT-BKP-001 | 21 |
| beneficiaries | id | ENT-CUS-002 | 1 |
| branches | id | ENT-ORG-002 | 1 |
| business_cases | id | ENT-WFK-004 | 23 |
| businesses | id | ENT-ORG-001 | 1 |
| chart_of_accounts | id | ENT-FIN-001 | 1 |
| collection_adjustments | id | ENT-SAV-004 | 6 |
| collections | id | ENT-SAV-003 | 1 |
| customers | id | ENT-CUS-001 | 1 |
| dataset_registry | id | ENT-AI-002 | 29 |
| decision_tables | id | ENT-RUL-001 | 24 |
| deployment_history | id | ENT-PLT-006 | 30 |
| devices | id | ENT-IDN-003 | 1 |
| document_metadata | id | ENT-DOC-001 | 17 |
| documents | id | ENT-DOC-001 | 17 |
| ecm_document_metadata | id | ENT-DOC-002 | 26 |
| ecm_documents | id | ENT-DOC-002 | 26 |
| environment_registry | id | ENT-PLT-003 | 30 |
| export_jobs | id | ENT-XCH-001 | 25 |
| feature_flag_rules | id | ENT-PLT-004 | 30 |
| fraud_alerts | id | ENT-AI-004 | 29 |
| fraud_cases | id | ENT-SEC-002 | 22 |
| group_meetings | id | ENT-GRP-003 | 1 |
| idempotency_keys | id | ENT-SYN-002 | 1 |
| import_jobs | id | ENT-XCH-001 | 25 |
| incidents | id | ENT-MON-002 | 19 |
| job_definitions | id | ENT-JOB-001 | 18 |
| job_queue | id | ENT-JOB-002 | 18 |
| journal_entries | id | ENT-FIN-002 | 1 |
| journal_lines | id | ENT-FIN-002 | 1 |
| kpi_definitions | id | ENT-BI-002 | 11 |
| ledger_entries | id | ENT-FIN-003 | 1 |
| licenses | id | ENT-PLT-002 | 30 |
| loan_disbursements | id | ENT-LON-001 | 1 |
| loan_repayments | id | ENT-LON-002 | 1 |
| loans | id | ENT-LON-001 | 1 |
| maintenance_windows | id | ENT-PLT-005 | 30 |
| message_queues | id | ENT-INT-003 | 28 |
| metric_definitions | id | ENT-BI-001 | 27 |
| migration_jobs | id | ENT-XCH-001 | 25 |
| model_registry | id | ENT-AI-001 | 29 |
| notifications | id | ENT-NTF-001 | 1 |
| payment_status_history | id | ENT-PAY-001 | 16 |
| payment_transactions | id | ENT-PAY-001 | 16 |
| permissions | id | ENT-ORG-005 | 1 |
| personal_savings_accounts | id | ENT-SAV-002 | 6 |
| prediction_requests | id | ENT-AI-003 | 29 |
| prediction_results | id | ENT-AI-003 | 29 |
| providers | id | ENT-INT-001 | 28 |
| recommendation_history | id | ENT-AI-005 | 29 |
| restore_operations | id | ENT-BKP-001 | 21 |
| role_permissions | id | ENT-ORG-005 | 1 |
| roles | id | ENT-ORG-004 | 1 |
| rule_definitions | id | ENT-RUL-001 | 24 |
| savings_accounts | id | ENT-SAV-002 | 1 |
| savings_products | id | ENT-SAV-001 | 6 |
| security_incidents | id | ENT-SEC-001 | 22 |
| sessions | id | ENT-IDN-002 | 1 |
| susu_group_members | id | ENT-GRP-002 | 7 |
| susu_groups | id | ENT-GRP-001 | 7 |
| sync_queue | id | ENT-SYN-001 | 1 |
| system_settings | id | ENT-CFG-001 | 1 |
| tenants | id | ENT-PLT-001 | 30 |
| user_roles | id | ENT-ORG-004 | 1 |
| webhooks | id | ENT-INT-002 | 28 |
| withdrawal_requests | id | ENT-WDL-001 | 1 |
| workflow_definitions | id | ENT-WFK-001 | 23 |
| workflow_instances | id | ENT-WFK-002 | 23 |
| workflow_tasks | id | ENT-WFK-003 | 23 |

Additional 270 operational/supporting tables are registered without a direct ENT-* bind; they still have owningModule, classification, and migration metadata.

Logical persistence keys: see Phase 3 ECDM `persistenceKeys` on each ENT-*.

---

*End of ECDAPS data dictionary v1.0.0*
