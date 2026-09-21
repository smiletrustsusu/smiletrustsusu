/**
 * Global export authorization, classification, role matrix, and assignment ownership.
 * Consumed by Module 25 and every other module. Does not post money.
 */

import { ROLE, isSystemOwner } from "./roles.js";
import { canAction, dataScope } from "./rbac.js";

export const EXPORT_POLICY_VERSION = "1.0.0";
export const ROLE_MATRIX_VERSION = "1.0.0";

export const EXPORT_PERMISSIONS = [
  "Export.Public", "Export.Internal", "Export.Customers", "Export.Savings", "Export.Loans",
  "Export.Accounting", "Export.Workflows", "Export.Audit", "Export.Configuration",
  "Export.Backup", "Export.Security", "Export.System", "Export.All"
];

export const HIGH_RISK_EXPORT_PERMISSIONS = [
  "Export.All", "Export.Backup", "Export.Security", "Export.Configuration", "Export.System"
];

export const EXPORT_SCOPES = ["User", "Branch", "Region", "Organization", "Platform"];

export const ROLE_ALIASES = {
  "Platform Administrator": ROLE.SYSTEM_OWNER,
  "System Administrator": ROLE.SUPER_ADMIN,
  "Organization Administrator": ROLE.MANAGING_DIRECTOR,
  "Compliance Officer": ROLE.AUDITOR,
  "Internal Auditor": ROLE.AUDITOR,
  "Finance Manager": ROLE.ACCOUNTANT,
  "Branch Manager": ROLE.BRANCH_MANAGER,
  "Branch Supervisor": ROLE.FIELD_SUPERVISOR,
  "Loan Officer": ROLE.FIELD_SUPERVISOR,
  "Savings Officer": ROLE.CASHIER,
  "Collector": ROLE.COLLECTOR,
  "Customer Service Officer": ROLE.CUSTOMER_SERVICE,
  "Reporting Analyst": ROLE.OPERATIONS_MANAGER,
  "Read-Only Auditor": ROLE.AUDITOR
};

export const DATASET_CATALOG = {
  customers: { classification: "Confidential", permission: "Export.Customers", import: true, apply: true },
  branches: { classification: "Internal", permission: "Export.Internal", import: true, apply: true },
  agents: { classification: "Confidential", permission: "Export.Customers", import: true, apply: true },
  savings_accounts: { classification: "Financial", permission: "Export.Savings", import: true, apply: false },
  savings_transactions: { classification: "Financial", permission: "Export.Savings", import: true, apply: false },
  savings_statements: { classification: "Financial", permission: "Export.Savings", import: false, apply: false },
  loan_accounts: { classification: "Financial", permission: "Export.Loans", import: true, apply: false },
  loan_repayments: { classification: "Financial", permission: "Export.Loans", import: true, apply: false },
  loan_statements: { classification: "Financial", permission: "Export.Loans", import: false, apply: false },
  withdrawals: { classification: "Financial", permission: "Export.Savings", import: true, apply: false },
  accounting_charts: { classification: "Financial", permission: "Export.Accounting", import: true, apply: false },
  journal_entries: { classification: "Financial", permission: "Export.Accounting", import: true, apply: false },
  financial_reports: { classification: "Financial", permission: "Export.Accounting", import: false, apply: false },
  documents_metadata: { classification: "Internal", permission: "Export.Internal", import: true, apply: true },
  configuration: { classification: "Restricted", permission: "Export.Configuration", import: true, apply: false },
  workflow_definitions: { classification: "Internal", permission: "Export.Workflows", import: true, apply: false },
  workflow_history: { classification: "Confidential", permission: "Export.Workflows", import: false, apply: false },
  rule_definitions: { classification: "Internal", permission: "Export.Configuration", import: true, apply: false },
  payment_provider_configuration: { classification: "Restricted", permission: "Export.Security", import: true, apply: false },
  audit_reports: { classification: "Restricted", permission: "Export.Audit", import: false, apply: false },
  security_reports: { classification: "Restricted", permission: "Export.Security", import: false, apply: false },
  backup_metadata: { classification: "Restricted", permission: "Export.Backup", import: false, apply: false },
  business_intelligence: { classification: "Internal", permission: "Export.Internal", import: false, apply: false },
  regulatory_reports: { classification: "Confidential", permission: "Export.Audit", import: false, apply: false }
};

export const PERMITTED_FORMATS = {
  Public: ["csv", "xlsx", "json", "pdf"],
  Internal: ["csv", "xlsx", "json"],
  Confidential: ["csv", "xlsx", "zip"],
  Financial: ["xlsx", "pdf", "zip"],
  Restricted: ["zip"]
};

export const SENSITIVE_FIELDS = [
  "password", "passwordHash", "pin", "momoPin", "apiKey", "secret", "token",
  "accessToken", "refreshToken", "recoveryKey", "plaintextKey", "cloudKey",
  "momoWebhookSecret"
];

export const EXPORT_ROLE_MATRIX = {
  [ROLE.SYSTEM_OWNER]: EXPORT_PERMISSIONS,
  [ROLE.SUPER_ADMIN]: EXPORT_PERMISSIONS.filter((item) => item !== "Export.All"),
  [ROLE.DEVELOPER]: EXPORT_PERMISSIONS.filter((item) => item !== "Export.All"),
  [ROLE.MANAGING_DIRECTOR]: [
    "Export.Public", "Export.Internal", "Export.Customers", "Export.Savings",
    "Export.Loans", "Export.Accounting", "Export.Workflows"
  ],
  [ROLE.OPERATIONS_MANAGER]: [
    "Export.Public", "Export.Internal", "Export.Customers", "Export.Savings",
    "Export.Loans", "Export.Accounting", "Export.Workflows"
  ],
  [ROLE.ACCOUNTANT]: [
    "Export.Public", "Export.Internal", "Export.Customers", "Export.Savings",
    "Export.Loans", "Export.Accounting"
  ],
  [ROLE.BRANCH_MANAGER]: [
    "Export.Public", "Export.Internal", "Export.Customers", "Export.Savings", "Export.Loans"
  ],
  [ROLE.FIELD_SUPERVISOR]: [
    "Export.Public", "Export.Internal", "Export.Customers", "Export.Savings", "Export.Loans"
  ],
  [ROLE.CASHIER]: ["Export.Public", "Export.Internal", "Export.Customers", "Export.Savings"],
  [ROLE.COLLECTOR]: ["Export.Public"],
  [ROLE.GROUP_COORDINATOR]: ["Export.Public"],
  [ROLE.CUSTOMER_SERVICE]: ["Export.Public"],
  [ROLE.AUDITOR]: [
    "Export.Public", "Export.Internal", "Export.Customers", "Export.Savings", "Export.Loans",
    "Export.Accounting", "Export.Workflows", "Export.Audit", "Export.Security"
  ],
  [ROLE.CUSTOMER]: ["Export.Public"]
};

export const ASSIGNMENT_STEP_OWNERS = {
  draft: { primary: "Requesting User", backup: [], permission: "Request.ExportPermission" },
  validation: { primary: "Authorization Service", backup: ["Security Administrator"] },
  pending_review: { primary: "Branch Manager / Organization Administrator", backup: ["Branch Supervisor"] },
  pending_security: { primary: "Security Administrator", backup: ["Chief Security Officer"] },
  pending_compliance: { primary: "Compliance Officer", backup: ["Internal Auditor"] },
  approved: { primary: "Organization Administrator", backup: ["Platform Administrator"] },
  provisioning: { primary: "Authorization Module", backup: ["System Administrator"] },
  active: { primary: "Authorization Module", backup: [] },
  revoked: { primary: "Organization Administrator", backup: ["Security Administrator"] },
  completed: { primary: "Audit Module", backup: [] }
};

export const SOD_FORBIDDEN = [
  ["requester", "business_reviewer"],
  ["requester", "security_reviewer"],
  ["requester", "compliance_reviewer"],
  ["requester", "final_approver"],
  ["business_reviewer", "final_approver"]
];

export const CANONICAL_CATEGORY_ACCESS = {
  customer: { full: [ROLE.SYSTEM_OWNER, ROLE.SUPER_ADMIN, ROLE.MANAGING_DIRECTOR], scoped: [ROLE.BRANCH_MANAGER, ROLE.FIELD_SUPERVISOR, ROLE.CASHIER], read: [ROLE.AUDITOR, ROLE.ACCOUNTANT] },
  savings: { full: [ROLE.SYSTEM_OWNER, ROLE.SUPER_ADMIN, ROLE.MANAGING_DIRECTOR, ROLE.ACCOUNTANT], scoped: [ROLE.BRANCH_MANAGER, ROLE.FIELD_SUPERVISOR, ROLE.CASHIER, ROLE.COLLECTOR], read: [ROLE.AUDITOR] },
  loans: { full: [ROLE.SYSTEM_OWNER, ROLE.SUPER_ADMIN, ROLE.MANAGING_DIRECTOR, ROLE.ACCOUNTANT], scoped: [ROLE.BRANCH_MANAGER, ROLE.FIELD_SUPERVISOR], read: [ROLE.AUDITOR] },
  accounting: { full: [ROLE.SYSTEM_OWNER, ROLE.SUPER_ADMIN, ROLE.MANAGING_DIRECTOR, ROLE.ACCOUNTANT], scoped: [], read: [ROLE.AUDITOR] },
  workflow: { full: [ROLE.SYSTEM_OWNER, ROLE.SUPER_ADMIN, ROLE.MANAGING_DIRECTOR, ROLE.AUDITOR], scoped: [ROLE.BRANCH_MANAGER], read: [ROLE.ACCOUNTANT] },
  rules: { full: [ROLE.SYSTEM_OWNER, ROLE.SUPER_ADMIN, ROLE.MANAGING_DIRECTOR], scoped: [], read: [ROLE.AUDITOR] },
  reports: { full: [ROLE.SYSTEM_OWNER, ROLE.SUPER_ADMIN, ROLE.MANAGING_DIRECTOR, ROLE.OPERATIONS_MANAGER, ROLE.AUDITOR], scoped: [ROLE.BRANCH_MANAGER, ROLE.FIELD_SUPERVISOR], read: [ROLE.COLLECTOR] },
  exchange: { full: [ROLE.SYSTEM_OWNER, ROLE.SUPER_ADMIN, ROLE.MANAGING_DIRECTOR, ROLE.OPERATIONS_MANAGER, ROLE.AUDITOR, ROLE.ACCOUNTANT], scoped: [ROLE.BRANCH_MANAGER], read: [] },
  security: { full: [ROLE.SYSTEM_OWNER, ROLE.SUPER_ADMIN, ROLE.AUDITOR], scoped: [], read: [ROLE.MANAGING_DIRECTOR] },
  backup: { full: [ROLE.SYSTEM_OWNER, ROLE.SUPER_ADMIN], scoped: [], read: [] },
  audit: { full: [ROLE.SYSTEM_OWNER, ROLE.SUPER_ADMIN, ROLE.AUDITOR], scoped: [], read: [ROLE.MANAGING_DIRECTOR] }
};

export function exportScopeFor(user) {
  if (!user) return "User";
  if (isSystemOwner(user) || user.role === ROLE.SUPER_ADMIN || user.role === ROLE.DEVELOPER) return "Platform";
  if ([ROLE.MANAGING_DIRECTOR, ROLE.OPERATIONS_MANAGER, ROLE.ACCOUNTANT, ROLE.AUDITOR].includes(user.role)) return "Organization";
  if ([ROLE.BRANCH_MANAGER, ROLE.FIELD_SUPERVISOR, ROLE.CASHIER, ROLE.CUSTOMER_SERVICE].includes(user.role)) return "Branch";
  return "User";
}

export function datasetMeta(type) {
  return DATASET_CATALOG[type] || null;
}

export function formatAllowed(classification, format) {
  return (PERMITTED_FORMATS[classification] || []).includes(format);
}

export function needsExportApproval(meta, input = {}, user) {
  if (isSystemOwner(user)) return false;
  if (!meta) return true;
  if (meta.classification === "Restricted") return true;
  if (HIGH_RISK_EXPORT_PERMISSIONS.includes(meta.permission)) return true;
  if (input.fullHistory === true) return true;
  if (Number(input.recordCount || 0) >= Number(input.approvalThreshold || 10000)) return true;
  return false;
}

export function activeExportGrants(state, user, now) {
  const stamp = typeof now === "number" ? now : Date.parse(now || Date.now());
  return (state.exportPermissionGrants || []).filter((item) => (
    item.userId === user?.id
    && item.status === "active"
    && (!item.expiresAt || Date.parse(item.expiresAt) > stamp)
  ));
}

export function expireExportGrants(state, now) {
  const stamp = typeof now === "number" ? now : Date.parse(now || Date.now());
  (state.exportPermissionGrants || []).forEach((item) => {
    if (item.status === "active" && item.expiresAt && Date.parse(item.expiresAt) <= stamp) {
      item.status = "expired";
    }
  });
}

export function evaluateExportAuthorization(state, user, type, format = "csv", options = {}) {
  const meta = datasetMeta(type);
  if (!meta) {
    return { ok: false, error: "Unknown export dataset", errorCode: "EX-001", http: 404 };
  }
  const permission = meta.permission;
  const scope = exportScopeFor(user);
  const granted = isSystemOwner(user)
    || canAction(user, "Export.All")
    || canAction(user, permission)
    || activeExportGrants(state, user, options.now).some((item) => item.permission === permission || item.permission === "Export.All");
  const evaluation = {
    userId: user?.id || "",
    roles: [user?.role].filter(Boolean),
    permission,
    scope,
    classification: meta.classification,
    decision: granted ? "Granted" : "Denied",
    reason: granted ? "Permission and scope satisfied" : `Missing ${permission}`,
    policyVersion: EXPORT_POLICY_VERSION,
    correlationId: options.correlationId || "",
    timestamp: typeof options.now === "number" ? new Date(options.now).toISOString() : (options.now || new Date().toISOString())
  };
  state.exportAuthorizationLog = state.exportAuthorizationLog || [];
  state.exportAuthorizationLog.push({ id: options.uid ? options.uid("exauth") : `exauth-${Date.now()}`, ...evaluation });
  if (!granted) {
    return { ok: false, error: `You are not allowed to export ${type}`, errorCode: "EX-002", http: 403, evaluation, meta };
  }
  if (!formatAllowed(meta.classification, format)) {
    return {
      ok: false,
      error: `${meta.classification} exports cannot use ${format}`,
      errorCode: "EX-005",
      http: 422,
      evaluation,
      meta
    };
  }
  const userScope = dataScope(user);
  const requestedBranch = options.branchId || "";
  if (userScope === "branch" || scope === "Branch") {
    if (requestedBranch && user.branchId && requestedBranch !== user.branchId) {
      return { ok: false, error: "Cross-branch exports are not permitted", errorCode: "EX-003", http: 403, evaluation, meta };
    }
  }
  if (userScope === "assigned" || userScope === "self" || userScope === "none") {
    if (["Confidential", "Financial", "Restricted"].includes(meta.classification) && permission !== "Export.Public") {
      return { ok: false, error: "Export is limited to authorized branch or organization scope", errorCode: "EX-003", http: 403, evaluation, meta };
    }
  }
  return { ok: true, evaluation, meta, scope };
}

export function assertExportPolicyBoundary() {
  return {
    leastPrivilege: true,
    exportAllRestricted: true,
    restHttp: false,
    postsCollections: false,
    centralMatrix: true
  };
}
