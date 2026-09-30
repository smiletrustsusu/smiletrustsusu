import {
  CLOUD_KEY_STORAGE,
  defaultStateTemplate,
  REMEMBER_LOGIN_KEY,
  STORE_KEY,
  SYNC_URL_KEY
} from "../constants.js";
import { App } from "../context.js";
import {
  getAppConfig,
  resolvedLocalBackupUrl,
  resolvedSupabaseKey,
  resolvedSupabaseUrl,
  resolveBusinessId
} from "../config.js";
import { buildInterestSchedule } from "./domain.js";
import { ensureDefaultSystemAccounts } from "./system-accounts.js";

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function saveStateToStorage(nextState) {
  localStorage.setItem(STORE_KEY, JSON.stringify(nextState));
}

export function loadStateFromStorage() {
  const saved = localStorage.getItem(STORE_KEY);
  if (!saved) return structuredClone(defaultStateTemplate);
  try {
    return { ...structuredClone(defaultStateTemplate), ...JSON.parse(saved) };
  } catch {
    return structuredClone(defaultStateTemplate);
  }
}

export function createDefaultState() {
  const config = getAppConfig();
  const state = {
    ...structuredClone(defaultStateTemplate),
    settings: {
      ...structuredClone(defaultStateTemplate.settings),
      cloudUrl: config.supabaseUrl || "",
      cloudKey: config.supabaseAnonKey || "",
      localBackupUrl: config.localBackupUrl || "",
      syncToken: config.syncToken || "",
      businessId: config.businessId || ""
    },
    users: []
  };
  ensureDefaultSystemAccounts(state, { now: new Date().toISOString() });
  return state;
}

export function normalizeState(data) {
  const normalized = { ...createDefaultState(), ...data };
  normalized.groups = normalized.groups || [];
  normalized.audit = normalized.audit || [];
  normalized.closings = normalized.closings || [];
  normalized.deletedUsers = normalized.deletedUsers || [];
  normalized.deletedRecords = normalized.deletedRecords || [];
  normalized.settings = { ...createDefaultState().settings, ...(normalized.settings || {}) };
  normalized.settings.cloudUrl = normalized.settings.cloudUrl || localStorage.getItem(SYNC_URL_KEY) || resolvedSupabaseUrl(normalized);
  normalized.settings.cloudKey = normalized.settings.cloudKey || localStorage.getItem(CLOUD_KEY_STORAGE) || resolvedSupabaseKey(normalized);
  normalized.settings.localBackupUrl = normalized.settings.localBackupUrl || resolvedLocalBackupUrl(normalized);
  normalized.settings.businessId = resolveBusinessId(normalized);
  const userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent || "";
  if (!/Electron/i.test(userAgent) && /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(normalized.settings.cloudUrl || "")) {
    normalized.settings.cloudUrl = localStorage.getItem(SYNC_URL_KEY) || "";
  }
  normalized.customers = (normalized.customers || []).map((customer) => ({
    nhis: "",
    ghanaCard: "",
    groupId: "",
    sittingsPaid: 0,
    ...customer
  }));
  normalized.collections = (normalized.collections || []).map((collection) => ({
    groupId: normalized.customers.find((customer) => customer.id === collection.customerId)?.groupId || "",
    contributionNo: "",
    sittingsPaid: Number(collection.sittingsPaid || collection.contributionNo || 0),
    ...collection
  }));
  normalized.loans = (normalized.loans || []).map((loan) => ({
    groupId: normalized.customers.find((customer) => customer.id === loan.customerId)?.groupId || "",
    interestMonths: Number(loan.interestMonths || 1),
    ...loan
  })).map((loan) => ({
    ...loan,
    interestSchedule: loan.interestSchedule?.length
      ? loan.interestSchedule
      : buildInterestSchedule(loan.date || today(), loan.principal || 0, loan.interest || 0, loan.interestMonths || 1)
  }));
  normalized.messages = normalized.messages || [];
  normalized.users = normalized.users.map((user) => {
    if (user.password && !user.passwordHash) user.passwordHash = user.password;
    delete user.password;
    return user;
  });
  ensureDefaultSystemAccounts(normalized, { now: new Date().toISOString() });
  normalized.users = applyUserTombstones(normalized.users, normalized.deletedUsers);
  normalized.groups = applyRecordTombstones(normalized.groups, normalized.deletedRecords, "groups");
  normalized.customers = applyRecordTombstones(normalized.customers, normalized.deletedRecords, "customers");
  normalized.collections = applyRecordTombstones(normalized.collections, normalized.deletedRecords, "collections");
  normalized.loans = applyRecordTombstones(normalized.loans, normalized.deletedRecords, "loans");
  normalized.transactions = applyRecordTombstones(normalized.transactions || [], normalized.deletedRecords, "transactions");
  normalized.messages = applyRecordTombstones(normalized.messages || [], normalized.deletedRecords, "messages");
  saveStateToStorage(normalized);
  return normalized;
}

export function saveState() {
  App.state.updatedAt = new Date().toISOString();
  saveStateToStorage(App.state);
  App.localSavePending = true;
}

export function mergeStates(localData, remoteData) {
  const local = normalizeStateForMerge(localData);
  const remote = normalizeStateForMerge(remoteData);
  const localIsNewer = Date.parse(local.updatedAt || 0) >= Date.parse(remote.updatedAt || 0);
  const deletedUsers = mergeById(local.deletedUsers, remote.deletedUsers);
  const deletedRecords = mergeById(local.deletedRecords, remote.deletedRecords);
  return {
    ...createDefaultState(),
    ...remote,
    ...local,
    settings: { ...remote.settings, ...local.settings },
    groups: applyRecordTombstones(mergeById(local.groups, remote.groups), deletedRecords, "groups"),
    deletedUsers,
    deletedRecords,
    users: applyUserTombstones(mergeUsers(local.users, remote.users), deletedUsers),
    customers: applyRecordTombstones(mergeById(local.customers, remote.customers), deletedRecords, "customers"),
    collections: applyRecordTombstones(mergeById(local.collections, remote.collections), deletedRecords, "collections"),
    loans: applyRecordTombstones(mergeById(local.loans, remote.loans), deletedRecords, "loans"),
    transactions: applyRecordTombstones(mergeById(local.transactions, remote.transactions), deletedRecords, "transactions"),
    messages: applyRecordTombstones(mergeById(local.messages, remote.messages), deletedRecords, "messages"),
    audit: mergeById(local.audit, remote.audit),
    closings: mergeById(local.closings, remote.closings),
    updatedAt: new Date(Math.max(Date.parse(local.updatedAt || 0), Date.parse(remote.updatedAt || 0), Date.now())).toISOString(),
    lastMergedAt: new Date().toISOString(),
    mergeSource: localIsNewer ? "local-first" : "cloud-first"
  };
}

function normalizeStateForMerge(data) {
  const normalized = { ...createDefaultState(), ...(data || {}) };
  normalized.settings = { ...createDefaultState().settings, ...(normalized.settings || {}) };
  ["groups", "users", "customers", "collections", "loans", "transactions", "messages", "audit", "closings", "deletedUsers", "deletedRecords"].forEach((key) => {
    normalized[key] = normalized[key] || [];
  });
  return normalized;
}

function applyUserTombstones(users = [], tombstones = []) {
  return users.filter((user) => {
    if (user.id === "u-owner" || user.id === "u-developer" || user.id === "u-superadmin") return true;
    // Privileged roles only ignore name-based tombstones; deleting that exact account must stick.
    const privileged = user.role === "SystemOwner" || user.role === "KBA" || user.systemOwner === true;
    const userTime = Date.parse(user.updatedAt || user.createdAt || 0);
    const tombstone = tombstones.find((item) => {
      const sameId = item.userId && item.userId === user.id;
      const sameName = item.username && String(item.username).toLowerCase() === String(user.username || "").toLowerCase();
      return privileged ? sameId : sameId || sameName;
    });
    if (!tombstone) return true;
    const deletedTime = Date.parse(tombstone.deletedAt || tombstone.createdAt || 0);
    return userTime > deletedTime;
  });
}

function applyRecordTombstones(rows = [], tombstones = [], collectionName) {
  const deletes = tombstones.filter((item) => item.collection === collectionName);
  if (!deletes.length) return rows;
  return rows.filter((row) => {
    const tombstone = deletes.find((item) => item.recordId === row.id);
    if (!tombstone) return true;
    const rowTime = Date.parse(row.updatedAt || row.createdAt || row.date || 0);
    const deletedTime = Date.parse(tombstone.deletedAt || tombstone.createdAt || 0);
    return rowTime > deletedTime;
  });
}

function mergeUsers(localUsers = [], remoteUsers = []) {
  const merged = new Map();
  [...remoteUsers, ...localUsers].forEach((user) => {
    if (!user) return;
    const key = user.username ? `username:${String(user.username).toLowerCase()}` : `id:${user.id}`;
    const existing = merged.get(key);
    const chosen = chooseUserRecord(existing, user);
    if (existing && isPlaceholderHash(chosen.passwordHash)) {
      const other = chosen === user ? existing : user;
      const real = [user.passwordHash, existing.passwordHash, other.passwordHash].find((hash) => !isPlaceholderHash(hash));
      if (real) chosen.passwordHash = real;
    }
    merged.set(key, chosen);
  });
  return Array.from(merged.values());
}

function isPlaceholderHash(hash) {
  return !hash || hash === "[protected]" || hash === "[local-only]";
}

function chooseUserRecord(a, b) {
  if (!a) return b;
  const aReady = Boolean(a.active && !a.pending);
  const bReady = Boolean(b.active && !b.pending);
  const aPending = Boolean(a.pending);
  const bPending = Boolean(b.pending);
  if (aReady && bPending) return { ...b, ...a, active: true, pending: false };
  if (bReady && aPending) return { ...a, ...b, active: true, pending: false };
  return chooseNewerRecord(a, b);
}

function mergeById(localRows = [], remoteRows = []) {
  const merged = new Map();
  [...remoteRows, ...localRows].forEach((row) => {
    if (!row) return;
    const id = row.id || row.ref || `${row.date || ""}-${row.action || row.type || ""}-${row.customerId || ""}-${row.createdAt || ""}`;
    const existing = merged.get(id);
    merged.set(id, chooseNewerRecord(existing, row));
  });
  return Array.from(merged.values());
}

function chooseNewerRecord(a, b) {
  if (!a) return b;
  const aTime = Date.parse(a.updatedAt || a.createdAt || a.date || 0);
  const bTime = Date.parse(b.updatedAt || b.createdAt || b.date || 0);
  return bTime >= aTime ? { ...a, ...b } : { ...b, ...a };
}

export async function hashNewPassword(password) {
  return hashPassword(password);
}
