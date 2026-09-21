import { recordAuditEvent } from "./audit-ops.js";
import { canAction } from "./rbac.js";
import { isSystemOwner } from "./roles.js";
import {
  ensureApiSchemaState,
  normalizeRequestHeader,
  validateRequestHeader,
  buildResponseHeader,
  standardSuccessEnvelope,
  standardErrorEnvelope,
  standardAsyncEnvelope,
  standardFileEnvelope,
  standardEvent,
  paginationFrom,
  httpStatusFor,
  statusFromContractError,
  recordHeaderValidation,
  maskHeaderForAudit
} from "./api-schema.js";

/**
 * Public interface contracts for modules 1–27.
 * Cross-module calls go through invokeContract. No SQL, caches, or private methods.
 */

export const INTERFACE_SCHEMA_VERSION = "1.0.0";

export const CONTRACT_KINDS = ["command", "query", "event", "admin", "batch", "health"];
export const CONTRACT_STATUSES = ["draft", "active", "deprecated", "retired"];

export const ERROR_CONTRACT = {
  fields: ["errorCode", "errorMessage", "correlationId", "timestamp", "retry"]
};

export const PROHIBITED_PATHS = [
  "direct_sql",
  "private_methods",
  "internal_cache",
  "shared_mutable_objects",
  "undocumented_integration",
  "bypass_gateway_external"
];

export const MODULE_CONSUME = {
  1: [14, 13, 19],
  2: "queries",
  3: [1, 5, 17, 13],
  4: [1, 5, 3, 13],
  5: [1, 14],
  6: [3, 4, 5, 10, 16, 17],
  7: [3, 10, 16, 17],
  8: [3, 10, 16, 17],
  9: [3, 10, 16, 17],
  10: [6, 7, 8, 9, 16],
  11: "queries",
  12: "all",
  13: "events",
  14: [19, 18, 22],
  15: [3, 6, 8, 16, 17],
  16: [10, 17, 12],
  17: [10, 16, 3],
  18: "all",
  19: "all",
  20: "public",
  21: "backup",
  22: [13, 19, 1, 16, 15, 23, 24],
  23: "all",
  24: [13, 18, 19, 20, 23],
  25: [13, 18, 19, 20, 23, 24],
  26: [13, 17, 18, 19, 20, 23],
  27: [11, 13, 18, 19, 20, 23, 24],
  28: [13, 18, 19, 20, 16, 23, 25],
  29: [13, 18, 19, 20, 23, 24, 27]
};

const ROWS = [];

function add(moduleId, owner, kind, names, extras = {}) {
  names.forEach((name) => {
    ROWS.push({
      id: name,
      moduleId,
      owner,
      kind,
      version: "1.0.0",
      status: extras.status || "active",
      action: extras.action || "",
      idempotent: extras.idempotent === true || kind === "query",
      audit: kind === "command",
      event: extras.event || "",
      ownerInternal: extras.ownerInternal === true,
      posting: extras.posting === true
    });
  });
}

add(1, "Authentication", "command", [
  "Authentication.Login.v1", "Authentication.Logout.v1", "Authentication.RefreshToken.v1",
  "Authentication.ChangePassword.v1", "Authentication.ResetPassword.v1", "Authentication.RegisterDevice.v1"
], { action: "System.View", ownerInternal: true });
add(1, "Authentication", "query", ["User.GetProfile.v1", "User.GetPermissions.v1", "Session.Validate.v1"], { action: "System.View" });
add(1, "Authentication", "event", ["UserAuthenticated", "UserLoggedOut", "PasswordChanged", "DeviceRegistered"]);

add(2, "Dashboard", "query", [
  "Dashboard.GetSummary.v1", "Dashboard.GetKPIs.v1", "Dashboard.GetNotifications.v1", "Dashboard.GetWidgets.v1"
], { action: "Reports.View" });
add(2, "Dashboard", "event", ["DashboardCacheRefreshed"]);

add(3, "Customer", "command", [
  "Customer.Create.v1", "Customer.Update.v1", "Customer.Suspend.v1", "Customer.Reactivate.v1", "Customer.Close.v1"
], { action: "Customer.Edit", ownerInternal: true });
add(3, "Customer", "query", ["Customer.Get.v1", "Customer.Search.v1", "Customer.List.v1", "Customer.History.v1"], { action: "Customer.View" });
add(3, "Customer", "event", ["CustomerCreated", "CustomerUpdated", "CustomerSuspended", "CustomerClosed"]);

add(4, "Agent", "command", ["Agent.Create.v1", "Agent.AssignBranch.v1", "Agent.Suspend.v1", "Agent.Reactivate.v1"], { action: "Agent.Edit", ownerInternal: true });
add(4, "Agent", "query", ["Agent.Get.v1", "Agent.List.v1", "Agent.Performance.v1"], { action: "Customer.View" });
add(4, "Agent", "event", ["AgentCreated", "AgentAssigned", "AgentSuspended"]);

add(5, "Branch", "command", ["Branch.Create.v1", "Branch.Update.v1", "Branch.Activate.v1", "Branch.Deactivate.v1"], { action: "Branch.Edit", ownerInternal: true });
add(5, "Branch", "query", ["Branch.Get.v1", "Branch.List.v1"], { action: "System.View" });
add(5, "Branch", "event", ["BranchCreated", "BranchUpdated"]);

add(6, "Savings", "command", ["Savings.Collect.v1", "Savings.Adjust.v1", "Savings.Cancel.v1"], { action: "Savings.Collect", ownerInternal: true, posting: true });
add(6, "Savings", "query", ["Savings.Balance.v1", "Savings.Statement.v1", "Savings.TransactionHistory.v1"], { action: "Customer.View" });
add(6, "Savings", "event", ["SavingsCollected", "SavingsAdjusted", "SavingsCancelled"]);

add(7, "Group", "command", [
  "Group.Create.v1", "Group.AddMember.v1", "Group.RemoveMember.v1", "Group.RecordContribution.v1", "Group.Close.v1"
], { action: "Group.Edit", ownerInternal: true, posting: true });
add(7, "Group", "query", ["Group.Get.v1", "Group.Members.v1", "Group.Statement.v1"], { action: "Group.View" });
add(7, "Group", "event", ["GroupCreated", "MemberAdded", "ContributionRecorded"]);

add(8, "Loan", "command", [
  "Loan.Apply.v1", "Loan.Approve.v1", "Loan.Reject.v1", "Loan.Disburse.v1", "Loan.Repay.v1", "Loan.Restructure.v1", "Loan.Close.v1"
], { action: "Loan.Approve", ownerInternal: true, posting: true });
add(8, "Loan", "query", ["Loan.Get.v1", "Loan.Schedule.v1", "Loan.Statement.v1"], { action: "Customer.View" });
add(8, "Loan", "event", ["LoanApproved", "LoanDisbursed", "LoanRepaymentReceived", "LoanClosed"]);

add(9, "Withdrawal", "command", [
  "Withdrawal.Request.v1", "Withdrawal.Approve.v1", "Withdrawal.Reject.v1", "Withdrawal.Execute.v1"
], { action: "Withdrawal.Approve", ownerInternal: true, posting: true });
add(9, "Withdrawal", "query", ["Withdrawal.Get.v1", "Withdrawal.History.v1"], { action: "Customer.View" });
add(9, "Withdrawal", "event", ["WithdrawalRequested", "WithdrawalApproved", "WithdrawalCompleted"]);

add(10, "Accounting", "command", ["Journal.Post.v1", "Journal.Reverse.v1", "Accounting.ClosePeriod.v1"], { action: "Accounting.Edit", ownerInternal: true, posting: true });
add(10, "Accounting", "query", ["Ledger.Balance.v1", "TrialBalance.Generate.v1", "FinancialStatements.Generate.v1"], { action: "Accounting.View" });
add(10, "Accounting", "event", ["JournalPosted", "JournalReversed", "AccountingPeriodClosed"]);

add(11, "Reports", "command", ["Report.Generate.v1", "Report.Schedule.v1"], { action: "Reports.View" });
add(11, "Reports", "query", ["Report.Get.v1", "Analytics.Dashboard.v1"], { action: "Reports.View" });
add(11, "Reports", "event", ["ReportGenerated"]);

add(12, "Notification", "command", ["Notification.Send.v1", "Notification.Schedule.v1", "Notification.Cancel.v1"], { action: "Notification.Send" });
add(12, "Notification", "query", ["Notification.Status.v1", "Notification.History.v1"], { action: "Notification.View" });
add(12, "Notification", "event", ["NotificationQueued", "NotificationDelivered", "NotificationFailed"]);

add(13, "Audit", "command", ["Audit.Record.v1"], { action: "Audit.View" });
add(13, "Audit", "query", ["Audit.Search.v1", "Audit.Export.v1"], { action: "Audit.View" });
add(13, "Audit", "event", ["AuditRecorded"]);

add(14, "Configuration", "command", ["Configuration.Update.v1", "FeatureFlag.Enable.v1", "FeatureFlag.Disable.v1"], { action: "System.Configure" });
add(14, "Configuration", "query", ["Configuration.Get.v1", "FeatureFlags.List.v1"], { action: "System.View" });
add(14, "Configuration", "event", ["ConfigurationChanged", "FeatureFlagUpdated"]);

add(15, "Synchronization", "command", ["Sync.Upload.v1", "Sync.Download.v1", "Sync.ResolveConflict.v1"], { action: "Sync.Retry" });
add(15, "Synchronization", "query", ["Sync.Status.v1", "Sync.Pending.v1"], { action: "Sync.View" });
add(15, "Synchronization", "event", ["SynchronizationStarted", "SynchronizationCompleted", "SynchronizationFailed"]);

add(16, "Payment", "command", ["Payment.Initiate.v1", "Payment.Verify.v1", "Payment.Reverse.v1", "Payment.Refund.v1"], { action: "Payment.View", idempotent: true });
add(16, "Payment", "query", ["Payment.Status.v1", "Payment.ProviderHealth.v1"], { action: "Payment.View" });
add(16, "Payment", "event", ["PaymentCompleted", "PaymentFailed", "PaymentReversed"]);

add(17, "Document", "command", ["Receipt.Generate.v1", "Statement.Generate.v1", "Document.Sign.v1", "Document.Archive.v1"], { action: "Document.Generate" });
add(17, "Document", "query", ["Receipt.Get.v1", "Statement.Get.v1", "Document.Search.v1"], { action: "Document.View" });
add(17, "Document", "event", ["ReceiptIssued", "StatementGenerated", "DocumentSigned"]);

add(18, "Scheduler", "command", ["Job.Enqueue.v1", "Job.Cancel.v1", "Job.Retry.v1"], { action: "Job.Run", idempotent: true });
add(18, "Scheduler", "query", ["Job.Status.v1", "Queue.Status.v1"], { action: "Job.View" });
add(18, "Scheduler", "event", ["JobCompleted", "JobFailed", "JobRetried"]);

add(19, "Monitoring", "command", ["Alert.Acknowledge.v1", "Alert.Resolve.v1"], { action: "Monitor.Alert" });
add(19, "Monitoring", "query", ["Health.Status.v1", "Metrics.Get.v1", "Alert.List.v1"], { action: "Monitor.View" });
add(19, "Monitoring", "event", ["AlertRaised", "AlertResolved", "HealthStatusChanged"]);

add(20, "API Gateway", "command", ["API.RegisterClient.v1", "API.RevokeKey.v1"], { action: "Gateway.Client" });
add(20, "API Gateway", "query", ["API.Usage.v1", "API.ClientStatus.v1"], { action: "Gateway.View" });
add(20, "API Gateway", "event", ["ClientRegistered", "APIKeyRevoked"]);

add(21, "Backup", "command", ["Backup.Start.v1", "Restore.Start.v1", "Recovery.Test.v1"], { action: "Backup.Create", idempotent: true });
add(21, "Backup", "query", ["Backup.Status.v1", "Recovery.Status.v1"], { action: "Backup.Verify" });
add(21, "Backup", "event", ["BackupCompleted", "RestoreCompleted", "RecoveryTestCompleted"]);

add(22, "Security", "command", ["Risk.Evaluate.v1"], { action: "Security.Evaluate", idempotent: true });
add(22, "Security", "command", ["Security.OpenIncident.v1", "Security.CloseIncident.v1"], { action: "Security.Incident" });
add(22, "Security", "command", ["Fraud.Investigate.v1"], { action: "Security.Investigate" });
add(22, "Security", "query", ["Risk.Score.v1", "Incident.Get.v1", "Threat.Status.v1"], { action: "Security.View" });
add(22, "Security", "query", ["Security.DeprecatedProbe.v1"], { action: "Security.View", status: "retired" });
add(22, "Security", "event", ["FraudDetected", "RiskScoreUpdated", "SecurityIncidentOpened", "SecurityIncidentClosed"]);

add(23, "Workflow", "command", ["Workflow.Start.v1", "Workflow.Simulate.v1"], { action: "Workflow.Start", idempotent: true });
add(23, "Workflow", "command", ["Workflow.Cancel.v1"], { action: "Workflow.Start", idempotent: true });
add(23, "Workflow", "command", ["Workflow.Resume.v1", "Workflow.Suspend.v1", "Workflow.Retry.v1", "Workflow.Replay.v1"], { action: "Workflow.Admin", idempotent: true });
add(23, "Workflow", "command", ["Workflow.CompleteTask.v1", "Task.Complete.v1", "Workflow.AssignTask.v1", "Workflow.DelegateTask.v1"], { action: "Workflow.Task", idempotent: true });
add(23, "Workflow", "command", ["Workflow.Approve.v1", "Workflow.Reject.v1"], { action: "Workflow.Approve", idempotent: true });
add(23, "Workflow", "command", ["Case.Open.v1", "Case.Close.v1"], { action: "Workflow.Case", idempotent: true });
add(23, "Workflow", "command", ["Workflow.PublishDefinition.v1", "Workflow.RetireDefinition.v1"], { action: "Workflow.Design", idempotent: true });
add(23, "Workflow", "command", ["Workflow.RegisterCallback.v1"], { action: "Workflow.Admin", idempotent: true });
add(23, "Workflow", "query", [
  "Workflow.Status.v1", "Workflow.Get.v1", "Workflow.List.v1", "Workflow.Tasks.v1", "Workflow.Case.v1",
  "Workflow.History.v1", "Task.Inbox.v1", "Case.Get.v1", "Workflow.Definitions.v1", "Workflow.Definition.Get.v1",
  "Workflow.Statistics.v1"
], { action: "Workflow.View" });
add(23, "Workflow", "event", [
  "WorkflowStarted", "WorkflowCompleted", "WorkflowFailed", "WorkflowCancelled", "WorkflowSuspended",
  "WorkflowResumed", "WorkflowEscalated", "WorkflowExpired", "WorkflowRetried", "WorkflowTaskCreated",
  "WorkflowTaskAssigned", "WorkflowTaskCompleted", "WorkflowTaskDelegated", "WorkflowApproved",
  "WorkflowRejected", "WorkflowSLABreached", "WorkflowCaseOpened", "WorkflowCaseClosed",
  "TaskAssigned", "TaskEscalated", "CaseOpened"
]);

add(24, "Rules", "command", ["Rule.Evaluate.v1", "Rule.EvaluateSet.v1"], { action: "Rule.View", idempotent: true });
add(24, "Rules", "command", ["Rule.Simulate.v1", "Rule.Replay.v1"], { action: "Rule.Simulate", idempotent: true });
add(24, "Rules", "command", ["Rule.Test.v1", "Rule.SubmitTest.v1"], { action: "Rule.Test", idempotent: true });
add(24, "Rules", "command", ["Rule.Publish.v1", "Rule.Retire.v1"], { action: "Rule.Publish", idempotent: true });
add(24, "Rules", "command", ["Rule.Approve.v1", "Rule.Reject.v1", "Rule.SubmitApproval.v1"], { action: "Rule.Approve", idempotent: true });
add(24, "Rules", "command", ["Rule.Import.v1"], { action: "Rule.Design", idempotent: true });
add(24, "Rules", "command", ["Rule.Export.v1"], { action: "Rule.View", idempotent: true });
add(24, "Rules", "query", [
  "Rule.Get.v1", "Rule.List.v1", "Rule.History.v1", "DecisionTable.Get.v1",
  "DecisionTree.Get.v1", "ScoringModel.Get.v1", "Rule.Statistics.v1"
], { action: "Rule.View" });
add(24, "Rules", "event", [
  "RuleEvaluated", "RulePublished", "RuleRetired", "RuleApproved", "RuleFailed", "RuleSimulated"
]);

add(25, "Exchange", "command", ["Exchange.Validate.v1", "Exchange.Map.v1"], { action: "Exchange.Import", idempotent: true });
add(25, "Exchange", "command", ["Exchange.Import.v1"], { action: "Exchange.Import", idempotent: true });
add(25, "Exchange", "command", ["Exchange.Export.v1"], { action: "Exchange.Export", idempotent: true });
add(25, "Exchange", "command", ["Exchange.Migrate.v1"], { action: "Exchange.Migrate", idempotent: true });
add(25, "Exchange", "command", ["Exchange.Bulk.v1"], { action: "Exchange.Bulk", idempotent: true });
add(25, "Exchange", "command", ["Exchange.Approve.v1", "Exchange.RequestPermission.v1", "Exchange.AdvancePermission.v1"], { action: "Exchange.Approve", idempotent: true });
add(25, "Exchange", "command", ["Exchange.Rollback.v1", "Exchange.Control.v1"], { action: "Exchange.Import", idempotent: true });
add(25, "Exchange", "query", [
  "Exchange.Jobs.v1", "Exchange.History.v1", "Exchange.Errors.v1", "Exchange.Templates.v1", "Exchange.Statistics.v1"
], { action: "Exchange.View" });
add(25, "Exchange", "event", [
  "ImportCompleted", "ExportCompleted", "MigrationCompleted", "ValidationFailed", "ExportDenied"
]);

add(26, "Records", "command", ["Records.Upload.v1", "Records.Version.v1"], { action: "Records.Upload", idempotent: true });
add(26, "Records", "command", ["Records.Compare.v1"], { action: "Records.View", idempotent: true });
add(26, "Records", "command", ["Records.Rollback.v1"], { action: "Records.Version", idempotent: true });
add(26, "Records", "command", ["Records.Archive.v1", "Records.Retire.v1"], { action: "Records.Archive", idempotent: true });
add(26, "Records", "command", ["Records.Restore.v1"], { action: "Records.Restore", idempotent: true });
add(26, "Records", "command", ["Records.Delete.v1"], { action: "Records.Delete", idempotent: true });
add(26, "Records", "command", ["Records.Hold.v1", "Records.ReleaseHold.v1"], { action: "Records.Hold", idempotent: true });
add(26, "Records", "command", ["Records.Share.v1"], { action: "Records.Share", idempotent: true });
add(26, "Records", "command", ["Records.Preview.v1", "Records.Link.v1", "Records.Download.v1"], { action: "Records.Download", idempotent: true });
add(26, "Records", "command", ["Records.Policy.v1"], { action: "Records.Policy", idempotent: true });
add(26, "Records", "query", [
  "Records.Search.v1", "Records.Get.v1", "Records.List.v1", "Records.Statistics.v1"
], { action: "Records.View" });
add(26, "Records", "event", [
  "RecordUploaded", "RecordSuperseded", "RecordArchived", "RecordRestored", "RecordDeleted", "RecordHeld"
]);

add(27, "BI", "command", ["Bi.Metric.Register.v1", "Bi.Metric.Validate.v1"], { action: "Bi.Metric", idempotent: true });
add(27, "BI", "command", ["Bi.Kpi.Calculate.v1", "Bi.Kpi.CalculateAll.v1"], { action: "Bi.View", idempotent: true });
add(27, "BI", "command", ["Bi.Kpi.Publish.v1"], { action: "Bi.Publish", idempotent: true });
add(27, "BI", "command", ["Bi.Schema.Register.v1", "Bi.Schema.Validate.v1"], { action: "Bi.Schema", idempotent: true });
add(27, "BI", "query", [
  "Bi.Metric.Get.v1", "Bi.Metric.List.v1", "Bi.Kpi.List.v1", "Bi.Schema.List.v1", "Bi.Statistics.v1"
], { action: "Bi.View" });
add(27, "BI", "event", ["MetricRegistered", "KpiPublished", "SchemaPublished"]);

add(28, "Integration", "command", ["Integration.Provider.Register.v1", "Integration.Provider.Status.v1"], { action: "Integration.Provider", idempotent: true });
add(28, "Integration", "command", ["Integration.Client.Register.v1", "Integration.OAuth.Register.v1"], { action: "Integration.Client", idempotent: true });
add(28, "Integration", "command", ["Integration.Key.Issue.v1"], { action: "Integration.Key", idempotent: true });
add(28, "Integration", "command", [
  "Integration.Webhook.Register.v1", "Integration.Webhook.Receive.v1", "Integration.Webhook.Deliver.v1", "Integration.Webhook.Replay.v1"
], { action: "Integration.Webhook", idempotent: true });
add(28, "Integration", "command", ["Integration.Transform.Register.v1", "Integration.Transform.Run.v1"], { action: "Integration.Transform", idempotent: true });
add(28, "Integration", "command", [
  "Integration.Dispatch.v1", "Integration.Queue.Publish.v1", "Integration.Queue.Subscribe.v1", "Integration.Queue.Consume.v1", "Integration.Queue.Ack.v1",
  "Integration.Delivery.Assign.v1", "Integration.Delivery.Advance.v1",
  "Integration.Delivery.DeadlineRequest.v1", "Integration.Delivery.DeadlineApprove.v1"
], { action: "Integration.Admin", idempotent: true });
add(28, "Integration", "query", [
  "Integration.Provider.List.v1", "Integration.Health.v1", "Integration.Dashboard.v1", "Integration.Usage.v1",
  "Integration.Delivery.Dashboard.v1", "Integration.Reports.v1"
], { action: "Integration.View" });
add(28, "Integration", "event", [
  "ProviderRegistered", "IntegrationClientRegistered", "WebhookRegistered", "IntegrationDispatched"
]);

add(29, "AI", "command", ["Ai.Predict.v1", "Ai.Fraud.Detect.v1", "Ai.Risk.Score.v1", "Ai.Recommend.v1", "Ai.Recommend.Decide.v1", "Ai.Forecast.v1", "Ai.Anomaly.Detect.v1"], { action: "Ai.Predict", idempotent: true });
add(29, "AI", "command", ["Ai.Model.Register.v1", "Ai.Model.Train.v1"], { action: "Ai.Model", idempotent: true });
add(29, "AI", "command", ["Ai.Model.Approve.v1", "Ai.Dataset.Approve.v1", "Ai.Dataset.Register.v1"], { action: "Ai.Govern", idempotent: true });
add(29, "AI", "command", ["Ai.Model.Deploy.v1", "Ai.Model.Rollback.v1"], { action: "Ai.Admin", idempotent: true });
add(29, "AI", "command", ["Ai.Drift.Detect.v1"], { action: "Ai.Model", idempotent: true });
add(29, "AI", "query", [
  "Ai.Model.List.v1", "Ai.Feature.List.v1", "Ai.Dataset.List.v1", "Ai.Prediction.List.v1",
  "Ai.Dashboard.v1", "Ai.Statistics.v1", "Ai.Health.v1", "Ai.Reports.v1", "Ai.Governance.Dashboard.v1"
], { action: "Ai.View" });
add(29, "AI", "event", [
  "PredictionGenerated", "FraudAlertCreated", "ModelDeployed", "DriftDetected"
]);

add(30, "Platform", "command", [
  "Platform.Tenant.Register.v1", "Platform.Tenant.Transition.v1", "Platform.Tenant.Config.v1"
], { action: "Platform.Tenant", idempotent: true });
add(30, "Platform", "command", ["Platform.Config.Publish.v1"], { action: "Platform.Config", idempotent: true });
add(30, "Platform", "command", ["Platform.Flag.Set.v1"], { action: "Platform.Flag", idempotent: true });
add(30, "Platform", "command", ["Platform.Flag.Kill.v1", "Platform.License.Revoke.v1", "Platform.Announcement.Publish.v1", "Platform.Environment.Update.v1", "Platform.Dr.Verify.v1"], { action: "Platform.Admin", idempotent: true });
add(30, "Platform", "command", [
  "Platform.License.Issue.v1", "Platform.License.Activate.v1", "Platform.License.Renew.v1", "Platform.License.Enforce.v1"
], { action: "Platform.License", idempotent: true });
add(30, "Platform", "command", [
  "Platform.Deploy.Plan.v1", "Platform.Deploy.Approve.v1", "Platform.Deploy.Execute.v1", "Platform.Deploy.Rollback.v1"
], { action: "Platform.Deploy", idempotent: true });
add(30, "Platform", "command", [
  "Platform.Maintenance.Schedule.v1", "Platform.Maintenance.Start.v1", "Platform.Maintenance.End.v1"
], { action: "Platform.Maintenance", idempotent: true });
add(30, "Platform", "query", [
  "Platform.Tenant.List.v1", "Platform.Tenant.Get.v1", "Platform.Tenant.Paged.v1",
  "Platform.Config.Get.v1", "Platform.Flag.Evaluate.v1", "Platform.License.List.v1",
  "Platform.Ops.Dashboard.v1", "Platform.Dr.Dashboard.v1", "Platform.Environment.List.v1",
  "Platform.Announcement.List.v1", "Platform.Health.v1", "Platform.Reports.v1"
], { action: "Platform.View" });
add(30, "Platform", "event", [
  "TenantSuspended", "FeatureFlagKilled", "MaintenanceStarted", "LicenseExpired"
]);

export const CONTRACT_CATALOG = ROWS;

export function getContract(id) {
  return CONTRACT_CATALOG.find((item) => item.id === id) || null;
}

export function contractsForModule(moduleId) {
  return CONTRACT_CATALOG.filter((item) => item.moduleId === Number(moduleId));
}

export function assertContractBoundary() {
  return {
    documentedOnly: true,
    directSql: false,
    privateMethods: false,
    internalCache: false,
    restHttp: false,
    graphqlHttp: false,
    postsCollections: false,
    versioned: true
  };
}

export function mayConsume(fromModule, targetModule, contract = {}) {
  const from = Number(fromModule);
  const to = Number(targetModule);
  if (!from || !to) return false;
  if (from === to) return true;
  if ((to === 24 || to === 25 || to === 26 || to === 27 || to === 28 || to === 29 || to === 30) && contract.ownerInternal !== true && contract.kind !== "event") return true;
  if (contract.kind === "event" && from === 13) return true;
  const rule = MODULE_CONSUME[from];
  if (rule === "all") return true;
  if (rule === "public") return contract.ownerInternal !== true && contract.kind !== "event";
  if (rule === "queries") return contract.kind === "query";
  if (rule === "events") return contract.kind === "event" || contract.id === "Audit.Record.v1";
  if (rule === "backup") return to === 21 || contract.kind === "query";
  if (Array.isArray(rule)) return rule.includes(to);
  return false;
}

export function standardError({ errorCode, errorMessage, correlationId, now, retry = false }) {
  return {
    errorCode: errorCode || "CONTRACT_ERROR",
    errorMessage: errorMessage || "Request rejected",
    correlationId: correlationId || "",
    timestamp: typeof now === "number" ? new Date(now).toISOString() : (now || new Date().toISOString()),
    retry: retry === true
  };
}

const HANDLERS = new Map();

export function registerContractHandler(contractId, fn) {
  if (typeof fn !== "function") HANDLERS.delete(contractId);
  else HANDLERS.set(contractId, fn);
}

export function contractHandler(contractId) {
  return HANDLERS.get(contractId) || null;
}

export function ensureContractState(state = {}) {
  state.domainEvents = state.domainEvents || [];
  state.contractInvocations = state.contractInvocations || [];
  state.contractVersions = state.contractVersions || [];
  ensureApiSchemaState(state);
  return state;
}

function nowIso(now) {
  if (typeof now === "number") return new Date(now).toISOString();
  if (now) {
    const parsed = Date.parse(now);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  return new Date().toISOString();
}

export function publishDomainEvent(state, { name, moduleId, payload = {}, correlationId = "", aggregateId = "", aggregateType = "" } = {}, uid, now) {
  ensureContractState(state);
  const contract = getContract(name);
  if (contract && contract.kind === "event" && Number(moduleId) !== contract.moduleId) {
    return { ok: false, error: "Events may be published only by the owning module" };
  }
  const schemaEvent = standardEvent({
    eventType: name,
    payload,
    correlationId,
    sourceModule: moduleId,
    aggregateId,
    aggregateType,
    occurredAtUtc: nowIso(now)
  });
  const event = {
    id: schemaEvent.eventId,
    name,
    moduleId: Number(moduleId),
    payload,
    correlationId: schemaEvent.correlationId,
    version: schemaEvent.eventVersion,
    createdAt: schemaEvent.occurredAtUtc,
    ...schemaEvent
  };
  state.domainEvents.push(event);
  if (state.domainEvents.length > 2000) state.domainEvents.splice(0, state.domainEvents.length - 2000);
  return { ok: true, event };
}

export function invokeContract(state, request = {}, { uid, now, user } = {}) {
  ensureContractState(state);
  const startedMs = typeof now === "number" ? now : (now ? Date.parse(now) : Date.now());
  const contract = getContract(request.contractId);
  const normalized = normalizeRequestHeader(request, { uid, now, user, contract });
  const header = normalized.header;
  const requestId = header.requestId;
  const correlationId = header.correlationId;
  request.header = header;

  const finish = ({ ok, http, status, message, data, error, envelope, warnings = [] }) => {
    const row = {
      id: requestId,
      contractId: header.contractId || request.contractId || "",
      fromModule: Number(request.fromModule || 0),
      targetModule: contract?.moduleId,
      version: header.contractVersion,
      status: ok ? "ok" : "rejected",
      http,
      durationMs: envelope?.header?.processingDurationMs ?? Math.max(0, Date.now() - startedMs),
      createdAt: nowIso(now)
    };
    state.contractInvocations.push(row);
    return {
      ok,
      http,
      requestId,
      correlationId,
      timestamp: envelope?.header?.responseTimestampUtc || nowIso(now),
      status,
      message,
      data: data ?? null,
      error: error || null,
      header: envelope?.header || null,
      envelope,
      warnings
    };
  };

  const fail = (errorCode, errorMessage, http = 400, extras = {}) => {
    const code = extras.statusCode || statusFromContractError(errorCode, http);
    const responseHeader = buildResponseHeader(header, { now, startedMs });
    const errors = extras.errors || [];
    const error = {
      ...standardError({ errorCode, errorMessage, correlationId, now: nowIso(now), retry: extras.retry === true }),
      errorCode,
      category: extras.category || (code === "VALIDATION_ERROR" ? "Validation" : "Contract"),
      message: errorMessage,
      details: errors,
      retryable: extras.retry === true,
      requestId
    };
    recordHeaderValidation(state, {
      requestId,
      correlationId,
      axis: extras.axis || "contract",
      outcome: "fail",
      errors,
      appliedRules: extras.appliedRules || [],
      substitutions: normalized.substitutions,
      createdAt: nowIso(now)
    });
    return finish({
      ok: false,
      http: extras.http || http || httpStatusFor(code, http),
      status: "rejected",
      message: errorMessage,
      data: null,
      error,
      envelope: standardErrorEnvelope({
        header: responseHeader,
        code,
        message: errorMessage,
        error,
        errors
      })
    });
  };

  const headerCheck = validateRequestHeader(header, {
    rules: state.conditionalRules,
    user,
    now,
    explicit: normalized.explicit,
    trusted: normalized.trusted,
    substitutions: normalized.substitutions,
    authenticationMethod: normalized.trusted ? "ServiceAccount" : "Session",
    processingMode: request.processingMode
  });
  recordHeaderValidation(state, {
    requestId,
    correlationId,
    axis: "requirement",
    outcome: headerCheck.ok ? "pass" : "fail",
    errors: headerCheck.requirementErrors,
    appliedRules: headerCheck.appliedRules,
    substitutions: normalized.substitutions,
    createdAt: nowIso(now)
  });
  if (headerCheck.generationErrors.length) {
    recordHeaderValidation(state, {
      requestId,
      correlationId,
      axis: "generation",
      outcome: "fail",
      errors: headerCheck.generationErrors,
      createdAt: nowIso(now)
    });
  }
  if (!headerCheck.ok) {
    return fail("VAL-001", "The request could not be processed.", 400, {
      statusCode: "VALIDATION_ERROR",
      category: "Validation",
      errors: headerCheck.errors,
      appliedRules: headerCheck.appliedRules,
      axis: "requirement"
    });
  }

  if (normalized.substitutions.length) {
    recordAuditEvent(state, {
      action: "API header substitution",
      details: normalized.substitutions.join(","),
      userId: user?.id || "",
      category: "operational",
      correlationId,
      module: "20",
      payload: maskHeaderForAudit({ requestId, substitutions: normalized.substitutions })
    }, uid);
  }

  if (!contract) return fail("UNKNOWN_CONTRACT", "Unknown or undocumented contract", 404);
  if (contract.status === "retired") return fail("RETIRED_CONTRACT", "This contract version is retired", 410);
  if (contract.kind === "event") return fail("EVENT_NOT_INVOKABLE", "Events are published, not invoked", 400);
  const fromModule = Number(request.fromModule || 0);
  if (!mayConsume(fromModule, contract.moduleId, contract)) {
    return fail("FORBIDDEN_DEPENDENCY", "This module may not consume that interface", 403);
  }
  if (contract.posting === true || contract.ownerInternal === true) {
    if (fromModule !== contract.moduleId) {
      return fail("OWNER_INTERNAL", "This command remains on the owning module and does not post through a shortcut", 403);
    }
  }
  if (contract.kind === "command" && contract.posting === true) {
    return fail("NO_POSTING_SHORTCUT", "Financial posting stays on the owning module UI or engine", 403);
  }
  if (user && contract.action && !canAction(user, contract.action) && !isSystemOwner(user)) {
    return fail("FORBIDDEN", "You are not allowed to call this contract", 403);
  }

  const handler = HANDLERS.get(contract.id);
  if (!handler) {
    return fail("NO_HANDLER", contract.kind === "query" ? "No query handler is registered" : "No command handler is registered", 501);
  }

  const payload = request.payload || request.body?.command || {};
  let result;
  try {
    result = handler(state, payload, {
      uid,
      now,
      user,
      requestId,
      correlationId,
      traceId: header.traceId,
      fromModule,
      header
    }) || { ok: true };
  } catch {
    return fail("HANDLER_FAILED", "Contract handler failed", 500);
  }
  if (result && result.ok === false) {
    const http = result.http || (result.errorCode === "PAG-001" ? 416 : 422);
    return fail(result.errorCode || "BUSINESS_REJECTED", result.error || result.message || "Business rule rejected the request", http, {
      statusCode: result.code || statusFromContractError(result.errorCode, http),
      retry: result.retryable === true,
      category: result.category
    });
  }

  if (contract.audit && contract.kind === "command") {
    recordAuditEvent(state, {
      action: `Contract ${contract.id}`,
      details: contract.id,
      userId: user?.id || header.userId || "",
      category: "operational",
      correlationId,
      module: String(contract.moduleId)
    }, uid);
  }
  if (contract.kind === "command" && result?.event) {
    publishDomainEvent(state, {
      name: result.event,
      moduleId: contract.moduleId,
      payload: result.data || {},
      correlationId
    }, uid, now);
  }

  const responseHeader = buildResponseHeader(header, { now, startedMs });
  let envelope = standardSuccessEnvelope({
    header: responseHeader,
    data: result,
    warnings: result?.warnings || []
  });
  if (result?.job || result?.accepted) {
    envelope = standardAsyncEnvelope({
      header: { ...responseHeader, jobId: result.job?.jobId || result.jobId },
      jobId: result.job?.jobId || result.jobId,
      queue: result.job?.queue,
      estimatedCompletion: result.job?.estimatedCompletion,
      status: result.job?.status || "Queued"
    });
  } else if (result?.document) {
    envelope = standardFileEnvelope({ header: responseHeader, document: result.document });
  } else if (result?.pagination) {
    envelope.pagination = result.pagination;
  } else if (request.query && Array.isArray(result?.rows)) {
    envelope.pagination = paginationFrom(request.query, result.rows, result.totalItems);
  }
  if (result?.links) envelope.links = result.links;

  return finish({
    ok: true,
    http: result?.http && result.http >= 200 && result.http < 400
      ? result.http
      : (envelope.status.code === "ACCEPTED" ? 202 : 200),
    status: "ok",
    message: envelope.status.message,
    data: result,
    error: null,
    envelope,
    warnings: envelope.warnings || []
  });
}
