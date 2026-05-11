-- Phase 8 (continued) — Team chat. Direct messages between any two
-- teammates, with file attachments. Distinct from inspection_messages,
-- which stay scoped to specific inspection threads. Group threads are not
-- implemented in v1 but the schema supports them (type = 'group').

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_type where typname = 'chat_thread_type') then
    create type public.chat_thread_type as enum ('direct', 'group');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  type public.chat_thread_type not null default 'direct',
  title text,                         -- only used for group threads
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_thread_members (
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz not null default '1970-01-01T00:00:00Z',
  primary key (thread_id, profile_id)
);

create index if not exists chat_thread_members_profile_idx
  on public.chat_thread_members(profile_id);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(body) between 0 and 10000),
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_thread_created_idx
  on public.chat_messages(thread_id, created_at desc);

-- Reuse the documents table for chat attachments — same Storage bucket,
-- same RLS surface, just a new FK. Filter chat-attached docs with
-- `chat_message_id is not null`.
alter table public.documents
  add column if not exists chat_message_id uuid
    references public.chat_messages(id) on delete cascade;

create index if not exists documents_chat_message_id_idx
  on public.documents(chat_message_id);

-- ---------------------------------------------------------------------------
-- Trigger — bump thread.updated_at when a new message lands so we can sort
-- the conversation list by most-recent-activity.
-- ---------------------------------------------------------------------------
create or replace function public.bump_chat_thread_updated_at()
returns trigger
language plpgsql
as $$
begin
  update public.chat_threads
     set updated_at = now()
   where id = new.thread_id;
  return new;
end;
$$;

drop trigger if exists bump_chat_thread_updated_at on public.chat_messages;
create trigger bump_chat_thread_updated_at
  after insert on public.chat_messages
  for each row execute function public.bump_chat_thread_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — everyone in a thread can read it and post to it. No one else.
-- Helper function to check membership cleanly inside policies.
-- ---------------------------------------------------------------------------
create or replace function public.is_chat_thread_member(p_thread_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.chat_thread_members
     where thread_id = p_thread_id
       and profile_id = auth.uid()
  )
$$;

grant execute on function public.is_chat_thread_member(uuid) to authenticated;

alter table public.chat_threads enable row level security;
alter table public.chat_thread_members enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists "chat_threads: members read"   on public.chat_threads;
drop policy if exists "chat_threads: any insert"     on public.chat_threads;
drop policy if exists "chat_threads: creator update" on public.chat_threads;

drop policy if exists "chat_thread_members: self read"   on public.chat_thread_members;
drop policy if exists "chat_thread_members: member read" on public.chat_thread_members;
drop policy if exists "chat_thread_members: insert"      on public.chat_thread_members;
drop policy if exists "chat_thread_members: self update" on public.chat_thread_members;

drop policy if exists "chat_messages: member read"   on public.chat_messages;
drop policy if exists "chat_messages: member insert" on public.chat_messages;

-- Threads
create policy "chat_threads: members read"
  on public.chat_threads for select
  using (public.is_chat_thread_member(id));

create policy "chat_threads: any insert"
  on public.chat_threads for insert
  with check (created_by = auth.uid());

create policy "chat_threads: creator update"
  on public.chat_threads for update
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

-- Thread members — read all member rows for any thread you're in (so you
-- can see who's in the chat); insert self into a thread you just created
-- or via a trusted server action. Update only your own row (for last_read_at).
create policy "chat_thread_members: member read"
  on public.chat_thread_members for select
  using (
    public.is_chat_thread_member(thread_id)
    or profile_id = auth.uid()
  );

create policy "chat_thread_members: insert"
  on public.chat_thread_members for insert
  with check (
    -- You can always add yourself
    profile_id = auth.uid()
    -- Or you can add anyone to a thread you created
    or exists (
      select 1 from public.chat_threads t
       where t.id = chat_thread_members.thread_id
         and t.created_by = auth.uid()
    )
  );

create policy "chat_thread_members: self update"
  on public.chat_thread_members for update
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- Messages
create policy "chat_messages: member read"
  on public.chat_messages for select
  using (public.is_chat_thread_member(thread_id));

create policy "chat_messages: member insert"
  on public.chat_messages for insert
  with check (
    author_id = auth.uid()
    and public.is_chat_thread_member(thread_id)
  );

-- ---------------------------------------------------------------------------
-- Documents RLS — extend so chat attachments are visible to thread members.
-- ---------------------------------------------------------------------------
drop policy if exists "documents: chat member read"   on public.documents;
drop policy if exists "documents: chat member insert" on public.documents;

create policy "documents: chat member read"
  on public.documents for select
  using (
    chat_message_id is not null
    and exists (
      select 1 from public.chat_messages m
       where m.id = documents.chat_message_id
         and public.is_chat_thread_member(m.thread_id)
    )
  );

create policy "documents: chat member insert"
  on public.documents for insert
  with check (
    chat_message_id is not null
    and uploaded_by = auth.uid()
    and exists (
      select 1 from public.chat_messages m
       where m.id = documents.chat_message_id
         and m.author_id = auth.uid()
         and public.is_chat_thread_member(m.thread_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Storage RLS — chat attachments live under chat/<thread_id>/<msg_id>/...
-- inside the existing load-documents bucket. Thread members can read,
-- the authoring user can upload (we verify msg+thread via the API).
-- ---------------------------------------------------------------------------
drop policy if exists "load-documents: chat member read"   on storage.objects;
drop policy if exists "load-documents: chat member insert" on storage.objects;

create policy "load-documents: chat member read"
  on storage.objects for select
  using (
    bucket_id = 'load-documents'
    and (storage.foldername(name))[1] = 'chat'
    and exists (
      select 1 from public.chat_thread_members
       where thread_id::text = (storage.foldername(name))[2]
         and profile_id = auth.uid()
    )
  );

create policy "load-documents: chat member insert"
  on storage.objects for insert
  with check (
    bucket_id = 'load-documents'
    and (storage.foldername(name))[1] = 'chat'
    and exists (
      select 1 from public.chat_thread_members
       where thread_id::text = (storage.foldername(name))[2]
         and profile_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Realtime publication — let subscribers receive INSERT events for new
-- messages and member additions on threads they belong to (RLS-filtered).
-- ---------------------------------------------------------------------------
do $$
begin
  perform 1 from pg_publication where pubname = 'supabase_realtime';
  if not found then
    raise notice 'supabase_realtime publication not found — skipping';
    return;
  end if;

  perform 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chat_messages';
  if not found then
    execute 'alter publication supabase_realtime add table public.chat_messages';
  end if;

  perform 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chat_thread_members';
  if not found then
    execute 'alter publication supabase_realtime add table public.chat_thread_members';
  end if;
end $$;
