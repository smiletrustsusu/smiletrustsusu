/**
 * Individual savings collection: validation, missed visits, bulk drafts,
 * desk metrics, and collection analytics. Uses existing collections[].
 */
import { toPesewas, fromPesewas } from "./money.js";
import { collectorDashboardMetrics } from "./collector-dashboard.js";
import { lastPaymentDate, personalSavingsSummary } from "./personal-savings.js";
import { personalSavingsBalance } from "./savings-products.js";
import { pendingQueueItems } from "../sync/offline-queue.js";

export const MISSED_REASONS = [
  "Customer Not Available",
  "Customer Travelling",
  "Insufficient Funds",
  "Business Closed",
  "Refused Payment",
  "Sick",
  "Other"
];

export const WALLET_METHODS = ["MTN Mobile Money", "Telecel Cash", "AirtelTigo Money", "Mobile Money"];
export const COLLECTION_METHODS = ["Cash", ...WALLET_METHODS, "Bank Transfer", "POS/Card", "Cheque"];

export function isWalletMethod(method) {
  return WALLET_METHODS.includes(method) || /momo|mobile money|mtn|telecel|airteltigo/i.test(method || "");
}

export function isElectronicMethod(method) {
  return method && method !== "Cash" && method !== "Cheque";
}

export function validateCollectionDraft({
  customer,
  agent,
  branch,
  product,
  amount,
  date,
  today = ""
} = {}) {
  const day = today || new Date().toISOString().slice(0, 10);
  if (!customer) return "Select a customer";
  if (customer.active === false || ["Suspended", "Closed", "Blacklisted", "Deceased"].includes(customer.memberStatus)) {
    return "Customer is not active";
  }
  if (!customer.accountNo && !customer.savingsProductId && customer.accountType !== "susu_group") {
    return "Customer account does not exist";
  }
  if (agent && agent.active === false) return "Agent is not active";
  if (branch && (branch.active === false || ["Suspended", "Closed", "Inactive"].includes(branch.status))) {
    return "Branch is not active";
  }
  if (!date) return "Collection date is required";
  if (date > day) return "Collection date cannot be in the future";
  const value = Number(amount);
  if (!Number.isFinite(value) || value < 0) return "Enter a valid amount";
  if (value > 0 && product) {
    if (product.minAmountPesewas && toPesewas(value) < product.minAmountPesewas) {
      return `Minimum deposit is GHS ${fromPesewas(product.minAmountPesewas).toFixed(2)}`;
    }
    if (product.maxAmountPesewas && toPesewas(value) > product.maxAmountPesewas) {
      return `Maximum deposit is GHS ${fromPesewas(product.maxAmountPesewas).toFixed(2)}`;
    }
  }
  return "";
}

export function isLargeDeposit(amount, product, threshold = 5000) {
  const limit = Number(product?.largeDepositAlert || threshold);
  return Number(amount) >= limit;
}

export function collectionCustomerCard(customer, {
  collections = [],
  transactions = [],
  products = [],
  users = [],
  date = ""
} = {}) {
  const product = products.find((item) => item.id === customer.savingsProductId);
  const summary = personalSavingsSummary(customer, product, collections);
  const expected = fromPesewas(product?.defaultAmountPesewas || toPesewas(customer.dailyAmount || 0));
  const todayPaid = collections.some((item) =>
    item.customerId === customer.id && item.date === (date || new Date().toISOString().slice(0, 10)) && Number(item.amount || 0) > 0 && !item.reversed
  );
  return {
    id: customer.id,
    name: customer.name,
    photo: customer.passportPhoto || "",
    customerNumber: customer.customerNumber || customer.accountNo || "",
    phone: customer.phone || "",
    productName: product?.name || "Personal savings",
    productId: customer.savingsProductId || "",
    expected,
    balance: personalSavingsBalance(customer.id, { collections, transactions }),
    lastCollection: lastPaymentDate(customer.id, collections) || summary.lastPayment || "",
    agentName: users.find((user) => user.id === customer.collectorId)?.name || "",
    status: todayPaid ? "Collected" : summary.overdue ? "Missed" : "Pending",
    overdue: Boolean(summary.overdue)
  };
}

export function collectionDesk(state, agentId, { date = "" } = {}) {
  const day = date || new Date().toISOString().slice(0, 10);
  const metrics = collectorDashboardMetrics(agentId, state, { date: day });
  const assigned = (state.customers || []).filter((item) => item.collectorId === agentId && item.active !== false);
  const personal = assigned.filter((item) => item.accountType !== "susu_group");
  const visited = new Set(
    (state.collections || [])
      .filter((item) => (item.userId === agentId || item.collectorId === agentId) && item.date === day)
      .map((item) => item.customerId)
  );
  const pending = pendingQueueItems(state).filter((item) => item.kind === "collection" || item.kind === "customer");
  const customTarget = (state.collectionTargets || []).find((item) => item.agentId === agentId && item.date === day);
  const target = customTarget ? Number(customTarget.amount || 0) : Number(metrics.expectedTotal || 0);
  return {
    ...metrics,
    assignedToday: personal.length,
    visited: visited.size,
    target,
    remaining: Math.max(0, target - Number(metrics.collectionsToday || 0)),
    pendingSync: pending.length,
    offline: pending.length
  };
}

export function customerBalanceBreakdown(customerId, {
  collections = [],
  transactions = [],
  product = null
} = {}) {
  const deposits = collections.filter((item) => item.customerId === customerId && !item.reversed && !item.susuGroupId);
  const deposit = deposits.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const charges = fromPesewas(Number(product?.feePesewas || 0) * deposits.filter((item) => Number(item.amount || 0) > 0).length);
  const penalties = fromPesewas(Number(product?.penaltyPesewas || 0));
  const current = personalSavingsBalance(customerId, { collections, transactions });
  const interest = +(current * (Number(product?.interestRate || 0) / 100)).toFixed(2);
  const opening = +(current - deposit + charges + penalties).toFixed(2);
  return {
    opening: Math.max(0, opening),
    deposit: +deposit.toFixed(2),
    interest,
    charges,
    penalties,
    current: +current.toFixed(2),
    available: +Math.max(0, current - charges - penalties).toFixed(2),
    projected: projectedMaturity(current, product)
  };
}

export function missedCollectionRows(collections = [], customers = []) {
  return collections
    .filter((item) => Number(item.amount || 0) <= 0 || MISSED_REASONS.includes(item.visitOutcome) || item.status === "Missed")
    .map((item) => ({
      date: item.date,
      customer: customers.find((customer) => customer.id === item.customerId)?.name || item.customerId,
      reason: item.visitOutcome || item.note || "Missed",
      agentId: item.userId || item.collectorId,
      receiptNo: item.receiptNo || item.paymentNo || ""
    }));
}

export function fraudAlerts(collections = [], { largeThreshold = 5000 } = {}) {
  const alerts = [];
  const sameDay = {};
  collections.filter((item) => !item.reversed && Number(item.amount || 0) > 0).forEach((item) => {
    const key = `${item.customerId}:${item.date}`;
    sameDay[key] = (sameDay[key] || 0) + 1;
    if (Number(item.amount || 0) >= largeThreshold) {
      alerts.push({ type: "large_deposit", collectionId: item.id, amount: item.amount, date: item.date });
    }
  });
  Object.entries(sameDay).forEach(([key, count]) => {
    if (count > 1) alerts.push({ type: "duplicate_same_day", key, count });
  });
  return alerts;
}

export function logCollectionActivity(state, { action, collectionId = "", detail = "", userId = "", uid }) {
  state.collectionActivityLogs = state.collectionActivityLogs || [];
  const row = {
    id: uid("cal"),
    action,
    collectionId,
    detail,
    userId,
    createdAt: new Date().toISOString()
  };
  state.collectionActivityLogs.push(row);
  return row;
}

export function collectionAnalytics(collections = [], {
  customers = [],
  users = [],
  products = [],
  groups = [],
  from = "",
  to = ""
} = {}) {
  const rows = collections.filter((item) => {
    if (item.reversed) return false;
    if (from && item.date < from) return false;
    if (to && item.date > to) return false;
    return true;
  });
  const by = (keyFn) => {
    const map = {};
    rows.forEach((item) => {
      const key = keyFn(item) || "Unassigned";
      map[key] = (map[key] || 0) + Number(item.amount || 0);
    });
    return Object.entries(map).map(([label, amount]) => ({ label, amount })).sort((a, b) => b.amount - a.amount);
  };
  const paidIds = new Set(rows.filter((item) => Number(item.amount || 0) > 0).map((item) => item.customerId));
  const assigned = customers.filter((item) => item.active !== false);
  const total = rows.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  return {
    total: +total.toFixed(2),
    count: rows.length,
    average: rows.length ? +(total / rows.length).toFixed(2) : 0,
    successRate: assigned.length ? Math.round((paidIds.size / assigned.length) * 100) : 0,
    byMethod: by((item) => item.paymentMethod || "Cash"),
    byProduct: by((item) => products.find((product) => product.id === item.savingsProductId)?.name),
    byAgent: by((item) => users.find((user) => user.id === (item.userId || item.collectorId))?.name),
    byBranch: by((item) => groups.find((group) => group.id === item.groupId)?.name),
    topCustomers: by((item) => customers.find((customer) => customer.id === item.customerId)?.name).slice(0, 8)
  };
}

export function filterCollections(collections = [], query = {}, extras = {}) {
  const { customerName = () => "", agentName = () => "", branchName = () => "", productName = () => "" } = extras;
  const term = String(query.q || "").trim().toLowerCase();
  return collections.filter((item) => {
    if (query.from && item.date < query.from) return false;
    if (query.to && item.date > query.to) return false;
    if (query.method && (item.paymentMethod || "Cash") !== query.method) return false;
    if (query.status) {
      const status = item.reversed ? "Reversed" : (item.verificationStatus || "Verified");
      if (status !== query.status) return false;
    }
    if (query.productId && item.savingsProductId !== query.productId) return false;
    if (query.agentId && item.userId !== query.agentId && item.collectorId !== query.agentId) return false;
    if (query.branchId && item.groupId !== query.branchId) return false;
    if (!term) return true;
    const hay = [
      customerName(item),
      agentName(item),
      branchName(item),
      productName(item),
      item.receiptNo,
      item.paymentNo,
      item.paymentMethod,
      item.accountNo
    ].join(" ").toLowerCase();
    return hay.includes(term);
  });
}

export function validateBulkDrafts(rows = [], context = {}) {
  const results = rows.map((row, index) => {
    const error = validateCollectionDraft({ ...context, ...row });
    return { index, ok: !error, error, row };
  });
  return {
    ok: results.every((item) => item.ok),
    results,
    valid: results.filter((item) => item.ok).map((item) => item.row)
  };
}

export function exportCollectionRows(collections = [], extras = {}) {
  const { customerName = () => "", agentName = () => "", branchName = () => "", productName = () => "" } = extras;
  return collections.map((item) => ({
    date: item.date,
    receiptNo: item.receiptNo || item.paymentNo || "",
    customer: customerName(item),
    agent: agentName(item),
    branch: branchName(item),
    product: productName(item),
    amount: item.amount,
    method: item.paymentMethod || "Cash",
    status: item.reversed ? "Reversed" : (item.verificationStatus || "Verified"),
    sync: item.syncStatus || (item.idempotencyKey ? "Queued/Saved" : "Local")
  }));
}

export function createAdjustmentRequest(state, { collection, amount, reason, requestedBy, uid }) {
  const value = Number(amount);
  if (!collection || collection.reversed) return { error: "Collection not found" };
  if (!String(reason || "").trim()) return { error: "Reason is required" };
  if (!Number.isFinite(value) || value <= 0 || value > Number(collection.amount || 0)) {
    return { error: "Adjustment must be greater than 0 and not exceed the original amount" };
  }
  state.collectionAdjustments = state.collectionAdjustments || [];
  const row = {
    id: uid("adj"),
    collectionId: collection.id,
    originalAmount: Number(collection.amount || 0),
    amount: value,
    reason: String(reason).trim(),
    requestedBy: requestedBy || "",
    status: "Pending",
    createdAt: new Date().toISOString()
  };
  state.collectionAdjustments.push(row);
  return { adjustment: row };
}

export function applyAdjustment(state, adjustmentId, actor) {
  const row = (state.collectionAdjustments || []).find((item) => item.id === adjustmentId);
  if (!row || row.status !== "Pending") return { error: "Adjustment not found or already processed" };
  if (!["SystemOwner", "KBA", "Admin", "ManagingDirector", "OperationsManager", "Accountant"].includes(actor?.role)) {
    return { error: "You cannot approve this adjustment" };
  }
  const collection = (state.collections || []).find((item) => item.id === row.collectionId);
  if (!collection || collection.reversed) return { error: "Original collection is not adjustable" };
  collection.amount = +(Number(collection.amount || 0) - Number(row.amount || 0)).toFixed(2);
  collection.amountPesewas = toPesewas(collection.amount);
  collection.adjusted = true;
  collection.updatedAt = new Date().toISOString();
  row.status = "Approved";
  row.approvedBy = actor.id;
  row.approvedAt = new Date().toISOString();
  return { adjustment: row, collection };
}

export function projectedMaturity(balance, product) {
  const rate = Number(product?.interestRate || 0) / 100;
  const months = Number(product?.maturityMonths || 0);
  if (!rate || !months) return Number(balance || 0);
  return +(Number(balance || 0) * (1 + rate * (months / 12))).toFixed(2);
}
