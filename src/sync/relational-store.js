/**
 * PostgreSQL read/write when postgresSourceOfTruth is enabled.
 */
import { mergeStates } from "../core/state.js";
import { restoreUsersFromCloud } from "./snapshot-security.js";
import { restFetch, supabaseConfigured, tenantHeaders } from "./supabase-rest.js";

export function postgresSourceEnabled(state) {
  return state.settings?.postgresSourceOfTruth === true
    && state.settings?.relationalSync === true
    && supabaseConfigured(state);
}

export function mergeRelationalSnapshot(state, snapshot) {
  if (!snapshot || typeof snapshot !== "object") return state;
  const partial = { ...snapshot };
  delete partial.settings;
  const merged = mergeStates(state, partial);
  merged.users = restoreUsersFromCloud(state.users, merged.users);
  Object.assign(state, merged);
  state.loadedFromPostgresAt = new Date().toISOString();
  return state;
}

export async function loadStateFromRelational(state) {
  if (!postgresSourceEnabled(state)) return { ok: false, skipped: true };
  const businessCode = tenantHeaders(state).businessId;
  try {
    const snapshot = await restFetch(state, "rpc/fetch_business_snapshot", {
      method: "POST",
      body: { business_code: businessCode }
    });
    if (!snapshot || typeof snapshot !== "object") {
      return { ok: false, error: "Empty snapshot from PostgreSQL" };
    }
    mergeRelationalSnapshot(state, snapshot);
    return { ok: true, snapshot };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export async function importSnapshotToRelational(state, snapshot) {
  if (!supabaseConfigured(state)) return { ok: false, error: "Supabase not configured" };
  const businessCode = tenantHeaders(state).businessId;
  try {
    const result = await restFetch(state, "rpc/import_snapshot_batch", {
      method: "POST",
      body: {
        business_code: businessCode,
        snapshot: sanitizeSnapshotForImport(snapshot)
      }
    });
    return { ok: true, result };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

function sanitizeSnapshotForImport(snapshot) {
  const copy = JSON.parse(JSON.stringify(snapshot || {}));
  delete copy.settings?.cloudKey;
  delete copy.settings?.syncAccessKey;
  delete copy.settings?.syncToken;
  delete copy.settings?.momoWebhookSecret;
  (copy.users || []).forEach((user) => {
    if (user.passwordHash) user.passwordHash = "[protected]";
  });
  return copy;
}

export async function pushMfaToRelational(state, user) {
  if (!postgresSourceEnabled(state) || !user?.mfaSecret) return { ok: true, skipped: true };
  try {
    await restFetch(state, "rpc/upsert_user_mfa", {
      method: "POST",
      body: {
        business_code: tenantHeaders(state).businessId,
        user_client_id: user.id,
        secret: user.mfaSecret,
        enabled: Boolean(user.mfaEnabled)
      }
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export async function recordMomoWebhookEvent(state, event) {
  if (!supabaseConfigured(state)) return { ok: false, error: "Supabase not configured" };
  try {
    const result = await restFetch(state, "rpc/record_momo_webhook", {
      method: "POST",
      body: {
        business_code: tenantHeaders(state).businessId,
        payload: event
      }
    });
    return { ok: true, result };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}
