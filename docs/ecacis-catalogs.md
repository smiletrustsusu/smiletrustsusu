# ECACIS Catalogs (Phase 6 Companion Matrices)

**Parent:** [`enterprise-canonical-api-catalog.md`](./enterprise-canonical-api-catalog.md)  
**Registry:** `src/core/canonical-api-registry.js`  
**Contracts:** `src/core/module-contracts.js`  
**Gateway:** `src/core/api-gateway-lifecycle.js`  
**Version:** 1.0.0  
**Date:** 2026-09-12  
**Scope:** Modules 1–30 · Phases 1–5 alignment  

**Facade reality:** OpenAPI/GraphQL are **facades**. Runtime = in-process `invokeContract` / gateway routes. **NO live REST/GraphQL HTTP server.**

**Endpoint count:** 426 (contracts 312 + gateway 114)

---

## 1. Ownership Matrix (contract facades by module)

| Owner Mod | Endpoint count | Sample contractIds |
|-----------|----------------|--------------------|
| 1 | 9 | Authentication.Login.v1, Authentication.Logout.v1, Authentication.RefreshToken.v1, Authentication.ChangePassword.v1, Authentication.ResetPassword.v1, Authentication.RegisterDevice.v1, User.GetProfile.v1, User.GetPermissions.v1 … |
| 2 | 4 | Dashboard.GetSummary.v1, Dashboard.GetKPIs.v1, Dashboard.GetNotifications.v1, Dashboard.GetWidgets.v1 |
| 3 | 9 | Customer.Create.v1, Customer.Update.v1, Customer.Suspend.v1, Customer.Reactivate.v1, Customer.Close.v1, Customer.Get.v1, Customer.Search.v1, Customer.List.v1 … |
| 4 | 7 | Agent.Create.v1, Agent.AssignBranch.v1, Agent.Suspend.v1, Agent.Reactivate.v1, Agent.Get.v1, Agent.List.v1, Agent.Performance.v1 |
| 5 | 6 | Branch.Create.v1, Branch.Update.v1, Branch.Activate.v1, Branch.Deactivate.v1, Branch.Get.v1, Branch.List.v1 |
| 6 | 6 | Savings.Collect.v1, Savings.Adjust.v1, Savings.Cancel.v1, Savings.Balance.v1, Savings.Statement.v1, Savings.TransactionHistory.v1 |
| 7 | 8 | Group.Create.v1, Group.AddMember.v1, Group.RemoveMember.v1, Group.RecordContribution.v1, Group.Close.v1, Group.Get.v1, Group.Members.v1, Group.Statement.v1 |
| 8 | 10 | Loan.Apply.v1, Loan.Approve.v1, Loan.Reject.v1, Loan.Disburse.v1, Loan.Repay.v1, Loan.Restructure.v1, Loan.Close.v1, Loan.Get.v1 … |
| 9 | 6 | Withdrawal.Request.v1, Withdrawal.Approve.v1, Withdrawal.Reject.v1, Withdrawal.Execute.v1, Withdrawal.Get.v1, Withdrawal.History.v1 |
| 10 | 6 | Journal.Post.v1, Journal.Reverse.v1, Accounting.ClosePeriod.v1, Ledger.Balance.v1, TrialBalance.Generate.v1, FinancialStatements.Generate.v1 |
| 11 | 4 | Report.Generate.v1, Report.Schedule.v1, Report.Get.v1, Analytics.Dashboard.v1 |
| 12 | 5 | Notification.Send.v1, Notification.Schedule.v1, Notification.Cancel.v1, Notification.Status.v1, Notification.History.v1 |
| 13 | 3 | Audit.Record.v1, Audit.Search.v1, Audit.Export.v1 |
| 14 | 5 | Configuration.Update.v1, FeatureFlag.Enable.v1, FeatureFlag.Disable.v1, Configuration.Get.v1, FeatureFlags.List.v1 |
| 15 | 5 | Sync.Upload.v1, Sync.Download.v1, Sync.ResolveConflict.v1, Sync.Status.v1, Sync.Pending.v1 |
| 16 | 6 | Payment.Initiate.v1, Payment.Verify.v1, Payment.Reverse.v1, Payment.Refund.v1, Payment.Status.v1, Payment.ProviderHealth.v1 |
| 17 | 7 | Receipt.Generate.v1, Statement.Generate.v1, Document.Sign.v1, Document.Archive.v1, Receipt.Get.v1, Statement.Get.v1, Document.Search.v1 |
| 18 | 5 | Job.Enqueue.v1, Job.Cancel.v1, Job.Retry.v1, Job.Status.v1, Queue.Status.v1 |
| 19 | 5 | Alert.Acknowledge.v1, Alert.Resolve.v1, Health.Status.v1, Metrics.Get.v1, Alert.List.v1 |
| 20 | 4 | API.RegisterClient.v1, API.RevokeKey.v1, API.Usage.v1, API.ClientStatus.v1 |
| 21 | 5 | Backup.Start.v1, Restore.Start.v1, Recovery.Test.v1, Backup.Status.v1, Recovery.Status.v1 |
| 22 | 8 | Risk.Evaluate.v1, Security.OpenIncident.v1, Security.CloseIncident.v1, Fraud.Investigate.v1, Risk.Score.v1, Incident.Get.v1, Threat.Status.v1, Security.DeprecatedProbe.v1 |
| 23 | 29 | Workflow.Start.v1, Workflow.Simulate.v1, Workflow.Cancel.v1, Workflow.Resume.v1, Workflow.Suspend.v1, Workflow.Retry.v1, Workflow.Replay.v1, Workflow.CompleteTask.v1 … |
| 24 | 20 | Rule.Evaluate.v1, Rule.EvaluateSet.v1, Rule.Simulate.v1, Rule.Replay.v1, Rule.Test.v1, Rule.SubmitTest.v1, Rule.Publish.v1, Rule.Retire.v1 … |
| 25 | 16 | Exchange.Validate.v1, Exchange.Map.v1, Exchange.Import.v1, Exchange.Export.v1, Exchange.Migrate.v1, Exchange.Bulk.v1, Exchange.Approve.v1, Exchange.RequestPermission.v1 … |
| 26 | 19 | Records.Upload.v1, Records.Version.v1, Records.Compare.v1, Records.Rollback.v1, Records.Archive.v1, Records.Retire.v1, Records.Restore.v1, Records.Delete.v1 … |
| 27 | 12 | Bi.Metric.Register.v1, Bi.Metric.Validate.v1, Bi.Kpi.Calculate.v1, Bi.Kpi.CalculateAll.v1, Bi.Kpi.Publish.v1, Bi.Schema.Register.v1, Bi.Schema.Validate.v1, Bi.Metric.Get.v1 … |
| 28 | 26 | Integration.Provider.Register.v1, Integration.Provider.Status.v1, Integration.Client.Register.v1, Integration.OAuth.Register.v1, Integration.Key.Issue.v1, Integration.Webhook.Register.v1, Integration.Webhook.Receive.v1, Integration.Webhook.Deliver.v1 … |
| 29 | 24 | Ai.Predict.v1, Ai.Fraud.Detect.v1, Ai.Risk.Score.v1, Ai.Recommend.v1, Ai.Recommend.Decide.v1, Ai.Forecast.v1, Ai.Anomaly.Detect.v1, Ai.Model.Register.v1 … |
| 30 | 33 | Platform.Tenant.Register.v1, Platform.Tenant.Transition.v1, Platform.Tenant.Config.v1, Platform.Config.Publish.v1, Platform.Flag.Set.v1, Platform.Flag.Kill.v1, Platform.License.Revoke.v1, Platform.Announcement.Publish.v1 … |
| 20 (gateway aliases) | 114 | ROUTE_CATALOG ids as `gateway:{id}` |

---

## 2. Endpoint Registry Summary

| Facade type | Count | Method model |
|-------------|-------|--------------|
| contract | 312 | QUERY/COMMAND (+ HTTP facade GET/POST) |
| gateway | 114 | HTTP method from ROUTE_CATALOG |
| **Total** | **426** | documentation aliases only |

| Contract kind | Count |
|---------------|-------|
| command | 195 |
| query | 117 |

URI templates:
- Contracts: `/contracts/{contractId}`
- Gateway: path from route (`/gateway/...`, `/payments`, etc.) as **aliases**

---

## 3. Authorization Matrix (action identifiers)

| Action / permission | Endpoint count | Note |
|---------------------|----------------|------|
| Accounting.Edit | 3 | identifier-only (RBAC unchanged) |
| Accounting.View | 3 | identifier-only (RBAC unchanged) |
| Agent.Edit | 4 | identifier-only (RBAC unchanged) |
| Ai.Admin | 3 | identifier-only (RBAC unchanged) |
| Ai.Govern | 4 | identifier-only (RBAC unchanged) |
| Ai.Model | 3 | identifier-only (RBAC unchanged) |
| Ai.Predict | 13 | identifier-only (RBAC unchanged) |
| Ai.View | 15 | identifier-only (RBAC unchanged) |
| Audit.View | 3 | identifier-only (RBAC unchanged) |
| Backup.Create | 4 | identifier-only (RBAC unchanged) |
| Backup.Verify | 3 | identifier-only (RBAC unchanged) |
| Bi.Metric | 3 | identifier-only (RBAC unchanged) |
| Bi.Publish | 1 | identifier-only (RBAC unchanged) |
| Bi.Schema | 3 | identifier-only (RBAC unchanged) |
| Bi.View | 12 | identifier-only (RBAC unchanged) |
| Branch.Edit | 4 | identifier-only (RBAC unchanged) |
| Customer.Edit | 5 | identifier-only (RBAC unchanged) |
| Customer.View | 15 | identifier-only (RBAC unchanged) |
| Document.Generate | 4 | identifier-only (RBAC unchanged) |
| Document.View | 3 | identifier-only (RBAC unchanged) |
| Exchange.Approve | 4 | identifier-only (RBAC unchanged) |
| Exchange.Bulk | 2 | identifier-only (RBAC unchanged) |
| Exchange.Export | 2 | identifier-only (RBAC unchanged) |
| Exchange.Import | 7 | identifier-only (RBAC unchanged) |
| Exchange.Migrate | 2 | identifier-only (RBAC unchanged) |
| Exchange.View | 8 | identifier-only (RBAC unchanged) |
| Gateway.Client | 2 | identifier-only (RBAC unchanged) |
| Gateway.Docs | 1 | identifier-only (RBAC unchanged) |
| Gateway.View | 3 | identifier-only (RBAC unchanged) |
| Gateway.Webhook | 1 | identifier-only (RBAC unchanged) |
| Group.Edit | 5 | identifier-only (RBAC unchanged) |
| Group.View | 3 | identifier-only (RBAC unchanged) |
| Integration.Admin | 11 | identifier-only (RBAC unchanged) |
| Integration.Client | 3 | identifier-only (RBAC unchanged) |
| Integration.Key | 2 | identifier-only (RBAC unchanged) |
| Integration.Provider | 4 | identifier-only (RBAC unchanged) |
| Integration.Transform | 3 | identifier-only (RBAC unchanged) |
| Integration.View | 10 | identifier-only (RBAC unchanged) |
| Integration.Webhook | 6 | identifier-only (RBAC unchanged) |
| Job.Run | 3 | identifier-only (RBAC unchanged) |
| Job.View | 2 | identifier-only (RBAC unchanged) |
| Loan.Approve | 7 | identifier-only (RBAC unchanged) |
| Monitor.Alert | 2 | identifier-only (RBAC unchanged) |
| Monitor.Diagnose | 1 | identifier-only (RBAC unchanged) |
| Monitor.View | 4 | identifier-only (RBAC unchanged) |
| Notification.Send | 3 | identifier-only (RBAC unchanged) |
| Notification.View | 2 | identifier-only (RBAC unchanged) |
| Payment.View | 8 | identifier-only (RBAC unchanged) |
| Platform.Admin | 7 | identifier-only (RBAC unchanged) |
| Platform.Config | 3 | identifier-only (RBAC unchanged) |
| Platform.Deploy | 6 | identifier-only (RBAC unchanged) |
| Platform.Flag | 2 | identifier-only (RBAC unchanged) |
| Platform.License | 6 | identifier-only (RBAC unchanged) |
| Platform.Maintenance | 4 | identifier-only (RBAC unchanged) |
| Platform.Tenant | 5 | identifier-only (RBAC unchanged) |
| Platform.View | 18 | identifier-only (RBAC unchanged) |
| Records.Archive | 3 | identifier-only (RBAC unchanged) |
| Records.Delete | 1 | identifier-only (RBAC unchanged) |
| Records.Download | 4 | identifier-only (RBAC unchanged) |
| Records.Hold | 2 | identifier-only (RBAC unchanged) |
| Records.Policy | 1 | identifier-only (RBAC unchanged) |
| Records.Restore | 1 | identifier-only (RBAC unchanged) |
| Records.Share | 1 | identifier-only (RBAC unchanged) |
| Records.Upload | 3 | identifier-only (RBAC unchanged) |
| Records.Version | 1 | identifier-only (RBAC unchanged) |
| Records.View | 9 | identifier-only (RBAC unchanged) |
| Reports.View | 8 | identifier-only (RBAC unchanged) |
| Rule.Approve | 3 | identifier-only (RBAC unchanged) |
| Rule.Design | 1 | identifier-only (RBAC unchanged) |
| Rule.Publish | 3 | identifier-only (RBAC unchanged) |
| Rule.Simulate | 3 | identifier-only (RBAC unchanged) |
| Rule.Test | 3 | identifier-only (RBAC unchanged) |
| Rule.View | 15 | identifier-only (RBAC unchanged) |
| Savings.Collect | 3 | identifier-only (RBAC unchanged) |
| Security.Evaluate | 2 | identifier-only (RBAC unchanged) |
| Security.Incident | 3 | identifier-only (RBAC unchanged) |
| Security.Investigate | 1 | identifier-only (RBAC unchanged) |
| Security.View | 4 | identifier-only (RBAC unchanged) |
| Sync.Retry | 3 | identifier-only (RBAC unchanged) |
| Sync.View | 2 | identifier-only (RBAC unchanged) |

---

## 4. Version Registry

| Source | Version field | Notes |
|--------|---------------|-------|
| CONTRACT_CATALOG | contract.version (typically 1.0.0) | Semver on contract facades |
| ROUTE_CATALOG | versions[] first tag | Gateway facade version |
| ECACIS pack | 1.0.0 | This catalog |

---

## 5. Error Mapping (governance + contract)

| Code | Meaning |
|------|---------|
| P6W-001 | Missing owner/approver on create |
| P6W-010 | SoD: owner = approver |
| P6W-011 | SoD: owner = independent reviewer |
| P6W-020 | Unknown status |
| P6W-021 | Illegal status transition |
| P6W-030 | AWC blocked by Critical findings |
| P6W-040 | Open conditions block baseline/publish |
| P6W-041 | Condition not found |
| P6W-050 | Publish without approvals |
| P6W-060 | Unknown stage |
| P6W-061/062 | Stage sequencing violation |
| P6W-063 | Stage criteria not met |
| Contract errors | Existing `ERROR_CONTRACT` / `statusFromContractError` unchanged |

---

## 6. SLA Matrix (documentation targets)

| Class | Target (doc) | Notes |
|-------|--------------|-------|
| In-process query | < 50ms typical | Local SPA; not network SLA |
| In-process command | < 200ms typical | Excludes device I/O |
| Gateway facade alias | N/A network | No live HTTP server |
| Batch | Best effort | Scheduler Module 18 |

---

## 7. API ↔ Entity / SM / Event / Module / Permission matrices

### API ↔ Module
See Ownership Matrix (§1). Gateway aliases → Module **20**.

### API ↔ Entity / SM (soft hints)
Hints derived from contract id prefix in `canonical-api-registry.js` (`CONTRACT_ENTITY_HINTS` / `CONTRACT_SM_HINTS`). ECDM/ECSMLS remain authoritative.

### API ↔ Event
When `contract.event` is set, registry lists ECECMS id if curated, else event name. Phase 5 curated events: 79.

### API ↔ Permission
`auth` / `permissions` = contract/route `action` string.

---

## 8. Cross-Reference Index (Phases 1–5)

| Phase | Artifact | ECACIS use |
|-------|----------|------------|
| 1 EMAS | enterprise-master-architecture.md | Module boundaries; Module 20 in-process |
| 2 | phase2-registers / governance | Precedence |
| 3 ECDM | canonical-domain-registry.js | Soft entity hints |
| 4 ECSMLS | canonical-state-machine-registry.js | Soft SM hints |
| 5 ECECMS | canonical-event-registry.js | Event links |
| 6 ECACIS | This pack | APIs / facades / governance |

---

*End of ECACIS catalogs v1.0.0*
