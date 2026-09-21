/**
 * Registers read and existing-engine handlers for published module contracts.
 * Does not add a second collection or ledger posting path.
 */

import { registerContractHandler } from "./module-contracts.js";
import { getConfigValue } from "./system-config.js";
import { canAction } from "./rbac.js";
import { paymentDashboard } from "./payment-ops.js";
import { jobDashboard, enqueueJob } from "./job-ops.js";
import { monitoringDashboard } from "./monitoring-ops.js";
import { gatewayDashboard, registerApiClient, rotateApiKey } from "./api-gateway-ops.js";
import { backupDashboard, createBackupSet, runRecoveryTest } from "./backup-recovery-ops.js";
import { syncDashboard } from "./sync-ops.js";
import { searchAudit } from "./audit-ops.js";

function sumCollections(state, customerId) {
  return (state.collections || [])
    .filter((item) => !item.reversed && (!customerId || item.customerId === customerId))
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
}

registerContractHandler("Dashboard.GetSummary.v1", (state) => ({
  ok: true,
  customers: (state.customers || []).length,
  collections: (state.collections || []).length,
  loans: (state.loans || []).length
}));
registerContractHandler("Dashboard.GetKPIs.v1", (state) => ({ ok: true, ...monitoringDashboard(state) }));
registerContractHandler("Dashboard.GetNotifications.v1", (state) => ({ ok: true, rows: (state.notifications || []).slice(-20) }));
registerContractHandler("Dashboard.GetWidgets.v1", () => ({ ok: true, widgets: ["collections", "health", "alerts"] }));

registerContractHandler("Customer.Get.v1", (state, payload) => {
  const customer = (state.customers || []).find((item) => item.id === payload.customerId || item.id === payload.id);
  return customer ? { ok: true, customer: { id: customer.id, name: customer.name, active: customer.active } } : { ok: false, error: "Customer not found" };
});
registerContractHandler("Customer.List.v1", (state) => ({
  ok: true,
  rows: (state.customers || []).slice(0, 50).map((item) => ({ id: item.id, name: item.name, active: item.active }))
}));
registerContractHandler("Customer.Search.v1", (state, payload) => {
  const q = String(payload.q || "").toLowerCase();
  return {
    ok: true,
    rows: (state.customers || []).filter((item) => String(item.name || "").toLowerCase().includes(q)).slice(0, 20)
  };
});
registerContractHandler("Customer.History.v1", (state, payload) => ({
  ok: true,
  rows: (state.collections || []).filter((item) => item.customerId === payload.customerId).slice(-20)
}));

registerContractHandler("Savings.Balance.v1", (state, payload) => ({ ok: true, balance: sumCollections(state, payload.customerId) }));
registerContractHandler("Savings.Statement.v1", (state, payload) => ({
  ok: true,
  rows: (state.collections || []).filter((item) => item.customerId === payload.customerId)
}));
registerContractHandler("Savings.TransactionHistory.v1", (state, payload) => ({
  ok: true,
  rows: (state.collections || []).filter((item) => item.customerId === payload.customerId)
}));

registerContractHandler("Loan.Get.v1", (state, payload) => {
  const loan = (state.loans || []).find((item) => item.id === payload.loanId || item.id === payload.id);
  return loan ? { ok: true, loan } : { ok: false, error: "Loan not found" };
});
registerContractHandler("Group.Get.v1", (state, payload) => {
  const group = (state.groups || state.susuGroups || []).find((item) => item.id === payload.groupId || item.id === payload.id);
  return group ? { ok: true, group } : { ok: false, error: "Group not found" };
});
registerContractHandler("Branch.List.v1", (state) => ({ ok: true, rows: state.branches || [] }));
registerContractHandler("Agent.List.v1", (state) => ({ ok: true, rows: (state.users || []).filter((item) => /collector|agent/i.test(item.role || "")) }));

registerContractHandler("Payment.Status.v1", (state) => ({ ok: true, ...paymentDashboard(state) }));
registerContractHandler("Payment.ProviderHealth.v1", (state) => ({ ok: true, ...paymentDashboard(state) }));
registerContractHandler("Health.Status.v1", (state) => ({ ok: true, ...monitoringDashboard(state) }));
registerContractHandler("Metrics.Get.v1", (state) => ({ ok: true, rows: (state.monitoringMetrics || []).slice(-50) }));
registerContractHandler("Alert.List.v1", (state) => ({ ok: true, rows: state.monitoringAlerts || [] }));
registerContractHandler("Job.Status.v1", (state) => ({ ok: true, ...jobDashboard(state) }));
registerContractHandler("Queue.Status.v1", (state) => ({ ok: true, ...jobDashboard(state) }));
registerContractHandler("API.Usage.v1", (state) => ({ ok: true, ...gatewayDashboard(state) }));
registerContractHandler("API.ClientStatus.v1", (state) => ({ ok: true, clients: state.apiClients || [] }));
registerContractHandler("Backup.Status.v1", (state) => ({ ok: true, ...backupDashboard(state) }));
registerContractHandler("Recovery.Status.v1", (state) => ({ ok: true, ...backupDashboard(state) }));
registerContractHandler("Sync.Status.v1", (state) => ({ ok: true, ...syncDashboard(state) }));
registerContractHandler("Sync.Pending.v1", (state) => ({ ok: true, pending: (state.offlineQueue || []).length }));
registerContractHandler("Audit.Search.v1", (state, payload) => ({ ok: true, rows: searchAudit(state, payload || {}) }));
registerContractHandler("FeatureFlags.List.v1", (state) => ({ ok: true, rows: state.featureFlags || [] }));
registerContractHandler("Configuration.Get.v1", (state, payload) => ({ ok: true, value: getConfigValue(state, payload.key) }));
registerContractHandler("Notification.History.v1", (state) => ({ ok: true, rows: (state.notifications || []).slice(-20) }));
registerContractHandler("Ledger.Balance.v1", (state) => ({ ok: true, entries: (state.ledgerEntries || []).length }));
registerContractHandler("Report.Get.v1", () => ({ ok: true, catalogs: true }));
registerContractHandler("Analytics.Dashboard.v1", (state) => ({ ok: true, ...monitoringDashboard(state) }));
registerContractHandler("User.GetPermissions.v1", (_state, _payload, ctx) => ({
  ok: true,
  canCollect: canAction(ctx.user, "Savings.Collect")
}));
registerContractHandler("Session.Validate.v1", (_state, _payload, ctx) => ({ ok: true, valid: Boolean(ctx.user) }));
registerContractHandler("Withdrawal.History.v1", (state, payload) => ({
  ok: true,
  rows: (state.withdrawalRequests || []).filter((item) => !payload.customerId || item.customerId === payload.customerId)
}));
registerContractHandler("Document.Search.v1", (state) => ({ ok: true, rows: (state.documents || []).slice(-20) }));
registerContractHandler("Receipt.Get.v1", (state, payload) => {
  const row = (state.documents || []).find((item) => item.id === payload.documentId || item.receiptNo === payload.receiptNo);
  return row ? { ok: true, document: row } : { ok: false, error: "Receipt not found" };
});

registerContractHandler("API.RegisterClient.v1", (state, payload, ctx) => registerApiClient(state, payload, ctx.user, ctx.uid, ctx.now));
registerContractHandler("API.RevokeKey.v1", (state, payload, ctx) => rotateApiKey(state, payload.clientId, ctx));
registerContractHandler("Backup.Start.v1", (state, payload, ctx) => createBackupSet(state, payload, ctx.user, ctx.uid, ctx.now));
registerContractHandler("Recovery.Test.v1", (state, payload, ctx) => runRecoveryTest(state, payload, ctx.user, ctx.uid, ctx.now));
registerContractHandler("Job.Enqueue.v1", (state, payload, ctx) => enqueueJob(state, payload, ctx.user, ctx.uid, ctx.now));

export const CONTRACT_HANDLERS_READY = true;
