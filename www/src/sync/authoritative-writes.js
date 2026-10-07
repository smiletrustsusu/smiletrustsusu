/**
 * Member registrations, member edits and collections when the relational database is authoritative
 * (relational sync on, Supabase configured). The device records nothing as done until the
 * protected server write (upsert_customer_from_client / record_collection_from_client, both
 * authorized by migration 047 from the session's own claims) has definitively succeeded.
 *
 * Outcomes:
 * - success: the server holds the record (newly written, or already written by an earlier try).
 * - WRITE_REJECTED: nothing was written (refused before sending, or the server answered with an
 *   error, which rolls its transaction back). Safe to correct and try again.
 * - WRITE_UNCONFIRMED: the request may have reached the server but no definitive answer came back
 *   (network failure, timeout, gateway error, unexpected reply). Retry only with the same
 *   identity: the customer client_id and the collection idempotency_key make a retry return the
 *   original record instead of writing a second one.
 *
 * Before each write a fresh public.fetch_business_snapshot load confirms that every id the write
 * names already exists in the database: the server's ensure_branch / ensure_app_user /
 * ensure_customer helpers would otherwise create a branch, an active staff row or a member from
 * whatever a device sent.
 *
 * Collection receipt numbers are allocated by the server (migration 048). Until it answers, a
 * collection carries only a PENDING-<id> reference, which is not a receipt and must never be
 * printed, sent to the member or written to the ledger.
 */
import { resolveBusinessId, resolvedSupabaseUrl } from "../config.js";
import { toPesewas } from "../core/money.js";
import { currentSessionIdentity } from "./canonical-snapshot.js";
import { ensureFreshAccessToken, getAccessToken } from "./supabase-auth.js";
import { restHeaders, supabaseConfigured } from "./supabase-rest.js";

export const WRITE_REJECTED = "AUTHORITATIVE_WRITE_REJECTED";
export const WRITE_UNCONFIRMED = "AUTHORITATIVE_WRITE_UNCONFIRMED";
export const DEFAULT_WRITE_TIMEOUT_MS = 20000;

export class AuthoritativeWriteError extends Error {
  constructor(code, message, { status = 0, serverCode = "" } = {}) {
    super(message);
    this.name = "AuthoritativeWriteError";
    this.code = code;
    this.status = status;
    this.serverCode = serverCode;
  }
}

const list = (value) => (Array.isArray(value) ? value : []);
const lower = (value) => String(value ?? "").trim().toLowerCase();
const rejected = (message, extra) => new AuthoritativeWriteError(WRITE_REJECTED, message, extra);
const unconfirmed = (message, extra) => new AuthoritativeWriteError(WRITE_UNCONFIRMED, message, extra);

export const PENDING_REFERENCE_LABEL = "Pending reference — not a receipt";

export function pendingCollectionReference(collectionId) {
  const short = String(collectionId || "").replace(/[^A-Za-z0-9]/g, "").slice(-8).toUpperCase();
  return `PENDING-${short || "UNKNOWN"}`;
}

export function isPendingReference(value) {
  return /^PENDING-/i.test(String(value ?? "").trim());
}

const serverReceipt = (value) => {
  const receipt = String(value ?? "").trim();
  return receipt && !isPendingReference(receipt) ? receipt : "";
};

/**
 * Gives a server-confirmed collection the server's receipt number before anything posts, prints or
 * announces it. Throws (unconfirmed) when the confirmation carries no usable receipt.
 */
export function adoptServerReceipt(collection, result) {
  const receipt = serverReceipt(result?.receiptNo);
  if (!receipt) throw unconfirmed("the server's answer did not include the receipt number");
  collection.receiptNo = receipt;
  collection.paymentNo = receipt;
  collection.temporaryReceiptNo = "";
  delete collection.pendingReference;
  return receipt;
}

/** Same condition as relationalSyncEnabled (relational-sync.js imports this module). */
export function authoritativeWritesEnabled(state) {
  return state?.settings?.relationalSync === true && supabaseConfigured(state);
}

function readableServerMessage(text) {
  let message = "";
  let serverCode = "";
  try {
    const body = JSON.parse(text);
    message = String(body?.message || body?.error || "");
    serverCode = String(body?.code || "");
  } catch {
    message = String(text || "");
  }
  message = message.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9._-]+/g, "[token]").replace(/\s+/g, " ").trim().slice(0, 160);
  return { message, serverCode };
}

/** One protected RPC call, classified as success, definitive rejection or unconfirmed outcome. */
async function callProtectedRpc(state, name, body, { timeoutMs = DEFAULT_WRITE_TIMEOUT_MS, describeConflict } = {}) {
  await ensureFreshAccessToken(state).catch(() => "");
  if (!getAccessToken()) throw rejected("sign in online first: there is no server session on this device");
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  let response;
  try {
    response = await fetch(`${resolvedSupabaseUrl(state)}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: restHeaders(state, { prefer: "return=representation" }),
      body: JSON.stringify(body),
      signal: controller?.signal
    });
  } catch (error) {
    throw unconfirmed(error?.name === "AbortError" ? "the server did not answer in time" : "the connection to the server failed");
  } finally {
    if (timer) clearTimeout(timer);
  }
  const text = await response.text().catch(() => null);
  if (response.ok) {
    if (text === null) throw unconfirmed("the server's answer could not be read", { status: response.status });
    try {
      return text ? JSON.parse(text) : null;
    } catch {
      throw unconfirmed("the server's answer could not be read", { status: response.status });
    }
  }
  const { message, serverCode } = readableServerMessage(text);
  if (response.status >= 500) {
    throw unconfirmed(`the server reported an error (${response.status}) and may or may not have saved it`, { status: response.status, serverCode });
  }
  if (serverCode === "23505") {
    throw rejected(describeConflict ? describeConflict(message) : "the database already holds a conflicting record", { status: response.status, serverCode });
  }
  if (response.status === 401 || response.status === 403 || serverCode === "42501") {
    throw rejected(`the server refused this account${message ? `: ${message}` : ""}`, { status: response.status, serverCode });
  }
  throw rejected(`the server refused it${message ? `: ${message}` : ` (${response.status})`}`, { status: response.status, serverCode });
}

/** The session the database authorizes by, which must belong to this device's business. */
async function signedInBusiness(state) {
  const identity = await currentSessionIdentity(state);
  if (!identity) throw rejected("sign in online with a staff account first (this session carries no server identity)");
  const businessCode = resolveBusinessId(state);
  if (!businessCode || identity.businessCode !== businessCode) {
    throw rejected("the signed-in account belongs to a different business than this device");
  }
  return { identity, businessCode };
}

/** Must match public.st_jwt_is_manager() (migration 047). */
const SERVER_MANAGER_ROLES = new Set(["SystemOwner", "KBA", "Admin", "ManagingDirector", "Accountant"]);

/** For any other role, st_scope_staff_payload replaces collector_client_id with the caller's own id. */
function assertCollectorKept(identity, collectorId) {
  if (SERVER_MANAGER_ROLES.has(identity.role) || collectorId === identity.appUserId) return;
  throw rejected("the server would assign this member to your own account instead of its collector; ask a manager to make this change");
}

async function freshDatabaseLoad(state, businessCode) {
  let load;
  try {
    load = await callProtectedRpc(state, "fetch_business_snapshot", { business_code: businessCode });
  } catch (error) {
    throw rejected(`the database could not be checked first (${error.message}); nothing was sent`);
  }
  if (!load || typeof load !== "object" || !["groups", "customers", "users"].every((key) => Array.isArray(load[key]))) {
    throw rejected("the database load was incomplete; nothing was sent");
  }
  return load;
}

export function customerRpcPayload(customer, { businessCode, groupName = "" }) {
  return {
    business_code: businessCode,
    customer_client_id: customer.id,
    account_no: String(customer.accountNo || "").trim(),
    customer_name: String(customer.name || "").trim(),
    customer_phone: String(customer.phone || ""),
    branch_client_id: customer.groupId,
    branch_name: groupName,
    collector_client_id: customer.collectorId,
    active: true
  };
}

/**
 * Registers a new member in the database. Resolves once the server holds it; throws
 * AuthoritativeWriteError otherwise. Retrying with the same customer object is safe.
 */
export async function registerCustomerAuthoritatively(state, customer, { timeoutMs } = {}) {
  if (!customer?.id || !String(customer.accountNo || "").trim() || !customer.groupId || !customer.collectorId) {
    throw rejected("the member is missing an id, account number, location or collector");
  }
  const { identity, businessCode } = await signedInBusiness(state);
  assertCollectorKept(identity, customer.collectorId);
  const load = await freshDatabaseLoad(state, businessCode);
  const group = list(load.groups).find((item) => item?.id === customer.groupId);
  if (!group) throw rejected("this location is not in the database; refresh from the server first");
  if (!list(load.users).some((item) => item?.id === customer.collectorId)) {
    throw rejected("the assigned collector is not in the database; refresh from the server first");
  }
  const accountNo = lower(customer.accountNo);
  const sameId = list(load.customers).find((item) => item?.id === customer.id);
  if (sameId) {
    if (lower(sameId.accountNo) === accountNo) return { status: "already-registered", customerId: customer.id };
    throw rejected("a different member already uses this registration id in the database");
  }
  if (list(load.customers).some((item) => lower(item?.accountNo) === accountNo)) {
    throw rejected(`account number ${customer.accountNo} is already used by another member in the database`);
  }
  const result = await callProtectedRpc(state, "upsert_customer_from_client", { payload: customerRpcPayload(customer, { businessCode, groupName: group.name || "" }) }, {
    timeoutMs,
    describeConflict: () => `account number ${customer.accountNo} is already used by another member in the database`
  });
  if (result?.ok !== true || !result?.customer_id) throw unconfirmed("the server's answer did not confirm the registration");
  return { status: "registered", customerId: customer.id, serverCustomerId: String(result.customer_id) };
}

/**
 * Edits an existing database member through upsert_customer_from_client. Its update branch
 * changes only name, phone, location and collector, so only name, phone and location (groupId)
 * are accepted here; the collector, account number, status and account type stay as the database
 * holds them. The member must already exist in the database: for an unknown client id the same
 * RPC would insert a new member. Resolves once the database holds the edit; throws
 * AuthoritativeWriteError otherwise. Retrying the same edit is safe (an update by client id).
 */
export async function updateCustomerAuthoritatively(state, customerId, changes, { timeoutMs } = {}) {
  const name = String(changes?.name || "").trim();
  const phone = String(changes?.phone || "").trim();
  if (!customerId || !name || !phone || !changes?.groupId) throw rejected("the member edit is missing a name, phone or location");
  const { identity, businessCode } = await signedInBusiness(state);
  const load = await freshDatabaseLoad(state, businessCode);
  const current = list(load.customers).find((item) => item?.id === customerId);
  if (!current) throw rejected("this member is not in the database (it may exist only on this device); nothing was sent");
  if (changes.accountNo !== undefined && lower(changes.accountNo) !== lower(current.accountNo)) {
    throw rejected(`the account number cannot be changed here; the database holds ${current.accountNo} for this member`);
  }
  assertCollectorKept(identity, current.collectorId);
  const group = list(load.groups).find((item) => item?.id === changes.groupId);
  if (!group) throw rejected("this location is not in the database; refresh from the server first");
  if (!list(load.users).some((item) => item?.id === current.collectorId)) {
    throw rejected("the member's collector is not in the database; refresh from the server first");
  }
  if (current.name === name && current.phone === phone && current.groupId === changes.groupId) {
    return { status: "already-applied", customerId };
  }
  const payload = {
    business_code: businessCode,
    customer_client_id: customerId,
    account_no: current.accountNo,
    customer_name: name,
    customer_phone: phone,
    branch_client_id: changes.groupId,
    branch_name: group.name || "",
    collector_client_id: current.collectorId,
    active: current.active !== false
  };
  const result = await callProtectedRpc(state, "upsert_customer_from_client", { payload }, { timeoutMs });
  if (result?.ok !== true || !result?.customer_id) throw unconfirmed("the server's answer did not confirm the edit");
  return { status: "updated", customerId, serverCustomerId: String(result.customer_id) };
}

/** receipt_no is sent only when the collection already has a real one; signed-in callers' values are ignored by the server (048). */
export function collectionRpcPayload(state, collection, businessCode) {
  const customer = list(state.customers).find((item) => item.id === collection.customerId);
  const receipt = serverReceipt(collection.receiptNo || collection.paymentNo);
  return {
    business_code: businessCode,
    client_id: collection.id,
    ...(receipt ? { receipt_no: receipt } : {}),
    idempotency_key: collection.idempotencyKey,
    amount: Number(collection.amount || 0),
    amount_pesewas: Number(collection.amountPesewas ?? toPesewas(collection.amount)),
    payment_method: collection.paymentMethod || "Cash",
    payment_reference: collection.paymentReference || "",
    verification_status: collection.verificationStatus || "Verified",
    collection_date: collection.date,
    client_created_at: collection.createdAt,
    customer_client_id: collection.customerId,
    customer_name: customer?.name || "",
    customer_phone: customer?.phone || "",
    account_no: customer?.accountNo || collection.accountNo || "",
    collector_client_id: collection.collectorId || collection.userId,
    branch_client_id: collection.groupId,
    susu_group_client_id: collection.susuGroupId || null,
    note: collection.note || "",
    reversed: Boolean(collection.reversed),
    device_fingerprint: collection.deviceFingerprint || ""
  };
}

/**
 * Records a collection (and, server-side, its ledger credit) in the database. Resolves with the
 * server's collection id and receipt number once it holds it; throws AuthoritativeWriteError
 * otherwise. Retrying the same collection object (same idempotency key) never records it twice and
 * returns the original receipt number.
 */
export async function submitCollectionAuthoritatively(state, collection, { timeoutMs } = {}) {
  if (!collection?.id || !String(collection.idempotencyKey || "").trim()) {
    throw rejected("the collection is missing its id or idempotency key");
  }
  if (!Number.isFinite(Number(collection.amount)) || Number(collection.amount) < 0) throw rejected("the amount is not valid");
  const { businessCode } = await signedInBusiness(state);
  const load = await freshDatabaseLoad(state, businessCode);
  const recorded = list(load.collections).find((item) => item?.id === collection.id || (item?.idempotencyKey && item.idempotencyKey === collection.idempotencyKey));
  if (recorded) {
    const receiptNo = serverReceipt(recorded.receiptNo);
    if (!receiptNo) throw unconfirmed("the database holds this collection but did not return its receipt number");
    return { status: "duplicate", collectionId: collection.id, receiptNo };
  }
  const payload = collectionRpcPayload(state, collection, businessCode);
  if (!list(load.customers).some((item) => item?.id === payload.customer_client_id)) {
    throw rejected("this member is not in the database yet; register or refresh the member first");
  }
  if (!list(load.groups).some((item) => item?.id === payload.branch_client_id)) {
    throw rejected("the member's location is not in the database; refresh from the server first");
  }
  if (!list(load.users).some((item) => item?.id === payload.collector_client_id)) {
    throw rejected("the collector is not in the database; refresh from the server first");
  }
  const result = await callProtectedRpc(state, "record_collection_from_client", { payload }, {
    timeoutMs,
    describeConflict: () => "the database refused a conflicting record (nothing was recorded); refresh from the server and try again"
  });
  if (!["recorded", "duplicate"].includes(result?.status) || !result?.collection_id) {
    throw unconfirmed("the server's answer did not confirm the collection");
  }
  const receiptNo = serverReceipt(result.receipt_no);
  if (!receiptNo) throw unconfirmed("the server's answer did not include the receipt number");
  return { status: result.status, collectionId: collection.id, serverCollectionId: String(result.collection_id), receiptNo };
}

/* Collections whose server outcome is not yet known: never posted locally, kept for a same-identity retry. */
export function collectionsAwaitingConfirmation(state) {
  if (!Array.isArray(state.pendingCollectionConfirmations)) state.pendingCollectionConfirmations = [];
  return state.pendingCollectionConfirmations;
}

export function holdCollectionForConfirmation(state, collection, reason, { now = new Date().toISOString() } = {}) {
  const held = collectionsAwaitingConfirmation(state);
  const existing = held.find((item) => item.id === collection.id);
  if (existing) {
    existing.lastError = reason;
    existing.lastAttemptAt = now;
    return existing;
  }
  const entry = {
    id: collection.id,
    idempotencyKey: collection.idempotencyKey,
    customerId: collection.customerId,
    amount: Number(collection.amount || 0),
    receiptNo: serverReceipt(collection.receiptNo || collection.paymentNo),
    pendingReference: collection.pendingReference || pendingCollectionReference(collection.id),
    heldAt: now,
    lastAttemptAt: now,
    lastError: reason,
    collection: structuredClone(collection)
  };
  held.push(entry);
  return entry;
}

export function releaseCollectionConfirmation(state, id) {
  state.pendingCollectionConfirmations = collectionsAwaitingConfirmation(state).filter((item) => item.id !== id);
}

export function collectionAwaitingConfirmationFor(state, customerId) {
  return collectionsAwaitingConfirmation(state).find((item) => item.customerId === customerId) || null;
}
