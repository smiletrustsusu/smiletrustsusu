/**
 * Everyday personal savings — daily, weekly, and flexible schedules.
 */
import { toPesewas, fromPesewas } from "./money.js";
import { COLLECTION_TYPES } from "./savings-products.js";

export function isPersonalCustomer(customer) {
  return Boolean(customer?.savingsProductId) || customer?.accountType === "personal" || customer?.accountType === "both";
}

export function expectedContributionPesewas(customer, product) {
  if (product?.defaultAmountPesewas) return product.defaultAmountPesewas;
  return toPesewas(Number(customer?.dailyAmount || 0));
}

export function lastPaymentDate(customerId, collections = []) {
  const paid = collections
    .filter((item) => item.customerId === customerId && !item.reversed && Number(item.amount) > 0 && !item.susuGroupId)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return paid[0]?.date || "";
}

export function contributionStreak(customerId, collections = [], { frequency = "Daily" } = {}) {
  const dates = [...new Set(
    collections
      .filter((item) => item.customerId === customerId && !item.reversed && Number(item.amount) > 0 && !item.susuGroupId)
      .map((item) => item.date)
  )].sort((a, b) => b.localeCompare(a));
  if (!dates.length) return 0;
  let streak = 1;
  const step = frequency === "Weekly" ? 7 : 1;
  for (let i = 1; i < dates.length; i += 1) {
    const prev = new Date(dates[i - 1]);
    const curr = new Date(dates[i]);
    const diffDays = Math.round((prev - curr) / 86400000);
    if (diffDays <= step) streak += 1;
    else break;
  }
  return streak;
}

export function missedPeriods(customer, product, collections = [], { asOf = "" } = {}) {
  if (!customer?.savingsProductId && customer?.accountType !== "personal" && customer?.accountType !== "both") {
    return { missedDays: 0, missedWeeks: 0, overdue: false };
  }
  const frequency = product?.frequency || "Daily";
  if (frequency === "Flexible") return { missedDays: 0, missedWeeks: 0, overdue: false };
  const last = lastPaymentDate(customer.id, collections);
  const today = asOf || new Date().toISOString().slice(0, 10);
  if (!last) {
    const created = (customer.createdAt || today).slice(0, 10);
    const daysSince = Math.max(0, Math.floor((new Date(today) - new Date(created)) / 86400000));
    if (frequency === "Weekly") return { missedDays: 0, missedWeeks: Math.floor(daysSince / 7), overdue: daysSince >= 7 };
    return { missedDays: daysSince, missedWeeks: 0, overdue: daysSince >= 1 };
  }
  const daysSince = Math.max(0, Math.floor((new Date(today) - new Date(last)) / 86400000));
  if (frequency === "Weekly") {
    const missedWeeks = Math.max(0, Math.floor(daysSince / 7) - 1);
    return { missedDays: 0, missedWeeks, overdue: daysSince > 7 };
  }
  const missedDays = Math.max(0, daysSince - 1);
  return { missedDays, missedWeeks: 0, overdue: daysSince > 1 };
}

export function nextExpectedDate(customer, product, collections = []) {
  const frequency = product?.frequency || "Daily";
  if (frequency === "Flexible") return "";
  const last = lastPaymentDate(customer.id, collections) || (customer.createdAt || "").slice(0, 10);
  if (!last) return new Date().toISOString().slice(0, 10);
  const next = new Date(last);
  if (frequency === "Weekly") next.setDate(next.getDate() + 7);
  else next.setDate(next.getDate() + 1);
  return next.toISOString().slice(0, 10);
}

export function personalSavingsSummary(customer, product, collections = []) {
  const missed = missedPeriods(customer, product, collections);
  const streak = contributionStreak(customer.id, collections, { frequency: product?.frequency });
  const last = lastPaymentDate(customer.id, collections);
  return {
    customerId: customer.id,
    productId: product?.id || customer.savingsProductId || "",
    frequency: product?.frequency || "Daily",
    expectedAmount: fromPesewas(expectedContributionPesewas(customer, product)),
    lastPayment: last,
    nextExpected: nextExpectedDate(customer, product, collections),
    streak,
    ...missed,
    collectionType: COLLECTION_TYPES.PERSONAL
  };
}

export function filterPersonalCustomers(customers = [], productId = "") {
  return customers.filter((customer) => {
    if (customer.active === false) return false;
    if (productId) return customer.savingsProductId === productId;
    return isPersonalCustomer(customer);
  });
}
