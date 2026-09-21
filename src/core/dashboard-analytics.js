/**
 * Dashboard aggregations over existing collections, loans, expenses, and staff.
 * Does not write business records — read-only summaries for the home screen.
 */
import { toPesewas, fromPesewas } from "./money.js";
import { CASH_ACCOUNT, MOMO_ACCOUNT, BANK_ACCOUNT, POS_ACCOUNT } from "./double-entry.js";
import { loanPortfolioSummary, outstandingLoanBalance } from "./loans-workflow.js";
import { agentPerformance, staffAgents, computeAgentCommission } from "./agents.js";
import { collectorDashboardMetrics } from "./collector-dashboard.js";
import { birthdayCustomers } from "./notifications.js";
import { pendingQueueItems } from "../sync/offline-queue.js";

export const DASHBOARD_WIDGETS = [
  { id: "search", label: "Search", roles: ["*"] },
  { id: "summaryCards", label: "Summary Cards", roles: ["*"] },
  { id: "quickActions", label: "Quick Actions", roles: ["*"] },
  { id: "offline", label: "Offline Sync", roles: ["Collector", "Admin", "FieldSupervisor", "SystemOwner", "KBA"] },
  { id: "agentToday", label: "Today's Route", roles: ["Collector"] },
  { id: "cso", label: "Customer Service", roles: ["CustomerService"] },
  { id: "financial", label: "Financial Summary", roles: ["SystemOwner", "KBA", "ManagingDirector", "Admin", "Accountant", "OperationsManager", "Cashier", "Developer"] },
  { id: "charts", label: "Charts & Analytics", roles: ["SystemOwner", "KBA", "ManagingDirector", "Admin", "Accountant", "OperationsManager", "Auditor", "Developer"] },
  { id: "loans", label: "Loan Portfolio", roles: ["SystemOwner", "KBA", "ManagingDirector", "Admin", "Accountant", "OperationsManager"] },
  { id: "branches", label: "Branch Performance", roles: ["SystemOwner", "KBA", "ManagingDirector", "OperationsManager", "Developer"] },
  { id: "agents", label: "Agent Performance", roles: ["SystemOwner", "KBA", "ManagingDirector", "Admin", "OperationsManager", "FieldSupervisor"] },
  { id: "kpis", label: "Performance Indicators", roles: ["SystemOwner", "KBA", "ManagingDirector", "Admin", "Accountant", "OperationsManager"] },
  { id: "cash", label: "Cash Position", roles: ["SystemOwner", "KBA", "ManagingDirector", "Admin", "Accountant", "Cashier", "Developer"] },
  { id: "pending", label: "Pending Tasks", roles: ["SystemOwner", "KBA", "ManagingDirector", "Admin", "Accountant", "CustomerService", "OperationsManager"] },
  { id: "activity", label: "Recent Activities", roles: ["*"] },
  { id: "calendar", label: "Calendar", roles: ["*"] },
  { id: "system", label: "System Status", roles: ["SystemOwner", "KBA", "Developer"] }
];

const DEFAULT_PREFS = {
  hiddenWidgets: [],
  pinnedActions: [],
  widgetOrder: DASHBOARD_WIDGETS.map((item) => item.id),
  refreshSeconds: 90
};

const PRODUCT_BUCKETS = [
  ["Daily", /daily/i],
  ["Weekly", /weekly/i],
  ["Monthly", /monthly/i],
  ["Fixed", /fixed/i],
  ["Target", /target/i],
  ["Group", /group|susu/i]
];

export function shiftIsoDate(dateStr, days) {
  const date = new Date(`${dateStr}T12:00:00`);
  date.setDate(date.getDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}

export function percentChange(current, previous) {
  const now = Number(current || 0);
  const then = Number(previous || 0);
  if (!then && !now) return { percent: 0, direction: "flat", label: "No change vs yesterday" };
  if (!then) return { percent: 100, direction: "up", label: "New vs yesterday" };
  const percent = Math.round(((now - then) / Math.abs(then)) * 100);
  return {
    percent: Math.abs(percent),
    direction: percent > 0 ? "up" : percent < 0 ? "down" : "flat",
    label: `${percent > 0 ? "+" : percent < 0 ? "−" : ""}${Math.abs(percent)}% vs yesterday`
  };
}

export function amountOnDate(rows = [], date, pick = (row) => row.amount) {
  return rows
    .filter((row) => row.date === date && !row.reversed)
    .reduce((sum, row) => sum + Number(pick(row) || 0), 0);
}

export function normalizeDashboardPrefs(user) {
  const raw = user?.dashboardPrefs || {};
  const hidden = Array.isArray(raw.hiddenWidgets) ? raw.hiddenWidgets : [];
  const pinned = Array.isArray(raw.pinnedActions) ? raw.pinnedActions : [];
  const order = Array.isArray(raw.widgetOrder) && raw.widgetOrder.length
    ? raw.widgetOrder
    : DEFAULT_PREFS.widgetOrder;
  const refreshSeconds = Math.max(30, Number(raw.refreshSeconds || DEFAULT_PREFS.refreshSeconds));
  return { hiddenWidgets: hidden, pinnedActions: pinned, widgetOrder: order, refreshSeconds };
}

export function widgetsForRole(role, prefs = DEFAULT_PREFS) {
  const visible = DASHBOARD_WIDGETS.filter((widget) =>
    widget.roles.includes("*") || widget.roles.includes(role)
  );
  const hidden = new Set(prefs.hiddenWidgets || []);
  const order = prefs.widgetOrder || [];
  return visible
    .filter((widget) => !hidden.has(widget.id))
    .sort((a, b) => {
      const ai = order.indexOf(a.id);
      const bi = order.indexOf(b.id);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
}

export function searchCustomers(customers = [], query = "") {
  const term = String(query || "").trim().toLowerCase();
  if (term.length < 2) return [];
  return customers.filter((customer) => {
    const hay = [
      customer.name,
      customer.customerNumber,
      customer.accountNo,
      customer.phone,
      customer.ghanaCard,
      customer.nationalId
    ].map((value) => String(value || "").toLowerCase());
    return hay.some((value) => value.includes(term));
  }).slice(0, 8);
}

export function searchGroups(groups = [], query = "") {
  const term = String(query || "").trim().toLowerCase();
  if (term.length < 2) return [];
  return groups.filter((group) => {
    const hay = [group.name, group.code, group.leaderName, group.chairperson].map((value) => String(value || "").toLowerCase());
    return hay.some((value) => value.includes(term));
  }).slice(0, 8);
}

function ledgerAccountPesewas(entries = [], account, groupIds = []) {
  return entries
    .filter((entry) => entry.account === account && !entry.reversed)
    .filter((entry) => !groupIds.length || groupIds.includes(entry.groupId))
    .reduce((sum, entry) => {
      const pesewas = Number(entry.amountPesewas ?? toPesewas(entry.amount));
      return sum + (entry.direction === "debit" ? pesewas : -pesewas);
    }, 0);
}

function collectionTotal(collections = [], predicate = () => true) {
  return collections
    .filter((item) => !item.reversed && predicate(item))
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
}

function isoWeekKey(dateStr) {
  const date = new Date(`${dateStr}T12:00:00`);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() + 4 - day);
  const yearStart = new Date(date.getFullYear(), 0, 1);
  const week = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

function monthKey(dateStr) {
  return String(dateStr || "").slice(0, 7);
}

function inRange(date, from, to) {
  return date >= from && date <= to;
}

function ghanaHolidays(year) {
  return [
    [`${year}-01-01`, "New Year's Day"],
    [`${year}-03-06`, "Independence Day"],
    [`${year}-05-01`, "May Day"],
    [`${year}-08-04`, "Founders' Day"],
    [`${year}-09-21`, "Kwame Nkrumah Memorial"],
    [`${year}-12-25`, "Christmas Day"],
    [`${year}-12-26`, "Boxing Day"]
  ];
}

export function productDistribution(collections = [], products = []) {
  const buckets = Object.fromEntries(PRODUCT_BUCKETS.map(([name]) => [name, 0]));
  collections.filter((item) => !item.reversed).forEach((item) => {
    const product = products.find((row) => row.id === item.savingsProductId);
    const label = `${product?.name || ""} ${product?.frequency || ""} ${item.collectionType || ""}`;
    const match = PRODUCT_BUCKETS.find(([, pattern]) => pattern.test(label) || (item.susuGroupId && pattern.test("group")));
    const key = match ? match[0] : (item.susuGroupId ? "Group" : "Daily");
    buckets[key] += Number(item.amount || 0);
  });
  return Object.entries(buckets).map(([label, amount]) => ({ label, amount: +amount.toFixed(2) }));
}

export function dailyCollectionTrend(collections = [], date, days = 30) {
  return Array.from({ length: days }, (_, index) => {
    const day = shiftIsoDate(date, index - (days - 1));
    return {
      date: day,
      label: day.slice(5),
      collections: +collectionTotal(collections, (item) => item.date === day).toFixed(2)
    };
  });
}

export function weeklyCollectionTrend(collections = [], date, weeks = 8) {
  const map = new Map();
  collections.filter((item) => !item.reversed).forEach((item) => {
    if (!item.date) return;
    const key = isoWeekKey(item.date);
    map.set(key, (map.get(key) || 0) + Number(item.amount || 0));
  });
  const keys = [];
  for (let index = weeks - 1; index >= 0; index -= 1) {
    keys.push(isoWeekKey(shiftIsoDate(date, -index * 7)));
  }
  return keys.map((key) => ({ label: key.replace(`${date.slice(0, 4)}-`, ""), amount: +(map.get(key) || 0).toFixed(2) }));
}

export function monthlyRevenueTrend(collections = [], date, months = 6) {
  const map = new Map();
  collections.filter((item) => !item.reversed).forEach((item) => {
    const key = monthKey(item.date);
    if (key) map.set(key, (map.get(key) || 0) + Number(item.amount || 0));
  });
  const rows = [];
  const cursor = new Date(`${date}T12:00:00`);
  cursor.setDate(1);
  for (let index = months - 1; index >= 0; index -= 1) {
    const copy = new Date(cursor);
    copy.setMonth(copy.getMonth() - index);
    const key = copy.toISOString().slice(0, 7);
    rows.push({ label: key, amount: +(map.get(key) || 0).toFixed(2) });
  }
  return rows;
}

export function buildActivityFeed({
  collections = [],
  customers = [],
  withdrawals = [],
  loans = [],
  expenses = [],
  susuGroups = [],
  users = [],
  audit = []
} = {}) {
  const userName = (id) => users.find((user) => user.id === id)?.name || "Staff";
  const customerName = (id) => customers.find((item) => item.id === id)?.name || "Customer";
  const branchName = (id) => {
    const group = susuGroups.find((item) => item.id === id) || {};
    return group.name || "";
  };
  const rows = [];
  collections.slice(-12).reverse().forEach((item) => {
    rows.push({
      action: "Savings Collected",
      user: userName(item.userId || item.collectorId),
      detail: customerName(item.customerId),
      date: item.date,
      time: (item.createdAt || "").slice(11, 16),
      branch: branchName(item.groupId || item.susuGroupId)
    });
  });
  customers.slice(-6).reverse().forEach((item) => {
    rows.push({
      action: "Customer Registered",
      user: userName(item.createdBy || item.collectorId),
      detail: item.name,
      date: (item.createdAt || "").slice(0, 10),
      time: (item.createdAt || "").slice(11, 16),
      branch: branchName(item.groupId)
    });
  });
  withdrawals.slice(-6).reverse().forEach((item) => {
    rows.push({
      action: item.status === "Paid" ? "Withdrawal Processed" : "Withdrawal Requested",
      user: userName(item.requestedBy || item.paidBy),
      detail: customerName(item.customerId),
      date: item.date || (item.createdAt || "").slice(0, 10),
      time: (item.createdAt || "").slice(11, 16),
      branch: branchName(item.groupId)
    });
  });
  loans.slice(-6).reverse().forEach((item) => {
    rows.push({
      action: item.status === "Approved" || item.status === "Disbursed" ? "Loan Approved" : "Loan Application",
      user: userName(item.approvedBy || item.createdBy),
      detail: customerName(item.customerId),
      date: item.date || (item.createdAt || "").slice(0, 10),
      time: (item.createdAt || "").slice(11, 16),
      branch: branchName(item.groupId)
    });
  });
  expenses.slice(-4).reverse().forEach((item) => {
    rows.push({
      action: "Expense Recorded",
      user: userName(item.recordedBy),
      detail: item.category || "Expense",
      date: item.date,
      time: (item.createdAt || "").slice(11, 16),
      branch: branchName(item.groupId)
    });
  });
  audit.slice(-6).reverse().forEach((item) => {
    rows.push({
      action: item.action || "Audit",
      user: userName(item.userId),
      detail: item.details || "",
      date: (item.createdAt || "").slice(0, 10),
      time: (item.createdAt || "").slice(11, 16),
      branch: ""
    });
  });
  return rows
    .filter((row) => row.date)
    .sort((a, b) => `${b.date}T${b.time || "00:00"}`.localeCompare(`${a.date}T${a.time || "00:00"}`))
    .slice(0, 12);
}

export function buildCalendarItems({ meetings = [], loans = [], customers = [], date }) {
  const year = Number(date.slice(0, 4));
  const holidays = ghanaHolidays(year).filter(([day]) => day === date).map(([, name]) => ({ type: "holiday", title: name }));
  const todayMeetings = meetings.filter((item) => item.date === date).map((item) => ({
    type: "meeting",
    title: item.title || item.groupName || "Group meeting"
  }));
  const dues = loans.filter((loan) => {
    const due = loan.nextDueDate || loan.dueDate || "";
    return due === date && !["Completed", "Settled", "Rejected"].includes(loan.status);
  }).map((loan) => ({ type: "loan", title: `Loan due · ${loan.customerName || loan.customerId}` }));
  const birthdays = birthdayCustomers(customers, date).map((customer) => ({
    type: "birthday",
    title: `Birthday · ${customer.name}`
  }));
  return [...todayMeetings, ...dues, ...birthdays, ...holidays].slice(0, 8);
}

export function buildDashboardModel({
  state = {},
  user = {},
  date,
  scoped = {},
  online = true,
  appVersion = "3.2.0"
} = {}) {
  const today = date || new Date().toISOString().slice(0, 10);
  const yesterday = shiftIsoDate(today, -1);
  const weekFrom = shiftIsoDate(today, -6);
  const monthFrom = `${today.slice(0, 8)}01`;
  const yearFrom = `${today.slice(0, 4)}-01-01`;
  const customers = scoped.customers || [];
  const collections = scoped.collections || [];
  const loans = scoped.loans || [];
  const transactions = scoped.transactions || [];
  const withdrawals = scoped.withdrawals || state.withdrawalRequests || [];
  const expenses = scoped.expenses || [];
  const groups = scoped.groups || [];
  const susuGroups = scoped.susuGroups || [];
  const users = scoped.users || state.users || [];
  const products = state.savingsProducts || [];
  const meetings = scoped.meetings || state.groupMeetings || [];
  const groupIds = groups.map((group) => group.id).filter(Boolean);
  const prefs = normalizeDashboardPrefs(user);

  const collectionsToday = collectionTotal(collections, (item) => item.date === today);
  const collectionsYesterday = collectionTotal(collections, (item) => item.date === yesterday);
  const withdrawalsToday = transactions
    .filter((tx) => tx.date === today && tx.type === "Withdrawal" && !tx.reversed)
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  const withdrawalsYesterday = transactions
    .filter((tx) => tx.date === yesterday && tx.type === "Withdrawal" && !tx.reversed)
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  const repaymentsToday = transactions
    .filter((tx) => tx.date === today && tx.type === "Loan Repayment" && !tx.reversed)
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  const repaymentsYesterday = transactions
    .filter((tx) => tx.date === yesterday && tx.type === "Loan Repayment" && !tx.reversed)
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  const expensesToday = amountOnDate(expenses, today);
  const expensesYesterday = amountOnDate(expenses, yesterday);
  const portfolio = loanPortfolioSummary(loans);
  const overdueLoans = loans.filter((loan) => {
    const due = loan.nextDueDate || loan.dueDate || "";
    return due && due < today && !["Completed", "Settled", "Rejected"].includes(loan.status);
  });
  const pendingLoans = loans.filter((loan) => ["Pending", "Verified", "Draft"].includes(loan.status));
  const pendingWithdrawals = withdrawals.filter((item) => !["Paid", "Rejected", "Cancelled"].includes(item.status));
  const pendingStaff = (state.users || []).filter((item) => item.pending);
  const pendingExpenses = expenses.filter((item) => item.status === "Pending");
  const pendingGroups = susuGroups.filter((item) => item.status === "Pending" || item.pending);
  const pendingCustomers = customers.filter((item) => item.pending || item.kycStatus === "Pending");
  const pendingCount = pendingLoans.length + pendingWithdrawals.length + pendingStaff.length
    + pendingExpenses.length + pendingGroups.length + pendingCustomers.length;

  const cashPesewas = ledgerAccountPesewas(state.ledgerEntries || [], CASH_ACCOUNT, groupIds);
  const momoPesewas = ledgerAccountPesewas(state.ledgerEntries || [], MOMO_ACCOUNT, groupIds);
  const bankPesewas = ledgerAccountPesewas(state.ledgerEntries || [], BANK_ACCOUNT, groupIds);
  const posPesewas = ledgerAccountPesewas(state.ledgerEntries || [], POS_ACCOUNT, groupIds);
  const agents = staffAgents(users);
  const cashWithAgents = agents.reduce((sum, agent) => {
    const todayCash = collections
      .filter((item) => (item.collectorId === agent.id || item.userId === agent.id) && item.date === today && !item.reversed && (item.paymentMethod || "Cash") === "Cash")
      .reduce((inner, item) => inner + Number(item.amount || 0), 0);
    const handed = (state.handovers || []).some((row) => row.collectorId === agent.id && row.date === today && (row.verifiedAt || row.submittedAt));
    return sum + (handed ? 0 : todayCash);
  }, 0);
  const cashOffice = fromPesewas(cashPesewas);
  const expectedCash = cashOffice + cashWithAgents;
  const actualCash = cashOffice;
  const queue = pendingQueueItems(state);
  const collectorMetrics = user.role === "Collector"
    ? collectorDashboardMetrics(user.id, state, { date: today })
    : null;

  const weeklyCollections = collectionTotal(collections, (item) => inRange(item.date, weekFrom, today));
  const monthlyCollections = collectionTotal(collections, (item) => inRange(item.date, monthFrom, today));
  const annualCollections = collectionTotal(collections, (item) => inRange(item.date, yearFrom, today));
  const totalWithdrawals = transactions.filter((tx) => tx.type === "Withdrawal" && !tx.reversed).reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  const totalExpenses = expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const totalRepayments = transactions.filter((tx) => tx.type === "Loan Repayment" && !tx.reversed).reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  const netCash = annualCollections + totalRepayments - totalWithdrawals - totalExpenses;

  const activeCustomers = customers.filter((item) => item.active !== false && item.memberStatus !== "Dormant");
  const dormantCustomers = customers.filter((item) => item.memberStatus === "Dormant" || item.active === false);
  const expectedToday = customers.reduce((sum, customer) => sum + Number(customer.dailyAmount || 0), 0);
  const collectionRate = expectedToday > 0 ? Math.round((collectionsToday / expectedToday) * 100) : (collectionsToday > 0 ? 100 : 0);
  const recoveryRate = portfolio.disbursed > 0 ? Math.round((totalRepayments / portfolio.disbursed) * 100) : 0;
  const lastMonthCustomers = customers.filter((item) => (item.createdAt || "") < monthFrom).length;
  const growth = lastMonthCustomers ? Math.round(((customers.length - lastMonthCustomers) / lastMonthCustomers) * 100) : (customers.length ? 100 : 0);
  const profitMargin = annualCollections > 0 ? Math.round(((annualCollections - totalExpenses) / annualCollections) * 100) : 0;

  const cards = [
    { id: "customers", label: "Total Customers", value: customers.length, icon: "👥", jump: "customers", change: percentChange(customers.length, Math.max(0, customers.length - customers.filter((item) => (item.createdAt || "").startsWith(today)).length)) },
    { id: "activeCustomers", label: "Active Customers", value: activeCustomers.length, icon: "✅", jump: "customers", filter: "active", change: percentChange(activeCustomers.length, activeCustomers.length) },
    { id: "agents", label: "Total Agents", value: agents.length, icon: "🏃", jump: "users", change: percentChange(agents.length, agents.length) },
    { id: "groups", label: "Susu Groups", value: susuGroups.length, icon: "⭕", jump: "susuGroups", change: percentChange(susuGroups.length, susuGroups.length) },
    { id: "branches", label: "Branches", value: groups.length, icon: "🏢", jump: "groups", change: percentChange(groups.length, groups.length) },
    { id: "todayCollections", label: "Today's Collections", value: collectionsToday, money: true, icon: "💰", jump: "collections", change: percentChange(collectionsToday, collectionsYesterday) },
    { id: "todayWithdrawals", label: "Today's Withdrawals", value: withdrawalsToday, money: true, icon: "🏦", jump: "withdrawals", change: percentChange(withdrawalsToday, withdrawalsYesterday) },
    { id: "todayRepayments", label: "Today's Loan Repayments", value: repaymentsToday, money: true, icon: "↩️", jump: "loanRepayments", change: percentChange(repaymentsToday, repaymentsYesterday) },
    { id: "outstandingLoans", label: "Outstanding Loans", value: portfolio.outstanding, money: true, icon: "📄", jump: "loans", change: percentChange(portfolio.outstanding, portfolio.outstanding) },
    { id: "todayExpenses", label: "Today's Expenses", value: expensesToday, money: true, icon: "🧾", jump: "expenses", change: percentChange(expensesToday, expensesYesterday) },
    { id: "cash", label: "Available Cash", value: cashOffice, money: true, icon: "💵", jump: "handover", change: percentChange(cashOffice, cashOffice) },
    { id: "bank", label: "Bank Balance", value: fromPesewas(bankPesewas), money: true, icon: "🏛️", jump: "accounting", change: percentChange(fromPesewas(bankPesewas), fromPesewas(bankPesewas)) },
    { id: "momo", label: "Mobile Money", value: fromPesewas(momoPesewas), money: true, icon: "📱", jump: "accounting", change: percentChange(fromPesewas(momoPesewas), fromPesewas(momoPesewas)) },
    { id: "pending", label: "Pending Approvals", value: pendingCount, icon: "⏳", jump: "approvals", change: percentChange(pendingCount, pendingCount) }
  ];

  const cardIdsForRole = {
    Collector: ["customers", "todayCollections", "todayWithdrawals", "outstandingLoans", "cash", "pending"],
    Accountant: ["todayCollections", "todayWithdrawals", "todayRepayments", "outstandingLoans", "todayExpenses", "cash", "bank", "momo", "pending"],
    CustomerService: ["customers", "activeCustomers", "pending"],
    Cashier: ["todayCollections", "todayWithdrawals", "cash", "momo", "bank", "pending"]
  };
  const allowedCards = cardIdsForRole[user.role];
  const visibleCards = allowedCards ? cards.filter((card) => allowedCards.includes(card.id)) : cards;

  const pendingTasks = [
    { label: "Pending Loan Applications", count: pendingLoans.length, jump: "loans" },
    { label: "Pending Withdrawals", count: pendingWithdrawals.length, jump: "withdrawals" },
    { label: "Pending Customer Approvals", count: pendingCustomers.length, jump: "customers" },
    { label: "Pending Group Registrations", count: pendingGroups.length, jump: "susuGroups" },
    { label: "Pending Expense Approvals", count: pendingExpenses.length, jump: "expenses" },
    { label: "Pending User Approvals", count: pendingStaff.length, jump: "approvals" }
  ].filter((item) => item.count > 0);

  const agentRows = agents.map((agent) => {
    const perf = agentPerformance(agent, { collections, customers, susuGroups, date: today });
    return {
      ...perf,
      name: agent.name,
      commission: computeAgentCommission(agent, perf.collected)
    };
  }).sort((a, b) => b.collected - a.collected);

  const branchRows = groups.map((group) => {
    const groupCustomers = customers.filter((item) => item.groupId === group.id);
    const collected = collectionTotal(collections, (item) => item.groupId === group.id && item.date === today);
    const groupLoans = loans.filter((item) => item.groupId === group.id);
    const recovered = transactions
      .filter((tx) => tx.type === "Loan Repayment" && !tx.reversed && groupCustomers.some((customer) => customer.id === tx.customerId))
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
    return {
      id: group.id,
      name: group.name,
      collections: collected,
      activeCustomers: groupCustomers.filter((item) => item.active !== false).length,
      loanRecovery: recovered,
      revenue: collected
    };
  }).sort((a, b) => b.collections - a.collections);

  const quickActions = [
    { id: "register", label: "Register Customer", jump: "customers", roles: ["SystemOwner", "KBA", "Admin", "Collector", "CustomerService", "FieldSupervisor"] },
    { id: "collect", label: "Collect Savings", jump: "collections", roles: ["SystemOwner", "KBA", "Admin", "Collector", "Cashier"] },
    { id: "group", label: "Create Group", jump: "susuGroups", roles: ["SystemOwner", "KBA", "Admin", "GroupCoordinator", "OperationsManager"] },
    { id: "withdraw", label: "Record Withdrawal", jump: "withdrawals", roles: ["SystemOwner", "KBA", "Admin", "Collector", "Cashier", "CustomerService"] },
    { id: "expense", label: "Record Expense", jump: "expenses", roles: ["SystemOwner", "KBA", "Admin", "Accountant", "Cashier"] },
    { id: "loan", label: "Apply Loan", jump: "loans", roles: ["SystemOwner", "KBA", "Admin", "Collector", "CustomerService"] },
    { id: "approveLoan", label: "Approve Loan", jump: "loans", roles: ["SystemOwner", "KBA", "Admin", "Accountant", "ManagingDirector"] },
    { id: "receipt", label: "Print Receipt", jump: "logs", roles: ["*"] },
    { id: "reports", label: "View Reports", jump: "reports", roles: ["SystemOwner", "KBA", "Admin", "Accountant", "ManagingDirector", "Auditor", "OperationsManager"] },
    { id: "search", label: "Search Customer", jump: "customers", roles: ["*"] }
  ].filter((action) => action.roles.includes("*") || action.roles.includes(user.role));

  return {
    date: today,
    role: user.role,
    prefs,
    widgets: widgetsForRole(user.role, prefs),
    cards: visibleCards,
    financial: {
      today: collectionsToday,
      weekly: weeklyCollections,
      monthly: monthlyCollections,
      annual: annualCollections,
      loansIssued: portfolio.disbursed,
      repayments: totalRepayments,
      outstanding: portfolio.outstanding,
      withdrawals: totalWithdrawals,
      expenses: totalExpenses,
      netCash
    },
    trends: {
      daily: dailyCollectionTrend(collections, today, 30),
      weekly: weeklyCollectionTrend(collections, today, 8),
      monthly: monthlyRevenueTrend(collections, today, 6),
      products: productDistribution(collections, products)
    },
    loanPortfolio: {
      active: portfolio.active,
      completed: loans.filter((loan) => ["Completed", "Settled"].includes(loan.status)).length,
      overdue: overdueLoans.length,
      pending: pendingLoans.length,
      outstanding: portfolio.outstanding
    },
    branchRows,
    agentRows: agentRows.slice(0, 6),
    activities: buildActivityFeed({
      collections, customers, withdrawals, loans, expenses, susuGroups: groups, users, audit: state.audit || []
    }),
    pendingTasks,
    calendar: buildCalendarItems({ meetings, loans, customers, date: today }),
    kpis: {
      collectionRate,
      recoveryRate,
      activeCustomers: activeCustomers.length,
      dormantCustomers: dormantCustomers.length,
      averageDaily: +(monthlyCollections / Math.max(1, Number(today.slice(8, 10)))).toFixed(2),
      branchRank: branchRows[0]?.name || "—",
      agentRank: agentRows[0]?.name || "—",
      growth,
      profitMargin
    },
    cash: {
      office: cashOffice,
      agents: cashWithAgents,
      bank: fromPesewas(bankPesewas),
      momo: fromPesewas(momoPesewas),
      pos: fromPesewas(posPesewas),
      expected: expectedCash,
      actual: actualCash,
      difference: +(actualCash - expectedCash).toFixed(2)
    },
    system: {
      database: "Local ready",
      internet: online ? "Online" : "Offline",
      sync: state.settings?.lastSyncedAt || "Never",
      backup: state.settings?.lastBackupAt || "Not recorded",
      version: appVersion,
      pendingUploads: queue.length
    },
    collector: collectorMetrics ? {
      ...collectorMetrics,
      commission: computeAgentCommission(user, collectorMetrics.collectionsToday)
    } : null,
    cso: {
      newCustomers: customers.filter((item) => (item.createdAt || "").startsWith(today)).length,
      pendingVerifications: pendingCustomers.length,
      requests: pendingWithdrawals.length + pendingLoans.length
    },
    quickActions,
    offline: {
      online,
      pending: queue.length,
      lastSync: state.settings?.lastSyncedAt || ""
    }
  };
}
