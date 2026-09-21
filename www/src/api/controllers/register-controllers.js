/**
 * Wave 3 domain controllers — thin adapters registering v1/* operations.
 */

import { registerOperation } from "../route-registry.js";

function bind(services, path) {
  return async (state, payload, ctx) => {
    const parts = path.split(".");
    let fn = services;
    for (const part of parts) fn = fn?.[part];
    if (typeof fn !== "function") {
      return { ok: false, errorCode: "API-501", error: `Service path missing: ${path}`, http: 501 };
    }
    const result = await fn.call(services, payload, ctx);
    if (result && result.ok === false) return result;
    return result && typeof result === "object" ? result : { ok: true, data: result };
  };
}

export function registerAllControllers(services) {
  const regs = [];

  const add = (id, opts, path) => {
    regs.push(registerOperation({ id, ...opts }, bind(services, path)));
  };

  // Auth
  add("v1/auth.login", {
    kind: "command", permission: "", public: true, authRequired: false,
    summary: "Authenticate user", schema: { required: ["username", "password"] }
  }, "auth.login");
  add("v1/auth.logout", { kind: "command", permission: "", summary: "Logout session" }, "auth.logout");
  add("v1/auth.refresh", { kind: "command", permission: "", summary: "Refresh cloud session" }, "auth.refresh");
  add("v1/auth.requestPasswordReset", {
    kind: "command", permission: "", public: true, authRequired: false,
    schema: { required: ["username"] }, summary: "Request password reset"
  }, "auth.requestPasswordReset");
  add("v1/auth.completePasswordReset", {
    kind: "command", permission: "", public: true, authRequired: false,
    schema: { required: ["token", "newPassword"] }, summary: "Complete password reset"
  }, "auth.completePasswordReset");
  add("v1/auth.session", { kind: "query", permission: "", summary: "Session status" }, "auth.session");
  add("v1/auth.roles", { kind: "query", permission: "", summary: "List auth roles" }, "auth.roles");
  add("v1/auth.registerDevice", {
    kind: "command", permission: "",
    schema: { required: ["fingerprint"] }, summary: "Register device"
  }, "auth.registerDevice");

  // Staff users (owner/developer isolation applied in service)
  add("v1/users.list", {
    kind: "query", permission: "User.Edit", summary: "List staff users visible to actor"
  }, "users.list");
  add("v1/users.get", {
    kind: "query", permission: "User.Edit", schema: { required: ["id"] }, summary: "Get staff user visible to actor"
  }, "users.get");

  // Authorization (handlers registered below with actor binding)
  // Customers
  add("v1/customers.register", {
    kind: "command", permission: "Customer.Edit", branchScoped: true,
    schema: { required: ["name"] }, summary: "Register customer", contractAlias: "Customer.Create.v1"
  }, "customers.register");
  add("v1/customers.update", {
    kind: "command", permission: "Customer.Edit", branchScoped: true,
    schema: { required: ["id"] }, summary: "Update customer"
  }, "customers.update");
  add("v1/customers.get", {
    kind: "query", permission: "Customer.View", schema: { required: ["id"] }, summary: "Get customer"
  }, "customers.get");
  add("v1/customers.list", { kind: "query", permission: "Customer.View", branchScoped: true, summary: "List customers" }, "customers.list");
  add("v1/customers.search", { kind: "query", permission: "Customer.View", summary: "Search customers" }, "customers.search");

  // Savings
  add("v1/savings.balance", {
    kind: "query", permission: "Customer.View", schema: { required: ["customerId"] }, summary: "Savings balance"
  }, "savings.balance");
  add("v1/savings.statement", {
    kind: "query", permission: "Customer.View", schema: { required: ["customerId"] }, summary: "Savings statement"
  }, "savings.statement");
  add("v1/savings.collect", {
    kind: "command", permission: "Savings.Collect", posting: true, branchScoped: true,
    schema: { required: ["customerId"] }, summary: "Collect savings (JS SoT + optional Wave 2 RPC)"
  }, "savings.collect");

  // Daily collections
  add("v1/collections.record", {
    kind: "command", permission: "Savings.Collect", posting: true, branchScoped: true,
    schema: { required: ["customerId"] }, summary: "Record daily collection"
  }, "collections.record");
  add("v1/collections.list", { kind: "query", permission: "Customer.View", branchScoped: true, summary: "List collections" }, "collections.list");
  add("v1/collections.get", {
    kind: "query", permission: "Customer.View", schema: { required: ["id"] }, summary: "Get collection"
  }, "collections.get");
  add("v1/collections.daily", { kind: "query", permission: "Customer.View", summary: "Daily collections summary" }, "collections.daily");

  // Loans
  add("v1/loans.apply", {
    kind: "command", permission: "Loan.Approve", posting: true,
    schema: { required: ["customerId", "principal"] }, summary: "Apply for loan"
  }, "loans.apply");
  add("v1/loans.get", {
    kind: "query", permission: "Customer.View", schema: { required: ["id"] }, summary: "Get loan"
  }, "loans.get");
  add("v1/loans.list", { kind: "query", permission: "Customer.View", summary: "List loans" }, "loans.list");
  add("v1/loans.repay", {
    kind: "command", permission: "Loan.Approve", posting: true,
    schema: { required: ["loanId"] }, summary: "Record loan repayment"
  }, "loans.repay");
  add("v1/loans.portfolio", { kind: "query", permission: "Customer.View", cacheTtlMs: 10000, summary: "Loan portfolio KPIs" }, "loans.portfolio");

  // Accounting
  add("v1/accounting.trialBalance", { kind: "query", permission: "Accounting.View", summary: "Trial balance" }, "accounting.trialBalance");
  add("v1/accounting.cashFlow", { kind: "query", permission: "Accounting.View", summary: "Cash flow summary" }, "accounting.cashFlow");
  add("v1/accounting.closePeriod", {
    kind: "command", permission: "Accounting.Edit", posting: true, summary: "Close accounting period"
  }, "accounting.closePeriod");
  add("v1/accounting.readiness", { kind: "query", permission: "Accounting.View", summary: "Ghana accounting readiness" }, "accounting.readiness");
  add("v1/accounting.cashbook", { kind: "query", permission: "Accounting.View", summary: "Cashbook (local or Wave 2 RPC)" }, "accounting.cashbook");

  // Reporting
  add("v1/reporting.run", {
    kind: "command", permission: "Reports.View", schema: { required: ["reportId"] }, summary: "Run report"
  }, "reporting.run");
  add("v1/reporting.dashboard", { kind: "query", permission: "Reports.View", cacheTtlMs: 10000, summary: "Reporting dashboard" }, "reporting.dashboard");
  add("v1/reporting.analytics", { kind: "query", permission: "Reports.View", summary: "Analytics series" }, "reporting.analytics");

  // Dashboards
  add("v1/dashboards.summary", { kind: "query", permission: "Reports.View", cacheTtlMs: 10000, summary: "Ops dashboard summary" }, "dashboards.summary");
  add("v1/dashboards.kpis", { kind: "query", permission: "Reports.View", cacheTtlMs: 10000, summary: "Dashboard KPIs" }, "dashboards.kpis");

  // Sync
  add("v1/sync.upload", {
    kind: "command", permission: "Sync.Retry",
    schema: { required: ["idempotencyKey"] }, summary: "Upload offline queue item"
  }, "sync.upload");
  add("v1/sync.status", { kind: "query", permission: "Sync.View", summary: "Sync status" }, "sync.status");
  add("v1/sync.progress", { kind: "query", permission: "Sync.View", summary: "Sync progress" }, "sync.progress");
  add("v1/sync.ack", {
    kind: "command", permission: "Sync.Retry", schema: { required: ["itemId"] }, summary: "Ack sync item"
  }, "sync.ack");

  // Audit
  add("v1/audit.record", { kind: "command", permission: "Audit.View", summary: "Record audit event" }, "audit.record");
  add("v1/audit.search", { kind: "query", permission: "Audit.View", summary: "Search audit trail" }, "audit.search");

  // Notifications
  add("v1/notifications.send", {
    kind: "command", permission: "Notification.Send", schema: { required: ["body"] }, summary: "Send notification"
  }, "notifications.send");
  add("v1/notifications.schedule", { kind: "command", permission: "Notification.Send", summary: "Schedule notification" }, "notifications.schedule");
  add("v1/notifications.cancel", { kind: "command", permission: "Notification.Send", summary: "Cancel notification" }, "notifications.cancel");
  add("v1/notifications.history", { kind: "query", permission: "Notification.View", summary: "Notification history" }, "notifications.history");

  // Configuration
  add("v1/configuration.get", { kind: "query", permission: "System.View", summary: "Get configuration" }, "configuration.get");
  add("v1/configuration.flags", { kind: "query", permission: "System.View", summary: "List feature flags" }, "configuration.flags");
  add("v1/configuration.moneyDefaults", {
    kind: "query", permission: "Reports.View", summary: "Money defaults (15/31/1000/pesewas)"
  }, "configuration.moneyDefaults");

  // Monitoring
  add("v1/monitoring.health", {
    kind: "health", permission: "Monitor.View", summary: "Health snapshot (Module 19)"
  }, "monitoring.health");
  add("v1/monitoring.metrics", { kind: "query", permission: "Monitor.View", summary: "Monitoring metrics" }, "monitoring.metrics");
  add("v1/monitoring.recordMetric", { kind: "command", permission: "Monitor.Alert", summary: "Record metric" }, "monitoring.recordMetric");

  // Special wrappers that need user injected into service call
  registerOperation({
    id: "v1/auth.changePassword",
    kind: "command",
    permission: "",
    schema: { required: ["currentPassword", "newPassword"] },
    summary: "Change password"
  }, async (_state, payload, ctx) => services.auth.changePassword(ctx.user, payload));

  registerOperation({
    id: "v1/authorization.can",
    kind: "query",
    permission: "",
    schema: { required: ["action"] },
    summary: "Check permission"
  }, async (_state, payload, ctx) => ({
    ok: true,
    allowed: services.authorization.can(ctx.user, payload.action)
  }));

  registerOperation({
    id: "v1/authorization.scope",
    kind: "query",
    permission: "",
    summary: "Data scope for actor"
  }, async (_state, _payload, ctx) => ({
    ok: true,
    scope: services.authorization.scope(ctx.user)
  }));

  registerOperation({
    id: "v1/authorization.forbidden",
    kind: "query",
    permission: "",
    summary: "SUPER_ADMIN_FORBIDDEN list"
  }, async () => ({ ok: true, forbidden: services.authorization.forbidden() }));

  registerOperation({
    id: "v1/authorization.checkTenantBranch",
    kind: "query",
    permission: "",
    branchScoped: true,
    summary: "Tenant/branch guard"
  }, async (_state, payload, ctx) => services.authorization.checkTenantBranch(ctx.user, payload));

  return regs;
}
