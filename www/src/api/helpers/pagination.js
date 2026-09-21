/**
 * Pagination helpers for Wave 3 query operations.
 */

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 200;

export function normalizePageParams(query = {}) {
  let page = Number(query.page ?? query.pageNumber ?? DEFAULT_PAGE);
  let pageSize = Number(query.pageSize ?? query.limit ?? DEFAULT_PAGE_SIZE);
  if (!Number.isFinite(page) || page < 1) page = DEFAULT_PAGE;
  if (!Number.isFinite(pageSize) || pageSize < 1) pageSize = DEFAULT_PAGE_SIZE;
  if (pageSize > MAX_PAGE_SIZE) pageSize = MAX_PAGE_SIZE;
  return { page, pageSize, offset: (page - 1) * pageSize };
}

export function paginateRows(rows = [], query = {}) {
  const { page, pageSize, offset } = normalizePageParams(query);
  const total = rows.length;
  const items = rows.slice(offset, offset + pageSize);
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  return {
    items,
    rows: items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1 && totalPages > 0
    }
  };
}
