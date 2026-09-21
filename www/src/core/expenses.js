/**
 * Operational expense tracking and reporting.
 */
import { toPesewas, fromPesewas, sumPesewas } from "./money.js";

export const EXPENSE_CATEGORIES = [
  "Fuel",
  "Stationery",
  "Salaries",
  "Meals",
  "Transport",
  "Utilities",
  "Office Rent",
  "Repairs",
  "MoMo Charges",
  "Communication",
  "Training",
  "Security",
  "Other"
];

export function validateExpense(data) {
  if (!String(data.category || "").trim()) return "Category is required";
  if (Number(data.amount || 0) <= 0) return "Amount must be greater than zero";
  if (!data.date) return "Date is required";
  return "";
}

export function createExpense(state, data, uid) {
  const error = validateExpense(data);
  if (error) return { error };
  const expense = {
    id: uid("exp"),
    date: data.date,
    category: EXPENSE_CATEGORIES.includes(data.category) ? data.category : "Other",
    amount: Number(data.amount),
    amountPesewas: toPesewas(data.amount),
    branchId: data.branchId || data.groupId || "",
    groupId: data.groupId || "",
    vendor: String(data.vendor || "").trim(),
    paymentMethod: data.paymentMethod || "Cash",
    reference: String(data.reference || "").trim(),
    notes: String(data.notes || "").trim(),
    recordedBy: data.recordedBy || "",
    status: data.status || "Posted",
    createdAt: new Date().toISOString()
  };
  state.expenses = state.expenses || [];
  state.expenses.push(expense);
  return { expense };
}

export function expenseTotals(expenses = [], { from = "", to = "", branchId = "", category = "" } = {}) {
  const rows = expenses.filter((item) => {
    if (item.status === "Void") return false;
    if (from && item.date < from) return false;
    if (to && item.date > to) return false;
    if (branchId && item.branchId !== branchId && item.groupId !== branchId) return false;
    if (category && item.category !== category) return false;
    return true;
  });
  const byCategory = {};
  rows.forEach((item) => {
    byCategory[item.category] = (byCategory[item.category] || 0) + Number(item.amount || 0);
  });
  return {
    count: rows.length,
    total: fromPesewas(sumPesewas(rows.map((item) => item.amountPesewas ?? toPesewas(item.amount)))),
    byCategory,
    rows
  };
}
