/**
 * Reports, analytics, and KPI engine.
 * Financial figures come from the Accounting GL. Operational reports query business modules.
 * Does not write balances or duplicate posting logic.
 */
import { toPesewas, fromPesewas } from "./money.js";
import { canAction, dataScope } from "./rbac.js";
import { trialBalance, incomeStatement, balanceSheet, cashbook, bankReconciliation } from "./accounting-reports.js";
import { cashFlowSummary } from "./accounting-ops.js";
import { cashPositionPesewas } from "./double-entry.js";
import { outstandingLoanBalance, loanPortfolioSummary } from "./loans-workflow.js";
import { collectionAnalytics, missedCollectionRows } from "./collection-ops.js";
import { isPostedCollection, isPostedTransaction, availableBalance } from "./domain-terms.js";
import { staffAgents, agentPerformance } from "./agents.js";
import { branchPerformance } from "./branches.js";
import { paymentReports } from "./payment-ops.js";
import { documentReports } from "./document-ops.js";
import { jobReports, registerJobHandler } from "./job-ops.js";
import { monitoringReports } from "./monitoring-ops.js";
import { gatewayReports } from "./api-gateway-ops.js";
import { backupReports } from "./backup-recovery-ops.js";
import { securityReports } from "./security-ops.js";
import { workflowReports } from "./workflow-ops.js";
import { ruleReports } from "./rule-ops.js";
import { exchangeReports } from "./exchange-ops.js";
import { recordsReports } from "./records-ops.js";
import { biReports } from "./bi-ops.js";
import { integrationReports } from "./integration-ops.js";
import { aiReports } from "./ai-ops.js";
import { platformReports } from "./platform-ops.js";

export const REPORT_VERSION = "3.2.0-m11";
export const PAGE_SIZE = 50;

export const DEFAULT_KPI_WEIGHTS = {
  agentCollection: 40,
  agentRecovery: 30,
  agentAttendance: 20,
  agentSatisfaction: 10,
  branchCollections: 30,
  branchRecovery: 25,
  branchGrowth: 20,
  branchExpense: 15,
  branchCompliance: 10,
  parDays: 30
};

export const REPORT_CATALOG = [
  { id: "bi_dashboard", name: "Report Dashboard", category: "Executive", kind: "hybrid", action: "Reports.View" },
  { id: "customer_register", name: "Customer Register", category: "Customer", kind: "operational", action: "Reports.View" },
  { id: "customer_new", name: "New Customers", category: "Customer", kind: "operational", action: "Reports.View" },
  { id: "customer_active", name: "Active Customers", category: "Customer", kind: "operational", action: "Reports.View" },
  { id: "customer_dormant", name: "Dormant Customers", category: "Customer", kind: "operational", action: "Reports.View" },
  { id: "customer_kyc", name: "Customer KYC Status", category: "Customer", kind: "operational", action: "Reports.View" },
  { id: "customer_growth", name: "Customer Growth", category: "Customer", kind: "operational", action: "Reports.View" },
  { id: "collections_daily", name: "Daily Collections", category: "Savings", kind: "operational", action: "Reports.View" },
  { id: "collections_by_product", name: "Collections by Product", category: "Savings", kind: "operational", action: "Reports.View" },
  { id: "collections_by_branch", name: "Collections by Branch", category: "Savings", kind: "operational", action: "Reports.View" },
  { id: "collections_by_agent", name: "Collections by Agent", category: "Savings", kind: "operational", action: "Reports.View" },
  { id: "collections_missed", name: "Missed Collections", category: "Savings", kind: "operational", action: "Reports.View" },
  { id: "group_register", name: "Group Register", category: "Group", kind: "operational", action: "Reports.View" },
  { id: "group_contributions", name: "Group Contributions", category: "Group", kind: "operational", action: "Reports.View" },
  { id: "loan_register", name: "Loan Register", category: "Loan", kind: "operational", action: "Reports.View" },
  { id: "loan_outstanding", name: "Outstanding Loans", category: "Loan", kind: "operational", action: "Reports.View" },
  { id: "loan_overdue", name: "Overdue Loans", category: "Loan", kind: "operational", action: "Reports.View" },
  { id: "loan_par", name: "Portfolio at Risk", category: "Loan", kind: "hybrid", action: "Reports.View" },
  { id: "loan_repayment", name: "Loan Repayment Report", category: "Loan", kind: "operational", action: "Reports.View" },
  { id: "withdrawal_register", name: "Withdrawal Register", category: "Withdrawal", kind: "operational", action: "Reports.View" },
  { id: "withdrawal_pending", name: "Pending Withdrawals", category: "Withdrawal", kind: "operational", action: "Reports.View" },
  { id: "trial_balance", name: "Trial Balance", category: "Accounting", kind: "financial", action: "Reports.Accounting" },
  { id: "income_statement", name: "Income Statement", category: "Accounting", kind: "financial", action: "Reports.Accounting" },
  { id: "balance_sheet", name: "Balance Sheet", category: "Accounting", kind: "financial", action: "Reports.Accounting" },
  { id: "cash_flow", name: "Cash Flow Statement", category: "Accounting", kind: "financial", action: "Reports.Accounting" },
  { id: "cash_book", name: "Cash Book", category: "Accounting", kind: "financial", action: "Reports.Accounting" },
  { id: "journal_register", name: "Journal Register", category: "Accounting", kind: "financial", action: "Reports.Accounting" },
  { id: "bank_reconciliation", name: "Bank Reconciliation", category: "Accounting", kind: "financial", action: "Reports.Accounting" },
  { id: "agent_performance", name: "Agent Collection Performance", category: "Agent", kind: "operational", action: "Reports.View" },
  { id: "branch_performance", name: "Branch Performance", category: "Branch", kind: "hybrid", action: "Reports.View" },
  { id: "executive_summary", name: "Executive Summary", category: "Executive", kind: "hybrid", action: "Reports.Executive" },
  { id: "revenue_analysis", name: "Revenue Analysis", category: "Executive", kind: "financial", action: "Reports.Executive" },
  { id: "expense_analysis", name: "Expense Analysis", category: "Executive", kind: "financial", action: "Reports.Executive" },
  { id: "payments_daily", name: "Daily Collections (Payment Engine)", category: "Payments", kind: "operational", action: "Reports.View" },
  { id: "payments_momo", name: "Mobile Money Collections", category: "Payments", kind: "operational", action: "Reports.View" },
  { id: "payments_bank", name: "Bank Transfer Report", category: "Payments", kind: "operational", action: "Reports.View" },
  { id: "payments_settlement", name: "Settlement Report", category: "Payments", kind: "operational", action: "Reports.Accounting" },
  { id: "payments_reconciliation", name: "Reconciliation Report", category: "Payments", kind: "operational", action: "Reports.Accounting" },
  { id: "payments_failed", name: "Failed Payments", category: "Payments", kind: "operational", action: "Reports.View" },
  { id: "payments_refunds", name: "Refund Report", category: "Payments", kind: "operational", action: "Reports.Accounting" },
  { id: "payments_reversals", name: "Reversal Report", category: "Payments", kind: "operational", action: "Reports.Accounting" },
  { id: "payments_provider", name: "Provider Performance", category: "Payments", kind: "operational", action: "Reports.View" },
  { id: "payments_methods", name: "Payment Method Analysis", category: "Payments", kind: "operational", action: "Reports.View" },
  { id: "payments_outstanding_settlements", name: "Outstanding Settlements", category: "Payments", kind: "operational", action: "Reports.Accounting" },
  { id: "documents_issued", name: "Issued Documents", category: "Documents", kind: "operational", action: "Reports.View" },
  { id: "documents_offline_pending", name: "Pending Offline Receipts", category: "Documents", kind: "operational", action: "Reports.View" },
  { id: "documents_reconciled", name: "Reconciled Receipts", category: "Documents", kind: "operational", action: "Reports.View" },
  { id: "documents_rejected", name: "Rejected Receipts", category: "Documents", kind: "operational", action: "Reports.View" },
  { id: "documents_duplicates", name: "Duplicate Synchronization Attempts", category: "Documents", kind: "operational", action: "Reports.Audit" },
  { id: "documents_mapping", name: "Receipt Mapping History", category: "Documents", kind: "operational", action: "Reports.View" },
  { id: "documents_approvals", name: "Receipt Approvals", category: "Documents", kind: "operational", action: "Reports.Audit" },
  { id: "documents_delivery", name: "Document Delivery History", category: "Documents", kind: "operational", action: "Reports.View" },
  { id: "jobs_queued", name: "Queued Jobs", category: "Scheduler", kind: "operational", action: "Reports.View" },
  { id: "jobs_failed", name: "Failed Jobs", category: "Scheduler", kind: "operational", action: "Reports.View" },
  { id: "jobs_dlq", name: "Dead Letter Queue", category: "Scheduler", kind: "operational", action: "Reports.Audit" },
  { id: "jobs_workers", name: "Worker Nodes", category: "Scheduler", kind: "operational", action: "Reports.View" },
  { id: "jobs_history", name: "Job Execution History", category: "Scheduler", kind: "operational", action: "Reports.View" },
  { id: "jobs_approvals", name: "Job Approvals", category: "Scheduler", kind: "operational", action: "Reports.Audit" },
  { id: "monitor_health", name: "System Health", category: "Monitoring", kind: "operational", action: "Reports.View" },
  { id: "monitor_alerts", name: "Alert History", category: "Monitoring", kind: "operational", action: "Reports.View" },
  { id: "monitor_incidents", name: "Incident Report", category: "Monitoring", kind: "operational", action: "Reports.Audit" },
  { id: "monitor_capacity", name: "Capacity Report", category: "Monitoring", kind: "operational", action: "Reports.View" },
  { id: "monitor_devices", name: "Android Device Health", category: "Monitoring", kind: "operational", action: "Reports.View" },
  { id: "monitor_traces", name: "Distributed Traces", category: "Monitoring", kind: "operational", action: "Reports.Audit" },
  { id: "monitor_security", name: "Device Security Events", category: "Monitoring", kind: "operational", action: "Reports.Audit" },
  { id: "monitor_sync", name: "Device Synchronization Metrics", category: "Monitoring", kind: "operational", action: "Reports.View" },
  { id: "gateway_requests", name: "API Gateway Requests", category: "Gateway", kind: "operational", action: "Reports.View" },
  { id: "gateway_usage", name: "API Usage by Client", category: "Gateway", kind: "operational", action: "Reports.View" },
  { id: "gateway_webhooks", name: "Webhook Deliveries", category: "Gateway", kind: "operational", action: "Reports.Audit" },
  { id: "backup_jobs", name: "Backup Jobs", category: "Recovery", kind: "operational", action: "Reports.View" },
  { id: "restore_history", name: "Restore History", category: "Recovery", kind: "operational", action: "Reports.Audit" },
  { id: "recovery_tests", name: "Recovery Tests", category: "Recovery", kind: "operational", action: "Reports.Audit" },
  { id: "rto_rpo", name: "RTO / RPO Compliance", category: "Recovery", kind: "operational", action: "Reports.Audit" },
  { id: "security_incidents", name: "Security Incidents", category: "Security", kind: "operational", action: "Reports.Audit" },
  { id: "fraud_cases", name: "Fraud Cases", category: "Security", kind: "operational", action: "Reports.Audit" },
  { id: "risk_scores", name: "Risk Scores", category: "Security", kind: "operational", action: "Reports.View" },
  { id: "contract_invocations", name: "Module Contract Invocations", category: "Security", kind: "operational", action: "Reports.Audit" },
  { id: "workflow_active", name: "Active Workflows", category: "Workflow", kind: "operational", action: "Reports.View" },
  { id: "workflow_completed", name: "Completed Workflows", category: "Workflow", kind: "operational", action: "Reports.View" },
  { id: "workflow_duration", name: "Workflow Duration", category: "Workflow", kind: "operational", action: "Reports.View" },
  { id: "workflow_sla", name: "SLA Compliance", category: "Workflow", kind: "operational", action: "Reports.Audit" },
  { id: "workflow_approvals", name: "Approval Performance", category: "Workflow", kind: "operational", action: "Reports.View" },
  { id: "workflow_cases", name: "Case Backlog", category: "Workflow", kind: "operational", action: "Reports.Audit" },
  { id: "workflow_escalations", name: "Escalation Statistics", category: "Workflow", kind: "operational", action: "Reports.Audit" },
  { id: "workflow_productivity", name: "Task Productivity", category: "Workflow", kind: "operational", action: "Reports.View" },
  { id: "rules_frequency", name: "Rule Execution Frequency", category: "Rules", kind: "operational", action: "Reports.View" },
  { id: "rules_latency", name: "Rule Execution Time", category: "Rules", kind: "operational", action: "Reports.View" },
  { id: "rules_failures", name: "Rule Failures", category: "Rules", kind: "operational", action: "Reports.Audit" },
  { id: "rules_coverage", name: "Rule Coverage", category: "Rules", kind: "operational", action: "Reports.Audit" },
  { id: "rules_decisions", name: "Decision Statistics", category: "Rules", kind: "operational", action: "Reports.View" },
  { id: "rules_scores", name: "Scoring Distributions", category: "Rules", kind: "operational", action: "Reports.View" },
  { id: "rules_simulations", name: "Simulation Results", category: "Rules", kind: "operational", action: "Reports.View" },
  { id: "rules_versions", name: "Rule Version History", category: "Rules", kind: "operational", action: "Reports.Audit" },
  { id: "exchange_imports", name: "Import Summary", category: "Exchange", kind: "operational", action: "Reports.View" },
  { id: "exchange_exports", name: "Export History", category: "Exchange", kind: "operational", action: "Reports.Audit" },
  { id: "exchange_migrations", name: "Migration Reports", category: "Exchange", kind: "operational", action: "Reports.Audit" },
  { id: "exchange_validation", name: "Validation Error Reports", category: "Exchange", kind: "operational", action: "Reports.View" },
  { id: "exchange_reconciliation", name: "Reconciliation Reports", category: "Exchange", kind: "operational", action: "Reports.Audit" },
  { id: "exchange_bulk", name: "Bulk Processing Statistics", category: "Exchange", kind: "operational", action: "Reports.View" },
  { id: "exchange_history", name: "Exchange Performance", category: "Exchange", kind: "operational", action: "Reports.View" },
  { id: "records_library", name: "Document Library", category: "Records", kind: "operational", action: "Reports.View" },
  { id: "records_access", name: "Document Access History", category: "Records", kind: "operational", action: "Reports.Audit" },
  { id: "records_retention", name: "Retention Policies", category: "Records", kind: "operational", action: "Reports.Audit" },
  { id: "records_holds", name: "Legal Holds", category: "Records", kind: "operational", action: "Reports.Audit" },
  { id: "records_archives", name: "Document Archives", category: "Records", kind: "operational", action: "Reports.View" },
  { id: "bi_metrics", name: "Metric Registry", category: "BI", kind: "operational", action: "Reports.View" },
  { id: "bi_kpis", name: "KPI Registry", category: "BI", kind: "operational", action: "Reports.Executive" },
  { id: "bi_schemas", name: "Schema Registry", category: "BI", kind: "operational", action: "Reports.Audit" },
  { id: "bi_calculations", name: "KPI Calculation Log", category: "BI", kind: "operational", action: "Reports.View" },
  { id: "bi_metric_history", name: "Metric Definition History", category: "BI", kind: "operational", action: "Reports.Audit" },
  { id: "integration_providers", name: "Integration Providers", category: "Integration", kind: "operational", action: "Reports.View" },
  { id: "integration_webhooks", name: "Integration Webhooks", category: "Integration", kind: "operational", action: "Reports.Audit" },
  { id: "integration_clients", name: "Integration API Clients", category: "Integration", kind: "operational", action: "Reports.Audit" },
  { id: "integration_usage", name: "Integration Usage", category: "Integration", kind: "operational", action: "Reports.View" },
  { id: "integration_queues", name: "Integration Queues", category: "Integration", kind: "operational", action: "Reports.View" },
  { id: "integration_delivery", name: "Integration Delivery Schedule", category: "Integration", kind: "operational", action: "Reports.Executive" },
  { id: "integration_ownership", name: "Integration Ownership Matrix", category: "Integration", kind: "operational", action: "Reports.Audit" },
  { id: "ai_models", name: "AI Model Registry", category: "AI", kind: "operational", action: "Reports.View" },
  { id: "ai_features", name: "AI Feature Registry", category: "AI", kind: "operational", action: "Reports.View" },
  { id: "ai_datasets", name: "AI Dataset Registry", category: "AI", kind: "operational", action: "Reports.Audit" },
  { id: "ai_predictions", name: "AI Predictions", category: "AI", kind: "operational", action: "Reports.View" },
  { id: "ai_fraud", name: "AI Fraud Alerts", category: "AI", kind: "operational", action: "Reports.Audit" },
  { id: "ai_forecasts", name: "AI Forecasts", category: "AI", kind: "operational", action: "Reports.View" },
  { id: "ai_recommendations", name: "AI Recommendations", category: "AI", kind: "operational", action: "Reports.View" },
  { id: "ai_drift", name: "AI Drift Events", category: "AI", kind: "operational", action: "Reports.Audit" },
  { id: "ai_governance", name: "AI Governance", category: "AI", kind: "operational", action: "Reports.Audit" },
  { id: "ai_audit", name: "AI Audit Viewer", category: "AI", kind: "operational", action: "Reports.Audit" }
];

export function kpiWeights(settings = {}) {
  return { ...DEFAULT_KPI_WEIGHTS, ...(settings.reportKpiWeights || {}) };
}

export function canRunReport(user, report) {
  if (!user || !report) return false;
  if (!canAction(user, "Reports.View")) return false;
  if (report.kind === "financial") {
    return canAction(user, "Reports.Accounting") || canAction(user, "Accounting.View");
  }
  if (report.action && report.action !== "Reports.View") return canAction(user, report.action);
  return true;
}

export function scopedState(state, user) {
  const scope = dataScope(user);
  if (scope === "system") return state;
  if (scope === "none" || !user) {
    return {
      ...state,
      customers: [],
      collections: [],
      loans: [],
      transactions: [],
      withdrawalRequests: [],
      ledgerEntries: [],
      expenses: [],
      susuGroups: []
    };
  }
  const branchIds = [user?.branchId, user?.groupId].filter(Boolean);
  const inBranch = (groupId, branchId) => {
    if (!branchIds.length) return scope !== "branch";
    return branchIds.includes(groupId) || branchIds.includes(branchId);
  };
  let customers = state.customers || [];
  if (scope === "self") {
    customers = customers.filter((item) => item.id === user.customerId);
  } else if (scope === "assigned") {
    customers = customers.filter((item) => item.collectorId === user.id);
  } else if (scope === "branch") {
    customers = customers.filter((item) => inBranch(item.groupId, item.branchId));
  }
  const customerIds = new Set(customers.map((item) => item.id));
  const collections = (state.collections || []).filter((item) => customerIds.has(item.customerId) || (scope === "branch" && inBranch(item.groupId, item.branchId)));
  const loans = (state.loans || []).filter((item) => customerIds.has(item.customerId) || (scope === "branch" && inBranch(item.groupId, item.branchId)));
  const transactions = (state.transactions || []).filter((item) => !item.customerId || customerIds.has(item.customerId));
  const withdrawalRequests = (state.withdrawalRequests || []).filter((item) => !item.customerId || customerIds.has(item.customerId));
  const refs = new Set([
    ...collections.map((item) => item.id),
    ...transactions.map((item) => item.id),
    ...loans.map((item) => item.id)
  ]);
  const ledgerEntries = (state.ledgerEntries || []).filter((item) => {
    const cid = String(item.customerId || "").replace(/^customer:/, "");
    if (cid) return customerIds.has(cid);
    if (item.referenceId && refs.has(item.referenceId)) return true;
    if (scope === "branch" && item.groupId && branchIds.includes(item.groupId)) return true;
    return false;
  });
  return {
    ...state,
    customers,
    collections,
    loans,
    transactions,
    withdrawalRequests,
    ledgerEntries,
    expenses: (state.expenses || []).filter((item) => !item.groupId || inBranch(item.groupId, item.branchId)),
    susuGroups: (state.susuGroups || []).filter((item) => inBranch(item.branchId, item.groupId) || (item.collectorId && item.collectorId === user.id)),
    journalEntries: state.journalEntries || [],
    groupMeetings: state.groupMeetings || []
  };
}

export function paginate(rows = [], { page = 1, pageSize = PAGE_SIZE } = {}) {
  const size = Math.max(1, Number(pageSize || PAGE_SIZE));
  const current = Math.max(1, Number(page || 1));
  const start = (current - 1) * size;
  return {
    rows: rows.slice(start, start + size),
    page: current,
    pageSize: size,
    total: rows.length,
    pages: Math.max(1, Math.ceil(rows.length / size))
  };
}

export function inRange(date, from, to) {
  const day = String(date || "").slice(0, 10);
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

function groupIdsFromFilters(filters = {}, user) {
  if (filters.branchId) return [filters.branchId];
  if (dataScope(user) === "system") return [];
  return [user?.branchId, user?.groupId].filter(Boolean);
}

function glCodeAmount(tb, code) {
  const row = (tb.rows || []).find((item) => item.code === code);
  if (!row) return 0;
  return fromPesewas((row.creditPesewas || 0) - (row.debitPesewas || 0));
}

export function financialFigures(state, range = {}, groupIds = []) {
  const opts = { from: range.from || "", to: range.to || "", groupIds };
  const tb = trialBalance(state, opts);
  const pnl = incomeStatement(state, opts);
  const bs = balanceSheet(state, opts);
  const flow = cashFlowSummary(state, opts);
  const cash = fromPesewas(cashPositionPesewas(state, { groupIds }));
  return {
    trialBalance: tb,
    income: pnl,
    balanceSheet: bs,
    cashFlow: flow,
    outstandingSavingsLiability: glCodeAmount(tb, "1100"),
    interestIncome: (pnl.income || []).filter((row) => row.code === "4000").reduce((sum, row) => sum + Number(row.amount || 0), 0),
    penaltyIncome: (pnl.income || []).filter((row) => row.code === "4030").reduce((sum, row) => sum + Number(row.amount || 0), 0),
    revenue: pnl.incomeTotal,
    expenses: pnl.expenseTotal,
    grossProfit: +(pnl.incomeTotal - pnl.expenseTotal).toFixed(2),
    netPosition: +(bs.assetTotal - bs.liabilityTotal).toFixed(2),
    cashPosition: cash,
    balancedTb: tb.balanced,
    balancedBs: bs.balanced
  };
}

export function validateFinancialReport(figures, report) {
  if (report.id === "trial_balance" && !figures.balancedTb) {
    return { error: "Trial balance is not balanced. Report generation rejected." };
  }
  if (report.id === "balance_sheet" && !figures.balancedBs) {
    return { error: "Balance sheet does not satisfy Assets = Liabilities + Equity." };
  }
  return { ok: true };
}

export function operationalCollections(state, range = {}) {
  return (state.collections || []).filter((item) => isPostedCollection(item) && inRange(item.date, range.from, range.to));
}

export function postedWithdrawals(state, range = {}) {
  return (state.transactions || []).filter((item) =>
    item.type === "Withdrawal" && isPostedTransaction(item) && inRange(item.date, range.from, range.to)
  );
}

export function totalCollections(state, range = {}) {
  return +operationalCollections(state, range).reduce((sum, item) => sum + toPesewas(item.amount), 0);
}

export function totalSavingsOperational(state, range = {}) {
  const collected = totalCollections(state, range);
  const reversed = (state.collections || [])
    .filter((item) => item.reversed && inRange(item.date, range.from, range.to))
    .reduce((sum, item) => sum + toPesewas(item.amount), 0);
  const withdrawn = postedWithdrawals(state, range).reduce((sum, item) => sum + toPesewas(item.amount), 0);
  return fromPesewas(collected - reversed - withdrawn);
}

export function customerGrowth(state, range = {}) {
  const customers = state.customers || [];
  const opened = customers.filter((item) => inRange(item.createdAt || item.date, range.from, range.to)).length;
  const closed = customers.filter((item) =>
    (item.memberStatus === "Closed" || item.active === false) && inRange(item.updatedAt || item.closedAt || "", range.from, range.to)
  ).length;
  return { opened, closed, net: opened - closed };
}

export function collectionSuccessRate(state, range = {}) {
  const stats = collectionAnalytics(operationalCollections(state, range), {
    customers: state.customers || [],
    users: state.users || [],
    products: state.savingsProducts || [],
    groups: state.groups || [],
    from: range.from,
    to: range.to
  });
  return stats.successRate;
}

export function loanRecoveryRate(loans = []) {
  const due = loans.reduce((sum, loan) => sum + Number(loan.totalDue || 0), 0);
  const recovered = loans.reduce((sum, loan) => sum + Number(loan.amountPaid || 0), 0);
  if (!due) return 0;
  return Math.round((recovered / due) * 100);
}

export function portfolioAtRisk(loans = [], { asOf = "", days = 30 } = {}) {
  const day = asOf || new Date().toISOString().slice(0, 10);
  const outstanding = loans.reduce((sum, loan) => sum + outstandingLoanBalance(loan), 0);
  const pastDue = loans.filter((loan) => {
    if (!["Active", "Restructured", "Defaulted", "Disbursed"].includes(loan.status)) return false;
    if (loan.status === "Defaulted") return true;
    const due = String(loan.dueDate || loan.nextDueDate || "").slice(0, 10);
    if (!due) return false;
    const limit = new Date(`${due}T12:00:00`);
    limit.setDate(limit.getDate() + Number(days || 0));
    return day > limit.toISOString().slice(0, 10);
  }).reduce((sum, loan) => sum + outstandingLoanBalance(loan), 0);
  return {
    pastDue: +pastDue.toFixed(2),
    outstanding: +outstanding.toFixed(2),
    rate: outstanding ? +((pastDue / outstanding) * 100).toFixed(2) : 0
  };
}

export function agentPerformanceScore(metrics = {}, weights = DEFAULT_KPI_WEIGHTS) {
  const collection = Number(metrics.collectionAchievement || 0);
  const recovery = Number(metrics.loanRecovery || 0);
  const attendance = Number(metrics.attendance || 0);
  const satisfaction = Number(metrics.satisfaction || 0);
  const total = (weights.agentCollection + weights.agentRecovery + weights.agentAttendance + weights.agentSatisfaction) || 1;
  return +((
    collection * weights.agentCollection
    + recovery * weights.agentRecovery
    + attendance * weights.agentAttendance
    + satisfaction * weights.agentSatisfaction
  ) / total).toFixed(2);
}

export function reportDashboard(state, range = {}, user) {
  const scoped = scopedState(state, user);
  const figures = financialFigures(scoped, range, groupIdsFromFilters({}, user));
  const collections = operationalCollections(scoped, range);
  const withdrawals = postedWithdrawals(scoped, range);
  const today = range.to || new Date().toISOString().slice(0, 10);
  const todayCollections = collections.filter((item) => item.date === today).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const todayWithdrawals = withdrawals.filter((item) => item.date === today).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const activeCustomers = (scoped.customers || []).filter((item) => item.active !== false && item.memberStatus !== "Closed").length;
  const activeGroups = (scoped.susuGroups || []).filter((item) => item.active !== false && item.status !== "Closed").length;
  const loans = loanPortfolioSummary(scoped.loans || []);
  return {
    todayCollections: +todayCollections.toFixed(2),
    todayWithdrawals: +todayWithdrawals.toFixed(2),
    activeCustomers,
    activeGroups,
    activeLoans: loans.active,
    outstandingLoans: loans.outstanding,
    totalSavings: figures.outstandingSavingsLiability,
    cashPosition: figures.cashPosition,
    revenue: figures.revenue,
    expenses: figures.expenses,
    netPosition: figures.netPosition,
    collectionSuccessRate: collectionSuccessRate(scoped, range),
    loanRecoveryRate: loanRecoveryRate(scoped.loans || []),
    customerGrowth: customerGrowth(scoped, range).net,
    par: portfolioAtRisk(scoped.loans || [], { asOf: today, days: kpiWeights(state.settings).parDays }),
    figures
  };
}

function table(columns, rows) {
  return { columns, rows };
}

function customerRows(state, range, predicate) {
  return (state.customers || []).filter((item) => predicate(item) && (!range.from || inRange(item.createdAt || item.date || "9999", range.from, range.to) || !range.from)).map((item) => ({
    id: item.id,
    name: item.name,
    customerNumber: item.customerNumber || item.accountNo || "",
    phone: item.phone || "",
    status: item.memberStatus || (item.active === false ? "Closed" : "Active"),
    kyc: item.kycStatus || item.kyc || "",
    branchId: item.groupId || "",
    collectorId: item.collectorId || ""
  }));
}

export function runReport(state, reportId, { user, from = "", to = "", branchId = "", agentId = "", status = "", q = "", page = 1, pageSize = PAGE_SIZE } = {}) {
  const report = REPORT_CATALOG.find((item) => item.id === reportId);
  if (!report) return { error: "Unknown report" };
  if (!canRunReport(user, report)) return { error: "You cannot view this report" };
  const scoped = scopedState(state, user);
  const range = { from, to };
  const groupIds = groupIdsFromFilters({ branchId }, user);
  if (report.kind === "financial" || report.id === "executive_summary" || report.id === "revenue_analysis" || report.id === "expense_analysis") {
    const figures = financialFigures(scoped, range, groupIds);
    const check = validateFinancialReport(figures, report);
    if (check.error) return { error: check.error, report, figures };
    return buildFinancial(report, figures, scoped, range);
  }
  const built = buildOperational(report, scoped, range, { branchId, agentId, status, q });
  const paged = paginate(built.rows, { page, pageSize });
  return {
    report,
    kind: report.kind,
    columns: built.columns,
    ...paged,
    summary: built.summary || {},
    source: report.kind === "operational" ? "business" : "hybrid"
  };
}

function buildFinancial(report, figures, state, range) {
  if (report.id === "trial_balance") {
    return {
      report,
      kind: "financial",
      source: "accounting",
      columns: ["code", "name", "debit", "credit"],
      rows: figures.trialBalance.rows.filter((row) => row.debit || row.credit),
      total: figures.trialBalance.rows.length,
      page: 1,
      pages: 1,
      summary: { totalDebit: figures.trialBalance.totalDebit, totalCredit: figures.trialBalance.totalCredit, balanced: true }
    };
  }
  if (report.id === "income_statement" || report.id === "revenue_analysis") {
    return {
      report,
      kind: "financial",
      source: "accounting",
      columns: ["code", "name", "amount"],
      rows: figures.income.income,
      total: figures.income.income.length,
      page: 1,
      pages: 1,
      summary: { revenue: figures.revenue, expenses: figures.expenses, netIncome: figures.grossProfit }
    };
  }
  if (report.id === "expense_analysis") {
    return {
      report,
      kind: "financial",
      source: "accounting",
      columns: ["code", "name", "amount"],
      rows: figures.income.expenses,
      total: figures.income.expenses.length,
      page: 1,
      pages: 1,
      summary: { expenses: figures.expenses }
    };
  }
  if (report.id === "balance_sheet") {
    const rows = [
      ...figures.balanceSheet.assets.map((row) => ({ ...row, section: "Asset" })),
      ...figures.balanceSheet.liabilities.map((row) => ({ ...row, section: "Liability" })),
      ...figures.balanceSheet.equity.map((row) => ({ ...row, section: "Equity" }))
    ];
    return {
      report,
      kind: "financial",
      source: "accounting",
      columns: ["section", "code", "name", "amount"],
      rows,
      total: rows.length,
      page: 1,
      pages: 1,
      summary: {
        assets: figures.balanceSheet.assetTotal,
        liabilities: figures.balanceSheet.liabilityTotal,
        equity: figures.balanceSheet.equityTotal,
        balanced: true
      }
    };
  }
  if (report.id === "cash_flow") {
    return {
      report,
      kind: "financial",
      source: "accounting",
      columns: ["class", "amount"],
      rows: [
        { class: "Operating inflow", amount: figures.cashFlow.inflow },
        { class: "Operating outflow", amount: figures.cashFlow.outflow },
        { class: "Net cash", amount: figures.cashFlow.net }
      ],
      total: 3,
      page: 1,
      pages: 1,
      summary: figures.cashFlow
    };
  }
  if (report.id === "cash_book") {
    const book = cashbook(state, range);
    return { report, kind: "financial", source: "accounting", columns: ["date", "type", "debit", "credit", "receiptNo"], rows: book, total: book.length, page: 1, pages: 1 };
  }
  if (report.id === "journal_register") {
    const rows = (state.journalEntries || []).filter((item) => inRange(item.date, range.from, range.to));
    return { report, kind: "financial", source: "accounting", columns: ["id", "date", "narration"], rows, total: rows.length, page: 1, pages: 1 };
  }
  if (report.id === "bank_reconciliation") {
    const rec = bankReconciliation(state);
    return {
      report,
      kind: "financial",
      source: "accounting",
      columns: ["bookBalance", "statementBalance", "difference"],
      rows: [rec],
      total: 1,
      page: 1,
      pages: 1,
      summary: rec
    };
  }
  if (report.id === "executive_summary") {
    const dash = reportDashboard(state, range, { role: "SystemOwner", systemOwner: true, id: "u-owner" });
    return {
      report,
      kind: "hybrid",
      source: "hybrid",
      columns: ["metric", "value"],
      rows: [
        { metric: "Revenue", value: figures.revenue },
        { metric: "Expenses", value: figures.expenses },
        { metric: "Net income", value: figures.grossProfit },
        { metric: "Cash position", value: figures.cashPosition },
        { metric: "Savings liability", value: figures.outstandingSavingsLiability },
        { metric: "Active customers", value: dash.activeCustomers }
      ],
      total: 6,
      page: 1,
      pages: 1,
      summary: figures
    };
  }
  return { error: "Unsupported financial report" };
}

function buildOperational(report, state, range, filters) {
  if (report.id === "bi_dashboard") {
    const dash = reportDashboard(state, range, { role: "SystemOwner", systemOwner: true, id: "x" });
    return table(["metric", "value"], Object.entries(dash).filter(([, value]) => typeof value !== "object").map(([metric, value]) => ({ metric, value })));
  }
  if (report.id.startsWith("customer_")) {
    const map = {
      customer_register: () => true,
      customer_new: (item) => inRange(item.createdAt || item.date, range.from, range.to),
      customer_active: (item) => item.active !== false && item.memberStatus !== "Closed" && item.memberStatus !== "Suspended",
      customer_dormant: (item) => item.dormant || item.memberStatus === "Dormant",
      customer_kyc: () => true,
      customer_growth: () => true
    };
    const rows = customerRows(state, range, map[report.id] || (() => true));
    if (report.id === "customer_growth") {
      const growth = customerGrowth(state, range);
      return { columns: ["opened", "closed", "net"], rows: [growth], summary: growth };
    }
    return table(["name", "customerNumber", "phone", "status", "kyc"], rows);
  }
  if (report.id.startsWith("collections_")) {
    let rows = operationalCollections(state, range);
    if (filters.agentId) rows = rows.filter((item) => item.userId === filters.agentId || item.collectorId === filters.agentId);
    if (filters.branchId) rows = rows.filter((item) => item.groupId === filters.branchId);
    if (report.id === "collections_missed") {
      return table(["date", "customer", "reason"], missedCollectionRows(state.collections || [], state.customers || []));
    }
    const stats = collectionAnalytics(rows, {
      customers: state.customers || [],
      users: state.users || [],
      products: state.savingsProducts || [],
      groups: state.groups || []
    });
    if (report.id === "collections_by_product") return table(["label", "amount"], stats.byProduct);
    if (report.id === "collections_by_branch") return table(["label", "amount"], stats.byBranch);
    if (report.id === "collections_by_agent") return table(["label", "amount"], stats.byAgent);
    return {
      columns: ["date", "customerId", "amount", "paymentMethod", "receiptNo"],
      rows: rows.map((item) => ({
        date: item.date,
        customerId: item.customerId,
        amount: item.amount,
        paymentMethod: item.paymentMethod || "Cash",
        receiptNo: item.receiptNo || item.paymentNo || ""
      })),
      summary: { total: stats.total, count: stats.count, successRate: stats.successRate }
    };
  }
  if (report.id === "group_register") {
    return table(["name", "code", "status"], (state.susuGroups || []).map((item) => ({ name: item.name, code: item.code, status: item.status || "Active" })));
  }
  if (report.id === "group_contributions") {
    const rows = operationalCollections(state, range).filter((item) => item.susuGroupId);
    return table(["date", "susuGroupId", "amount"], rows);
  }
  if (report.id.startsWith("loan_")) {
    let loans = state.loans || [];
    if (report.id === "loan_outstanding") loans = loans.filter((item) => outstandingLoanBalance(item) > 0.009);
    if (report.id === "loan_overdue") loans = loans.filter((item) => ["Defaulted"].includes(item.status) || (item.dueDate && item.dueDate < (range.to || "9999")));
    if (report.id === "loan_par") {
      const par = portfolioAtRisk(loans, { asOf: range.to, days: kpiWeights(state.settings).parDays });
      return { columns: ["pastDue", "outstanding", "rate"], rows: [par], summary: par };
    }
    if (report.id === "loan_repayment") {
      const rows = (state.transactions || []).filter((item) => item.type === "Loan Repayment" && isPostedTransaction(item) && inRange(item.date, range.from, range.to));
      return table(["date", "customerId", "amount", "receiptNo"], rows);
    }
    return table(["id", "customerId", "principal", "status", "outstanding"], loans.map((item) => ({
      id: item.id,
      customerId: item.customerId,
      principal: item.principal,
      status: item.status,
      outstanding: outstandingLoanBalance(item)
    })));
  }
  if (report.id.startsWith("withdrawal_")) {
    const requests = state.withdrawalRequests || [];
    if (report.id === "withdrawal_pending") {
      const rows = requests.filter((item) => !["Paid", "Rejected", "Cancelled", "Reversed"].includes(item.status));
      return table(["id", "customerId", "amount", "status"], rows);
    }
    return table(["id", "customerId", "amount", "status", "date"], requests);
  }
  if (report.id === "agent_performance") {
    const day = range.to || new Date().toISOString().slice(0, 10);
    const rows = staffAgents(state.users || []).map((user) => {
      const perf = agentPerformance(user, {
        collections: state.collections || [],
        customers: state.customers || [],
        susuGroups: state.susuGroups || [],
        date: day
      });
      return {
        agent: user.name,
        collected: perf.collected,
        achievementPercent: perf.achievementPercent,
        score: agentPerformanceScore({
          collectionAchievement: perf.achievementPercent,
          loanRecovery: 0,
          attendance: 100,
          satisfaction: 0
        }, kpiWeights(state.settings))
      };
    });
    return table(["agent", "collected", "achievementPercent", "score"], rows);
  }
  if (report.id === "branch_performance") {
    const day = range.to || new Date().toISOString().slice(0, 10);
    const rows = (state.branches || []).map((branch) => {
      const perf = branchPerformance(branch, {
        collections: state.collections || [],
        customers: state.customers || [],
        groups: state.groups || [],
        date: day
      });
      return { branch: branch.name, customers: perf.activeCustomers, collected: perf.collected };
    });
    return table(["branch", "customers", "collected"], rows);
  }
  if (String(report.id || "").startsWith("payments_")) {
    return paymentReports(state, report.id, range);
  }
  if (String(report.id || "").startsWith("documents_")) {
    return documentReports(state, report.id, range);
  }
  if (String(report.id || "").startsWith("jobs_")) {
    return jobReports(state, report.id, range);
  }
  if (String(report.id || "").startsWith("monitor_")) {
    return monitoringReports(state, report.id, range);
  }
  if (String(report.id || "").startsWith("gateway_")) {
    return gatewayReports(state, report.id, range);
  }
  if (["backup_jobs", "restore_history", "recovery_tests", "rto_rpo"].includes(report.id)) {
    return backupReports(state, report.id, range);
  }
  if (["security_incidents", "fraud_cases", "risk_scores", "contract_invocations"].includes(report.id)) {
    return securityReports(state, report.id, range);
  }
  if (String(report.id || "").startsWith("workflow_")) {
    return workflowReports(state, report.id, range);
  }
  if (String(report.id || "").startsWith("rules_")) {
    return ruleReports(state, report.id, range);
  }
  if (String(report.id || "").startsWith("exchange_")) {
    return exchangeReports(state, report.id, range);
  }
  if (String(report.id || "").startsWith("records_")) {
    return recordsReports(state, report.id, range);
  }
  if (["bi_metrics", "bi_kpis", "bi_schemas", "bi_calculations", "bi_metric_history"].includes(report.id)) {
    return biReports(state, report.id, range);
  }
  if (String(report.id || "").startsWith("integration_")) {
    return integrationReports(state, report.id);
  }
  if (String(report.id || "").startsWith("ai_")) {
    return aiReports(state, report.id);
  }
  if (String(report.id || "").startsWith("platform_")) {
    return platformReports(state, report.id);
  }
  return table(["id"], []);
}

export const CUSTOM_SOURCES = {
  collections: { label: "Collections", kind: "operational", fields: ["date", "amount", "paymentMethod", "groupId", "customerId", "receiptNo"] },
  customers: { label: "Customers", kind: "operational", fields: ["name", "customerNumber", "memberStatus", "groupId", "collectorId"] },
  loans: { label: "Loans", kind: "operational", fields: ["date", "principal", "status", "amountPaid", "totalDue"] },
  withdrawals: { label: "Withdrawals", kind: "operational", fields: ["date", "amount", "status", "customerId"] },
  ledger: { label: "General Ledger", kind: "financial", fields: ["date", "account", "direction", "amount", "entryType"] },
  journals: { label: "Journals", kind: "financial", fields: ["date", "narration"] },
  payments: { label: "Payments", kind: "operational", fields: ["createdAt", "amount", "paymentMethod", "status", "paymentReference"] },
  documents: { label: "Documents", kind: "operational", fields: ["createdAt", "type", "receiptNo", "status", "outcome"] },
  jobs: { label: "Jobs", kind: "operational", fields: ["createdAt", "type", "status", "priority", "correlationId"] },
  monitoring: { label: "Monitoring", kind: "operational", fields: ["createdAt", "domain", "status", "score"] },
  gateway: { label: "API Gateway", kind: "operational", fields: ["createdAt", "route", "status", "http"] },
  recovery: { label: "Backup & Recovery", kind: "operational", fields: ["createdAt", "type", "status"] },
  security: { label: "Security", kind: "operational", fields: ["createdAt", "title", "severity", "status"] },
  workflows: { label: "Workflows", kind: "operational", fields: ["createdAt", "code", "status", "startedBy"] }
};

export function runCustomReport(state, spec, user) {
  if (!canAction(user, "Reports.Custom")) return { error: "You cannot build custom reports" };
  const source = CUSTOM_SOURCES[spec.source];
  if (!source) return { error: "Unknown data source" };
  if (source.kind === "financial" && !canAction(user, "Reports.Accounting") && !canAction(user, "Accounting.View")) {
    return { error: "You cannot query financial sources" };
  }
  const scoped = scopedState(state, user);
  let rows = [];
  if (spec.source === "collections") rows = operationalCollections(scoped, spec);
  else if (spec.source === "customers") rows = scoped.customers || [];
  else if (spec.source === "loans") rows = scoped.loans || [];
  else if (spec.source === "withdrawals") rows = scoped.withdrawalRequests || [];
  else if (spec.source === "ledger") rows = (scoped.ledgerEntries || []).filter((item) => !item.reversed);
  else if (spec.source === "journals") rows = scoped.journalEntries || [];
  else if (spec.source === "payments") rows = scoped.paymentTransactions || [];
  else if (spec.source === "documents") rows = scoped.documents || [];
  else if (spec.source === "jobs") rows = scoped.backgroundJobs || [];
  else if (spec.source === "monitoring") rows = scoped.healthChecks || [];
  else if (spec.source === "workflows") rows = scoped.workflowInstances || [];
  const fields = (spec.fields || []).filter((field) => source.fields.includes(field));
  const selected = fields.length ? fields : source.fields;
  let mapped = rows.map((row) => Object.fromEntries(selected.map((field) => [field, row[field]])));
  if (spec.groupBy && selected.includes(spec.groupBy)) {
    const groups = {};
    mapped.forEach((row) => {
      const key = String(row[spec.groupBy] ?? "");
      groups[key] = groups[key] || { [spec.groupBy]: key, count: 0, sum: 0 };
      groups[key].count += 1;
      groups[key].sum += Number(row.amount || row.principal || 0);
    });
    mapped = Object.values(groups);
  }
  if (spec.sort) {
    const dir = spec.sortDir === "desc" ? -1 : 1;
    mapped.sort((a, b) => String(a[spec.sort] ?? "").localeCompare(String(b[spec.sort] ?? ""), undefined, { numeric: true }) * dir);
  }
  const paged = paginate(mapped, spec);
  return { report: { id: "custom", name: spec.name || "Custom report", kind: source.kind }, columns: mapped[0] ? Object.keys(mapped[0]) : selected, ...paged };
}

export function saveReportTemplate(state, template, user, uid) {
  if (!canAction(user, "Reports.Custom")) return { error: "You cannot save report templates" };
  state.reportTemplates = state.reportTemplates || [];
  const row = {
    id: template.id || uid("rpt"),
    name: String(template.name || "Untitled").trim(),
    spec: template.spec || {},
    userId: user.id,
    createdAt: new Date().toISOString()
  };
  state.reportTemplates.push(row);
  return { template: row };
}

export function recordReportHistory(state, payload, uid) {
  state.reportHistory = state.reportHistory || [];
  const row = {
    id: uid("rph"),
    reportId: payload.reportId,
    reportName: payload.reportName,
    userId: payload.userId || "",
    branchId: payload.branchId || "",
    filters: payload.filters || {},
    format: payload.format || "view",
    rowCount: payload.rowCount || 0,
    durationMs: payload.durationMs || 0,
    version: REPORT_VERSION,
    periodFrom: payload.from || "",
    periodTo: payload.to || "",
    createdAt: new Date().toISOString()
  };
  state.reportHistory.push(row);
  state.reportActivityLogs = state.reportActivityLogs || [];
  state.reportActivityLogs.push({
    id: uid("rpa"),
    action: payload.error ? "report_rejected" : "report_generated",
    reportId: payload.reportId,
    userId: payload.userId || "",
    detail: payload.error || payload.reportName,
    createdAt: row.createdAt
  });
  return row;
}

export function scheduleReport(state, data, user, uid) {
  if (!canAction(user, "Reports.Schedule")) return { error: "You cannot schedule reports" };
  const report = REPORT_CATALOG.find((item) => item.id === data.reportId);
  if (!report) return { error: "Unknown report" };
  if (!canRunReport(user, report)) return { error: "You cannot schedule this report" };
  const row = {
    id: uid("rps"),
    reportId: data.reportId,
    frequency: data.frequency || "Daily",
    delivery: data.delivery || "In-App",
    filters: data.filters || {},
    userId: user.id,
    nextRunAt: data.nextRunAt || new Date().toISOString(),
    active: true,
    createdAt: new Date().toISOString()
  };
  state.scheduledReports = state.scheduledReports || [];
  state.scheduledReports.push(row);
  return { schedule: row };
}

function addDays(iso, days) {
  const date = new Date(iso);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

export function runDueSchedules(state, user, uid, now = new Date().toISOString()) {
  const due = (state.scheduledReports || []).filter((item) => item.active && item.nextRunAt <= now);
  due.forEach((item) => {
    const actor = (state.users || []).find((row) => row.id === item.userId) || user;
    const generated = runReport(state, item.reportId, { user: actor, ...(item.filters || {}) });
    recordReportHistory(state, {
      reportId: item.reportId,
      reportName: REPORT_CATALOG.find((row) => row.id === item.reportId)?.name,
      userId: item.userId,
      filters: item.filters,
      format: item.delivery,
      rowCount: generated.total || generated.rows?.length || 0,
      from: item.filters?.from,
      to: item.filters?.to
    }, uid);
    state.reportExports = state.reportExports || [];
    state.reportExports.push({
      id: uid("rpx"),
      scheduleId: item.id,
      reportId: item.reportId,
      status: generated.error ? "Failed" : "Queued",
      createdAt: now
    });
    const days = { Daily: 1, Weekly: 7, Monthly: 30, Quarterly: 90, Annual: 365, Custom: 1 }[item.frequency] || 1;
    item.nextRunAt = addDays(item.nextRunAt, days);
    item.lastRunAt = now;
  });
  return { ran: due.length };
}

export function searchRecords(state, query, user) {
  const scoped = scopedState(state, user);
  const term = String(query || "").trim().toLowerCase();
  if (term.length < 2) return { customers: [], agents: [], groups: [], loans: [], transactions: [] };
  const match = (...values) => values.some((value) => String(value || "").toLowerCase().includes(term));
  return {
    customers: (scoped.customers || []).filter((item) => match(item.name, item.customerNumber, item.accountNo)).slice(0, 8),
    agents: (scoped.users || []).filter((item) => match(item.name, item.username)).slice(0, 8),
    groups: [...(scoped.groups || []), ...(scoped.susuGroups || [])].filter((item) => match(item.name, item.code)).slice(0, 8),
    loans: (scoped.loans || []).filter((item) => match(item.id, item.loanNo)).slice(0, 8),
    transactions: (scoped.transactions || []).filter((item) => match(item.id, item.receiptNo, item.ref)).slice(0, 8)
  };
}

export function analyticsSeries(state, range, user) {
  const scoped = scopedState(state, user);
  const rows = operationalCollections(scoped, range);
  const byDate = {};
  rows.forEach((item) => {
    byDate[item.date] = (byDate[item.date] || 0) + Number(item.amount || 0);
  });
  return Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, amount]) => ({ date, amount: +amount.toFixed(2) }));
}

export function exportReportCsv(result, meta = {}) {
  const rows = result.rows || [];
  const columns = result.columns || (rows[0] ? Object.keys(rows[0]) : []);
  const header = [
    `# ${meta.company || "Smile Trust"}`,
    `# ${result.report?.name || "Report"}`,
    `# Generated ${meta.generatedAt || new Date().toISOString()}`,
    `# By ${meta.generatedBy || ""}`,
    `# Filters ${JSON.stringify(meta.filters || {})}`,
    `# Version ${REPORT_VERSION}`
  ];
  const csv = [
    ...header,
    columns.join(","),
    ...rows.map((row) => columns.map((col) => jsonCsv(row[col])).join(","))
  ].join("\n");
  return csv;
}

function jsonCsv(value) {
  const text = value == null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export { availableBalance, table };

registerJobHandler("report_schedule", (state, _job, ctx) => {
  runDueSchedules(state, ctx.user, ctx.uid, typeof ctx.now === "number" ? new Date(ctx.now).toISOString() : ctx.now);
  return { ok: true, orchestrated: true };
});
