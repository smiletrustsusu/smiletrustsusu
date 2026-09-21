/**
 * Lightweight filtering helpers for list/query operations.
 */

export function applyFilters(rows = [], filters = {}, { fieldMap = {} } = {}) {
  let out = Array.isArray(rows) ? rows.slice() : [];
  const entries = Object.entries(filters || {}).filter(([key, value]) => {
    if (value == null || value === "") return false;
    if (["page", "pageSize", "limit", "offset", "sort", "order", "q", "search"].includes(key)) return false;
    return true;
  });
  for (const [key, value] of entries) {
    const field = fieldMap[key] || key;
    const needle = String(value).toLowerCase();
    out = out.filter((row) => {
      const cell = row?.[field];
      if (cell == null) return false;
      if (typeof cell === "boolean") return String(cell) === String(value);
      if (typeof cell === "number") return Number(cell) === Number(value);
      return String(cell).toLowerCase().includes(needle);
    });
  }
  const q = String(filters.q || filters.search || "").trim().toLowerCase();
  if (q) {
    out = out.filter((row) => JSON.stringify(row).toLowerCase().includes(q));
  }
  return out;
}

export function filterByBranch(rows = [], branchId = "", field = "branchId") {
  if (!branchId) return rows.slice();
  return rows.filter((row) => String(row?.[field] || row?.groupId || "") === String(branchId));
}

export function filterByTenant(rows = [], tenantId = "", field = "tenantId") {
  if (!tenantId) return rows.slice();
  return rows.filter((row) => {
    const tid = row?.[field] || row?.businessId || "";
    return !tid || String(tid) === String(tenantId);
  });
}
