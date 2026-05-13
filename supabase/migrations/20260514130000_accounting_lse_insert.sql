-- Accounting can already update `loads` (RLS-permitted for status flips
-- like delivered → invoiced) but couldn't insert into load_status_events,
-- so the timeline event was silently dropped under their session. Grant
-- insert so the event log stays complete when accounting marks a load
-- invoiced from the new preview-dialog flow.

drop policy if exists "lse: accounting insert" on public.load_status_events;

create policy "lse: accounting insert"
  on public.load_status_events for insert
  with check (public.has_role('accounting'));
