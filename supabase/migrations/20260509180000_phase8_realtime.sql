-- Phase 8 (early): enable Supabase Realtime CDC on the tables that drive
-- in-app notifications and live message threads so the UI doesn't need a
-- full reload to see new inspection messages or status changes.
--
-- Realtime respects RLS, so subscribers only receive events for rows their
-- role+session is allowed to see.

do $$
declare
  pub_oid oid;
begin
  select oid into pub_oid from pg_publication where pubname = 'supabase_realtime';
  if pub_oid is null then
    -- Cloud Supabase creates this publication automatically; bail if it's
    -- truly missing rather than failing on the alter below.
    raise notice 'supabase_realtime publication not found — skipping';
    return;
  end if;

  -- alter publication ... add table is idempotent only when we guard against
  -- duplicates manually; loop through the targets.
  perform 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'inspection_messages';
  if not found then
    execute 'alter publication supabase_realtime add table public.inspection_messages';
  end if;

  perform 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'inspections';
  if not found then
    execute 'alter publication supabase_realtime add table public.inspections';
  end if;
end $$;
