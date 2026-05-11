-- Phase 5 (DVIR replies): admin can leave a free-form reply on an
-- inspection (e.g. "Send me a photo of the brake pad") in addition to the
-- terminal "mark corrected" action. Drivers read it on their dashboard and
-- get a bell notification when it lands.

alter table public.inspections
  add column if not exists admin_reply       text,
  add column if not exists admin_reply_at    timestamptz,
  add column if not exists admin_reply_by    uuid
    references public.profiles(id) on delete set null;

create index if not exists inspections_admin_reply_at_idx
  on public.inspections (admin_reply_at desc)
  where admin_reply_at is not null;
