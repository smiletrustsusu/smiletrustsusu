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

- `supabase/migrations/046_server_side_authorization.sql`: default-deny grants, row-level security everywhere, guarded RPC wrappers, portal tables and RPCs. Idempotent.
- `supabase/rls.sql`: the same snapshot policies for projects set up from `rls.sql`.
- `supabase/functions/staff-login/`: the staff sign-in Edge Function.

## Edge Function secrets

Set these as Supabase function secrets only. They never go in `config.json`, the repo or a client build.

| Name | Purpose |
| --- | --- |
| `SUPABASE_URL` | Project URL (provided by Supabase). |
| `SUPABASE_SERVICE_ROLE_KEY` | Reads the snapshot and manages Auth users. Server-side only. |
| `SUPABASE_ANON_KEY` | Issues the per-user session. |
| `STAFF_EMAIL_DOMAIN` | Optional. Domain for the synthetic Auth e-mails (default `staff.smile-trust.invalid`). |

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

## Effects on existing data and devices

- No financial rows are modified or deleted. Legacy `access_key` values stay in existing snapshot rows but stop granting access.
- **Old APK/EXE builds lose cloud sync after step 4.** Their unsynced local work stays on the device; install the new build and sign in online to upload it. Complete step 1 so nothing is pending.
- Members keep their current PINs. A PIN set through the new portal is stored server-side and overrides the snapshot PIN until staff reset it in the app.
- Deactivating a user in the app blocks new sign-ins immediately (the function bans the linked Auth user on the next attempt). An already-issued session stays valid until it expires; revoke it from the Supabase dashboard if needed.

## Rollback

Restore the backup from step 1. Migration 046 has no automated down-script; rolling back means restoring grants and policies from the backup. Do not roll back by re-granting anon access.
