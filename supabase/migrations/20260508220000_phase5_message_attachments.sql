-- Phase 5 (DVIR chat attachments): allow files to be attached to specific
-- inspection-thread messages. Reuses the same documents table + storage
-- bucket. Path scheme: inspections/<inspection_id>/messages/<message_id>/<doc_id>.<ext>
-- — keeps all driver uploads under the existing `inspections/` prefix so
-- the storage RLS we already wrote covers it.

alter table public.documents
  add column if not exists inspection_message_id uuid
    references public.inspection_messages(id) on delete cascade;

create index if not exists documents_inspection_message_id_idx
  on public.documents (inspection_message_id);
