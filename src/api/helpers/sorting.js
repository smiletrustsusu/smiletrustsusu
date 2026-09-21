/**
 * Sorting helpers for Wave 3 list operations.
 */

export function parseSort(query = {}) {
  const sort = String(query.sort || query.orderBy || "").trim();
  if (!sort) return { field: "", direction: "asc" };
  if (sort.startsWith("-")) return { field: sort.slice(1), direction: "desc" };
  const order = String(query.order || query.direction || "asc").toLowerCase();
  return { field: sort, direction: order === "desc" ? "desc" : "asc" };
}

export function applySort(rows = [], query = {}, { defaultField = "createdAt", defaultDirection = "desc" } = {}) {
  const parsed = parseSort(query);
  const field = parsed.field || defaultField;
  const direction = parsed.field ? parsed.direction : defaultDirection;
  if (!field) return rows.slice();
  const factor = direction === "desc" ? -1 : 1;
  return rows.slice().sort((a, b) => {
    const av = a?.[field];
    const bv = b?.[field];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * factor;
    return String(av).localeCompare(String(bv), undefined, { numeric: true }) * factor;
  });
}
