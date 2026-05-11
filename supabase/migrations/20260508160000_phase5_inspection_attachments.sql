-- Phase 5 (DVIR attachments): allow drivers to attach photos / PDFs to an
-- inspection. Reuses the existing documents table + load-documents bucket
-- so we don't grow another storage surface for what is essentially the same
-- pattern (driver upload, role-aware read).

-- ---------------------------------------------------------------------------
-- 1) inspection_id FK on documents.
-- ---------------------------------------------------------------------------
alter table public.documents
  add column if not exists inspection_id uuid
    references public.inspections(id) on delete cascade;

create index if not exists documents_inspection_id_idx
  on public.documents (inspection_id);

-- ---------------------------------------------------------------------------
-- 2) Document-table RLS: drivers can insert + read inspection-attached docs
-- they own. Existing load-scoped policies stay untouched. Admin/dispatcher
-- and accounting policies already cover everything via earlier all/read
-- policies on this table.
-- ---------------------------------------------------------------------------
drop policy if exists "documents: driver insert inspection own"
  on public.documents;
drop policy if exists "documents: driver read inspection own"
  on public.documents;

create policy "documents: driver insert inspection own"
  on public.documents for insert
  with check (
    inspection_id is not null
    and uploaded_by = auth.uid()
    and exists (
      select 1
        from public.inspections i
       where i.id = documents.inspection_id
         and i.driver_id = auth.uid()
    )
  );

create policy "documents: driver read inspection own"
  on public.documents for select
  using (
    inspection_id is not null
    and exists (
      select 1
        from public.inspections i
       where i.id = documents.inspection_id
         and i.driver_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 3) Storage RLS: allow inspection-prefixed objects (same bucket).
-- Path scheme: inspections/<inspection_id>/<doc_id>.<ext>
-- ---------------------------------------------------------------------------
drop policy if exists "load-documents: driver inspection insert"
  on storage.objects;
drop policy if exists "load-documents: driver inspection read"
  on storage.objects;

create policy "load-documents: driver inspection insert"
  on storage.objects for insert
  with check (
    bucket_id = 'load-documents'
    and (storage.foldername(name))[1] = 'inspections'
    and exists (
      select 1
        from public.inspections i
       where i.id::text = (storage.foldername(name))[2]
         and i.driver_id = auth.uid()
    )
  );

create policy "load-documents: driver inspection read"
  on storage.objects for select
  using (
    bucket_id = 'load-documents'
    and (storage.foldername(name))[1] = 'inspections'
    and exists (
      select 1
        from public.inspections i
       where i.id::text = (storage.foldername(name))[2]
         and i.driver_id = auth.uid()
    )
  );
