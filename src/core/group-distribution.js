import { toPesewas, fromPesewas, sumPesewas } from "./money.js";
import { activeMemberships } from "./susu-groups.js";

export const DISTRIBUTION_STATUSES = ["Pending", "Approved", "Paid", "Rejected"];

export function buildDistributionRecord({
  id,
  susuGroupId,
  cycleLabel,
  createdBy,
  members = [],
  totalPesewas = 0
}) {
  return {
    id,
    susuGroupId,
    cycleLabel,
    totalPesewas,
    total: fromPesewas(totalPesewas),
    memberLines: members,
    status: "Pending",
    createdBy,
    approvedBy: "",
    paidBy: "",
    createdAt: new Date().toISOString(),
    approvedAt: "",
    paidAt: ""
  };
}

export function computeCyclePayouts(group, { customers = [], collections = [], loans = [], cycleStart = "", cycleEnd = "" } = {}) {
  const memberIds = activeMemberships(group).map((item) => item.customerId);
  const memberLines = memberIds.map((customerId) => {
    const customer = customers.find((item) => item.id === customerId);
    const contributed = collections
      .filter((item) =>
        item.susuGroupId === group.id
        && item.customerId === customerId
        && !item.reversed
        && (!cycleStart || item.date >= cycleStart)
        && (!cycleEnd || item.date <= cycleEnd)
      )
      .reduce((sum, item) => sum + toPesewas(item.amount), 0);
    const loanBalance = loans
      .filter((loan) => loan.customerId === customerId && loan.status !== "Completed")
      .reduce((sum, loan) => sum + Math.max(0, toPesewas(loan.totalDue) - toPesewas(loan.amountPaid)), 0);
    const netPesewas = Math.max(0, contributed - loanBalance);
    return {
      customerId,
      customerName: customer?.name || "",
      accountNo: customer?.accountNo || "",
      contributedPesewas: contributed,
      loanBalancePesewas: loanBalance,
      payoutPesewas: netPesewas
    };
  });
  const totalPesewas = sumPesewas(memberLines.map((line) => line.payoutPesewas));
  return { memberLines, totalPesewas, total: fromPesewas(totalPesewas) };
}

export function canApproveDistribution(user) {
  return user?.role === "SystemOwner" || user?.role === "KBA" || user?.role === "Admin";
}

export function approveDistribution(distribution, approver) {
  if (!distribution || distribution.status !== "Pending") return { ok: false, error: "Distribution not pending" };
  if (approver.id === distribution.createdBy) return { ok: false, error: "Cannot approve your own distribution" };
  distribution.status = "Approved";
  distribution.approvedBy = approver.id;
  distribution.approvedAt = new Date().toISOString();
  return { ok: true, distribution };
}

export function markDistributionPaid(distribution, payer) {
  if (!distribution || distribution.status !== "Approved") return { ok: false, error: "Distribution must be approved first" };
  distribution.status = "Paid";
  distribution.paidBy = payer.id;
  distribution.paidAt = new Date().toISOString();
  return { ok: true, distribution };
}
