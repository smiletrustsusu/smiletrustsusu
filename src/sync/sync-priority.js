/**
 * Wave 4 — Offline queue prioritization.
 * Financial / money-critical items upload before soft metadata; conflicts stay held.
 */

import { isFinancialKind, FINANCIAL_KINDS } from "../core/sync-ops.js";

export const PRIORITY_BANDS = Object.freeze({
  CRITICAL_FINANCIAL: 100,
  FINANCIAL: 80,
  CUSTOMER: 60,
  OPERATIONAL: 40,
  METADATA: 20,
  HELD_CONFLICT: 0
});

const KIND_BAND = Object.freeze({
  collection: PRIORITY_BANDS.CRITICAL_FINANCIAL,
  repayment: PRIORITY_BANDS.CRITICAL_FINANCIAL,
  disbursement: PRIORITY_BANDS.CRITICAL_FINANCIAL,
  withdrawal: PRIORITY_BANDS.FINANCIAL,
  payment: PRIORITY_BANDS.FINANCIAL,
  transfer: PRIORITY_BANDS.FINANCIAL,
  expense: PRIORITY_BANDS.FINANCIAL,
  journal: PRIORITY_BANDS.FINANCIAL,
  adjustment: PRIORITY_BANDS.FINANCIAL,
  reversal: PRIORITY_BANDS.FINANCIAL,
  customer: PRIORITY_BANDS.CUSTOMER,
  meeting: PRIORITY_BANDS.OPERATIONAL
});

export function queueItemPriority(entry = {}) {
  const status = String(entry.status || "").toLowerCase();
  if (status === "conflict_detected" || status === "cancelled") {
    return PRIORITY_BANDS.HELD_CONFLICT;
  }
  const kind = String(entry.kind || "").toLowerCase();
  if (KIND_BAND[kind] != null) return KIND_BAND[kind];
  if (isFinancialKind(kind) || FINANCIAL_KINDS.includes(kind)) return PRIORITY_BANDS.FINANCIAL;
  return PRIORITY_BANDS.METADATA;
}

export function prioritizeQueueItems(items = []) {
  return items
    .slice()
    .map((item, index) => ({
      item,
      index,
      priority: Number(item.priority ?? queueItemPriority(item)),
      localSequence: Number(item.localSequence || 0)
    }))
    .sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      if (a.localSequence !== b.localSequence) return a.localSequence - b.localSequence;
      return a.index - b.index;
    })
    .map((row) => {
      row.item.priority = row.priority;
      return row.item;
    });
}

export function annotateQueuePriorities(state) {
  const queue = state?.offlineQueue || [];
  for (const entry of queue) {
    if (entry.priority == null) entry.priority = queueItemPriority(entry);
  }
  return queue;
}
