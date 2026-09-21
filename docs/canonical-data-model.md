# Canonical PostgreSQL data model

This phase locks **one Smile Trust data model**. The Windows EXE and Android APK are the same `app.js` client. They must not grow a second schema.

**This phase does not rebuild screens, does not ship a new EXE/APK, and does not open a direct SQL connection from the clients.**

---

## A. Current database audit

| Store | Who | What | Authoritative today? |
|---|---|---|---|
| `localStorage` key `smile_trust_susu_v1` | EXE + APK + browser | Full snapshot: users, customers, collections, loans, ledger, settings | **Yes** |
| Legacy `smile_trust_susu_android_v1` | Old APK | Same snapshot; merged into v1 on load | No |
| `sessionStorage` | Current session | Logged-in user id | No |
| Supabase table `smile_trust_cloud_snapshots` | Optional cloud merge | JSON copy of the snapshot | No |
| PostgreSQL (migrations 001–018) | Optional RPCs | Relational branches, customers, collections, groups, withdrawals, notifications | **No** (`postgresSourceOfTruth` defaults false) |
| `state.offlineQueue` | Offline devices | Pending writes until flush | No |
| Hardcoded seed | First launch | JOHN / KBA users | Bootstrap only |
| Sibling Next.js folder (not this repo) | Separate product | Must not be treated as this schema | Conflict if mixed |

**Duplicates:** JSON snapshot vs relational tables; `groups` in JS often acting as branches vs `branches`; `customers.name` vs split first/last; `collections.amount` (GHS numeric) vs `amount_pesewas`.

**Conflicts:** `customerBalance` sums GHS `transactions` unless `ledgerEntries` exist. Core modules store integer **pesewas**. Loans exist in localStorage; SQL had `loan_status_history` without `loans`.

**Missing relationships:** loans → ledger; journal JSON lines not normalized; roles/permissions only in JS.

**IDs:** Clients already use string `uid()` values (`cus-…`, `col-…`), not auto-increment `125`. PostgreSQL uses UUID PKs plus `client_id` to map those strings. Human numbers (`ST-…`, receipt numbers) stay unique per business.

**MySQL / SQLite / Room / IndexedDB:** not used in this repo.

---

## B. Target architecture

| Layer | Decision |
|---|---|
| Backend | Trusted API only (not built in this phase). Existing `record_collection_from_client` RPC is a starting point, not the full API. |
| Database | PostgreSQL 16+ in `public`. One database. |
| Authentication | Central `app_users`. Target server Argon2id; today hashes are PBKDF2 in the client. Do not reset live passwords here. |
| Authorization | `roles` / `permissions` / `role_permissions` / `user_roles`. `app_users.role` remains a compatibility column. |
| API | HTTPS operations listed below. Clients never connect to PostgreSQL. |
| Realtime | `system_events` outbox after COMMIT. |
| Offline | `sync_queue` + `idempotency_keys`. Queue is not a second ledger. |
| Money | Integer **pesewas** (1 GHS = 100). Currency **GHS**. |
| Balance | Derived from `ledger_entries`. `savings_accounts.balance_pesewas` is cache only. |

```text
WINDOWS EXE  ─┐
ANDROID APK  ─┼─►  HTTPS API  ─►  PostgreSQL
              ┘         ▲
         no direct SQL ─┘
```

### Stop condition (honest)

Reliable “create on Windows, read on Android” **cannot** be guaranteed while localStorage remains the writer. Merge-by-id snapshot sync can overwrite or fork financial history. **Do not mark PostgreSQL as source of truth until the API owns every financial write and integration tests pass.** What this phase *does* lock: the tables, aliases, money unit, IDs, constraints, and migration path.

---

## C. Canonical data model

Prompt names map to **existing** tables. Do not create parallel `members` / `organizations` / `users` tables.

| Prompt name | Canonical table |
|---|---|
| Organization | `businesses` |
| Branch | `branches` |
| User | `app_users` |
| Member | `customers` |
| Contribution | `collections` |
| SUSU account | `savings_accounts` + `susu_group_members` |
| Withdrawal | `withdrawal_requests` |
| Audit | `audit_log` |
| Sync | `sync_queue` |
| Nominee | `beneficiaries` |

New in `019_canonical_schema.sql`: `roles`, `permissions`, `role_permissions`, `user_roles`, `sessions`, `system_settings`, `user_preferences`, `idempotency_keys`, `system_events`, `loans`, `loan_repayments`, `loan_disbursements`, `journal_lines`, `chart_of_accounts`, views `members` / `organizations`.

**SUSU meaning in Smile Trust**

- A **member** (`customers`) belongs to a **branch** and optionally a **susu group**.
- **Personal savings** use `savings_accounts` + `savings_products` (daily/weekly/flexible).
- **Group susu** uses `susu_groups` + `susu_group_members` + meeting collections.
- Expected contribution comes from the product or group `contribution_amount_pesewas` and frequency.
- Actual contribution is a **Posted** `collections` row.
- Missed contribution is amount 0 / visit outcome — not a deleted row.
- **Balance** = ledger, not a field the APK or EXE may edit.

**Contribution lifecycle:** Initiated → Pending → Validated → Posted. Correction: Posted → Reversal (new ledger pair). Never delete posted money.

**Withdrawal:** Requested → Verified → Approved → Paid (Cashier GHS 1,000 approval limit unchanged). Paid → Reversed only with a reason.

**Loan:** Draft → Submitted → Pending Approval → Approved → Disbursed → Active → Completed. Outstanding = disbursed − posted repayments on the ledger.

**Atomic contribution**

1. Validate  
2. Insert `collections` (`idempotency_key`, `receipt_no`)  
3. Insert paired `ledger_entries`  
4. Insert `audit_log`  
5. Insert `system_events`  
6. COMMIT  

---

## D. Migration plan

```text
BACKUP localStorage export + Postgres dump
    ↓
Keep 001–018 (already applied conceptually)
    ↓
Apply 019_canonical_schema.sql on a copy
    ↓
Map client_id → uuid for customers, users, collections, loans
    ↓
Rebuild savings_accounts.balance_pesewas from ledger
    ↓
Count members, collections, ledger totals both sides
    ↓
Do not enable postgresSourceOfTruth until API tests pass
```

Preserve: members, collections, withdrawals, ledger, users (hashes), branches, groups.  
Do not migrate fake seed loans.  
Do not drop snapshot table until relational catch-up is proven.

Rollback: restore dump; 019 only adds tables/views/columns.

---

## E. Test plan (must pass before client cutover)

Schema catalog tests (this repo, `tests/canonical-schema.test.js`): aliases, pesewas, no EXE/APK-only tables, atomic contribution, live loan/withdrawal statuses.

Still required on a real Postgres (next phase, against a copy):

- Unique member number, username, receipt, idempotency  
- FK reject orphan collections  
- Duplicate contribution returns existing row  
- Contribution rollback leaves no orphan ledger  
- Debits = credits on a posted journal  
- Concurrent collection with same key  
- Create user / role / permission  
- Cross-client: insert via API, read from both UIs  

Golden dataset (API phase): 5 branches, 10 users, 100 members, 500 contributions — Postgres = API = EXE = APK.

---

## API contract (operations, not table dumps)

See `API_OPERATIONS` in `src/core/canonical-schema.js`. Examples: `POST /api/v1/contributions`, `POST /api/v1/withdrawals/:id/approve`. The API is **not implemented in this phase**.

---

## Definition of done

| Criterion | This phase |
|---|---|
| One documented PostgreSQL model | Yes |
| No EXE-only / APK-only production tables | Yes |
| Members/users/roles/ledger named and constrained | Yes |
| Clients writing only through API | **Not yet** — requires API phase |
| `postgresSourceOfTruth` enabled | **Not yet** |
| UI / EXE / APK rebuild | Intentionally not done |
