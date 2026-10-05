/**
 * The canonical (database-bootstrap) format of a business's cloud snapshot, shared by the Initial
 * Cloud Snapshot (snapshot-bootstrap.js) and every later manager update (cloud.js).
 *
 * Who decides each module:
 * - groups, customers, users, savingsProducts: the relational database alone. A snapshot holds
 *   exactly the records of a fresh, integrity-checked public.fetch_business_snapshot load, with
 *   only the fields that function returns. Nothing a device holds is ever added.
 * - collections: the database load plus the collections already in the cloud copy, which only
 *   public.st_submit_collections appends (migration 047). Device-only collections never enter.
 * - loans, transactions, messages, closings, deletedUsers, deletedRecords, audit and the
 *   server-appended ledgerEntries: there is no database source, so an update carries the cloud
 *   copy's records unchanged; a device cannot add, change or remove them by uploading.
 * - settings: the cloud copy's business settings (allowlisted), with the signed-in business id.
 */
import { defaultStateTemplate } from "../constants.js";
import { jwtPayload } from "../config.js";
import { isSnapshotSecretKey } from "./snapshot-security.js";
import { ensureFreshAccessToken, getAccessToken } from "./supabase-auth.js";
import { restFetch } from "./supabase-rest.js";

export const RELATIONAL_KEYS = Object.freeze(["groups", "customers", "collections", "users", "savingsProducts"]);
export const DATABASE_KEYS = Object.freeze(["groups", "customers", "users", "savingsProducts"]);
export const CARRIED_KEYS = Object.freeze(["loans", "transactions", "messages", "closings", "deletedUsers", "deletedRecords", "audit"]);
export const SERVER_APPENDED_KEYS = Object.freeze(["ledgerEntries"]);
export const CANONICAL_TOP_KEYS = Object.freeze(["settings", ...RELATIONAL_KEYS, ...CARRIED_KEYS, "updatedAt"]);

/** The fields public.fetch_business_snapshot returns for each record (migration 005). */
export const RECORD_FIELDS = Object.freeze({
  groups: Object.freeze(["id", "name", "active", "collectorCode"]),
  customers: Object.freeze(["id", "accountNo", "name", "phone", "groupId", "collectorId", "active", "memberStatus", "accountType"]),
  collections: Object.freeze(["id", "customerId", "groupId", "userId", "collectorId", "amount", "amountPesewas", "date", "receiptNo",
    "idempotencyKey", "paymentMethod", "paymentReference", "verificationStatus", "reversed", "createdAt"]),
  users: Object.freeze(["id", "username", "name", "role", "groupId", "active", "authEmail"]),
  savingsProducts: Object.freeze(["id", "code", "name", "type", "collectionType", "frequency", "minAmountPesewas", "defaultAmountPesewas", "active"])
});

/** Business settings a snapshot may hold: the defaults minus device secrets (sync token, cloud key). */
export const CANONICAL_SETTINGS = Object.freeze(Object.keys(defaultStateTemplate.settings).filter((key) => !isSnapshotSecretKey(key)));

const BUSINESS_KEYS = new Set(["businessId", "businessCode", "business_id", "business_code"]);
const CREDENTIAL_VALUES = [/pbkdf2:\d+:/, /\$2[aby]\$\d{2}\$/, /eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}/, /sb_secret_/, /otpauth:\/\//, /"[A-Z2-7]{32}"/];

const blank = (value) => value === null || value === undefined || value === "";
const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const list = (value) => (Array.isArray(value) ? value : []);

/** The server-issued claims the database authorizes this session by (never local App.state). */
export async function currentSessionIdentity(state) {
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

/** One database load for the business: fetch_business_snapshot plus the rows it must account for. */
export async function fetchDatabaseLoad(state, businessCode) {
  const snapshot = await restFetch(state, "rpc/fetch_business_snapshot", { method: "POST", body: { business_code: businessCode } });
  const rows = {
    customers: await restFetch(state, "customers?select=client_id,branch_id,collector_id"),
    collections: await restFetch(state, "collections?select=client_id,customer_id,branch_id,collector_id")
  };
  return { snapshot, rows };
}

export function usableDatabaseLoad(load) {
  return isObject(load?.snapshot) && Array.isArray(load?.rows?.customers) && Array.isArray(load?.rows?.collections);
}

/**
 * fetch_business_snapshot inner-joins members and collections to their branch and collector, so a
 * row missing either is silently left out of the load, and it identifies every record by its
 * nullable client_id. Compare against the tables themselves and refuse rather than drop or
 * blank anything.
 */
export function relationalIntegrityProblems(snapshot, rows) {
  const missingKeys = RELATIONAL_KEYS.filter((key) => !Array.isArray(snapshot?.[key]));
  if (missingKeys.length) return [`the database load did not return ${missingKeys.join(", ")}`];
  const problems = [];
  const incomplete = (items, fields) => items.filter((row) => fields.some((field) => blank(row?.[field]))).length;
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

/** A database record with only the fields fetch_business_snapshot returns for its kind. */
export function projectRecord(kind, record) {
  const out = {};
  for (const field of RECORD_FIELDS[kind]) {
    if (record?.[field] !== undefined) out[field] = structuredClone(record[field]);
  }
  return out;
}

export function databaseModules(snapshot) {
  return Object.fromEntries(RELATIONAL_KEYS.map((key) => [key, list(snapshot?.[key]).map((record) => projectRecord(key, record))]));
}

export function canonicalSettings(settings, businessCode) {
  const out = {};
  for (const key of CANONICAL_SETTINGS) {
    if (isObject(settings) && settings[key] !== undefined) out[key] = structuredClone(settings[key]);
  }
  out.businessId = businessCode;
  return out;
}

/** The session's staff member as the fresh database load knows them, or why they may not write. */
export function sessionStaffProblem(snapshot, identity) {
  const matches = list(snapshot?.users).filter((user) => user?.id === identity.appUserId);
  if (matches.length !== 1) return "the signed-in staff account is not in the database load";
  if (matches[0].active !== true) return "the signed-in staff account is deactivated in the database";
  if (matches[0].role !== identity.role) return "the signed-in role differs from the staff account's role in the database";
  return null;
}

/** Why a cloud copy is not in the canonical format (an older full device-state copy, for example). */
export function cloudFormatProblems(payload) {
  if (!isObject(payload)) return ["the cloud copy has no payload object"];
  const problems = [];
  const extra = Object.keys(payload).filter((key) => !CANONICAL_TOP_KEYS.includes(key) && !SERVER_APPENDED_KEYS.includes(key));
  if (extra.length) problems.push(`${extra.length} unexpected top-level key(s)`);
  const missing = CANONICAL_TOP_KEYS.filter((key) => !(key in payload));
  if (missing.length) problems.push(`${missing.length} canonical top-level key(s) missing`);
  const notArrays = [...RELATIONAL_KEYS, ...CARRIED_KEYS, ...SERVER_APPENDED_KEYS].filter((key) => key in payload && !Array.isArray(payload[key]));
  if (notArrays.length) problems.push(`${notArrays.join(", ")} not a list`);
  if (!isObject(payload.settings)) problems.push("settings missing");
  else if (Object.keys(payload.settings).some((key) => !CANONICAL_SETTINGS.includes(key))) problems.push("device-only settings present");
  return problems;
}

/** The next canonical snapshot: database modules from the load, everything else from the cloud copy. */
export function buildCanonicalUpdate({ database, cloudPayload, businessCode, now }) {
  const fromDatabase = databaseModules(database);
  const cloud = isObject(cloudPayload) ? cloudPayload : {};
  const payload = { settings: canonicalSettings(cloud.settings, businessCode) };
  DATABASE_KEYS.forEach((key) => { payload[key] = fromDatabase[key]; });
  const cloudCollections = list(cloud.collections);
  const inCloud = new Set(cloudCollections.map((item) => item?.id));
  payload.collections = [...structuredClone(cloudCollections), ...fromDatabase.collections.filter((item) => !inCloud.has(item.id))];
  CARRIED_KEYS.forEach((key) => { payload[key] = structuredClone(list(cloud[key])); });
  SERVER_APPENDED_KEYS.forEach((key) => { if (key in cloud) payload[key] = structuredClone(list(cloud[key])); });
  payload.updatedAt = now;
  return payload;
}

export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (isObject(value)) {
    return `{${Object.keys(value).filter((key) => value[key] !== undefined).sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

/**
 * True when two snapshots differ only in their updatedAt stamp. fetch_business_snapshot returns
 * records in no fixed order, so database records are compared by id, not by position.
 */
export function sameSnapshotContent(a, b) {
  const byId = (x, y) => (String(x?.id) < String(y?.id) ? -1 : String(x?.id) > String(y?.id) ? 1 : 0);
  const strip = (payload) => {
    const { updatedAt, ...rest } = isObject(payload) ? payload : {};
    for (const key of RELATIONAL_KEYS) {
      if (Array.isArray(rest[key])) rest[key] = [...rest[key]].sort(byId);
    }
    return rest;
  };
  return stableStringify(strip(a)) === stableStringify(strip(b));
}

function walk(value, visit) {
  if (Array.isArray(value)) {
    value.forEach((item) => walk(item, visit));
  } else if (isObject(value)) {
    for (const [key, item] of Object.entries(value)) {
      visit(key, item);
      walk(item, visit);
    }
  }
}

/**
 * Every reason `payload` may not be written as the business's canonical snapshot. Checked
 * independently of the builder, against the database load and the cloud copy it was read from
 * (`cloudPayload` null for the initial snapshot).
 */
export function canonicalSnapshotProblems(payload, { database, cloudPayload = null, businessCode }) {
  if (!isObject(payload)) return ["the snapshot is not an object"];
  const problems = [];
  const cloud = isObject(cloudPayload) ? cloudPayload : {};
  const allowedTop = [...CANONICAL_TOP_KEYS, ...SERVER_APPENDED_KEYS.filter((key) => key in cloud)];
  const extraTop = Object.keys(payload).filter((key) => !allowedTop.includes(key));
  if (extraTop.length) problems.push(`unknown top-level key(s): ${extraTop.map((key) => (/^[A-Za-z0-9_]{1,40}$/.test(key) ? key : "(unusual key)")).join(", ")}`);
  const missingTop = CANONICAL_TOP_KEYS.filter((key) => !(key in payload));
  if (missingTop.length) problems.push(`missing top-level key(s): ${missingTop.join(", ")}`);

  const loaded = databaseModules(database);
  const idsOf = (items) => items.map((item) => item?.id);
  for (const key of RELATIONAL_KEYS) {
    if (!Array.isArray(payload[key])) {
      problems.push(`${key} is not a list`);
      continue;
    }
    const records = payload[key];
    const ids = idsOf(records);
    if (records.some((item) => !isObject(item) || blank(item.id) || typeof item.id !== "string")) problems.push(`${key}: record(s) without an id`);
    if (new Set(ids).size !== ids.length) problems.push(`${key}: duplicate id(s)`);
    const dbIds = new Set(idsOf(loaded[key]));
    if (key === "collections") {
      const cloudById = new Map(list(cloud.collections).map((item) => [item?.id, item]));
      const unknown = records.filter((item) => !dbIds.has(item?.id) && !cloudById.has(item?.id)).length;
      if (unknown) problems.push(`collections: ${unknown} record(s) neither in the database nor accepted into the cloud copy`);
      const changed = records.filter((item) => cloudById.has(item?.id) && stableStringify(item) !== stableStringify(cloudById.get(item.id))).length;
      if (changed) problems.push(`collections: ${changed} cloud record(s) changed`);
      const missingCloud = [...cloudById.keys()].filter((id) => !ids.includes(id)).length;
      if (missingCloud) problems.push(`collections: ${missingCloud} cloud record(s) removed`);
      const missingDb = [...dbIds].filter((id) => !ids.includes(id)).length;
      if (missingDb) problems.push(`collections: ${missingDb} database record(s) missing`);
      const deviceFields = records.filter((item) => !cloudById.has(item?.id) && Object.keys(item || {}).some((field) => !RECORD_FIELDS.collections.includes(field))).length;
      if (deviceFields) problems.push(`collections: ${deviceFields} record(s) with fields the database does not provide`);
      const loadedById = new Map(loaded.collections.map((item) => [item.id, item]));
      const differs = records.filter((item) => !cloudById.has(item?.id) && loadedById.has(item?.id) && stableStringify(item) !== stableStringify(loadedById.get(item.id))).length;
      if (differs) problems.push(`collections: ${differs} record(s) differ from the database`);
      continue;
    }
    const notInDb = ids.filter((id) => !dbIds.has(id)).length;
    if (notInDb) problems.push(`${key}: ${notInDb} record(s) not in the database`);
    const missing = [...dbIds].filter((id) => !ids.includes(id)).length;
    if (missing) problems.push(`${key}: ${missing} database record(s) missing`);
    const deviceFields = records.filter((item) => Object.keys(item || {}).some((field) => !RECORD_FIELDS[key].includes(field))).length;
    if (deviceFields) problems.push(`${key}: ${deviceFields} record(s) with fields the database does not provide`);
    const loadedById = new Map(loaded[key].map((item) => [item.id, item]));
    const differs = records.filter((item) => loadedById.has(item?.id) && stableStringify(item) !== stableStringify(loadedById.get(item.id))).length;
    if (differs) problems.push(`${key}: ${differs} record(s) differ from the database`);
  }

  for (const key of [...CARRIED_KEYS, ...SERVER_APPENDED_KEYS]) {
    if (!(key in payload)) continue;
    if (!Array.isArray(payload[key])) problems.push(`${key} is not a list`);
    else if (stableStringify(payload[key]) !== stableStringify(list(cloud[key]))) problems.push(`${key}: differs from the cloud copy (no database source; only the server changes it)`);
  }

  if (!isObject(payload.settings)) {
    problems.push("settings missing");
  } else {
    const extraSettings = Object.keys(payload.settings).filter((key) => !CANONICAL_SETTINGS.includes(key));
    if (extraSettings.length) problems.push(`${extraSettings.length} device-only or unknown setting(s)`);
    if (payload.settings.businessId !== businessCode) problems.push("settings.businessId is not the signed-in business");
  }
  if (typeof payload.updatedAt !== "string" || !payload.updatedAt) problems.push("updatedAt missing");

  const secretKeys = new Set();
  const otherBusinesses = new Set();
  walk(payload, (key, item) => {
    if (isSnapshotSecretKey(key)) secretKeys.add(/^[A-Za-z0-9_]{1,40}$/.test(key) ? key : "(unusual key)");
    if (BUSINESS_KEYS.has(key) && typeof item === "string" && item !== "" && item !== businessCode) otherBusinesses.add(key);
  });
  if (secretKeys.size) problems.push(`secret or credential key(s): ${[...secretKeys].sort().join(", ")}`);
  if (otherBusinesses.size) problems.push("record(s) belonging to another business");
  const text = JSON.stringify(payload);
  const credentialValues = CREDENTIAL_VALUES.reduce((n, pattern) => n + (text.match(new RegExp(pattern.source, "g")) || []).length, 0);
  if (credentialValues) problems.push(`${credentialValues} credential-shaped value(s)`);
  return problems;
}

/** Records this device holds that the snapshot does not (never uploaded; counts only). */
export function recordsHeldOnDevice(localState, payload) {
  const held = {};
  for (const key of [...RELATIONAL_KEYS, ...CARRIED_KEYS, ...SERVER_APPENDED_KEYS]) {
    const inSnapshot = new Set(list(payload?.[key]).map((item) => item?.id).filter((id) => !blank(id)));
    const count = list(localState?.[key]).filter((item) => !blank(item?.id) && !inSnapshot.has(item.id)).length;
    if (count) held[key] = count;
  }
  return held;
}
