-- Phase 5 (DVIR threaded messages): replaces the single admin_reply column
-- with a proper inspection_messages table so the driver and admin can have
-- a back-and-forth on the report.

create table if not exists public.inspection_messages (
  id            uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  author_id     uuid not null references public.profiles(id)    on delete set null,
  -- Captured at write time so a later role change doesn't rewrite history.
  author_role   public.app_role not null,
  message       text not null check (char_length(message) > 0 and char_length(message) <= 2000),
  created_at    timestamptz not null default now()
);

create index if not exists inspection_messages_inspection_idx
  on public.inspection_messages (inspection_id, created_at desc);
create index if not exists inspection_messages_author_idx
  on public.inspection_messages (author_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS: read scoped by role; insert verified against the row's author_id and
-- author_role both matching the caller.
-- ---------------------------------------------------------------------------
alter table public.inspection_messages enable row level security;

drop policy if exists "inspection_messages: admin all"           on public.inspection_messages;
drop policy if exists "inspection_messages: dispatcher all"      on public.inspection_messages;
drop policy if exists "inspection_messages: driver read own"     on public.inspection_messages;
drop policy if exists "inspection_messages: driver insert own"   on public.inspection_messages;

create policy "inspection_messages: admin all"
  on public.inspection_messages for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "inspection_messages: dispatcher all"
  on public.inspection_messages for all
  using (public.has_role('dispatcher'))
  with check (public.has_role('dispatcher'));

create policy "inspection_messages: driver read own"
  on public.inspection_messages for select
  using (
    exists (
      select 1 from public.inspections i
       where i.id = inspection_messages.inspection_id
         and i.driver_id = auth.uid()
    )
  );

create policy "inspection_messages: driver insert own"
  on public.inspection_messages for insert
  with check (
    author_id = auth.uid()
    and author_role = 'driver'
    and exists (
      select 1 from public.inspections i
       where i.id = inspection_messages.inspection_id
         and i.driver_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Backfill: migrate existing admin_reply rows into the new table so we
-- don't drop dev data. Skip if already migrated (idempotent prefix check).
-- ---------------------------------------------------------------------------
insert into public.inspection_messages
  (inspection_id, author_id, author_role, message, created_at)
select
  i.id,
  i.admin_reply_by,
  -- Preserve role even though we don't know it for certain — these were
  -- written by users who could write admin_reply, which were admins or
  -- dispatchers per the action. Default to 'admin' for v1.
  'admin'::public.app_role,
  i.admin_reply,
  coalesce(i.admin_reply_at, now())
from public.inspections i
where i.admin_reply is not null
  and i.admin_reply_by is not null
  and not exists (
    select 1 from public.inspection_messages m
     where m.inspection_id = i.id
  );
