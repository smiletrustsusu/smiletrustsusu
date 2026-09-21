/**
 * Canonical Smile Trust data model.
 * One PostgreSQL schema for EXE and APK. Clients must not own a second database.
 *
 * Existing table names are preserved. Prompt names (members, organizations) are aliases.
 */
export const CANONICAL_SCHEMA_VERSION = "1.0.0";
export const MONEY_UNIT = "pesewas";
export const MONEY_SCALE = 100;
export const CURRENCY = "GHS";
export const ID_STRATEGY = "uuid_pk_plus_client_id";

export const CURRENT_DATA_SOURCES = [
  {
    id: "localStorage",
    name: "Browser / Electron / Capacitor localStorage",
    key: "smile_trust_susu_v1",
    who: "Windows EXE, Android APK, and any browser session of this same app.js",
    contains: "Full business snapshot: users, customers, collections, loans, ledger, settings",
    authoritativeToday: true
  },
  {
    id: "legacyAndroidStorage",
    name: "Legacy Android localStorage",
    key: "smile_trust_susu_android_v1",
    who: "Older APK installs; migrated into smile_trust_susu_v1 on load",
    contains: "Same snapshot shape",
    authoritativeToday: false
  },
  {
    id: "sessionStorage",
    name: "sessionStorage",
    key: "smile_trust_session_user",
    who: "Current device session",
    contains: "Logged-in user id, UI drafts — not financial history",
    authoritativeToday: false
  },
  {
    id: "supabaseSnapshot",
    name: "Supabase smile_trust_cloud_snapshots",
    who: "Optional cloud backup / merge sync",
    contains: "Serialized JSON copy of localStorage state",
    authoritativeToday: false
  },
  {
    id: "postgresRelational",
    name: "Supabase PostgreSQL 16 (migrations 001–018)",
    who: "Optional relational sync RPCs; not used as exclusive source of truth",
    contains: "Normalized tables for branches, customers, collections, groups, withdrawals, notifications",
    authoritativeToday: false
  },
  {
    id: "offlineQueue",
    name: "state.offlineQueue",
    who: "Android / desktop when offline",
    contains: "Pending collections, meetings, withdrawals until flush",
    authoritativeToday: false
  }
];

export const ENTITY_ALIASES = {
  organizations: "businesses",
  members: "customers",
  users: "app_users",
  contributions: "collections",
  susu_accounts: "savings_accounts",
  audit_logs: "audit_log",
  sync_operations: "sync_queue",
  member_nominees: "beneficiaries",
  member_documents: "customer_documents"
};

export const TABLES_NOT_CREATED = [
  {
    promptName: "members",
    reason: "customers is the live member record. A second members table would split identity."
  },
  {
    promptName: "organizations",
    reason: "businesses is the live tenant/organization table."
  },
  {
    promptName: "cash_accounts / bank_accounts as balance owners",
    reason: "Channel cash is ledger accounts account:cash, account:momo, account:bank, account:pos. Cached tills are not authoritative."
  }
];

export const CANONICAL_TABLES = [
  { name: "businesses", alias: "organizations", category: "Organization & Branches", pk: "id uuid", purpose: "Single Smile Trust tenant", unique: ["code", "legacy_code"] },
  { name: "branches", alias: "branches", category: "Organization & Branches", pk: "id uuid", purpose: "Operating branch / group desk", unique: ["(business_id, lower(code))", "(business_id, name)"] },
  { name: "app_users", alias: "users", category: "Users & Authentication", pk: "id uuid", purpose: "One staff identity for EXE and APK", unique: ["(business_id, lower(username))", "client_id"] },
  { name: "roles", alias: "roles", category: "Roles & Permissions", pk: "id uuid", purpose: "Configurable role catalog (SystemOwner, KBA, Collector, …)" },
  { name: "permissions", alias: "permissions", category: "Roles & Permissions", pk: "id uuid", purpose: "Data-driven actions such as Customer.View, Savings.Collect" },
  { name: "role_permissions", alias: "role_permissions", category: "Roles & Permissions", pk: "id uuid", purpose: "What each role may do", unique: ["(role_id, permission_id)"] },
  { name: "user_roles", alias: "user_roles", category: "Roles & Permissions", pk: "id uuid", purpose: "Assigned roles; app_users.role remains a compatibility column", unique: ["(user_id, role_id)"] },
  { name: "devices", alias: "devices", category: "Devices & Sessions", pk: "id uuid", purpose: "Authorized Windows / Android installations", unique: ["(business_id, device_fingerprint)"] },
  { name: "sessions", alias: "sessions", category: "Devices & Sessions", pk: "id uuid", purpose: "Revocable server sessions; not localStorage sessionUserId" },
  { name: "customers", alias: "members", category: "Members", pk: "id uuid", purpose: "Authoritative member identity", unique: ["(business_id, lower(account_no))", "customer_number"] },
  { name: "customer_documents", alias: "member_documents", category: "Members", pk: "id", purpose: "KYC documents metadata" },
  { name: "beneficiaries", alias: "member_nominees", category: "Members", pk: "id uuid", purpose: "Nominees with share_percent" },
  { name: "susu_groups", alias: "susu_groups", category: "SUSU", pk: "id uuid", purpose: "Rotating / group susu cycle", unique: ["(business_id, lower(code))"] },
  { name: "susu_group_members", alias: "susu_group_members", category: "SUSU", pk: "id uuid", purpose: "Membership of a group", unique: ["(susu_group_id, customer_id)"] },
  { name: "savings_accounts", alias: "susu_accounts", category: "SUSU", pk: "id uuid", purpose: "Personal savings account; balance_pesewas is cache only" },
  { name: "savings_products", alias: "loan_products_savings", category: "SUSU", pk: "id uuid", purpose: "Daily/weekly/group product rules", unique: ["(business_id, lower(code))"] },
  { name: "collections", alias: "contributions", category: "Contributions", pk: "id uuid", purpose: "Posted contribution events", unique: ["(business_id, idempotency_key)", "(business_id, receipt_no)"] },
  { name: "withdrawal_requests", alias: "withdrawals", category: "Withdrawals", pk: "id uuid", purpose: "Request → Verified → Approved → Paid" },
  { name: "loans", alias: "loans", category: "Loans", pk: "id uuid", purpose: "Approved/active loan; outstanding from ledger not a writable column" },
  { name: "loan_status_history", alias: "loan_approvals", category: "Loans", pk: "id", purpose: "Immutable status transitions" },
  { name: "ledger_entries", alias: "transaction_lines", category: "Accounting & Ledger", pk: "id uuid", purpose: "Append-only debit/credit lines in pesewas" },
  { name: "journal_entries", alias: "journal_entries", category: "Accounting & Ledger", pk: "id uuid", purpose: "Manual journals; lines must balance" },
  { name: "journal_lines", alias: "journal_lines", category: "Accounting & Ledger", pk: "id uuid", purpose: "Normalized journal debit/credit rows" },
  { name: "chart_of_accounts", alias: "ledger_accounts", category: "Accounting & Ledger", pk: "code", purpose: "Ghana COA; cash 1000, MoMo 1010" },
  { name: "reversals", alias: "reversals", category: "Financial Transactions", pk: "id uuid", purpose: "Correction of posted collections without deletes" },
  { name: "notifications", alias: "notifications", category: "Notifications", pk: "id uuid", purpose: "Queued communications; Module 12" },
  { name: "system_settings", alias: "system_settings", category: "System Configuration", pk: "id uuid", purpose: "Organization settings; not per-client copies" },
  { name: "user_preferences", alias: "user_preferences", category: "System Configuration", pk: "id uuid", purpose: "Theme/language for the same user on both clients" },
  { name: "audit_log", alias: "audit_logs", category: "Audit", pk: "id", purpose: "Immutable activity trail" },
  { name: "idempotency_keys", alias: "idempotency_keys", category: "Synchronization", pk: "id uuid", purpose: "Duplicate financial request protection" },
  { name: "sync_queue", alias: "sync_operations", category: "Synchronization", pk: "id uuid", purpose: "Move device operations to PostgreSQL; not a second ledger" },
  { name: "system_events", alias: "system_events", category: "Synchronization", pk: "id uuid", purpose: "Transactional outbox after commit" }
];

export const RELATIONSHIPS = [
  ["businesses", "branches", "1:n"],
  ["businesses", "app_users", "1:n"],
  ["branches", "customers", "1:n"],
  ["app_users", "customers", "1:n collector"],
  ["customers", "savings_accounts", "1:n"],
  ["customers", "beneficiaries", "1:n"],
  ["susu_groups", "susu_group_members", "1:n"],
  ["customers", "susu_group_members", "1:n"],
  ["customers", "collections", "1:n"],
  ["collections", "ledger_entries", "1:n via reference_id"],
  ["customers", "withdrawal_requests", "1:n"],
  ["customers", "loans", "1:n"],
  ["loans", "loan_status_history", "1:n"],
  ["journal_entries", "journal_lines", "1:n"],
  ["app_users", "user_roles", "1:n"],
  ["roles", "role_permissions", "1:n"],
  ["permissions", "role_permissions", "1:n"]
];

export const CONTRIBUTION_LIFECYCLE = ["Initiated", "Pending", "Validated", "Posted"];
export const CONTRIBUTION_REJECT = ["Pending", "Rejected"];
export const CONTRIBUTION_CORRECT = ["Posted", "Reversal"];

export const WITHDRAWAL_LIFECYCLE = ["Requested", "Verified", "Approved", "Paid"];
export const LOAN_LIFECYCLE = ["Draft", "Submitted", "Pending Approval", "Approved", "Disbursed", "Active", "Completed"];

export const ATOMIC_CONTRIBUTION = [
  "Validate member, product, date, amount",
  "Insert collections row with idempotency_key",
  "Insert paired ledger_entries (customer credit + cash/momo debit)",
  "Insert audit_log",
  "Insert system_events outbox",
  "COMMIT — never leave a collection without its ledger pair"
];

export const BALANCE_RULE = {
  authoritative: "Sum of ledger_entries for the customer (credits minus debits), excluding reversed originals that have a reversal pair",
  cache: "savings_accounts.balance_pesewas may exist for speed but must be rebuilt from ledger",
  forbidden: ["apk.balance", "exe.balance", "customers.balance as independently editable"]
};

export const API_OPERATIONS = [
  { method: "POST", path: "/api/v1/members", op: "Create customer after uniqueness checks" },
  { method: "GET", path: "/api/v1/members", op: "List members in the caller's branch scope" },
  { method: "GET", path: "/api/v1/members/:id", op: "Read one member" },
  { method: "PATCH", path: "/api/v1/members/:id", op: "Update non-financial profile fields with version check" },
  { method: "POST", path: "/api/v1/contributions", op: "Post collection atomically after commit of financial rows" },
  { method: "GET", path: "/api/v1/contributions", op: "Query collections" },
  { method: "POST", path: "/api/v1/contributions/:id/reverse", op: "Post reversing ledger pair; never delete" },
  { method: "POST", path: "/api/v1/withdrawals", op: "Create withdrawal request" },
  { method: "POST", path: "/api/v1/withdrawals/:id/approve", op: "Advance Requested → Verified → Approved" },
  { method: "POST", path: "/api/v1/withdrawals/:id/pay", op: "Pay after approval; post ledger" },
  { method: "POST", path: "/api/v1/loans", op: "Create loan application" },
  { method: "POST", path: "/api/v1/loans/:id/approve", op: "Approve within Cashier GHS 1000 / manager limits" },
  { method: "POST", path: "/api/v1/loans/:id/disburse", op: "Disburse and post ledger" },
  { method: "POST", path: "/api/v1/repayments", op: "Record loan repayment against ledger" }
];

export const INDEXES = [
  "customers (business_id, lower(account_no))",
  "customers (branch_id)",
  "customers (phone)",
  "app_users (business_id, lower(username))",
  "collections (business_id, collection_date)",
  "collections (business_id, idempotency_key)",
  "collections (business_id, receipt_no)",
  "ledger_entries (customer_id, server_created_at)",
  "loans (business_id, loan_number)",
  "withdrawal_requests (business_id, status)",
  "audit_log (business_id, created_at)",
  "sync_queue (business_id, status)"
];

export const ARCHITECTURE_GAPS = [
  "EXE and APK currently persist the full ledger in localStorage and optionally merge JSON snapshots. PostgreSQL is not yet the exclusive writer.",
  "Two PostgreSQL representations exist: smile_trust_cloud_snapshots (JSON) and relational tables (001–018). They can diverge.",
  "Loans live in localStorage; loan_status_history exists in SQL without a loans parent table until 019.",
  "customerBalance in app.js sums GHS numbers from transactions unless ledgerEntries exist; core modules use integer pesewas. Canonical money is pesewas.",
  "app_users.role is a CHECK string; permissions are still in roles.js / rbac.js until clients read role_permissions from the API.",
  "Passwords are PBKDF2-SHA-256 in the client today, not Argon2id. Server-side Argon2id is required when the API owns authentication. Do not reset live hashes in this phase.",
  "No REST/GraphQL server exists in this repository. Defining the contract is this phase; implementing the API is the next phase.",
  "settings.postgresSourceOfTruth is false by default. Do not flip it until API integration tests pass."
];

export function tableByName(name) {
  return CANONICAL_TABLES.find((item) => item.name === name || item.alias === name);
}

export function postgresIsSourceOfTruth(settings = {}) {
  return settings.postgresSourceOfTruth === true && settings.relationalSync === true;
}

export function assertSingleMemberModel() {
  const memberTables = CANONICAL_TABLES.filter((item) => item.alias === "members");
  return memberTables.length === 1 && memberTables[0].name === "customers";
}
