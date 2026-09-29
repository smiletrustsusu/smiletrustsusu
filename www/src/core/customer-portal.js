/**
 * Customer / member self-service portal.
 */
import { personalSavingsBalance } from "./savings-products.js";
import { outstandingLoanBalance } from "./loans-workflow.js";
import { normalizeGhanaPhone } from "./ghana.js";

function emptyState() {
  return {
    customers: [],
    collections: [],
    transactions: [],
    loans: [],
    notifications: [],
    withdrawalRequests: [],
    ledgerEntries: []
  };
}

function safeState(state) {
  return state && typeof state === "object" ? state : emptyState();
}

/** Normalize account / phone / member id for portal login lookup. */
export function normalizePortalLoginId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

export function findPortalCustomer(state, accountNo) {
  const st = safeState(state);
  const needle = normalizePortalLoginId(accountNo);
  if (!needle) return null;
  const phoneNeedle = normalizeGhanaPhone(accountNo);
  return (st.customers || []).find((customer) => {
    const account = normalizePortalLoginId(customer.accountNo);
    const number = normalizePortalLoginId(customer.customerNumber);
    const phone = normalizeGhanaPhone(customer.phone);
    return account === needle
      || number === needle
      || (phone && phoneNeedle && phone === phoneNeedle)
      || normalizePortalLoginId(customer.phone) === needle;
  }) || null;
}

/** Default member portal PIN = last 4 digits of Ghana phone. */
export function portalPinFromPhone(phone) {
  const digits = normalizeGhanaPhone(phone) || String(phone || "").replace(/\D/g, "");
  return digits.slice(-4) || "0000";
}

/**
 * Ensure registration sets login credentials: account number + last-4 phone PIN.
 */
export function ensureDefaultPortalCredentials(customer, { now = () => new Date().toISOString(), force = false } = {}) {
  if (!customer) return customer;
  const pin = portalPinFromPhone(customer.phone);
  if (force || !customer.portalPin) {
    customer.portalPin = pin;
    customer.portalPinSetAt = now();
    customer.portalPinSource = "phone_last4";
  }
  return customer;
}

export function verifyPortalPin(customer, pin) {
  const entered = String(pin || "").trim();
  if (!customer || !entered) return false;
  const phonePin = portalPinFromPhone(customer.phone);
  if (customer.portalPin && customer.portalPin === entered) return true;
  // Always allow last-4 phone as the published default login PIN.
  if (entered === phonePin) return true;
  return false;
}

export function setPortalPin(customer, pin) {
  const next = String(pin || "").trim();
  if (!/^\d{4,6}$/.test(next)) return { error: "PIN must be 4–6 digits" };
  customer.portalPin = next;
  customer.portalPinSetAt = new Date().toISOString();
  customer.portalPinSource = "manual";
  return { customer };
}

/** Transaction ledger-style balance (matches staff customerBalance for Susu Deposit path). */
export function portalAccountBalance(state, customerId) {
  const st = safeState(state);
  const ledger = st.ledgerEntries || [];
  if (ledger.some((entry) => entry.customerId === customerId)) {
    return ledger
      .filter((entry) => entry.customerId === customerId && !entry.reversed)
      .reduce((sum, entry) => {
        const amt = Number(entry.amount || 0);
        const direction = entry.direction || entry.side || entry.type;
        if (direction === "credit") return sum + amt;
        if (direction === "debit") return sum - amt;
        return sum + amt;
      }, 0);
  }
  const deposits = (st.transactions || [])
    .filter((tx) => tx.customerId === customerId && tx.type === "Susu Deposit" && !tx.reversed)
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  const withdrawals = (st.transactions || [])
    .filter((tx) => tx.customerId === customerId && tx.type === "Withdrawal" && !tx.reversed)
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  const collectionTotal = (st.collections || [])
    .filter((item) => item.customerId === customerId && !item.reversed)
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  // Prefer transaction ledger when present; otherwise fall back to collections total.
  if (deposits || withdrawals) return deposits - withdrawals;
  return collectionTotal - withdrawals;
}

export function portalDashboard(state, customer) {
  if (!customer) return null;
  const st = safeState(state);
  const collections = (st.collections || []).filter((item) => item.customerId === customer.id && !item.reversed);
  const transactions = (st.transactions || []).filter((item) => item.customerId === customer.id && !item.reversed);
  const loans = (st.loans || []).filter((item) => item.customerId === customer.id);
  const personal = personalSavingsBalance(customer.id, {
    collections,
    transactions,
    ledgerEntries: st.ledgerEntries || []
  });
  const accountBalance = portalAccountBalance(st, customer.id);
  const loanBalance = loans.reduce((sum, loan) => sum + outstandingLoanBalance(loan), 0);
  const withdrawals = (st.withdrawalRequests || []).filter((item) => item.customerId === customer.id);
  const notifications = (st.notifications || []).filter((item) => item.customerId === customer.id).slice(-20).reverse();
  const contributionTotal = collections.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  return {
    customer,
    savingsBalance: accountBalance || personal,
    personalBalance: personal,
    contributionTotal,
    accountBalance,
    loanBalance,
    collections: collections.slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 50),
    transactions: transactions.slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 50),
    loans,
    withdrawals,
    notifications
  };
}

export function portalStatement(state, customer, { from = "", to = "" } = {}) {
  const st = safeState(state);
  const rows = (st.transactions || [])
    .filter((tx) => tx.customerId === customer.id && !tx.reversed)
    .filter((tx) => (!from || tx.date >= from) && (!to || tx.date <= to))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  let running = 0;
  if (rows.length) {
    return rows.map((tx) => {
      const amount = Number(tx.amount || 0);
      if (tx.type === "Susu Deposit") running += amount;
      else if (tx.type === "Withdrawal") running -= amount;
      return { ...tx, runningBalance: +running.toFixed(2) };
    });
  }
  // Fall back to collections when no ledger transactions yet.
  const collections = (st.collections || [])
    .filter((item) => item.customerId === customer.id && !item.reversed)
    .filter((item) => (!from || item.date >= from) && (!to || item.date <= to))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  running = 0;
  return collections.map((item) => {
    const amount = Number(item.amount || 0);
    running += amount;
    return {
      id: item.id,
      date: item.date,
      type: "Collection",
      amount,
      runningBalance: +running.toFixed(2)
    };
  });
}

export function canCustomerRequestWithdrawal(customer) {
  return customer && customer.active !== false && customer.memberStatus !== "Closed";
}
