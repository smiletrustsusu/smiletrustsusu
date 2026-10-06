/**
 * Dual-write financial records to PostgreSQL when relational sync is enabled.
 * Snapshot sync remains for migration period; relational is authoritative when productionMode is on.
 */
import { restFetch, supabaseConfigured, tenantHeaders } from "./supabase-rest.js";
import { collectionRpcPayload } from "./authoritative-writes.js";

export function relationalSyncEnabled(state) {
  return state.settings?.relationalSync === true && supabaseConfigured(state);
}

export async function pushCollectionToRelational(state, collection) {
  if (!relationalSyncEnabled(state)) return { ok: true, skipped: true };
  const row = collectionRpcPayload(state, collection, tenantHeaders(state).businessId);
  try {
    const result = await restFetch(state, "rpc/record_collection_from_client", {
      method: "POST",
      body: { payload: row },
      prefer: "return=representation"
    });
    return { ok: true, result };
  } catch (error) {
    if (state.settings?.productionMode === true) throw error;
    return { ok: false, error: error.message };
  }
}

export async function pushDeviceToRelational(state, device) {
  if (!relationalSyncEnabled(state)) return { ok: true, skipped: true };
  try {
    await restFetch(state, "devices", {
      method: "POST",
      body: {
        business_code: tenantHeaders(state).businessId,
        client_id: device.id,
        user_client_id: device.userId,
        device_fingerprint: device.fingerprint,
        label: device.label || "",
        active: device.active !== false,
        last_seen_at: device.lastSeenAt || new Date().toISOString()
      },
      prefer: "resolution=merge-duplicates,return=minimal"
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export async function pushSyncQueueItem(state, entry) {
  if (!relationalSyncEnabled(state)) return { ok: true, skipped: true };
  try {
    await restFetch(state, "sync_queue", {
      method: "POST",
      body: {
        business_code: tenantHeaders(state).businessId,
        idempotency_key: entry.idempotencyKey,
        payload: entry.payload,
        status: entry.status || "pending"
      },
      prefer: "resolution=ignore-duplicates,return=minimal"
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export async function flushRelationalOfflineQueue(state, applyFn) {
  const results = [];
  for (const entry of (state.offlineQueue || []).filter((item) => item.status === "pending")) {
    entry.attempts = Number(entry.attempts || 0) + 1;
    entry.lastAttemptAt = new Date().toISOString();
    try {
      const applied = await applyFn(entry);
      if (applied !== false) {
        entry.status = "applied";
        entry.appliedAt = new Date().toISOString();
        await pushSyncQueueItem(state, entry);
        results.push({ id: entry.id, ok: true });
      }
    } catch (error) {
      entry.lastError = error.message || "Apply failed";
      results.push({ id: entry.id, ok: false, error: entry.lastError });
    }
  }
  return results;
}
