-- Web admin / Next.js server actions compatibility
-- Fixes: branches.code missing, direct app_users select under RLS

alter table public.branches add column if not exists code text;

update public.branches
set code = coalesce(
  nullif(trim(code), ''),
  nullif(trim(client_id), ''),
  nullif(trim(collector_code), ''),
  lower(regexp_replace(trim(name), '\s+', '-', 'g'))
)
where code is null or trim(code) = '';

create unique index if not exists branches_code_uq
  on public.branches (business_id, lower(code))
  where code is not null and code <> '';

-- List staff for admin UI (works with anon key + business code, like the desktop app RPCs)
create or replace function public.list_app_users(p_business_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
begin
  v_business_id := public.resolve_business_id(p_business_code);
  if v_business_id is null then
    return '[]'::jsonb;
  end if;

  return coalesce((
    select jsonb_agg(row order by row->>'created_at' desc)
    from (
      select jsonb_build_object(
        'id', u.id,
        'client_id', u.client_id,
        'username', u.username,
        'name', u.name,
        'full_name', u.name,
        'email', u.auth_email,
        'auth_email', u.auth_email,
        'role', u.role,
        'active', u.active,
        'branch_id', u.branch_id,
        'collector_code', u.collector_code,
        'can_verify_handover', u.can_verify_handover,
        'created_at', u.created_at,
        'branch', case when br.id is null then null else jsonb_build_object(
          'id', br.id,
          'name', br.name,
          'code', coalesce(br.code, br.client_id, br.collector_code),
          'collector_code', br.collector_code,
          'client_id', br.client_id
        ) end
      ) as row
      from public.app_users u
      left join public.branches br on br.id = u.branch_id
      where u.business_id = v_business_id
    ) s
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.list_app_users(text) to anon, authenticated;

comment on function public.list_app_users is
  'Admin staff list by business code — use from Next.js server actions instead of direct app_users select when RLS blocks anon reads';
