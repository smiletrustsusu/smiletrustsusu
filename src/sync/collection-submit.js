/**
 * Offline-collected payments from staff who may not write the whole business snapshot
 * (collectors, cashiers and other non-manager roles — migration 047). Each queued collection is
 * uploaded with its ledger pair and mirrored transaction through public.st_submit_collections,
 * which validates the member, assignment, amounts and author on the server and appends the
 * records. Resubmitting is safe: the server reports duplicates by id or idempotency key.
 */

/** Roles whose session may write the snapshot (public.st_jwt_is_manager in migration 047). */
export const SNAPSHOT_WRITER_ROLES = Object.freeze(["SystemOwner", "KBA", "Admin", "ManagingDirector", "Accountant"]);
export const SUBMIT_BATCH_SIZE = 200;

export function canWriteSnapshot(role) {
  return SNAPSHOT_WRITER_ROLES.includes(String(role || ""));
}

/**
 * Collections this user recorded that the server copy does not have yet.
 * @param {object} state local state (after merging the latest server copy)
 * @param {{ userId: string, serverCollectionIds: Iterable<string> }} options
 */
export function pendingCollectionSubmissions(state, { userId, serverCollectionIds = [] }) {
  if (!userId) return [];
  const onServer = new Set(serverCollectionIds);
  const ledger = state.ledgerEntries || [];
  const transactions = state.transactions || [];
  return (state.collections || [])
    .filter((collection) => collection?.id && collection.userId === userId && !onServer.has(collection.id)
      && collection.cloudSyncStatus !== "Rejected")
    .map((collection) => {
      const ledgerEntries = ledger.filter((entry) => entry.referenceId === collection.id && entry.referenceType === "collection").slice(0, 2);
      const ledgerIds = new Set(ledgerEntries.map((entry) => entry.id));
      const linked = transactions.filter((tx) => ledgerIds.has(tx.ledgerEntryId)).slice(0, 1);
      return { collection, ledgerEntries, transactions: linked };
    });
}

export function submissionBatches(items, size = SUBMIT_BATCH_SIZE) {
  const batches = [];
  for (let i = 0; i < items.length; i += size) batches.push(items.slice(i, i + size));
  return batches;
}

/** Marks collections the server refused so they are shown to staff instead of retried forever. */
export function applySubmissionResult(state, result, now = new Date().toISOString()) {
  const rejected = Array.isArray(result?.rejected) ? result.rejected : [];
  const byId = new Map(rejected.map((row) => [row.id, row.reason]));
  (state.collections || []).forEach((collection) => {
    if (!byId.has(collection.id)) return;
    collection.cloudSyncStatus = "Rejected";
    collection.cloudSyncError = String(byId.get(collection.id) || "Rejected by the server");
    collection.cloudSyncCheckedAt = now;
  });
  const count = (value) => (Array.isArray(value) ? value.length : 0);
  return { accepted: count(result?.accepted), duplicates: count(result?.duplicates), rejected: rejected.length };
}
