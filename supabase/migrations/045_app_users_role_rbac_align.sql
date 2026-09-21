-- GAP-010: Align public.app_users.role CHECK with JS agency RBAC (additive).
-- Apply AFTER 044_wave2_database_platform.sql.
-- Safe to re-run. Does NOT drop rows; keeps legacy Owner / AssistantManager aliases.

-- JS SoT roles (src/core/roles.js ROLE values):
--   SystemOwner, KBA, ManagingDirector, Admin, OperationsManager, Accountant,
--   Cashier, FieldSupervisor, Collector, GroupCoordinator, CustomerService,
--   Auditor, Customer, Developer
-- Legacy SQL aliases retained for existing rows:
--   Owner (pre-SystemOwner), AssistantManager (pre-agency rename)

alter table public.app_users
  drop constraint if exists app_users_role_check;

alter table public.app_users
  add constraint app_users_role_check check (role in (
    'SystemOwner',
    'Owner',
    'KBA',
    'Admin',
    'ManagingDirector',
    'OperationsManager',
    'Accountant',
    'Cashier',
    'FieldSupervisor',
    'Collector',
    'GroupCoordinator',
    'CustomerService',
    'Auditor',
    'Customer',
    'Developer',
    'AssistantManager'
  ));

comment on constraint app_users_role_check on public.app_users is
  'GAP-010: JS RBAC roles + legacy Owner/AssistantManager. App SoT: src/core/roles.js; SUPER_ADMIN_FORBIDDEN unchanged.';

-- Optional one-time map: Owner → SystemOwner when username is the canonical owner (john).
-- Does not touch other Owner rows (may be historical branch owners).
update public.app_users
set role = 'SystemOwner'
where role = 'Owner'
  and lower(username) = 'john'
  and not exists (
    select 1 from public.app_users u2
    where u2.business_id = app_users.business_id
      and u2.role = 'SystemOwner'
      and u2.id <> app_users.id
  );
