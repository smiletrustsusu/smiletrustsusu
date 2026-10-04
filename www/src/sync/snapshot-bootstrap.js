/**
 * The first authoritative cloud copy of a business (its smile_trust_cloud_snapshots row).
 *
 * It is created only by an explicit, confirmed manager action, never by autosave or background
 * sync, and only from a fresh, integrity-checked database load made in this browser session.
 * Business data this device already holds is never part of it: a reused device's old members,
 * collections, loans, settings or tombstones cannot become authoritative. The verified load lives
 * in memory only, so a reload, another session or another user needs a fresh load.
 *
 * Initial snapshot contents: groups, customers, collections, users and savingsProducts exactly as
 * public.fetch_business_snapshot returns them; default settings with the signed-in business id;
 * every other module empty (it has no authoritative database source to copy from).
 */
import { App } from "../context.js";
import { CLOUD_SNAPSHOT_TABLE, defaultStateTemplate } from "../constants.js";
import { getAppConfig, getSyncMode, jwtPayload, resolveBusinessId } from "../config.js";
import { canWriteSnapshot } from "./collection-submit.js";
import { pauseCloudUploads, readCloudSnapshotState, resumeCloudUploads, waitForCloudUploadsIdle } from "./cloud.js";
import { restoreUsersFromCloud, sanitizeStateForCloud } from "./snapshot-security.js";
import { ensureFreshAccessToken, getAccessToken, getStoredAuthSession } from "./supabase-auth.js";
import { restFetch } from "./supabase-rest.js";

export const BOOTSTRAP_REFUSED = "cloud-bootstrap-refused";
export const BOOTSTRAP_MAX_AGE_MS = 10 * 60 * 1000;
export const BOOTSTRAP_RELATIONAL_KEYS = Object.freeze(["groups", "customers", "collections", "users", "savingsProducts"]);
/** Display preferences of this device; never business data. */
const DEVICE_LOCAL_SETTINGS = Object.freeze(["theme", "colorMode"]);
const IDENTITY_FIELDS = ["authUserId", "sessionId", "appUserId", "role", "businessCode"];

let verifiedLoad = null;

function refused(message) {
  const error = new Error(message);
  error.code = BOOTSTRAP_REFUSED;
  return error;
}

/** The server-issued claims the database authorizes this session by. */
export async function currentSessionIdentity(state = App.state) {
  await ensureFreshAccessToken(state).catch(() => "");
  const claims = jwtPayload(getAccessToken());
  const meta = claims?.app_metadata || {};
  if (!claims?.sub || !meta.business_code || !meta.app_user_id) return null;
  return {
    authUserId: String(claims.sub),
    sessionId: String(claims.session_id || ""),
    appUserId: String(meta.app_user_id),
    role: String(meta.app_role || ""),
    businessCode: String(meta.business_code)
  };
}

const sameIdentity = (a, b) => Boolean(a && b) && IDENTITY_FIELDS.every((field) => a[field] === b[field]);

async function authorizedIdentity(state) {
  if (getSyncMode(state) !== "supabase") throw refused("The initial cloud snapshot needs the Supabase cloud connection");
  const identity = await currentSessionIdentity(state);
  if (!identity) throw refused("Sign in online as a manager to create the initial cloud snapshot");
  if (!canWriteSnapshot(identity.role)) throw refused("Only a manager can create the initial cloud snapshot");
  const configured = getAppConfig().businessId;
  if (identity.businessCode !== resolveBusinessId(state) || (configured && configured !== identity.businessCode)) {
    throw refused("This device is set up for a different business than the signed-in account");
  }
  return identity;
}

async function requireNoCloudCopy() {
  const cloud = await readCloudSnapshotState();
  if (cloud.status !== "missing") throw refused("A cloud copy already exists for this business; use normal sync instead");
}

const blank = (value) => value === null || value === undefined || value === "";

/**
 * fetch_business_snapshot inner-joins members and collections to their branch and collector, so a
 * row missing either is silently left out of the load, and it identifies every record by its
 * nullable client_id. Compare against the tables themselves and refuse rather than drop or
 * blank anything.
 */
export function relationalIntegrityProblems(snapshot, rows) {
  const missingKeys = BOOTSTRAP_RELATIONAL_KEYS.filter((key) => !Array.isArray(snapshot?.[key]));
  if (missingKeys.length) return [`the database load did not return ${missingKeys.join(", ")}`];
  const problems = [];
  const incomplete = (list, fields) => list.filter((row) => fields.some((field) => blank(row?.[field]))).length;
  const members = incomplete(rows.customers, ["client_id", "branch_id", "collector_id"]);
  if (members) problems.push(`${members} member(s) have no app id, branch or collector`);
  if (rows.customers.length !== snapshot.customers.length) {
    problems.push(`the database has ${rows.customers.length} member(s) but the load returned ${snapshot.customers.length}`);
  }
  const collections = incomplete(rows.collections, ["client_id", "customer_id", "branch_id", "collector_id"]);
  if (collections) problems.push(`${collections} collection(s) have no app id, member, branch or collector`);
  if (rows.collections.length !== snapshot.collections.length) {
    problems.push(`the database has ${rows.collections.length} collection(s) but the load returned ${snapshot.collections.length}`);
  }
  const loadedRecords = ["customers", "collections", "users", "groups"].reduce((n, key) => n + snapshot[key].filter((item) => blank(item?.id)).length, 0);
  if (loadedRecords) problems.push(`${loadedRecords} loaded record(s) have no app id`);
  const unlinked = snapshot.customers.filter((item) => blank(item?.groupId) || blank(item?.collectorId)).length;
  if (unlinked) problems.push(`${unlinked} member(s) load without a branch or collector id`);
  return problems;
}

export function buildBootstrapState(snapshot, businessCode, now) {
  const state = structuredClone(defaultStateTemplate);
  BOOTSTRAP_RELATIONAL_KEYS.forEach((key) => {
    state[key] = structuredClone(snapshot[key]);
  });
  state.settings = { ...state.settings, businessId: businessCode };
  state.updatedAt = now;
  return state;
}

export function bootstrapSummary(state) {
  return {
    members: state.customers.length,
    staff: state.users.length,
    groups: state.groups.length,
    collections: state.collections.length,
    savingsProducts: state.savingsProducts.length
  };
}

/**
 * Step 1: load and verify the business from the database for this session. Nothing is written.
 * Refuses if a cloud copy already exists or the cloud cannot be read.
 */
export async function loadVerifiedBootstrap(state = App.state) {
  verifiedLoad = null;
  const identity = await authorizedIdentity(state);
  await requireNoCloudCopy();
  let snapshot;
  let rows;
  try {
    snapshot = await restFetch(state, "rpc/fetch_business_snapshot", { method: "POST", body: { business_code: identity.businessCode } });
    rows = {
      customers: await restFetch(state, "customers?select=client_id,branch_id,collector_id"),
      collections: await restFetch(state, "collections?select=client_id,customer_id,branch_id,collector_id")
    };
  } catch (error) {
    throw refused(`The database load failed (${error.message}); nothing was created`);
  }
  if (!snapshot || typeof snapshot !== "object" || !Array.isArray(rows.customers) || !Array.isArray(rows.collections)) {
    throw refused("The database load returned no usable data; nothing was created");
  }
  const problems = relationalIntegrityProblems(snapshot, rows);
  if (problems.length) {
    throw refused(`Database integrity check failed: ${problems.join("; ")}. Correct these records before creating the initial cloud snapshot.`);
  }
  const loadedAt = Date.now();
  const bootstrapState = buildBootstrapState(snapshot, identity.businessCode, new Date(loadedAt).toISOString());
  verifiedLoad = { identity, loadedAt, state: bootstrapState };
  return { businessCode: identity.businessCode, ...bootstrapSummary(bootstrapState) };
}

/**
 * Step 2: create the first cloud copy from the verified load, once. `confirmation` must be the
 * business code typed by the manager. A plain insert: if a copy appeared meanwhile the server
 * rejects it rather than overwriting.
 */
export async function createInitialCloudSnapshot({ confirmation } = {}, state = App.state) {
  const identity = await authorizedIdentity(state);
  const load = verifiedLoad;
  if (!load || !sameIdentity(load.identity, identity)) {
    throw refused("Load the business data from the database in this session first");
  }
  if (Date.now() - load.loadedAt > BOOTSTRAP_MAX_AGE_MS) {
    verifiedLoad = null;
    throw refused("The database load is too old; load it again");
  }
  if (confirmation !== identity.businessCode) throw refused(`Type ${identity.businessCode} exactly to confirm`);
  // Paused before the final check and never resumed once the insert is sent: a push that reads
  // the cloud after the insert would overwrite the new copy with this device's normalized state.
  pauseCloudUploads();
  try {
    if (!(await waitForCloudUploadsIdle())) throw refused("A cloud upload is still running; reload the app and try again");
    await requireNoCloudCopy();
  } catch (error) {
    resumeCloudUploads();
    throw error;
  }
  verifiedLoad = null;
  const savedAt = new Date().toISOString();
  await restFetch(state, CLOUD_SNAPSHOT_TABLE, {
    method: "POST",
    prefer: "return=minimal",
    body: {
      business_id: identity.businessCode,
      payload: sanitizeStateForCloud(load.state),
      saved_by: getStoredAuthSession()?.app_user?.username || identity.appUserId,
      saved_at: savedAt
    }
  });
  return { savedAt, state: structuredClone(load.state), summary: bootstrapSummary(load.state) };
}

/** The bootstrapping device continues from the initial copy, keeping only its own sign-in material and display preferences. */
export function deviceStateAfterBootstrap(localState, bootstrapState) {
  const next = structuredClone(bootstrapState);
  next.users = restoreUsersFromCloud(localState?.users || [], next.users);
  DEVICE_LOCAL_SETTINGS.forEach((key) => {
    if (localState?.settings?.[key] !== undefined) next.settings[key] = localState.settings[key];
  });
  return next;
}

export function discardVerifiedBootstrap() {
  verifiedLoad = null;
}
