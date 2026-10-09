-- EMERGENCY ONLY. Requires separate written approval; not part of the normal 048 rollback.
-- Removes the 048 write-protocol fence (trigger st_client_write_protocol on public tables and
-- public.st_guard_client_write_protocol) and nothing else: receipt allocation, counters, receipts,
-- grants, RLS and 047 authorization are unchanged. Old unmarked clients can write again afterwards.
-- Re-applying 048_server_receipt_allocation.sql reinstalls the fence.
do $$
declare t record;
begin
  for t in
    select c.relname
    from pg_trigger g join pg_class c on c.oid = g.tgrelid
    where c.relnamespace = 'public'::regnamespace and g.tgname = 'st_client_write_protocol'
  loop
    execute format('drop trigger if exists st_client_write_protocol on public.%I', t.relname);
  end loop;
end $$;
drop function if exists public.st_guard_client_write_protocol();
notify pgrst, 'reload schema';
