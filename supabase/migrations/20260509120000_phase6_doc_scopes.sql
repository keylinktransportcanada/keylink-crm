-- Phase 6: extend documents to truck-, driver-, and trailer-scoped uploads.
-- Adds trailer_id column, opens up RLS so dispatchers/admins can manage
-- compliance docs across all three entity types, and lets drivers read their
-- own personal docs and the assigned truck's paperwork (registration etc.)
-- from their phone.

-- ---------------------------------------------------------------------------
-- Schema — add trailer_id; truck_id and driver_id already exist.
-- ---------------------------------------------------------------------------
alter table public.documents
  add column if not exists trailer_id uuid
    references public.trailers(id) on delete cascade;

create index if not exists documents_trailer_id_idx
  on public.documents(trailer_id);

create index if not exists documents_expiry_idx
  on public.documents(expiry_date)
  where expiry_date is not null;

-- ---------------------------------------------------------------------------
-- Table RLS — add per-scope policies on top of the load-only ones.
-- ---------------------------------------------------------------------------
drop policy if exists "documents: dispatcher truck"   on public.documents;
drop policy if exists "documents: dispatcher driver"  on public.documents;
drop policy if exists "documents: dispatcher trailer" on public.documents;
drop policy if exists "documents: driver read own personal" on public.documents;
drop policy if exists "documents: driver read assigned truck" on public.documents;

-- Dispatcher/admin already has `documents: dispatcher all` from Phase 6 init,
-- which covers any row regardless of scope. We don't need scope-specific
-- write policies for them; the existing FOR ALL policy already does it.

-- Driver: read their own personal docs (driver_licence, medical, FAST card).
create policy "documents: driver read own personal"
  on public.documents for select
  using (
    driver_id is not null
    and driver_id = auth.uid()
  );

-- Driver: read paperwork attached to the truck they're currently assigned to.
-- Useful so they can pull insurance/registration on the side of the road.
create policy "documents: driver read assigned truck"
  on public.documents for select
  using (
    truck_id is not null
    and exists (
      select 1 from public.loads l
       where l.driver_id = auth.uid()
         and l.truck_id = documents.truck_id
         and l.status not in ('delivered', 'invoiced', 'paid', 'cancelled')
    )
  );

-- ---------------------------------------------------------------------------
-- Storage RLS — extend the load-documents bucket so paths
--   trucks/<id>/...     drivers/<id>/...     trailers/<id>/...
-- are policed alongside loads/<id>/...
-- ---------------------------------------------------------------------------
drop policy if exists "load-documents: dispatcher trucks"   on storage.objects;
drop policy if exists "load-documents: dispatcher drivers"  on storage.objects;
drop policy if exists "load-documents: dispatcher trailers" on storage.objects;
drop policy if exists "load-documents: driver read personal" on storage.objects;
drop policy if exists "load-documents: driver read assigned truck" on storage.objects;

-- The existing "load-documents: dispatcher all" policy is keyed on bucket only
-- (no path filter), so it already grants dispatchers/admins full access to
-- every prefix in this bucket. We just need driver-side read paths.

create policy "load-documents: driver read personal"
  on storage.objects for select
  using (
    bucket_id = 'load-documents'
    and (storage.foldername(name))[1] = 'drivers'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "load-documents: driver read assigned truck"
  on storage.objects for select
  using (
    bucket_id = 'load-documents'
    and (storage.foldername(name))[1] = 'trucks'
    and exists (
      select 1 from public.loads l
       where l.driver_id = auth.uid()
         and l.truck_id::text = (storage.foldername(name))[2]
         and l.status not in ('delivered', 'invoiced', 'paid', 'cancelled')
    )
  );
