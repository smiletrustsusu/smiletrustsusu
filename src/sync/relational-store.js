/**
 * PostgreSQL read/write when postgresSourceOfTruth is enabled.
 */
import { resolveBusinessId } from "../config.js";
import { mergeStates } from "../core/state.js";
import { restoreUsersFromCloud, sanitizeStateForCloud } from "./snapshot-security.js";
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
  return sanitizeStateForCloud(snapshot || {});
}

/**
 * Mirrors a staff account's username, name, role and active flag to public.app_users, the only
 * authority staff-login and the database use (migration 047). Passwords are never sent: a new
 * account signs in for the first time with a one-time activation code.
 */
export async function pushStaffAccountToServer(state, user) {
  if (!supabaseConfigured(state) || !user?.id || !user?.username) return { ok: false, skipped: true };
  try {
    const result = await restFetch(state, "rpc/st_upsert_staff_account", {
      method: "POST",
      body: {
        p_business_code: resolveBusinessId(state),
        p_user: { id: user.id, username: user.username, name: user.name || user.username, role: user.role || "Collector", active: user.active !== false }
      }
    });
    return { ok: true, result };
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
