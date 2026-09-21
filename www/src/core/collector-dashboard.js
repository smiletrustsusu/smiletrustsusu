/**
 * Collector dashboard metrics — today's targets, cash/MoMo split, missed customers.
 */
import { toPesewas, fromPesewas, sumPesewas } from "./money.js";
import { computeGroupPerformance } from "./susu-groups.js";
import { personalSavingsSummary, filterPersonalCustomers } from "./personal-savings.js";
import { COLLECTION_TYPES } from "./savings-products.js";

export function todayCollectionsForCollector(collectorId, collections = [], date = "") {
  return collections.filter((item) =>
    item.userId === collectorId
    && !item.reversed
    && (!date || item.date === date)
  );
}

export function channelSplit(collections = []) {
  const buckets = { Cash: 0, "Mobile Money": 0, Bank: 0, Card: 0 };
  collections.forEach((item) => {
    const method = item.paymentMethod || "Cash";
    const key = /mobile money|mtn|telecel|airteltigo|momo/i.test(method)
      ? "Mobile Money"
      : method === "Bank Transfer"
        ? "Bank"
        : method === "POS/Card"
          ? "Card"
          : "Cash";
    buckets[key] = (buckets[key] || 0) + toPesewas(item.amount);
  });
  return Object.fromEntries(Object.entries(buckets).map(([key, pesewas]) => [key, fromPesewas(pesewas)]));
}

export function missedCustomersToday(collectorId, {
  customers = [],
  collections = [],
  susuGroups = [],
  savingsProducts = [],
  date = ""
} = {}) {
  const assigned = customers.filter((c) => c.collectorId === collectorId && c.active !== false);
  const dayCollections = todayCollectionsForCollector(collectorId, collections, date);
  const paidIds = new Set(dayCollections.filter((c) => Number(c.amount) > 0).map((c) => c.customerId));
  const missed = [];

  assigned.forEach((customer) => {
    if (customer.savingsProductId || customer.accountType === "personal" || customer.accountType === "both") {
      const product = savingsProducts.find((p) => p.id === customer.savingsProductId);
      const summary = personalSavingsSummary(customer, product, collections);
      if (summary.overdue && !paidIds.has(customer.id)) {
        missed.push({ customer, reason: "Personal savings overdue", type: COLLECTION_TYPES.PERSONAL, ...summary });
      } else if (!paidIds.has(customer.id) && product?.frequency === "Daily") {
        missed.push({ customer, reason: "No payment today", type: COLLECTION_TYPES.PERSONAL, ...summary });
      }
    }
  });

  susuGroups.filter((g) => g.collectorId === collectorId && g.active !== false).forEach((group) => {
    const perf = computeGroupPerformance(group, { collections, customers, date });
    if (perf.missedMembers > 0) {
      missed.push({ group, reason: `${perf.missedMembers} member(s) missed`, type: COLLECTION_TYPES.SUSU_GROUP, ...perf });
    }
  });

  return missed;
}

export function collectorDashboardMetrics(collectorId, state, { date = "" } = {}) {
  const customers = state.customers || [];
  const collections = state.collections || [];
  const susuGroups = state.susuGroups || [];
  const savingsProducts = state.savingsProducts || [];
  const handovers = state.handovers || [];
  const today = date || new Date().toISOString().slice(0, 10);

  const todayCols = todayCollectionsForCollector(collectorId, collections, today);
  const channels = channelSplit(todayCols);
  const totalPesewas = sumPesewas(todayCols.map((c) => toPesewas(c.amount)));
  const cashPesewas = sumPesewas(todayCols.filter((c) => (c.paymentMethod || "Cash") === "Cash").map((c) => toPesewas(c.amount)));
  const assignedCustomers = customers.filter((c) => c.collectorId === collectorId && c.active !== false);
  const assignedGroups = susuGroups.filter((g) => g.collectorId === collectorId && g.active !== false);
  const personalMembers = filterPersonalCustomers(assignedCustomers);
  const missed = missedCustomersToday(collectorId, { customers, collections, susuGroups, savingsProducts, date: today });

  let expectedPersonalPesewas = 0;
  personalMembers.forEach((customer) => {
    const product = savingsProducts.find((p) => p.id === customer.savingsProductId);
    expectedPersonalPesewas += toPesewas(Number(customer.dailyAmount || 0)) || Number(product?.defaultAmountPesewas || 0);
  });

  let expectedGroupPesewas = 0;
  assignedGroups.forEach((group) => {
    const perf = computeGroupPerformance(group, { collections, customers, date: today });
    expectedGroupPesewas += perf.expectedPesewas || 0;
  });

  const handover = handovers.find((h) => h.collectorId === collectorId && h.date === today);
  const handoverStatus = handover?.verifiedAt ? "Verified" : handover?.submittedAt ? "Submitted" : "Pending";

  return {
    date: today,
    assignedCustomers: assignedCustomers.length,
    assignedGroups: assignedGroups.length,
    personalMembers: personalMembers.length,
    collectionsToday: fromPesewas(totalPesewas),
    cashToday: channels.Cash || 0,
    momoToday: channels["Mobile Money"] || 0,
    expectedCash: fromPesewas(cashPesewas),
    expectedPersonal: fromPesewas(expectedPersonalPesewas),
    expectedGroup: fromPesewas(expectedGroupPesewas),
    expectedTotal: fromPesewas(expectedPersonalPesewas + expectedGroupPesewas),
    missedCount: missed.length,
    missed,
    handoverStatus,
    handover,
    progressPercent: expectedPersonalPesewas + expectedGroupPesewas
      ? Math.min(100, Math.round((totalPesewas / (expectedPersonalPesewas + expectedGroupPesewas)) * 100))
      : (totalPesewas > 0 ? 100 : 0)
  };
}

export function managerDashboardSplit(state, { date = "" } = {}) {
  const today = date || new Date().toISOString().slice(0, 10);
  const collections = (state.collections || []).filter((c) => c.date === today && !c.reversed);
  const personalPesewas = sumPesewas(collections.filter((c) => !c.susuGroupId).map((c) => toPesewas(c.amount)));
  const groupPesewas = sumPesewas(collections.filter((c) => c.susuGroupId).map((c) => toPesewas(c.amount)));
  const channels = channelSplit(collections);
  return {
    personalToday: fromPesewas(personalPesewas),
    groupToday: fromPesewas(groupPesewas),
    totalToday: fromPesewas(personalPesewas + groupPesewas),
    cashToday: channels.Cash || 0,
    momoToday: channels["Mobile Money"] || 0,
    bankToday: channels.Bank || 0,
    cardToday: channels.Card || 0
  };
}
