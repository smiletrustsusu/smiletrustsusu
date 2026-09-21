-- Rollback for 044_wave2_database_platform.sql
-- Safe lab rollback: drops Wave-2-only objects. Does NOT drop ECDAPS 001–043 tables.
-- Run manually in Supabase SQL editor after backing up. Prefer restore from backup for production.

insert into public.schema_migration_log (filename, version_order, direction, notes)
values ('044_wave2_database_platform.sql', 44, 'down', 'Wave 2 rollback')
on conflict do nothing;

-- Revoke RPC grants
revoke execute on function public.upsert_customer_from_client(jsonb) from authenticated;
revoke execute on function public.record_deposit_from_client(jsonb) from authenticated;
revoke execute on function public.record_withdrawal_from_client(jsonb) from authenticated;
revoke execute on function public.record_loan_repayment_from_client(jsonb) from authenticated;
revoke execute on function public.record_eod_snapshot(jsonb) from authenticated;
revoke execute on function public.fetch_cashbook_summary(text, date, date) from authenticated;
revoke execute on function public.fetch_dashboard_kpis(text) from authenticated;
revoke execute on function public.ack_sync_queue_item(jsonb) from authenticated;
revoke execute on function public.append_audit_event(jsonb) from authenticated;
revoke execute on function public.enqueue_offline_item(jsonb) from authenticated;

drop function if exists public.upsert_customer_from_client(jsonb);
drop function if exists public.record_deposit_from_client(jsonb);
drop function if exists public.record_withdrawal_from_client(jsonb);
drop function if exists public.record_loan_repayment_from_client(jsonb);
drop function if exists public.record_eod_snapshot(jsonb);
drop function if exists public.fetch_cashbook_summary(text, date, date);
drop function if exists public.fetch_dashboard_kpis(text);
drop function if exists public.ack_sync_queue_item(jsonb);
drop function if exists public.append_audit_event(jsonb);
drop function if exists public.enqueue_offline_item(jsonb);
drop function if exists public.jwt_branch_id();
drop function if exists public.jwt_is_elevated_role();
drop function if exists public.policy_collector_customer_match(uuid);

drop view if exists public.v_dashboard_ops_kpi;
drop view if exists public.v_cashbook_daily;
drop view if exists public.v_loan_portfolio_kpi;
drop view if exists public.v_customer_balance_summary;
drop view if exists public.v_branch_collection_daily;

drop trigger if exists trg_customers_audit on public.customers;
drop trigger if exists trg_branches_audit on public.branches;
drop trigger if exists trg_branches_updated_at on public.branches;
drop trigger if exists trg_customers_updated_at on public.customers;
drop trigger if exists trg_app_users_updated_at on public.app_users;
drop trigger if exists trg_susu_groups_updated_at on public.susu_groups;
drop trigger if exists trg_loans_updated_at on public.loans;
drop trigger if exists trg_wave2_platform_meta_updated_at on public.wave2_platform_meta;
drop trigger if exists trg_offline_queue_updated_at on public.offline_queue;

drop function if exists public.tg_audit_row_change();
drop function if exists public.tg_set_updated_at();

drop table if exists public.bcdr_drill_log;
drop table if exists public.offline_queue;
drop table if exists public.wave2_platform_meta;
-- Keep schema_migration_log for audit of the rollback itself.

delete from public.canonical_schema_meta where version = '2.0.0-wave2';

-- Note: indexes/policies/seeds from 044 on pre-existing tables are left in place
-- (additive hardening). Full reversal of those requires restore from backup.
