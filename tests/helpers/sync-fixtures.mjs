/**
 * Shared shapes for mocked post-bootstrap sync tests: a staff session token carrying the claims
 * the server issues, the rows public.fetch_business_snapshot returns, and the canonical cloud copy
 * an Initial Cloud Snapshot stores from them. Imports nothing from src/ so tests can set up their
 * browser globals first.
 */
const b64url = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");

export function staffSession({ business, role = "SystemOwner", appUserId = "demo-user-john", username = "john", sessionId = "session-1" }) {
  const claims = { role: "authenticated", sub: `auth-${appUserId}`, session_id: sessionId, app_metadata: { business_code: business, app_user_id: appUserId, app_role: role } };
  return {
    access_token: `${b64url({ alg: "none" })}.${b64url(claims)}.sig`,
    refresh_token: "refresh",
    expires_at: Date.now() + 3600_000,
    app_user: { id: appUserId, username, role }
  };
}

export function relationalLoad() {
  return {
    groups: [{ id: "demo-branch-accra", name: "Accra Main", active: true, collectorCode: "ACC" }],
    customers: [{ id: "demo-customer-001", accountNo: "ST-1001", name: "Demo Member", phone: "233200000001", groupId: "demo-branch-accra", collectorId: "demo-user-kwame", active: true, memberStatus: "Active", accountType: "personal" }],
    collections: [],
    users: [
      { id: "demo-user-john", username: "john", name: "System Owner", role: "SystemOwner", groupId: "demo-branch-accra", active: true, authEmail: "john@staff.example" },
      { id: "demo-user-ama", username: "ama", name: "Ama Manager", role: "Admin", groupId: "demo-branch-accra", active: false, authEmail: null },
      { id: "demo-user-kwame", username: "kwame", name: "Kwame Collector", role: "Collector", groupId: "demo-branch-accra", active: false, authEmail: null }
    ],
    savingsProducts: [{ id: "SUSU-DAILY", code: "SUSU-DAILY", name: "Daily Susu", type: "susu", collectionType: "daily", frequency: "daily", minAmountPesewas: 100, defaultAmountPesewas: 500, active: true }]
  };
}

/** The relational rows the integrity check compares the load with. */
export function tableRows(load) {
  return {
    customers: load.customers.map((c) => ({ client_id: c.id, branch_id: "b-uuid", collector_id: "u-uuid" })),
    collections: load.collections.map((c) => ({ client_id: c.id, customer_id: "c-uuid", branch_id: "b-uuid", collector_id: "u-uuid" }))
  };
}

export function canonicalPayload(load, businessCode, extra = {}) {
  return {
    settings: { collectionDays: 31, loanInterest: 15, businessName: "SMILE TRUST SUSU MANAGEMENT SYSTEM", currency: "GHS", theme: "emerald", cloudUrl: "", localBackupUrl: "", businessId: businessCode, cloudMode: "auto" },
    groups: structuredClone(load.groups),
    users: structuredClone(load.users),
    customers: structuredClone(load.customers),
    collections: structuredClone(load.collections),
    loans: [], transactions: [], messages: [], closings: [], deletedUsers: [], deletedRecords: [], audit: [],
    savingsProducts: structuredClone(load.savingsProducts),
    updatedAt: "2026-10-05T10:44:18.728Z",
    ...extra
  };
}

export const CANONICAL_KEYS = ["audit", "closings", "collections", "customers", "deletedRecords", "deletedUsers", "groups", "loans",
  "messages", "savingsProducts", "settings", "transactions", "updatedAt", "users"];
