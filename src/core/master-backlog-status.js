/**
 * MIB status reconciliation — canonical user statuses + legacy aliases.
 * Canonical (preferred): Completed | Ready | Planned | In Progress | Blocked | Deferred | Cancelled
 * Legacy aliases remain accepted by validators and map via toCanonicalStatus().
 */

/** @type {ReadonlyArray<string>} */
export const CANONICAL_BACKLOG_STATUSES = Object.freeze([
  "Completed",
  "Ready",
  "Planned",
  "In Progress",
  "Blocked",
  "Deferred",
  "Cancelled"
]);

/** Legacy statuses retained for migration notes / acceptance during transition. */
export const LEGACY_BACKLOG_STATUSES = Object.freeze([
  "Not Started",
  "Code Complete",
  "Code Review",
  "QA Testing",
  "UAT",
  "Ready for Release",
  "Released"
]);

/** Full enum accepted on backlog items (canonical ∪ legacy). */
export const BACKLOG_STATUSES = Object.freeze([
  ...CANONICAL_BACKLOG_STATUSES,
  ...LEGACY_BACKLOG_STATUSES
]);

/**
 * Map any accepted status onto the canonical user set.
 * @param {string} status
 * @returns {string}
 */
export function toCanonicalStatus(status) {
  switch (status) {
    case "Released":
    case "Code Complete":
    case "Code Review":
    case "QA Testing":
    case "Ready for Release":
    case "Completed":
      return "Completed";
    case "UAT":
      return "In Progress";
    case "Not Started":
      return "Planned";
    case "Ready":
    case "Planned":
    case "In Progress":
    case "Blocked":
    case "Deferred":
    case "Cancelled":
      return status;
    default:
      return status;
  }
}

/**
 * Normalize status at write-time onto the canonical set (preferred for new/updated items).
 * @param {string} status
 * @returns {string}
 */
export function normalizeBacklogStatus(status) {
  return toCanonicalStatus(status ?? "Planned");
}

/** Statuses treated as “done” for release-like rollups. */
export const COMPLETED_LIKE_STATUSES = Object.freeze([
  "Completed",
  "Released",
  "Code Complete",
  "Ready for Release",
  "Code Review",
  "QA Testing"
]);

export const MIB_STATUS_MIGRATION_NOTE =
  "2026-09-17 reconciliation: preferred status enum is Completed|Ready|Planned|In Progress|Blocked|Deferred|Cancelled. " +
  "Legacy Released/Code Complete/Ready for Release/Code Review/QA Testing → Completed; Not Started → Planned; UAT → In Progress. " +
  "Validators accept both; buildBacklogItem normalizes to canonical.";
