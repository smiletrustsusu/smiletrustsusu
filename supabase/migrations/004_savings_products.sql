-- Smile Trust Susu — savings products, personal accounts, collector assignments
-- Run AFTER 001, 002, 003. Back up before applying.

-- ---------------------------------------------------------------------------
-- Savings products (configurable by Manager)
-- ---------------------------------------------------------------------------

create table if not exists public.savings_products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  code text not null,
  name text not null,
  product_type text not null check (product_type in (
    'group_susu', 'personal_daily', 'personal_weekly', 'personal_flexible', 'target_savings'
  )),
  collection_type text not null check (collection_type in ('susu_group', 'personal')),
  frequency text not null default 'Daily',
  min_amount_pesewas bigint not null default 0 check (min_amount_pesewas >= 0),
  default_amount_pesewas bigint not null default 0 check (default_amount_pesewas >= 0),
  fee_pesewas bigint not null default 0 check (fee_pesewas >= 0),
  interest_rate numeric(8,4) not null default 0,
  withdrawal_rule text not null default '',
  missed_payment_rule text not null default '',
  approval_rule text not null default '',
  active boolean not null default true,
  client_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists savings_products_business_code_uq
  on public.savings_products (business_id, lower(code));

create index if not exists savings_products_business_idx on public.savings_products (business_id);
create index if not exists savings_products_type_idx on public.savings_products (product_type);

-- Link customers to personal savings product
alter table public.customers
  add column if not exists savings_product_id uuid references public.savings_products(id),
  add column if not exists account_type text not null default 'personal'
    check (account_type in ('personal', 'susu_group', 'both'));

-- Personal savings sub-accounts (optional separate ledger per product)
create table if not exists public.personal_savings_accounts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  savings_product_id uuid not null references public.savings_products(id) on delete restrict,
  balance_pesewas bigint not null default 0,
  streak_days int not null default 0,
  last_payment_at timestamptz,
  next_expected_at date,
  active boolean not null default true,
  client_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_id, savings_product_id)
);

create index if not exists personal_accounts_customer_idx on public.personal_savings_accounts (customer_id);

-- Extend collections with product linkage
alter table public.collections
  add column if not exists savings_product_id uuid references public.savings_products(id),
  add column if not exists collection_type text check (collection_type in ('susu_group', 'personal')),
  add column if not exists susu_group_id uuid;

-- Collector assignment audit trail
create table if not exists public.collector_assignments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  kind text not null check (kind in ('customer', 'susu_group', 'route', 'collection_type')),
  entity_id text not null,
  from_collector_id uuid references public.app_users(id),
  to_collector_id uuid not null references public.app_users(id) on delete restrict,
  reason text not null,
  approved_by uuid references public.app_users(id),
  client_id text,
  created_at timestamptz not null default now()
);

create index if not exists collector_assignments_entity_idx on public.collector_assignments (entity_id);
create index if not exists collector_assignments_to_idx on public.collector_assignments (to_collector_id);

-- Collector capabilities (which collection types they handle)
alter table public.app_users
  add column if not exists susu_group_collection boolean not null default true,
  add column if not exists personal_savings_collection boolean not null default true;

-- Seed default products for existing businesses (idempotent)
insert into public.savings_products (
  business_id, code, name, product_type, collection_type, frequency,
  min_amount_pesewas, default_amount_pesewas, withdrawal_rule, missed_payment_rule, approval_rule
)
select
  b.id,
  v.code,
  v.name,
  v.product_type,
  v.collection_type,
  v.frequency,
  v.min_pesewas,
  v.default_pesewas,
  v.withdrawal_rule,
  v.missed_rule,
  v.approval_rule
from public.businesses b
cross join (
  values
    ('SUSU-GROUP', 'Group Susu Savings', 'group_susu', 'susu_group', 'Daily', 100::bigint, 0::bigint,
     'End of cycle with group approval', 'Track as arrears', 'Manager or Assistant Manager'),
    ('PERS-DAILY', 'Daily Personal Savings', 'personal_daily', 'personal', 'Daily', 100::bigint, 500::bigint,
     'Manager approval with ID verification', 'Mark missed day', 'Manager'),
    ('PERS-WEEKLY', 'Weekly Personal Savings', 'personal_weekly', 'personal', 'Weekly', 500::bigint, 2000::bigint,
     'Manager approval with ID verification', 'Mark missed week', 'Manager'),
    ('PERS-FLEX', 'Flexible Personal Savings', 'personal_flexible', 'personal', 'Flexible', 100::bigint, 0::bigint,
     'Balance check required', 'No fixed schedule', 'Collector records')
) as v(code, name, product_type, collection_type, frequency, min_pesewas, default_pesewas, withdrawal_rule, missed_rule, approval_rule)
where not exists (
  select 1 from public.savings_products sp
  where sp.business_id = b.id and lower(sp.code) = lower(v.code)
);

comment on table public.savings_products is 'Configurable savings products — group susu and personal everyday savings';
comment on table public.personal_savings_accounts is 'Individual personal savings balances separate from susu group pool';
comment on table public.collector_assignments is 'Immutable audit of customer/group/route reassignment between collectors';
