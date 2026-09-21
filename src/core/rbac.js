/**
 * Action-level RBAC and approval limits.
 * Screen access remains in roles.js; this layer gates individual actions.
 */
import { ROLE, isSystemOwner, isReadOnlyRole } from "./roles.js";

export const ACTIONS = [
  "Customer.Create", "Customer.View", "Customer.Edit", "Customer.Delete", "Customer.Export", "Customer.Assign",
  "Agent.Create", "Agent.Edit", "Agent.Delete", "Agent.Assign",
  "Branch.Create", "Branch.Edit", "Branch.Delete",
  "Savings.Collect", "Savings.Adjust", "Savings.Reverse",
  "Loan.Create", "Loan.Approve", "Loan.Reject", "Loan.Disburse",
  "Withdrawal.Create", "Withdrawal.Approve", "Withdrawal.Pay", "Withdrawal.Reject",
  "Group.Create", "Group.Edit", "Group.Delete", "Group.View", "Group.Meeting",
  "Reports.View", "Reports.Export", "Reports.Print", "Reports.Schedule", "Reports.Custom", "Reports.Executive", "Reports.Accounting", "Reports.Audit",
  "Notification.View", "Notification.Send", "Notification.Broadcast", "Notification.Schedule", "Notification.Template", "Notification.Provider",
  "Accounting.View", "Accounting.Edit", "Accounting.ClosePeriod",
  "Settings.View", "Settings.Edit",
  "System.View", "System.Configure", "System.Security", "System.Products", "System.FeatureFlags", "System.Backup", "System.Restore", "System.ConfigurationApprove",
  "User.Create", "User.Edit", "User.Delete",
  "Role.Manage", "Permission.Manage",
  "Audit.View", "Audit.Export", "Audit.Integrity", "Audit.Archive",
  "Backup.Create", "Backup.Restore",
  "Sync.View", "Sync.Retry", "Sync.Resolve", "Device.Revoke",
  "Identifier.View", "Identifier.Delegate", "Identifier.Approve",
  "Payment.View", "Payment.Reconcile", "Payment.Refund", "Payment.Reverse", "Payment.Provider",
  "Document.View", "Document.Generate", "Document.Deliver", "Document.Reprint", "Document.Reissue", "Document.Cancel", "Document.Refund", "Document.Reverse", "Document.Supersede", "Document.Archive", "Document.Template", "Document.Approve",
  "Job.View", "Job.Run", "Job.Cancel", "Job.Retry", "Job.Replay", "Job.Schedule", "Job.Worker", "Job.Approve",
  "Monitor.View", "Monitor.Alert", "Monitor.Incident", "Monitor.Diagnose", "Monitor.Export", "Monitor.Device", "Monitor.Approve",
  "Gateway.View", "Gateway.Client", "Gateway.Key", "Gateway.Webhook", "Gateway.Docs", "Gateway.Approve",
  "Backup.Verify", "Backup.Test", "Backup.Approve", "Backup.Retention", "DR.View", "DR.Manage",
  "Security.View", "Security.Evaluate", "Security.Incident", "Security.Investigate", "Security.Approve", "Contract.View",
  "Workflow.View", "Workflow.Start", "Workflow.Design", "Workflow.Approve", "Workflow.Task", "Workflow.Case", "Workflow.Escalate", "Workflow.Admin",
  "Rule.View", "Rule.Design", "Rule.Test", "Rule.Simulate", "Rule.Approve", "Rule.Publish", "Rule.Admin",
  "Exchange.View", "Exchange.Import", "Exchange.Export", "Exchange.Migrate", "Exchange.Bulk", "Exchange.Approve", "Exchange.Map",
  "Request.ExportPermission",
  "Export.Public", "Export.Internal", "Export.Customers", "Export.Savings", "Export.Loans",
  "Export.Accounting", "Export.Workflows", "Export.Audit", "Export.Configuration",
  "Export.Backup", "Export.Security", "Export.System", "Export.All",
  "Records.View", "Records.Upload", "Records.Download", "Records.Version", "Records.Archive",
  "Records.Restore", "Records.Delete", "Records.Hold", "Records.Policy", "Records.Share", "Records.Admin",
  "Bi.View", "Bi.Metric", "Bi.Kpi", "Bi.Publish", "Bi.Schema", "Bi.Admin",
  "Integration.View", "Integration.Provider", "Integration.Webhook", "Integration.Client",
  "Integration.Key", "Integration.Transform", "Integration.Admin",
  "Ai.View", "Ai.Model", "Ai.Predict", "Ai.Govern", "Ai.Admin",
  "Platform.View", "Platform.Tenant", "Platform.Config", "Platform.License",
  "Platform.Flag", "Platform.Deploy", "Platform.Maintenance", "Platform.Admin",
  "System.Reset", "Owner.Transfer"
];

/** Actions KBA / Super Admin must never receive (System Owner only). */
export const SUPER_ADMIN_FORBIDDEN = Object.freeze(["Owner.Transfer", "System.Reset", "Export.All"]);

export function isForbiddenForSuperAdmin(user, action) {
  if (!user || !action) return false;
  if (user.role !== ROLE.SUPER_ADMIN) return false;
  return SUPER_ADMIN_FORBIDDEN.includes(action);
}

export const DEFAULT_APPROVAL_LIMITS = {
  [ROLE.CASHIER]: 1000,
  [ROLE.BRANCH_MANAGER]: 20000,
  [ROLE.OPERATIONS_MANAGER]: 100000,
  [ROLE.ACCOUNTANT]: 20000,
  [ROLE.MANAGING_DIRECTOR]: Number.POSITIVE_INFINITY,
  [ROLE.SUPER_ADMIN]: Number.POSITIVE_INFINITY,
  [ROLE.SYSTEM_OWNER]: Number.POSITIVE_INFINITY
};

function allActions() {
  return [...ACTIONS];
}

function except(...blocked) {
  return allActions().filter((action) => !blocked.includes(action));
}

export function defaultActionsForRole(role) {
  switch (role) {
    case ROLE.SYSTEM_OWNER:
      return allActions();
    case ROLE.SUPER_ADMIN:
    case ROLE.DEVELOPER:
      return except(...SUPER_ADMIN_FORBIDDEN);
    case ROLE.MANAGING_DIRECTOR:
      return except("Settings.Edit", "Permission.Manage", "User.Delete", "System.Reset", "Owner.Transfer", "Role.Manage", "Audit.Archive", "System.Security", "System.ConfigurationApprove", "Identifier.Approve", "Payment.Provider", "Document.Archive", "Document.Template", "Export.All", "Export.Backup", "Export.Configuration", "Export.System", "Export.Security", "Export.Audit", "Exchange.Migrate");
    case ROLE.OPERATIONS_MANAGER:
      return [
        "Customer.View", "Customer.Assign", "Customer.Export",
        "Agent.Assign", "Agent.Edit",
        "Branch.Create", "Branch.Edit",
        "Savings.Collect", "Savings.Adjust",
        "Loan.Create",
        "Group.Create", "Group.Edit", "Group.View", "Group.Meeting",
        "Reports.View", "Reports.Export", "Reports.Print", "Reports.Schedule", "Reports.Custom", "Reports.Executive",
        "Notification.View", "Notification.Send", "Notification.Broadcast", "Notification.Schedule",
        "Audit.View", "Audit.Export",
        "Sync.View",
        "Payment.View",
        "Document.View", "Document.Generate", "Document.Deliver", "Document.Reprint",
        "Job.View", "Job.Run", "Job.Schedule", "Job.Retry",
        "Monitor.View", "Monitor.Alert", "Monitor.Incident", "Monitor.Diagnose", "Monitor.Device",
        "Gateway.View", "Gateway.Webhook", "Gateway.Docs",
        "Backup.Create", "Backup.Verify", "Backup.Test", "DR.View",
        "Security.View", "Security.Evaluate", "Security.Incident", "Contract.View",
        "Workflow.View", "Workflow.Start", "Workflow.Task", "Workflow.Case", "Workflow.Escalate",
        "Rule.View", "Rule.Test", "Rule.Simulate",
        "Exchange.View", "Exchange.Import", "Exchange.Export", "Exchange.Bulk", "Exchange.Map", "Request.ExportPermission",
        "Export.Public", "Export.Internal", "Export.Customers", "Export.Savings", "Export.Loans", "Export.Accounting", "Export.Workflows",
        "Records.View", "Records.Upload", "Records.Download", "Records.Version", "Records.Archive", "Records.Restore", "Records.Share",
        "Bi.View", "Bi.Kpi",
        "Integration.View", "Integration.Provider", "Integration.Webhook", "Integration.Client", "Integration.Transform",
        "Ai.View", "Ai.Predict", "Ai.Model",
        "Platform.View", "Platform.Tenant", "Platform.Flag", "Platform.License", "Platform.Deploy", "Platform.Maintenance"
      ];
    case ROLE.BRANCH_MANAGER:
      return [
        "Customer.Create", "Customer.View", "Customer.Edit", "Customer.Assign", "Customer.Export",
        "Agent.Assign", "Agent.Edit",
        "Branch.Edit",
        "Savings.Collect", "Savings.Adjust", "Savings.Reverse",
        "Loan.Create", "Loan.Approve", "Loan.Reject", "Loan.Disburse",
        "Withdrawal.Create", "Withdrawal.Approve", "Withdrawal.Pay", "Withdrawal.Reject",
        "Group.Create", "Group.Edit", "Group.View", "Group.Meeting",
        "Reports.View", "Reports.Export", "Reports.Print",
        "Notification.View", "Notification.Send",
        "Accounting.View",
        "Audit.View", "Audit.Export",
        "Sync.View", "Sync.Retry", "Sync.Resolve",
        "Payment.View", "Payment.Reconcile", "Payment.Refund", "Payment.Reverse",
        "Document.View", "Document.Generate", "Document.Deliver", "Document.Reprint", "Document.Cancel", "Document.Reissue", "Document.Refund", "Document.Reverse", "Document.Supersede", "Document.Approve",
        "Job.View", "Job.Run", "Job.Retry", "Job.Cancel",
        "Monitor.View", "Monitor.Alert", "Monitor.Device",
        "Backup.Create", "Backup.Verify",
        "Security.View", "Security.Evaluate",
        "Workflow.View", "Workflow.Start", "Workflow.Approve", "Workflow.Task", "Workflow.Case",
        "Rule.View", "Rule.Test",
        "Exchange.View", "Exchange.Import", "Exchange.Export", "Exchange.Bulk", "Exchange.Map",
        "Export.Public", "Export.Internal", "Export.Customers", "Export.Savings", "Export.Loans",
        "Records.View", "Records.Upload", "Records.Download", "Records.Version", "Records.Archive", "Records.Restore", "Records.Share",
        "Bi.View", "Bi.Kpi",
        "Integration.View", "Integration.Webhook",
        "Ai.View", "Ai.Predict",
        "Platform.View"
      ];
    case ROLE.ACCOUNTANT:
      return [
        "Customer.View",
        "Savings.Adjust", "Savings.Reverse",
        "Withdrawal.Create", "Withdrawal.Pay",
        "Group.View",
        "Reports.View", "Reports.Export", "Reports.Print", "Reports.Accounting",
        "Notification.View",
        "Accounting.View", "Accounting.Edit", "Accounting.ClosePeriod",
        "Audit.View", "Audit.Export",
        "Sync.View",
        "Payment.View", "Payment.Reconcile", "Payment.Refund", "Payment.Reverse",
        "Document.View", "Document.Generate", "Document.Deliver", "Document.Reprint", "Document.Refund", "Document.Reverse", "Document.Supersede", "Document.Approve",
        "Job.View",
        "Monitor.View",
        "Backup.Create", "Backup.Verify",
        "Security.View",
        "Workflow.View", "Workflow.Approve", "Workflow.Task",
        "Rule.View",
        "Exchange.View", "Exchange.Export",
        "Export.Public", "Export.Internal", "Export.Customers", "Export.Savings", "Export.Loans", "Export.Accounting",
        "Records.View", "Records.Download",
        "Bi.View",
        "Integration.View",
        "Ai.View",
        "Platform.View"
      ];
    case ROLE.CASHIER:
      return [
        "Customer.View",
        "Savings.Collect",
        "Withdrawal.Pay",
        "Group.View", "Group.Meeting",
        "Reports.View",
        "Sync.View", "Sync.Retry",
        "Payment.View",
        "Document.View", "Document.Generate", "Document.Deliver", "Document.Reprint", "Document.Cancel",
        "Workflow.View", "Workflow.Task",
        "Exchange.View",
        "Export.Public", "Export.Internal", "Export.Customers", "Export.Savings",
        "Records.View", "Records.Upload", "Records.Download"
      ];
    case ROLE.FIELD_SUPERVISOR:
      return [
        "Customer.Create", "Customer.View", "Customer.Edit", "Customer.Assign",
        "Agent.Assign",
        "Savings.Collect",
        "Loan.Create",
        "Group.Create", "Group.Edit", "Group.View", "Group.Meeting",
        "Reports.View",
        "Sync.View", "Sync.Retry",
        "Payment.View",
        "Document.View", "Document.Generate", "Document.Deliver", "Document.Reprint", "Document.Cancel",
        "Workflow.View", "Workflow.Task",
        "Exchange.View",
        "Export.Public", "Export.Internal", "Export.Customers", "Export.Savings", "Export.Loans",
        "Records.View", "Records.Upload", "Records.Download"
      ];
    case ROLE.COLLECTOR:
      return [
        "Customer.Create", "Customer.View", "Customer.Edit",
        "Savings.Collect",
        "Loan.Create",
        "Group.View", "Group.Meeting",
        "Reports.View",
        "Sync.View", "Sync.Retry",
        "Payment.View",
        "Document.View", "Document.Generate", "Document.Deliver", "Document.Reprint", "Document.Cancel",
        "Exchange.View",
        "Export.Public",
        "Records.View", "Records.Upload", "Records.Download"
      ];
    case ROLE.GROUP_COORDINATOR:
      return [
        "Customer.View",
        "Savings.Collect",
        "Group.Create", "Group.Edit", "Group.View", "Group.Meeting",
        "Reports.View", "Reports.Export", "Reports.Print",
        "Sync.View", "Sync.Retry",
        "Payment.View",
        "Document.View", "Document.Generate", "Document.Deliver", "Document.Reprint", "Document.Cancel",
        "Exchange.View",
        "Export.Public"
      ];
    case ROLE.CUSTOMER_SERVICE:
      return [
        "Customer.Create", "Customer.View", "Customer.Edit",
        "Group.View",
        "Reports.View",
        "Notification.View", "Notification.Send",
        "Document.View", "Document.Deliver", "Document.Reprint",
        "Exchange.View",
        "Export.Public",
        "Records.View", "Records.Upload", "Records.Download"
      ];
    case ROLE.AUDITOR:
      return [
        "Customer.View", "Customer.Export",
        "Group.View",
        "Reports.View", "Reports.Export", "Reports.Print", "Reports.Audit", "Reports.Accounting",
        "Notification.View",
        "Accounting.View",
        "Audit.View", "Audit.Export",
        "System.View",
        "Sync.View",
        "Identifier.View",
        "Payment.View",
        "Document.View", "Document.Reprint",
        "Job.View",
        "Monitor.View",
        "Gateway.View", "Gateway.Docs",
        "Backup.Verify", "DR.View",
        "Security.View", "Contract.View",
        "Workflow.View",
        "Rule.View",
        "Exchange.View", "Exchange.Export",
        "Export.Public", "Export.Internal", "Export.Customers", "Export.Savings", "Export.Loans",
        "Export.Accounting", "Export.Workflows", "Export.Audit", "Export.Security",
        "Records.View", "Records.Download",
        "Bi.View",
        "Integration.View",
        "Ai.View", "Ai.Govern",
        "Platform.View"
      ];
    case ROLE.CUSTOMER:
      return ["Customer.View", "Reports.View"];
    default:
      return ["Customer.View"];
  }
}

export function canAction(user, action) {
  if (!user) return false;
  if (isSystemOwner(user)) return true;
  if (isReadOnlyRole(user) && !["Customer.View", "Customer.Export", "Group.View", "Reports.View", "Reports.Export", "Reports.Print", "Reports.Audit", "Reports.Accounting", "Notification.View", "Accounting.View", "Audit.View", "Audit.Export", "System.View", "Sync.View", "Identifier.View", "Payment.View", "Document.View", "Document.Reprint", "Job.View", "Monitor.View", "Gateway.View", "Gateway.Docs", "Backup.Verify", "DR.View", "Security.View", "Contract.View", "Workflow.View", "Rule.View", "Exchange.View", "Exchange.Export", "Export.Public", "Export.Internal", "Export.Customers", "Export.Savings", "Export.Loans", "Export.Accounting", "Export.Workflows", "Export.Audit", "Export.Security", "Records.View", "Records.Download", "Bi.View", "Integration.View", "Ai.View", "Platform.View"].includes(action)) {
    return false;
  }
  if (user.role === ROLE.SUPER_ADMIN && SUPER_ADMIN_FORBIDDEN.includes(action)) return false;
  const custom = user.actionPermissions || {};
  if (custom[action] === false) return false;
  if (custom[action] === true) return true;
  return defaultActionsForRole(user.role).includes(action);
}

export function approvalLimitGhs(user, overrides = {}) {
  if (!user) return 0;
  if (isSystemOwner(user)) return Number.POSITIVE_INFINITY;
  const custom = Number(user.approvalLimitGhs);
  if (Number.isFinite(custom) && custom >= 0) return custom;
  const mapped = overrides[user.role] ?? DEFAULT_APPROVAL_LIMITS[user.role];
  return mapped === undefined ? 0 : mapped;
}

export function canApproveAmount(user, amount, overrides = {}) {
  const limit = approvalLimitGhs(user, overrides);
  return Number(amount || 0) <= limit;
}

export function setActionPermission(user, action, allowed) {
  if (!ACTIONS.includes(action)) return { error: "Unknown action" };
  user.actionPermissions = user.actionPermissions || {};
  user.actionPermissions[action] = Boolean(allowed);
  user.updatedAt = new Date().toISOString();
  return { user };
}

export function dataScope(user) {
  if (!user) return "none";
  if (isSystemOwner(user) || user.role === ROLE.SUPER_ADMIN || user.role === ROLE.MANAGING_DIRECTOR || user.role === ROLE.OPERATIONS_MANAGER || user.role === ROLE.ACCOUNTANT || user.role === ROLE.AUDITOR) {
    return "system";
  }
  if (user.role === ROLE.BRANCH_MANAGER || user.role === ROLE.CASHIER || user.role === ROLE.FIELD_SUPERVISOR || user.role === ROLE.CUSTOMER_SERVICE) {
    return "branch";
  }
  if (user.role === ROLE.COLLECTOR || user.role === ROLE.GROUP_COORDINATOR) return "assigned";
  if (user.role === ROLE.CUSTOMER) return "self";
  return "none";
}
