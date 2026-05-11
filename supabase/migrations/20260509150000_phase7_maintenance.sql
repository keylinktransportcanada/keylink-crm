-- Phase 7 — Maintenance log per truck. Stores every service event (oil
-- change, tires, annual safety, repair, etc.) with cost, vendor, odometer
-- at service, and the next-due target so we can flag trucks that are
-- approaching a service interval on the load board.
--
-- Conventions:
--   service_date    — the date the service was performed (date only).
--   odometer_km     — km on the truck at the moment of service.
--   next_due_date   — calendar trigger for the next service of this kind.
--   next_due_odometer_km — mileage trigger for the next service of this kind.
-- Either next_due column may be null; the dispatcher warning treats whichever
-- is present as a constraint.

-- ---------------------------------------------------------------------------
-- Enum
-- ---------------------------------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_type where typname = 'maintenance_service_type') then
    create type public.maintenance_service_type as enum (
      'oil_change',
      'tire',
      'brake',
      'annual_inspection',
      'safety',
      'repair',
      'preventive',
      'other'
    );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
create table if not exists public.maintenance_records (
  id uuid primary key default gen_random_uuid(),
  truck_id uuid not null references public.trucks(id) on delete cascade,

  service_type         public.maintenance_service_type not null,
  service_date         date not null,
  odometer_km          integer check (odometer_km is null or odometer_km >= 0),
  cost_cad             numeric(10, 2) check (cost_cad is null or cost_cad >= 0),
  vendor               text,
  description          text,
  next_due_date        date,
  next_due_odometer_km integer check (
    next_due_odometer_km is null or next_due_odometer_km >= 0
  ),

  document_id uuid references public.documents(id) on delete set null,
  created_by  uuid references public.profiles(id)  on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists maintenance_records_truck_id_idx
  on public.maintenance_records(truck_id);

create index if not exists maintenance_records_next_due_date_idx
  on public.maintenance_records(next_due_date)
  where next_due_date is not null;

create index if not exists maintenance_records_service_date_idx
  on public.maintenance_records(service_date desc);

-- updated_at trigger
create or replace function public.touch_maintenance_records()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_maintenance_records on public.maintenance_records;
create trigger touch_maintenance_records
  before update on public.maintenance_records
  for each row execute function public.touch_maintenance_records();

-- ---------------------------------------------------------------------------
-- RLS
-- Dispatcher/admin: full read/write. Driver: read records on the truck they
-- are currently assigned to (so they can see scheduled services on their
-- daily view). Accounting: read-only (so they can audit costs).
-- ---------------------------------------------------------------------------
alter table public.maintenance_records enable row level security;

drop policy if exists "maintenance: dispatcher all" on public.maintenance_records;
drop policy if exists "maintenance: driver read assigned truck"
  on public.maintenance_records;
drop policy if exists "maintenance: accounting read"
  on public.maintenance_records;

create policy "maintenance: dispatcher all"
  on public.maintenance_records for all
  using (public.is_dispatcher_or_admin())
  with check (public.is_dispatcher_or_admin());

create policy "maintenance: driver read assigned truck"
  on public.maintenance_records for select
  using (
    exists (
      select 1 from public.loads l
       where l.driver_id = auth.uid()
         and l.truck_id = maintenance_records.truck_id
         and l.status not in ('delivered', 'invoiced', 'paid', 'cancelled')
    )
  );

create policy "maintenance: accounting read"
  on public.maintenance_records for select
  using (public.has_role('accounting'));
