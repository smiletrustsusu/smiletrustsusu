/**
 * Role-based access control for Smile Trust agency operations.
 * Legacy codes (KBA, Admin) remain the stored values for Super Admin and Branch Manager.
 */

export const ROLE = {
  SYSTEM_OWNER: "SystemOwner",
  SUPER_ADMIN: "KBA",
  MANAGING_DIRECTOR: "ManagingDirector",
  BRANCH_MANAGER: "Admin",
  OPERATIONS_MANAGER: "OperationsManager",
  ACCOUNTANT: "Accountant",
  CASHIER: "Cashier",
  FIELD_SUPERVISOR: "FieldSupervisor",
  COLLECTOR: "Collector",
  GROUP_COORDINATOR: "GroupCoordinator",
  CUSTOMER_SERVICE: "CustomerService",
  AUDITOR: "Auditor",
  CUSTOMER: "Customer",
  DEVELOPER: "Developer"
};

/** Stored role codes accepted by JS RBAC (align SQL CHECK via migration 045). */
export const ROLE_CODES = Object.freeze(Object.values(ROLE));

/** Legacy SQL-only aliases still accepted by DB CHECK after GAP-010. */
export const LEGACY_SQL_ROLE_ALIASES = Object.freeze(["Owner", "AssistantManager"]);

export const PERMISSIONS = [
  ["dashboard", "Dashboard"],
  ["approvals", "Approvals"],
  ["branches", "Branches"],
  ["agents", "Agents / Collectors"],
  ["customers", "Customers"],
  ["collections", "Collections"],
  ["meetings", "Group Meetings"],
  ["susuGroups", "Susu Groups"],
  ["savingsProducts", "Savings Products"],
  ["withdrawals", "Withdrawals"],
  ["loans", "Loans"],
  ["loanRepayments", "Loan Repayments"],
  ["interestPayments", "Interest Payments"],
  ["expenses", "Expenses"],
  ["accounting", "Accounting"],
  ["messages", "Messages"],
  ["notifications", "Notifications"],
  ["reports", "Reports"],
  ["logs", "Collector's Sheet"],
  ["closing", "Daily Closing"],
  ["handover", "Cash Handover"],
  ["backup", "Backup & Restore"],
  ["audit", "Audit Trail"],
  ["settings", "System Settings"],
  ["users", "Staff Accounts"],
  ["permissions", "Permissions"],
  ["imports", "Uploads"]
];

export const STAFF_ROLES = [
  ROLE.MANAGING_DIRECTOR,
  ROLE.BRANCH_MANAGER,
  ROLE.OPERATIONS_MANAGER,
  ROLE.ACCOUNTANT,
  ROLE.CASHIER,
  ROLE.FIELD_SUPERVISOR,
  ROLE.COLLECTOR,
  ROLE.GROUP_COORDINATOR,
  ROLE.CUSTOMER_SERVICE,
  ROLE.AUDITOR
];

const LABELS = {
  SystemOwner: "System Owner",
  KBA: "Super Administrator",
  ManagingDirector: "Managing Director",
  Admin: "Branch Manager",
  OperationsManager: "Operations Manager",
  Accountant: "Accountant",
  Cashier: "Cashier",
  FieldSupervisor: "Field Supervisor",
  Collector: "Agent / Collector",
  GroupCoordinator: "Group Coordinator",
  CustomerService: "Customer Service Officer",
  Auditor: "Auditor",
  Customer: "Customer",
  Developer: "Developer"
};

const ALL_KEYS = PERMISSIONS.map(([key]) => key);

function allow(...keys) {
  return Object.fromEntries(ALL_KEYS.map((key) => [key, keys.includes(key) || keys.includes("*")]));
}

function allExcept(...keys) {
  return Object.fromEntries(ALL_KEYS.map((key) => [key, !keys.includes(key)]));
}

export function roleLabel(role) {
  return LABELS[role] || role || "";
}

export function isSystemOwner(user) {
  return user?.role === ROLE.SYSTEM_OWNER || user?.systemOwner === true || user?.id === "u-owner";
}

export function isSuperAdmin(user) {
  return user?.role === ROLE.SUPER_ADMIN || user?.role === ROLE.SYSTEM_OWNER;
}

export function isBranchManager(user) {
  return user?.role === ROLE.BRANCH_MANAGER;
}

export function isCollectorRole(user) {
  return user?.role === ROLE.COLLECTOR;
}

export function isReadOnlyRole(user) {
  return user?.role === ROLE.AUDITOR;
}

export function isCustomerPortalRole(user) {
  return user?.role === ROLE.CUSTOMER;
}

export function isPrivilegedRole(user) {
  return [
    ROLE.SYSTEM_OWNER,
    ROLE.SUPER_ADMIN,
    ROLE.MANAGING_DIRECTOR,
    ROLE.BRANCH_MANAGER,
    ROLE.OPERATIONS_MANAGER
  ].includes(user?.role);
}

export function isFinanceRole(user) {
  return [ROLE.SYSTEM_OWNER, ROLE.SUPER_ADMIN, ROLE.MANAGING_DIRECTOR, ROLE.ACCOUNTANT, ROLE.CASHIER].includes(user?.role);
}

export function isHqRole(user) {
  return [ROLE.SYSTEM_OWNER, ROLE.SUPER_ADMIN, ROLE.MANAGING_DIRECTOR, ROLE.OPERATIONS_MANAGER, ROLE.ACCOUNTANT, ROLE.AUDITOR, ROLE.DEVELOPER].includes(user?.role);
}

export function defaultPermissionsForRole(role) {
  switch (role) {
    case ROLE.SYSTEM_OWNER:
    case ROLE.SUPER_ADMIN:
    case ROLE.DEVELOPER:
      return allow("*");
    case ROLE.MANAGING_DIRECTOR:
      return allExcept("permissions");
    case ROLE.BRANCH_MANAGER:
      return allExcept("settings", "permissions", "users");
    case ROLE.OPERATIONS_MANAGER:
      return allExcept("settings", "permissions", "accounting");
    case ROLE.ACCOUNTANT:
      return allow(
        "dashboard", "approvals", "customers", "collections", "withdrawals", "loans",
        "loanRepayments", "interestPayments", "expenses", "accounting", "reports",
        "logs", "closing", "handover", "audit", "backup"
      );
    case ROLE.CASHIER:
      return allow(
        "dashboard", "collections", "withdrawals", "loanRepayments", "interestPayments",
        "expenses", "handover", "closing", "reports", "customers"
      );
    case ROLE.FIELD_SUPERVISOR:
      return allow(
        "dashboard", "agents", "customers", "collections", "meetings", "susuGroups",
        "withdrawals", "loans", "loanRepayments", "messages", "reports", "logs",
        "handover", "closing"
      );
    case ROLE.COLLECTOR:
      return allow(
        "dashboard", "agents", "customers", "collections", "meetings", "susuGroups", "withdrawals",
        "loans", "loanRepayments", "interestPayments", "messages", "reports", "logs",
        "closing", "handover", "backup"
      );
    case ROLE.GROUP_COORDINATOR:
      return allow(
        "dashboard", "customers", "meetings", "susuGroups", "collections", "loans",
        "loanRepayments", "messages", "reports"
      );
    case ROLE.CUSTOMER_SERVICE:
      return allow(
        "dashboard", "customers", "withdrawals", "loans", "messages", "notifications",
        "reports"
      );
    case ROLE.AUDITOR:
      return allow(
        "dashboard", "customers", "collections", "susuGroups", "withdrawals", "loans",
        "loanRepayments", "interestPayments", "expenses", "accounting", "reports",
        "handover", "audit", "logs"
      );
    case ROLE.CUSTOMER:
      return allow("dashboard", "withdrawals", "loans", "reports", "notifications");
    default:
      return allow("dashboard");
  }
}

export function resolvePermissions(user) {
  const defaults = defaultPermissionsForRole(user?.role);
  const custom = user?.screenPermissions || {};
  return { ...defaults, ...custom };
}

export function can(user, permission) {
  if (!user) return false;
  if (user.role === ROLE.SYSTEM_OWNER || user.role === ROLE.SUPER_ADMIN || user.role === ROLE.DEVELOPER) return true;
  return resolvePermissions(user)[permission] !== false;
}

export function canAccessView(user, view) {
  if (!user) return false;
  if (view === "memberDetail") return can(user, "customers");
  if (view === "groupDetail") return can(user, "branches") || can(user, "groups") || isSuperAdmin(user);
  if (view === "groups" || view === "branchDetail") return can(user, "branches") || can(user, "groups") || isHqRole(user) || isBranchManager(user);
  if (view === "agents" || view === "agentDetail") return can(user, "agents") || can(user, "users");
  return can(user, view);
}

export function navItemsForRole(role) {
  const user = { role, screenPermissions: defaultPermissionsForRole(role) };
  const labels = {
    dashboard: "Dashboard",
    approvals: "Approvals",
    groups: "Branches",
    agents: "Agents / My Desk",
    savingsProducts: "Savings Products",
    susuGroups: "Susu Groups",
    meetings: "Group Meetings",
    customers: "Customers",
    collections: "Collections",
    withdrawals: "Withdrawals",
    loans: "Loans",
    loanRepayments: "Loan Repayments",
    interestPayments: "Interest Payments",
    expenses: "Expenses",
    accounting: "Accounting",
    messages: "Messages",
    notifications: "Notifications",
    reports: "Reports",
    logs: "Collector's Sheet",
    closing: "Daily Closing",
    handover: "Cash Handover",
    backup: "Backup & Restore",
    audit: "Audit Trail",
    settings: "Settings",
    users: "Staff & Collectors",
    permissions: "Permissions",
    imports: "Uploads"
  };
  const order = Object.keys(labels);
  return order
    .filter((key) => {
      if (key === "groups") return canAccessView(user, "groups");
      return canAccessView(user, key);
    })
    .map((key) => [key, labels[key]]);
}

export function canApproveFinancial(user) {
  return [
    ROLE.SYSTEM_OWNER,
    ROLE.SUPER_ADMIN,
    ROLE.MANAGING_DIRECTOR,
    ROLE.BRANCH_MANAGER,
    ROLE.OPERATIONS_MANAGER,
    ROLE.ACCOUNTANT
  ].includes(user?.role);
}

export function canDisburseFunds(user) {
  return [ROLE.SYSTEM_OWNER, ROLE.SUPER_ADMIN, ROLE.MANAGING_DIRECTOR, ROLE.BRANCH_MANAGER, ROLE.CASHIER, ROLE.ACCOUNTANT].includes(user?.role);
}

export function canManageStaff(user) {
  return [ROLE.SYSTEM_OWNER, ROLE.SUPER_ADMIN, ROLE.MANAGING_DIRECTOR].includes(user?.role);
}

export function canManageSettings(user) {
  return user?.role === ROLE.SYSTEM_OWNER || user?.role === ROLE.SUPER_ADMIN;
}

export function staffRoleOptions() {
  return STAFF_ROLES.map((role) => ({ value: role, label: roleLabel(role) }));
}

export function normalizeLegacyRole(role) {
  if (role === "Owner" || role === "System Owner") return ROLE.SYSTEM_OWNER;
  if (role === "AssistantManager" || role === "Input Officer" || role === "Money Keeper" || role === "Money Counter") {
    return ROLE.BRANCH_MANAGER;
  }
  return role;
}

export function branchScopedRoles() {
  return [
    ROLE.BRANCH_MANAGER,
    ROLE.CASHIER,
    ROLE.FIELD_SUPERVISOR,
    ROLE.COLLECTOR,
    ROLE.GROUP_COORDINATOR,
    ROLE.CUSTOMER_SERVICE
  ];
}

export function userBranchId(user) {
  return user?.branchId || user?.groupId || "";
}
