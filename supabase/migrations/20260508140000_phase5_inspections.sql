-- Phase 5 (DVIR foundation): Driver Vehicle Inspection Reports. Legally
-- required pre-trip / post-trip / en-route inspections per Canadian NSC and
-- US FMCSA rules. Drivers create them; admins and dispatchers see them all.
-- A major defect automatically flips the truck to out_of_service so dispatch
-- can't accidentally assign it again before the issue is corrected.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_type where typname = 'inspection_type') then
    create type public.inspection_type as enum (
      'pre_trip',
      'post_trip',
      'en_route'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'inspection_severity') then
    create type public.inspection_severity as enum (
      'none',
      'minor',
      'major'
    );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
create table if not exists public.inspections (
  id uuid primary key default gen_random_uuid(),

  truck_id   uuid not null references public.trucks(id)    on delete restrict,
  trailer_id uuid          references public.trailers(id) on delete set null,
  driver_id  uuid not null references public.profiles(id) on delete restrict,
  load_id    uuid          references public.loads(id)    on delete set null,

  inspection_type     public.inspection_type    not null,
  inspection_date     timestamptz               not null default now(),

  -- Driver checklist signal. We don't normalize each item to a column — for
  -- v1 the driver picks "no defects / minor / major" and writes notes.
  defects_found        boolean              not null default false,
  defects_description  text,
  severity             public.inspection_severity not null default 'none',

  signed_by_driver bool not null default true,

  -- Correction tracking — admin/dispatcher updates these once the truck is
  -- repaired and back in service.
  corrected_at  timestamptz,
  corrected_by  uuid references public.profiles(id) on delete set null,
  corrected_notes text,

  notes text,

  created_at timestamptz not null default now()
);

create index if not exists inspections_truck_id_idx
  on public.inspections (truck_id, inspection_date desc);
create index if not exists inspections_driver_id_idx
  on public.inspections (driver_id, inspection_date desc);
create index if not exists inspections_load_id_idx
  on public.inspections (load_id);
create index if not exists inspections_severity_idx
  on public.inspections (severity)
  where severity = 'major' and corrected_at is null;

-- ---------------------------------------------------------------------------
-- RLS
-- Driver: insert for their own (driver_id = self), select for their own
-- inspections. Dispatcher/admin: full. Accounting: read all.
-- Inspections are append-mostly: only admin can mark something corrected.
-- ---------------------------------------------------------------------------
alter table public.inspections enable row level security;

drop policy if exists "inspections: admin all"          on public.inspections;
drop policy if exists "inspections: dispatcher all"     on public.inspections;
drop policy if exists "inspections: driver insert own"  on public.inspections;
drop policy if exists "inspections: driver read own"    on public.inspections;
drop policy if exists "inspections: accounting read"    on public.inspections;

create policy "inspections: admin all"
  on public.inspections for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "inspections: dispatcher all"
  on public.inspections for all
  using (public.has_role('dispatcher'))
  with check (public.has_role('dispatcher'));

create policy "inspections: driver insert own"
  on public.inspections for insert
  with check (driver_id = auth.uid());

create policy "inspections: driver read own"
  on public.inspections for select
  using (driver_id = auth.uid());

create policy "inspections: accounting read"
  on public.inspections for select
  using (public.has_role('accounting'));

-- ---------------------------------------------------------------------------
-- Auto out-of-service trigger: a major defect flips the truck status to
-- out_of_service so dispatchers can't assign it. The reverse (back to active)
-- happens manually when the truck is repaired and the inspection is marked
-- corrected_at — handled by a separate UPDATE trigger below.
-- ---------------------------------------------------------------------------
create or replace function public.inspections_handle_major_defect()
returns trigger
language plpgsql
security definer  -- needs to update trucks regardless of caller's RLS
set search_path = public
as $$
begin
  if new.severity = 'major' and (tg_op = 'INSERT' or old.severity is distinct from new.severity) then
    update public.trucks
       set status = 'out_of_service'
     where id = new.truck_id
       and status <> 'out_of_service';
  end if;
  return new;
end;
$$;

drop trigger if exists inspections_major_defect on public.inspections;
create trigger inspections_major_defect
  after insert or update on public.inspections
  for each row execute function public.inspections_handle_major_defect();

-- When an inspection is marked corrected (corrected_at set, corrected_by set
-- by an admin), and there are no other open major defects on this truck,
-- automatically restore the truck to active status. Keeps the workflow
-- one-click for ops.
create or replace function public.inspections_restore_truck_on_correction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  remaining_open_major int;
begin
  if new.corrected_at is not null
     and old.corrected_at is null
     and new.severity = 'major'
  then
    select count(*)
      into remaining_open_major
      from public.inspections
     where truck_id = new.truck_id
       and severity = 'major'
       and corrected_at is null
       and id <> new.id;

    if remaining_open_major = 0 then
      update public.trucks
         set status = 'active'
       where id = new.truck_id
         and status = 'out_of_service';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists inspections_restore_truck on public.inspections;
create trigger inspections_restore_truck
  after update on public.inspections
  for each row execute function public.inspections_restore_truck_on_correction();
