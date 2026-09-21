/**
 * Tax calculation and accounting only.
 * Does not file returns or submit to GRA / any government system.
 */
import { toPesewas, fromPesewas } from "./money.js";
import { canAction } from "./rbac.js";

export const TAX_CATEGORIES = ["VAT", "Withholding Tax", "Service Tax", "Other"];
export const TAX_METHODS = ["Percentage", "Fixed Amount"];
export const TAX_STATUSES = ["Draft", "Active", "Inactive"];

export function canManageTaxes(user) {
  return canAction(user, "Settings.Edit") || canAction(user, "Accounting.Edit");
}

export function activeTaxFor({
  taxes = [],
  date = "",
  productId = "",
  service = "",
  branchId = "",
  category = ""
} = {}) {
  const day = date || new Date().toISOString().slice(0, 10);
  return taxes.find((tax) => {
    if (tax.status !== "Active") return false;
    if (tax.effectiveDate && day < tax.effectiveDate) return false;
    if (tax.expiryDate && day > tax.expiryDate) return false;
    if (category && tax.category && tax.category !== category) return false;
    if (Array.isArray(tax.productIds) && tax.productIds.length && productId && !tax.productIds.includes(productId)) return false;
    if (Array.isArray(tax.services) && tax.services.length && service && !tax.services.includes(service)) return false;
    if (tax.branchId && branchId && tax.branchId !== branchId) return false;
    return true;
  }) || null;
}

export function calculateTax(baseAmount, tax) {
  if (!tax) {
    return { taxAmount: 0, taxPesewas: 0, taxId: "", taxCode: "", rate: 0, method: "" };
  }
  const basePesewas = toPesewas(baseAmount);
  let taxPesewas = 0;
  if (tax.method === "Fixed Amount") taxPesewas = toPesewas(tax.rate || 0);
  else taxPesewas = Math.round(basePesewas * Number(tax.rate || 0) / 100);
  return {
    taxAmount: fromPesewas(taxPesewas),
    taxPesewas,
    taxId: tax.id || "",
    taxCode: tax.code || "",
    taxName: tax.name || "",
    rate: Number(tax.rate || 0),
    method: tax.method || "Percentage",
    liabilityAccount: tax.liabilityAccount || "2200",
    incomeAccount: tax.incomeAccount || "4010"
  };
}

export function applyConfiguredTax(baseAmount, {
  taxes = [],
  date = "",
  productId = "",
  service = "",
  branchId = "",
  category = ""
} = {}) {
  const tax = activeTaxFor({ taxes, date, productId, service, branchId, category });
  return calculateTax(baseAmount, tax);
}

export function upsertTaxDefinition(state, data, user, uid) {
  if (!canManageTaxes(user)) return { error: "You cannot change tax settings" };
  if (!String(data.code || "").trim() || !String(data.name || "").trim()) return { error: "Tax code and name are required" };
  if (!TAX_METHODS.includes(data.method || "Percentage")) return { error: "Unsupported tax method" };
  state.taxDefinitions = state.taxDefinitions || [];
  const existing = state.taxDefinitions.find((item) => item.id === data.id || item.code === data.code);
  const next = {
    id: existing?.id || uid("tax"),
    code: String(data.code).trim().toUpperCase(),
    name: String(data.name).trim(),
    description: String(data.description || "").trim(),
    category: TAX_CATEGORIES.includes(data.category) ? data.category : "Other",
    method: data.method || "Percentage",
    rate: Number(data.rate || 0),
    effectiveDate: data.effectiveDate || new Date().toISOString().slice(0, 10),
    expiryDate: data.expiryDate || "",
    status: TAX_STATUSES.includes(data.status) ? data.status : "Draft",
    productIds: data.productIds || [],
    services: data.services || [],
    branchId: data.branchId || "",
    liabilityAccount: data.liabilityAccount || "2200",
    incomeAccount: data.incomeAccount || "4010",
    version: Number(existing?.version || 0) + 1,
    updatedAt: new Date().toISOString(),
    updatedBy: user?.id || ""
  };
  const previous = existing ? { ...existing } : null;
  if (existing) Object.assign(existing, next);
  else state.taxDefinitions.push(next);
  state.taxConfigHistory = state.taxConfigHistory || [];
  state.taxConfigHistory.push({
    id: uid("taxh"),
    taxId: next.id,
    previous,
    next: { ...next },
    userId: user?.id || "",
    role: user?.role || "",
    reason: String(data.reason || "").trim(),
    createdAt: new Date().toISOString()
  });
  return { tax: existing || next, previous };
}

export function taxSummary(transactions = [], { from = "", to = "", branchId = "", productId = "" } = {}) {
  const rows = transactions.filter((item) => {
    if (!Number(item.taxAmount || 0)) return false;
    if (from && (item.date || "") < from) return false;
    if (to && (item.date || "") > to) return false;
    if (branchId && item.branchId !== branchId && item.groupId !== branchId) return false;
    if (productId && item.productId !== productId) return false;
    return true;
  });
  const byCode = {};
  rows.forEach((item) => {
    const code = item.taxCode || "TAX";
    byCode[code] = (byCode[code] || 0) + Number(item.taxAmount || 0);
  });
  return {
    count: rows.length,
    total: +rows.reduce((sum, item) => sum + Number(item.taxAmount || 0), 0).toFixed(2),
    byCode,
    rows
  };
}
