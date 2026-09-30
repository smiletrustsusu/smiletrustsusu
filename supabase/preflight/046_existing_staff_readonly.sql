-- READ-ONLY preflight for migration 046 + staff-login on an existing project.
-- Reports whether each existing staff account has the credentials staff-login needs.
-- Returns booleans and format labels only: no password hashes, MFA secrets, codes or personal data.
-- Safe to run in the SQL editor before anything is applied. Contains no INSERT/UPDATE/DELETE/DDL.

select
  u.username,
  u.role,
  u.active,
  u.client_id is not null as has_client_id,
  coalesce(u.client_id, '') like 'demo-user-%' as seeded_by_migration_044,
  case
    when u.password_hash is null or u.password_hash = '' then 'none'
    when u.password_hash like 'pbkdf2:%' then 'pbkdf2 (compatible)'
    when u.password_hash like 'kba-%' then 'legacy kba (compatible, weak)'
    else 'unrecognised format'
  end as password_format,
  u.auth_user_id is not null as has_auth_user_id,
  coalesce(u.auth_email, '') <> '' as has_auth_email,
  exists (
    select 1 from public.user_mfa_secrets m
    where m.business_id = u.business_id and m.user_client_id = coalesce(u.client_id, u.id::text)
  ) as mfa_row_present,
  exists (
    select 1 from public.user_mfa_secrets m
    where m.business_id = u.business_id and m.user_client_id = coalesce(u.client_id, u.id::text) and m.enabled
  ) as mfa_enabled
from public.app_users u
join public.businesses b on b.id = u.business_id
where b.code = 'SMILE-TRUST' or b.legacy_code = 'SMILE-TRUST'
order by u.username;

-- @supabase-only (needs the auth schema; skip on plain PostgreSQL)
select
  (select count(*) from auth.users) as auth_users,
  to_regclass('public.smile_trust_cloud_snapshots') is not null as snapshot_table_present,
  to_regclass('public.st_staff_auth_links') is not null as staff_auth_links_present,
  to_regclass('public.st_staff_activation_codes') is not null as activation_codes_present,
  to_regprocedure('public.st_issue_staff_activation(text, text, integer)') is not null as activation_function_present;
