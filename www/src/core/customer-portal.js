/**
 * Customer / member self-service portal.
 */
import { personalSavingsBalance } from "./savings-products.js";
import { outstandingLoanBalance } from "./loans-workflow.js";

export function findPortalCustomer(state, accountNo) {
  const needle = String(accountNo || "").trim().toLowerCase();
  if (!needle) return null;
  return (state.customers || []).find((customer) =>
    String(customer.accountNo || "").toLowerCase() === needle
    || String(customer.customerNumber || "").toLowerCase() === needle
    || String(customer.phone || "").replace(/\s/g, "") === needle.replace(/\s/g, "")
  ) || null;
}

export function portalDashboard(state, customer) {
  if (!customer) return null;
  const collections = (state.collections || []).filter((item) => item.customerId === customer.id && !item.reversed);
  const transactions = (state.transactions || []).filter((item) => item.customerId === customer.id && !item.reversed);
  const loans = (state.loans || []).filter((item) => item.customerId === customer.id);
  const savings = personalSavingsBalance(customer.id, { collections, transactions, ledgerEntries: state.ledgerEntries || [] });
  const loanBalance = loans.reduce((sum, loan) => sum + outstandingLoanBalance(loan), 0);
  const withdrawals = (state.withdrawalRequests || []).filter((item) => item.customerId === customer.id);
  const notifications = (state.notifications || []).filter((item) => item.customerId === customer.id).slice(-20).reverse();
  return {
    customer,
    savingsBalance: savings,
    loanBalance,
    collections: collections.slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 50),
    transactions: transactions.slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 50),
    loans,
    withdrawals,
    notifications
  };
}

/** Default member portal PIN = last 4 digits of Ghana phone. */
export function portalPinFromPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.slice(-4) || "0000";
}

/**
 * Ensure registration sets login credentials: account number + last-4 phone PIN.
 */
export function ensureDefaultPortalCredentials(customer, { now = () => new Date().toISOString() } = {}) {
  if (!customer) return customer;
  const pin = portalPinFromPhone(customer.phone);
  if (!customer.portalPin) {
    customer.portalPin = pin;
    customer.portalPinSetAt = now();
    customer.portalPinSource = "phone_last4";
  }
  return customer;
}

export function verifyPortalPin(customer, pin) {
  const entered = String(pin || "").trim();
  if (!customer || !entered) return false;
  if (customer.portalPin) return customer.portalPin === entered;
  return entered === portalPinFromPhone(customer.phone);
}

export function setPortalPin(customer, pin) {
  const next = String(pin || "").trim();
  if (next.length < 4) return { error: "PIN must be at least 4 digits" };
  customer.portalPin = next;
  customer.portalPinSetAt = new Date().toISOString();
  customer.portalPinSource = "manual";
  return { customer };
}

export function portalStatement(state, customer, { from = "", to = "" } = {}) {
  const rows = (state.transactions || [])
    .filter((tx) => tx.customerId === customer.id && !tx.reversed)
    .filter((tx) => (!from || tx.date >= from) && (!to || tx.date <= to))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  let running = 0;
  return rows.map((tx) => {
    const amount = Number(tx.amount || 0);
    if (tx.type === "Susu Deposit") running += amount;
    else if (tx.type === "Withdrawal") running -= amount;
    return { ...tx, runningBalance: +running.toFixed(2) };
  });
}

export function canCustomerRequestWithdrawal(customer) {
  return customer && customer.active !== false && customer.memberStatus !== "Closed";
}
