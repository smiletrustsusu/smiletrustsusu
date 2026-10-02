# Security hardening: migration 047 (blockers B1–B7)

Migration `supabase/migrations/047_security_hardening.sql` builds on 046. **It has not been applied to production.** It needs 046 in place (it refuses to run otherwise), a fresh backup, and an explicit go-ahead. The matching client and `staff-login` changes ship in the same release and must be deployed in the order below.

Tests: `tests/migration-047-security-hardening.test.js` (live-shaped path 001–045 without `rls.sql` → 046 → 047 → 047 again), `tests/security-server-authorization.test.js` (clean 001–047 with `rls.sql`, then 046 and 047 re-applied), `tests/staff-login-existing-users.test.js`, `tests/security-client-secrets.test.js`, `tests/security-hardening-client.test.js`, `tests/cross-device-login.test.js`, `tests/activate-existing-staff-script.test.js`.

## What changes

| Blocker | Server (047) | staff-login / app |
| --- | --- | --- |
| B1 role escalation | Trigger `st_guard_app_users` on every `app_users` write (direct, RLS or RPC). Only SystemOwner grants owner-level roles (SystemOwner, Owner, KBA, Developer); only SystemOwner/KBA touch manager-level accounts; nobody changes their own role, active flag or username; the last active SystemOwner cannot be demoted, deactivated or deleted; password hashes and identity columns never change from a client session. `st_upsert_staff_account` is the staff RPC (no password). | Staff create/edit/activate/disable are mirrored to `app_users` through `st_upsert_staff_account`. |
| B2 snapshot authority | Snapshot insert/update only for manager sessions (SystemOwner, KBA, Admin, ManagingDirector, Accountant). Delete is revoked. Collectors and other staff upload through `st_submit_collections`. | staff-login reads only `app_users` for password, role and active status; the snapshot is never consulted. Non-manager devices submit their own offline collections instead of writing the snapshot. |
| B3 snapshot secrets | Trigger strips passwords, hashes of any format, TOTP secrets, activation/recovery codes, session/access/refresh tokens and other keys at any depth; member portal PINs are bcrypt-hashed into `st_portal_pins` and removed. Existing snapshot rows are scrubbed once when 047 runs. | `sanitizeStateForCloud` strips the same keys (lists are tested to match). Device TOTP secrets are no longer uploaded (`upsert_user_mfa` is revoked from clients). |
| B4 deactivation | Every authorization helper (`st_tenant_match`, `st_business_authorized`, privileged RPCs, RLS) re-checks the live `app_users` row: active, not Developer, role equal to the session claim, Auth link equal to `auth.uid()`, and the session issued after the link's `sessions_not_before`. Deactivation or a role change moves that cutoff, bans the Auth user and deletes its sessions and refresh tokens (best effort). | Unchanged: staff-login refuses inactive rows and bans the linked Auth user. |
| B5 MFA | `user_mfa_secrets` is server-only (`last_used_step` added for replay protection). `st_reset_staff_mfa` (owner-only, reason required, audited in `st_staff_security_events`, forces re-sign-in). | Privileged roles get **no session** without a confirmed authenticator: 403 `mfa_enrollment_required`. `mfa_enroll_start` / `mfa_enroll_confirm` actions. Each TOTP code works once. The app requires the server check for privileged sign-in whenever a server is configured; offline only within 7 days of a server-verified sign-in on that device. |
| B6 financial | Ledger tables (collections, ledger entries, journals, loan repayments/disbursements, audit log, MoMo events, receipt sequences) accept no client writes; posted rows are never deleted and only status columns may change; a reversal cannot be undone. Workflow tables (withdrawal requests etc.) are written by managers only. RPC wrappers ignore payload roles and actors: the collector, cashier limit role and actor come from the session. Snapshot history is append-only: recorded collections, ledger entries and transactions cannot be removed, moved to another member, have their amount changed or be un-reversed; an approved adjustment may lower a collection. | Editing a disbursed loan's member, principal or date is refused (reverse and re-issue instead); the posted disbursement transaction is never edited. |
| B7 member lifecycle | A member with financial history cannot be deleted (snapshot or relational, even by SystemOwner); status changes need SystemOwner, KBA, Admin or ManagingDirector and are logged in `st_member_lifecycle_events` (who, role, from, to, when). Zero-history members may be deleted by SystemOwner only. | Delete closes members with history; bulk delete skips them; hard delete never cascades to collections, loans or transactions. |

## Proposed deployment sequence (each step is a human gate)

1. **Freeze and back up.** Every device syncs; stop financial work; database backup; export `smile_trust_cloud_snapshots`.
2. **Read-only preflight.** Run `supabase/preflight/047_production_preflight_readonly.sql` in the SQL editor of project qouokiqoepjpoksupskb. The first row must read `READY_FOR_047`; review every `WARN` row. It checks the 046 prerequisites, that 047 is absent, JOHN/AMA/KWAME, Auth links and claims, duplicates, orphaned snapshot history (which would block every manager sync after 047) and secrets in the snapshot, and records the counts to compare after 047 (`tests/preflight-047-readonly.test.js`).
3. **Apply 047** in the SQL editor (one transaction), then run `supabase/preflight/047_post_migration_readonly.sql`: the first row must read `POST_047_VERIFIED` (`tests/post-migration-047-readonly.test.js`). It changes no staff row, uuid, role, password or active flag; it scrubs secrets out of the snapshot payload and records the existing financial history baseline.
4. **Deploy the new `staff-login`.** From now on privileged roles need an authenticator (see JOHN below).
5. **JOHN enrolls MFA** from the app's sign-in screen.
6. **Distribute the new APK/EXE** (separate approval). Old builds keep reading, but collectors on old builds can no longer write the snapshot.
7. **Verify** with the read-only queries and a test collection from a collector device.
8. Only then activate AMA and KWAME (separate approval).

Re-applying 046 after 047 reverts 047's helpers, wrappers and policies. **If 046 is ever re-run, run 047 again immediately afterwards.**

## How JOHN enrolls MFA after deployment

Nothing is inserted by hand; JOHN's secret is generated on the server and never appears in SQL, logs, Auth metadata or the snapshot.

1. Install an authenticator app (Google Authenticator, Microsoft Authenticator or similar) on JOHN's phone.
2. Open the SMILE TRUST app, enter `john` and his existing password, and sign in. The server answers that two-factor authentication is required.
3. Tap **Set up authenticator**. The app shows a key once; add it to the authenticator app (manual entry, time-based).
4. Enter the 6-digit code and tap **Confirm**. The server enables the authenticator only after this code checks out.
5. Wait for the next code, enter it in the **MFA code** field and sign in.
6. Optional check from a PC: `scripts\activate-existing-staff.ps1 -Username john -Mode Login` prompts for the password and the authenticator code and prints `SIGN-IN VERIFIED`. Before enrollment it prints `MFA ENROLLMENT REQUIRED` and exits with code 3; it never shows the key.

JOHN's uuid, role, password and activation state are not touched by any of this.

## Lost authenticator (owner-controlled reset)

An owner signed in to the app (SystemOwner for anyone; KBA for non-owners; nobody for themselves) or the SQL editor runs:

```sql
select public.st_reset_staff_mfa('SMILE-TRUST', '<username>', '<reason>');
```

The reason is required. The authenticator row is removed, existing sessions for that user stop working, and `st_staff_security_events` records who reset it, when and why (never the secret). The member then enrolls again with their password. A reset of JOHN's own authenticator needs the SQL editor (a trusted session) because nobody may reset their own MFA from the app.

## Offline collections from collectors

1. A collector records collections offline as before (local collection, ledger pair and mirrored transaction).
2. When online with a staff session, the device reads the server copy, merges it, and calls `rpc/st_submit_collections` with up to 200 of its own collections that the server copy does not have yet, each with its ledger pair and transaction.
3. The server checks the member exists and is Active, the amount is consistent, the collection is not reversed, the collector recorded it and the member is assigned to them (customer or group collector, or the collector's own group), and the ledger pair and transaction match. Accepted rows are appended with the collector, group and author set by the server; non-cash payments become `Pending Verification`.
4. Duplicates (same id or idempotency key) are reported and skipped, so retries are safe. Refused collections are marked `cloudSyncStatus: "Rejected"` with the reason on the device and are not retried automatically.

Not uploaded by non-manager roles any more: member registrations, notes, audit entries and other non-collection records. A manager device must enter or sync those (see remaining concerns in the review report).

## Staff accounts created in the app

The app mirrors the account (id, username, name, role, active) to `app_users` but never sends a password. The new member's first online sign-in uses a one-time activation code (`st_issue_staff_activation`, issued by an owner or manager). Until then they can only sign in offline on the device where the account was created.

## Deactivation and reactivation

- Deactivating (app toggle → `st_upsert_staff_account`, or SQL) immediately invalidates every existing session for that user, bans the Auth identity and records `staff_deactivated`.
- Reactivation is deliberate: an owner/manager sets the account active again. The member then signs in with their password; staff-login lifts the ban and issues a fresh session. Sessions from before the deactivation stay invalid.
