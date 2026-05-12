-- Phase 10 — IFTA basics. International Fuel Tax Agreement reporting requires
-- two pieces of data per quarter:
--   1. Fuel purchased in each jurisdiction (province / US state).
--   2. Kilometres driven in each jurisdiction.
-- Together they let the bookkeeper compute the per-jurisdiction fuel-tax
-- liability for the quarterly filing (Apr 30, Jul 31, Oct 31, Jan 31).
--
-- This migration adds two manual-entry tables. CSV import + auto-distance
-- estimation are deferred to a later phase once there's actual data flowing.

-- ---------------------------------------------------------------------------
-- fuel_records — one row per fuel purchase. Jurisdiction is stored as the
-- 2–3 char code (matches lib/regions: ON, BC, NY, JAL, ...).
-- ---------------------------------------------------------------------------
create table if not exists public.fuel_records (
  id uuid primary key default gen_random_uuid(),
  truck_id uuid not null references public.trucks(id)    on delete restrict,
  driver_id uuid references public.profiles(id)          on delete set null,

  purchase_date date    not null,
  jurisdiction  text    not null,
  litres        numeric(10, 3) not null check (litres > 0),
  total_cad     numeric(12, 2) not null check (total_cad >= 0),

  odometer_km   integer check (odometer_km is null or odometer_km >= 0),
  vendor        text,

  -- Optional link to a receipt document (Phase 6 storage). Set when the
  -- driver uploads a photo of the receipt with the entry.
  receipt_document_id uuid references public.documents(id) on delete set null,

  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fuel_records_truck_id_idx
  on public.fuel_records(truck_id);
create index if not exists fuel_records_purchase_date_idx
  on public.fuel_records(purchase_date desc);
create index if not exists fuel_records_jurisdiction_idx
  on public.fuel_records(jurisdiction);

create or replace function public.touch_fuel_records()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_fuel_records on public.fuel_records;
create trigger touch_fuel_records
  before update on public.fuel_records
  for each row execute function public.touch_fuel_records();

-- ---------------------------------------------------------------------------
-- trip_distances — kilometres per jurisdiction per trip (load). One load
-- crossing 3 jurisdictions produces 3 rows.
-- ---------------------------------------------------------------------------
create table if not exists public.trip_distances (
  id uuid primary key default gen_random_uuid(),
  load_id uuid not null references public.loads(id) on delete cascade,
  truck_id uuid references public.trucks(id)        on delete set null,

  jurisdiction text not null,
  distance_km  numeric(10, 2) not null check (distance_km > 0),

  -- Date the dispatcher locked the breakdown — separate from the load's
  -- delivery date so we can sort filings cleanly even when a load is edited.
  entered_at timestamptz not null default now(),
  entered_by uuid references public.profiles(id) on delete set null,

  created_at timestamptz not null default now()
);

create index if not exists trip_distances_load_id_idx
  on public.trip_distances(load_id);
create index if not exists trip_distances_jurisdiction_idx
  on public.trip_distances(jurisdiction);
create index if not exists trip_distances_entered_at_idx
  on public.trip_distances(entered_at desc);

-- ---------------------------------------------------------------------------
-- RLS — both tables share the same policy shape:
--   admin/dispatcher: full RW (dispatch enters trip distances; either can
--     correct fuel entries).
--   accounting: full RW (they're the primary owners of the IFTA workflow).
--   driver: select+insert on their own loads / their own fuel purchases.
-- ---------------------------------------------------------------------------
alter table public.fuel_records enable row level security;

drop policy if exists "fuel_records: dispatcher all"   on public.fuel_records;
drop policy if exists "fuel_records: accounting all"   on public.fuel_records;
drop policy if exists "fuel_records: driver read own"  on public.fuel_records;
drop policy if exists "fuel_records: driver insert own"on public.fuel_records;

create policy "fuel_records: dispatcher all"
  on public.fuel_records for all
  using (public.is_dispatcher_or_admin())
  with check (public.is_dispatcher_or_admin());

create policy "fuel_records: accounting all"
  on public.fuel_records for all
  using (public.has_role('accounting'))
  with check (public.has_role('accounting'));

create policy "fuel_records: driver read own"
  on public.fuel_records for select
  using (driver_id = auth.uid());

create policy "fuel_records: driver insert own"
  on public.fuel_records for insert
  with check (driver_id = auth.uid());

alter table public.trip_distances enable row level security;

drop policy if exists "trip_distances: dispatcher all"
  on public.trip_distances;
drop policy if exists "trip_distances: accounting all"
  on public.trip_distances;
drop policy if exists "trip_distances: driver read own"
  on public.trip_distances;

create policy "trip_distances: dispatcher all"
  on public.trip_distances for all
  using (public.is_dispatcher_or_admin())
  with check (public.is_dispatcher_or_admin());

create policy "trip_distances: accounting all"
  on public.trip_distances for all
  using (public.has_role('accounting'))
  with check (public.has_role('accounting'));

create policy "trip_distances: driver read own"
  on public.trip_distances for select
  using (
    exists (
      select 1 from public.loads l
       where l.id = trip_distances.load_id
         and l.driver_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Audit triggers — same audit_generic helper used by Phase 2 tables.
-- ---------------------------------------------------------------------------
drop trigger if exists fuel_records_audit on public.fuel_records;
create trigger fuel_records_audit
  after insert or update or delete on public.fuel_records
  for each row execute function public.audit_generic();

drop trigger if exists trip_distances_audit on public.trip_distances;
create trigger trip_distances_audit
  after insert or update or delete on public.trip_distances
  for each row execute function public.audit_generic();
