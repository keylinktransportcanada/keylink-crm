-- Phase 6 (scoped): documents table + private Storage bucket for load-attached
-- files (BOL, POD, rate confirmations, customs paperwork). Driver/truck/etc.
-- document scopes will land in later phases; the columns and enum values are
-- already here so we don't have to migrate the type later.

-- ---------------------------------------------------------------------------
-- Enum
-- ---------------------------------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_type where typname = 'document_type') then
    create type public.document_type as enum (
      'bol',
      'pod',
      'invoice',
      'rate_con',
      'customs',
      'cci',
      'inspection',
      'maintenance',
      'driver_licence',
      'medical',
      'fast_card',
      'insurance',
      'registration',
      'other'
    );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),

  load_id    uuid references public.loads(id)    on delete cascade,
  truck_id   uuid references public.trucks(id)   on delete cascade,
  driver_id  uuid references public.profiles(id) on delete cascade,

  type        public.document_type not null,
  file_path   text not null,            -- storage object key, e.g. "loads/<id>/<doc>.pdf"
  file_name   text not null,            -- original filename for download
  mime_type   text not null,
  size_bytes  bigint not null check (size_bytes >= 0),
  expiry_date date,

  uploaded_by uuid references public.profiles(id) on delete set null,
  uploaded_at timestamptz not null default now()
);

create index if not exists documents_load_id_idx     on public.documents(load_id);
create index if not exists documents_truck_id_idx    on public.documents(truck_id);
create index if not exists documents_driver_id_idx   on public.documents(driver_id);
create index if not exists documents_uploaded_at_idx on public.documents(uploaded_at desc);

-- ---------------------------------------------------------------------------
-- RLS — table
-- Dispatcher/admin: full. Driver: read+insert for their own loads.
-- Accounting: read all + insert/update invoice-type documents.
-- ---------------------------------------------------------------------------
alter table public.documents enable row level security;

drop policy if exists "documents: dispatcher all"        on public.documents;
drop policy if exists "documents: driver read own load"  on public.documents;
drop policy if exists "documents: driver insert own"     on public.documents;
drop policy if exists "documents: accounting read"       on public.documents;
drop policy if exists "documents: accounting invoice"    on public.documents;

create policy "documents: dispatcher all"
  on public.documents for all
  using (public.is_dispatcher_or_admin())
  with check (public.is_dispatcher_or_admin());

create policy "documents: driver read own load"
  on public.documents for select
  using (
    load_id is not null
    and exists (
      select 1 from public.loads l
       where l.id = documents.load_id
         and l.driver_id = auth.uid()
    )
  );

create policy "documents: driver insert own"
  on public.documents for insert
  with check (
    uploaded_by = auth.uid()
    and load_id is not null
    and exists (
      select 1 from public.loads l
       where l.id = documents.load_id
         and l.driver_id = auth.uid()
    )
  );

create policy "documents: accounting read"
  on public.documents for select
  using (public.has_role('accounting'));

create policy "documents: accounting invoice"
  on public.documents for insert
  with check (
    public.has_role('accounting')
    and type = 'invoice'
    and uploaded_by = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- Storage bucket — private. Filenames live under "loads/<load_id>/...".
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('load-documents', 'load-documents', false, 26214400)  -- 25 MiB cap
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit;

-- Storage RLS — mirror the table policies. We gate on the load_id encoded in
-- the object's path: "loads/<load_id>/..." so the policy can join back to
-- loads to check ownership without needing a documents-table lookup.

drop policy if exists "load-documents: dispatcher all"       on storage.objects;
drop policy if exists "load-documents: driver read own"      on storage.objects;
drop policy if exists "load-documents: driver insert own"    on storage.objects;
drop policy if exists "load-documents: accounting read"      on storage.objects;
drop policy if exists "load-documents: accounting invoice"   on storage.objects;

create policy "load-documents: dispatcher all"
  on storage.objects for all
  using (
    bucket_id = 'load-documents'
    and public.is_dispatcher_or_admin()
  )
  with check (
    bucket_id = 'load-documents'
    and public.is_dispatcher_or_admin()
  );

create policy "load-documents: driver read own"
  on storage.objects for select
  using (
    bucket_id = 'load-documents'
    and (storage.foldername(name))[1] = 'loads'
    and exists (
      select 1 from public.loads l
       where l.id::text = (storage.foldername(name))[2]
         and l.driver_id = auth.uid()
    )
  );

create policy "load-documents: driver insert own"
  on storage.objects for insert
  with check (
    bucket_id = 'load-documents'
    and (storage.foldername(name))[1] = 'loads'
    and exists (
      select 1 from public.loads l
       where l.id::text = (storage.foldername(name))[2]
         and l.driver_id = auth.uid()
    )
  );

create policy "load-documents: accounting read"
  on storage.objects for select
  using (
    bucket_id = 'load-documents'
    and public.has_role('accounting')
  );

create policy "load-documents: accounting invoice"
  on storage.objects for insert
  with check (
    bucket_id = 'load-documents'
    and public.has_role('accounting')
  );
