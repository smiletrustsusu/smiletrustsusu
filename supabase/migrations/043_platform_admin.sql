-- Module 30 platform administration. Additive only.
-- Rollback notes: drop tables in reverse dependency order; no destructive alters to prior modules.
-- Seeds default Smile Trust tenant, production environment, platform license, and sample flags.

create table if not exists tenants (
  id text primary key,
  business_id text,
  code text not null,
  name text not null,
  status text not null default 'registered',
  region text,
  timezone text default 'Africa/Accra',
  retention_days integer default 2555,
  migration jsonb,
  archived_at timestamptz,
  created_by text,
  created_at timestamptz default now(),
  updated_at timestamptz,
  constraint tenants_code_uq unique (code),
  constraint tenants_status_chk check (status in ('registered', 'active', 'suspended', 'reactivating', 'archived', 'pending_deletion', 'deleted'))
);

create table if not exists tenant_configurations (
  id text primary key,
  tenant_id text not null references tenants(id),
  currency text default 'GHS',
  locale text default 'en-GH',
  loan_interest_default numeric default 15,
  collection_days_default integer default 31,
  updated_at timestamptz default now(),
  constraint tenant_configurations_tenant_uq unique (tenant_id)
);

create table if not exists tenant_branding (
  id text primary key,
  tenant_id text not null references tenants(id),
  primary_color text,
  logo text,
  product_name text,
  updated_at timestamptz default now(),
  constraint tenant_branding_tenant_uq unique (tenant_id)
);

create table if not exists tenant_localization (
  id text primary key,
  tenant_id text not null references tenants(id),
  language text default 'en',
  date_format text default 'YYYY-MM-DD',
  number_format text default 'en-GH',
  timezone text default 'Africa/Accra',
  updated_at timestamptz default now(),
  constraint tenant_localization_tenant_uq unique (tenant_id)
);

create table if not exists feature_flags (
  id text primary key,
  business_id text,
  flag_id text not null,
  enabled boolean default true,
  kill_switch boolean default false,
  scheduled_activate_at timestamptz,
  scheduled_retire_at timestamptz,
  high_risk boolean default false,
  updated_at timestamptz default now(),
  constraint feature_flags_flag_uq unique (flag_id)
);

create table if not exists feature_flag_rules (
  id text primary key,
  business_id text,
  flag_id text not null,
  enabled boolean default true,
  kill_switch boolean default false,
  rollout_percent integer,
  tenant_ids jsonb default '[]'::jsonb,
  branch_ids jsonb default '[]'::jsonb,
  activate_at timestamptz,
  retire_at timestamptz,
  emergency boolean default false,
  created_by text,
  created_at timestamptz default now(),
  constraint feature_flag_rules_pct_chk check (rollout_percent is null or (rollout_percent >= 0 and rollout_percent <= 100))
);

create table if not exists licenses (
  id text primary key,
  business_id text,
  code text not null,
  status text not null default 'draft',
  issued_to text,
  issued_at timestamptz,
  activated_at timestamptz,
  expires_at timestamptz,
  entitlements jsonb default '[]'::jsonb,
  quotas jsonb default '{}'::jsonb,
  revoked_at timestamptz,
  revoke_reason text,
  created_by text,
  created_at timestamptz default now(),
  constraint licenses_code_uq unique (code),
  constraint licenses_status_chk check (status in ('draft', 'issued', 'active', 'renewing', 'suspended', 'expired', 'revoked'))
);

create table if not exists license_assignments (
  id text primary key,
  license_id text not null references licenses(id),
  assignee_type text,
  assignee_id text,
  tenant_id text references tenants(id),
  created_at timestamptz default now()
);

create table if not exists deployment_history (
  id text primary key,
  business_id text,
  version text not null,
  strategy text not null,
  status text not null default 'planned',
  environment text,
  docs_ref text,
  planned_by text,
  executed_by text,
  verification jsonb,
  rollback_of text,
  created_at timestamptz default now(),
  executed_at timestamptz,
  rolled_back_at timestamptz,
  constraint deployment_strategy_chk check (strategy in ('blue_green', 'canary', 'rolling', 'recreate')),
  constraint deployment_status_chk check (status in ('planned', 'pending_approval', 'approved', 'in_progress', 'verified', 'rolled_back', 'completed', 'cancelled'))
);

create table if not exists deployment_approvals (
  id text primary key,
  deployment_id text not null references deployment_history(id),
  status text not null default 'pending',
  requested_by text,
  approved_by text,
  created_at timestamptz default now(),
  approved_at timestamptz,
  constraint deployment_approvals_status_chk check (status in ('pending', 'approved', 'rejected'))
);

create table if not exists maintenance_windows (
  id text primary key,
  business_id text,
  type text not null default 'scheduled',
  status text not null default 'planned',
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  read_only boolean default true,
  notify boolean default true,
  procedure jsonb,
  created_by text,
  started_by text,
  created_at timestamptz default now(),
  started_at timestamptz,
  ended_at timestamptz,
  constraint maintenance_type_chk check (type in ('scheduled', 'emergency')),
  constraint maintenance_status_chk check (status in ('planned', 'notified', 'active', 'completed', 'cancelled'))
);

create table if not exists platform_configurations (
  id text primary key,
  business_id text,
  key text not null,
  version integer not null default 1,
  value jsonb not null default '{}'::jsonb,
  published_by text,
  published_at timestamptz default now(),
  constraint platform_configurations_key_uq unique (key)
);

create table if not exists operational_policies (
  id text primary key,
  business_id text,
  code text not null,
  min_retention_days integer default 90,
  require_approval boolean default true,
  updated_at timestamptz default now(),
  constraint operational_policies_code_uq unique (code)
);

create table if not exists global_announcements (
  id text primary key,
  business_id text,
  title text not null,
  body text,
  severity text default 'info',
  audience text default 'all',
  active boolean default true,
  created_by text,
  created_at timestamptz default now()
);

create table if not exists environment_registry (
  id text primary key,
  business_id text,
  code text not null,
  name text not null,
  status text default 'available',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz,
  constraint environment_registry_code_uq unique (code),
  constraint environment_registry_code_chk check (code in ('development', 'testing', 'staging', 'uat', 'production', 'dr'))
);

create index if not exists idx_tenants_status on tenants(status);
create index if not exists idx_tenant_configurations_tenant on tenant_configurations(tenant_id);
create index if not exists idx_feature_flag_rules_flag on feature_flag_rules(flag_id);
create index if not exists idx_licenses_status on licenses(status);
create index if not exists idx_deployment_history_status on deployment_history(status);
create index if not exists idx_maintenance_windows_status on maintenance_windows(status);
create index if not exists idx_global_announcements_active on global_announcements(active);

insert into tenants (id, code, name, status, region, timezone, retention_days, created_by)
values ('tenant-smile-trust', 'SMILE-TRUST', 'Smile Trust', 'active', 'GH', 'Africa/Accra', 2555, 'system')
on conflict (id) do nothing;

insert into tenant_configurations (id, tenant_id, currency, locale, loan_interest_default, collection_days_default)
values ('tcfg-smile-trust', 'tenant-smile-trust', 'GHS', 'en-GH', 15, 31)
on conflict (id) do nothing;

insert into tenant_branding (id, tenant_id, primary_color, logo, product_name)
values ('tbr-smile-trust', 'tenant-smile-trust', '#0B5F3A', 'assets/smile-trust-logo.png', 'Smile Trust Susu Management System')
on conflict (id) do nothing;

insert into tenant_localization (id, tenant_id, language, date_format, number_format, timezone)
values ('tloc-smile-trust', 'tenant-smile-trust', 'en', 'YYYY-MM-DD', 'en-GH', 'Africa/Accra')
on conflict (id) do nothing;

insert into environment_registry (id, code, name, status, metadata)
values
  ('env-development', 'development', 'Development', 'available', '{"independentlyConfigurable":true,"separateDatabase":false}'::jsonb),
  ('env-testing', 'testing', 'Testing', 'available', '{"independentlyConfigurable":true,"separateDatabase":false}'::jsonb),
  ('env-staging', 'staging', 'Staging', 'available', '{"independentlyConfigurable":true,"separateDatabase":false}'::jsonb),
  ('env-uat', 'uat', 'UAT', 'available', '{"independentlyConfigurable":true,"separateDatabase":false}'::jsonb),
  ('env-production', 'production', 'Production', 'active', '{"independentlyConfigurable":true,"separateDatabase":false}'::jsonb),
  ('env-dr', 'dr', 'DR', 'available', '{"independentlyConfigurable":true,"separateDatabase":false}'::jsonb)
on conflict (id) do nothing;

insert into licenses (id, code, status, issued_to, issued_at, activated_at, expires_at, entitlements, quotas, created_by)
values (
  'lic-platform-owner',
  'PLT-OWNER-2026',
  'active',
  'SystemOwner',
  now(),
  now(),
  now() + interval '365 days',
  '["platform","tenants","flags","deploy","maintenance","ops","dr"]'::jsonb,
  '{"users":10000,"branches":500,"devices":5000,"apiPerMinute":6000}'::jsonb,
  'system'
)
on conflict (id) do nothing;

insert into license_assignments (id, license_id, assignee_type, assignee_id, tenant_id)
values ('lassign-owner', 'lic-platform-owner', 'system', 'u-owner', 'tenant-smile-trust')
on conflict (id) do nothing;

insert into feature_flags (id, flag_id, enabled, kill_switch)
values
  ('ff-enable-platform-admin', 'enablePlatformAdmin', true, false),
  ('ff-enable-enterprise-ai', 'enableEnterpriseAi', true, false),
  ('ff-enable-enterprise-integration', 'enableEnterpriseIntegration', true, false),
  ('ff-enable-enterprise-bi', 'enableEnterpriseBi', true, false)
on conflict (id) do nothing;

insert into platform_configurations (id, key, version, value, published_by)
values (
  'pcfg-defaults',
  'platform.defaults',
  1,
  '{"currency":"GHS","localization":{"timezone":"Africa/Accra","locale":"en-GH"},"paymentProviderDefaults":{"momoEnabled":true,"secretsInPlaintext":false}}'::jsonb,
  'system'
)
on conflict (id) do nothing;

insert into operational_policies (id, code, min_retention_days, require_approval)
values ('pol-retention', 'tenant_deletion_retention', 90, true)
on conflict (id) do nothing;
