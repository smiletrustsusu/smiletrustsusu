# Security cutover: server-side authorization (Production Blocker #1)

This guide moves a live business from the legacy shared-secret sync model to per-user sessions authorized by the database. **Nothing here has been applied to the pilot project.** Every step needs an explicit go-ahead from the business owner, a fresh backup and a maintenance window.

## What changes

| Before | After |
| --- | --- |
| Every APK/EXE shipped `config.json` with the owner and developer default passwords and a shared `syncAccessKey`. | `www/config.json` holds only public settings (URL, anon key, business code, feature flags). `npm run prepare:web` refuses to build if a secret key is present. |
| Anyone holding the anon key could read and overwrite `smile_trust_cloud_snapshots` and call every RPC; most tables had no row-level security. | Anon has no table access. The snapshot and tenant tables require a Supabase session whose server-set `app_metadata.business_code` matches the row. Privileged RPCs check the caller's business and role. |
| Staff signed in only against the local copy of the snapshot. | Online sign-in goes through the `staff-login` Edge Function, which checks the PBKDF2 password and TOTP against the server copy and issues a per-user session. Offline sign-in against the local hash still works afterwards. |
| The member portal downloaded the whole business snapshot to check a PIN on the device. | `portal_login` checks the PIN on the server (bcrypt, lockout) and returns only that member's records. Withdrawal requests queue in `st_portal_requests` and staff devices import them. |

## Components

- `supabase/migrations/046_server_side_authorization.sql`: creates `smile_trust_cloud_snapshots` if it is missing, then default-deny grants, row-level security everywhere, guarded RPC wrappers, portal tables and RPCs. Idempotent. Needs only migrations 001–045; `supabase/rls.sql` is not a prerequisite (`tests/migration-046-without-rls-sql.test.js`).
- `supabase/rls.sql`: the same snapshot policies for projects set up from `rls.sql`. Do not run an older copy of this file: earlier versions let the anon key read and write every snapshot.
- `supabase/functions/staff-login/`: the staff sign-in Edge Function.

## Edge Function secrets

Set these as Supabase function secrets only. They never go in `config.json`, the repo or a client build.

| Name | Purpose |
| --- | --- |
| `SUPABASE_URL` | Project URL (provided by Supabase). |
| `SUPABASE_SERVICE_ROLE_KEY` | Reads `app_users` and MFA rows and manages Auth users. Server-side only. |
| `SUPABASE_ANON_KEY` | Issues the per-user session. |
| `STAFF_EMAIL_DOMAIN` | Optional. Domain for the synthetic Auth e-mails (default `staff.smile-trust.invalid`). |
| `STAFF_LOGIN_PUBLIC_KEY` / `STAFF_LOGIN_SERVICE_KEY` | Optional. For projects using the new API keys: the `sb_publishable_...` and `sb_secret_...` keys. They take precedence over the two legacy keys above and are sent only in the `apikey` header. |

Deploy with JWT verification off, because callers only hold the public anon key and the function performs its own checks:

```powershell
supabase functions deploy staff-login --no-verify-jwt
```

## Cutover order

1. **Freeze and back up.** Ask every device to sync, then stop financial work. Take a database backup and export `smile_trust_cloud_snapshots`.
2. **Deploy `staff-login`** and set its secrets. Verify it returns 401 for a wrong password against a test business. It does not change data.
3. **Install the new APK/EXE on every staff device while the old policies are still in place.** Devices that already hold the legacy sync key keep syncing through the compatibility path until step 4. Each staff member signs in once online so the device obtains a session.
4. **Apply migration 046** in the SQL editor. From this moment the anon key alone cannot read or write business data.
5. **Verify:** a staff sign-in syncs; a collector cannot import snapshots; the member portal signs in with a PIN; a withdrawal request from the portal appears on a staff device within a few minutes; anon requests to `smile_trust_cloud_snapshots` return no rows.
6. **Rotate** the anon key if you want old builds cut off completely, and retire the old `syncAccessKey` (it no longer grants access once 046 is applied).

## Existing staff accounts in `public.app_users`

staff-login checks a staff member only against `public.app_users` (password hash in the app's `pbkdf2:<iterations>:<salt>:<hash>` format, role and active flag); the snapshot copy is never consulted (migration 047 / B2). A deactivation in `app_users` blocks sign-in. Privileged roles also need a confirmed authenticator; see `docs/SECURITY-HARDENING-047.md`. The session's `app_user_id` is the row's `client_id` (or its uuid when it has none), so rows, uuids and foreign keys are never changed or re-created. Roles map the same way as `fetch_business_snapshot`: `AssistantManager` signs in as `Admin` and `Owner` as `KBA`.

Migration 046 makes `app_users.password_hash` unreadable and unwritable for every client session, and only owners/managers (`SystemOwner`, `Owner`, `KBA`, `Admin`, `AssistantManager`) may change staff rows. Only the staff-login function (service role) writes password hashes.

Rows that have never had a password (for example the rows seeded by migration 044) are adopted with a **one-time activation code**. Nothing is reset: the code only works while the row has no password, and the member chooses their own password.

1. In the SQL editor, issue a code (valid 60 minutes here; default 24 hours, maximum 7 days):

   ```sql
   select public.st_issue_staff_activation('SMILE-TRUST', 'john', 60);
   ```

   This inserts one row into `st_staff_activation_codes` (only the SHA-256 of the code is stored) and returns the code once. It does not change `app_users`. It refuses accounts that already have a password. Issuing a new code cancels the previous unused one.
2. Give the code to the member in person. On the login screen they open **First sign-in with an activation code**, enter username, code and a new password (at least 8 characters). If MFA is already enabled for them on the server, they also enter an authenticator code.
3. staff-login checks the code, stores the PBKDF2 hash in their `app_users` row, marks the code used, creates or links their Supabase Auth identity (`st_staff_auth_links`) and signs them in. The device keeps a local hash of the same password for offline sign-in.

A signed-in owner can also call `st_issue_staff_activation` for their own business (owners for anyone, managers for non-owner staff, nobody for themselves); the app has no screen for this yet.

## Effects on existing data and devices

- No financial rows are modified or deleted. Legacy `access_key` values stay in existing snapshot rows but stop granting access.
- **Old APK/EXE builds lose cloud sync after step 4.** Their unsynced local work stays on the device; install the new build and sign in online to upload it. Complete step 1 so nothing is pending.
- Members keep their current PINs. A PIN set through the new portal is stored server-side and overrides the snapshot PIN until staff reset it in the app.
- **Devices switched to a different backend** (another Supabase project or business code) set their existing local data aside under hidden quarantine keys on the device, start clean, and show a notice on the login screen. That data is never uploaded, merged or read by sync. Cloud sync on the new backend starts only after a staff member signs in online (staff-login succeeds); until then every database call is refused on the device.
- Deactivating a user in the app blocks new sign-ins immediately (the function bans the linked Auth user on the next attempt). With 046 alone an already-issued session stays valid until it expires; migration 047 rejects it at once (live `app_users` check and per-user session cutoff).
- Re-running 046 after 047 reverts 047's guards. Always run 047 again afterwards.

## Rollback

Restore the backup from step 1. Migration 046 has no automated down-script; rolling back means restoring grants and policies from the backup. Do not roll back by re-granting anon access.
