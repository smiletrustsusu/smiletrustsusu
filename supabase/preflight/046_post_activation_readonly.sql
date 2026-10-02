-- READ-ONLY verification after a staff account was activated through staff-login.
-- Returns one row of yes/no checks. Never returns password hashes, activation code hashes,
-- Auth emails, tokens or MFA secrets. Contains no INSERT/UPDATE/DELETE/DDL.
--
-- Edit the three values in "target" for the account being checked:
--   john   bbef5ecc-3bdf-40b6-bf8e-c0e206eed9db   SystemOwner  (Auth claim role: SystemOwner)
--   ama    6e6667ac-72ce-4f30-9c8e-2fd838988590   AssistantManager  (Auth claim role: Admin)
--   kwame  3d156d98-3b4a-4024-8a46-1450df386672   Collector  (Auth claim role: Collector)
--
-- Expected after a successful activation:
--   matching_rows = 1, uuid_unchanged = true, role_unchanged = true, active = true,
--   password_format = 'pbkdf2', auth_link_present = true, auth_user_exists = true,
--   auth_claim_user_matches = true, auth_claim_business = 'SMILE-TRUST', auth_user_not_banned = true,
--   codes_used >= 1, codes_still_redeemable = 0.
--   app_users_auth_user_id_set / app_users_auth_email_set stay false: staff-login records the
--   Auth identity in public.st_staff_auth_links and does not write those app_users columns.

with target as (
  select 'john'::text as username,
         'bbef5ecc-3bdf-40b6-bf8e-c0e206eed9db'::uuid as expected_uuid,
         'SystemOwner'::text as expected_role
),
staff as (
  select u.id, u.client_id, u.username, u.role, u.active, u.password_hash, u.auth_user_id, u.auth_email,
         t.expected_uuid, t.expected_role
  from public.app_users u
  join public.businesses b on b.id = u.business_id
  join target t on lower(u.username) = t.username
  where b.code = 'SMILE-TRUST' or b.legacy_code = 'SMILE-TRUST'
)
select
  s.username,
  (select count(*) from staff)::int as matching_rows,
  s.id = s.expected_uuid as uuid_unchanged,
  s.role,
  s.role = s.expected_role as role_unchanged,
  s.active,
  case
    when coalesce(s.password_hash, '') = '' then 'none'
    when s.password_hash like 'pbkdf2:%' then 'pbkdf2'
    when s.password_hash like 'kba-%' then 'legacy kba'
    else 'unrecognised'
  end as password_format,
  s.auth_user_id is not null as app_users_auth_user_id_set,
  coalesce(s.auth_email, '') <> '' as app_users_auth_email_set,
  l.auth_user_id is not null as auth_link_present,
  au.id is not null as auth_user_exists,
  au.raw_app_meta_data ->> 'app_role' as auth_claim_role,
  coalesce(au.raw_app_meta_data ->> 'app_user_id' = coalesce(s.client_id, s.id::text), false) as auth_claim_user_matches,
  au.raw_app_meta_data ->> 'business_code' as auth_claim_business,
  (au.id is not null and (au.banned_until is null or au.banned_until < now())) as auth_user_not_banned,
  (select count(*) from auth.users)::int as auth_users_total,
  (select count(*) from public.st_staff_activation_codes c where c.app_user_uuid = s.id and c.used_at is not null)::int as codes_used,
  (select max(c.used_at) from public.st_staff_activation_codes c where c.app_user_uuid = s.id) as last_code_used_at,
  (select count(*) from public.st_staff_activation_codes c
    where c.app_user_uuid = s.id and c.used_at is null and c.expires_at > now())::int as codes_still_redeemable
from staff s
left join public.st_staff_auth_links l
  on l.business_code = 'SMILE-TRUST' and l.app_user_id = coalesce(s.client_id, s.id::text)
left join auth.users au on au.id = l.auth_user_id;
