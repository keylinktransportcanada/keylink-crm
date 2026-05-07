-- Phase 2: customers, trucks, trailers, loads, load_status_events.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_type where typname = 'equipment_status') then
    create type public.equipment_status as enum
      ('active', 'maintenance', 'out_of_service', 'retired');
  end if;
  if not exists (select 1 from pg_type where typname = 'trailer_type') then
    create type public.trailer_type as enum
      ('dry_van', 'reefer', 'flatbed', 'step_deck', 'tank', 'other');
  end if;
  if not exists (select 1 from pg_type where typname = 'load_status') then
    create type public.load_status as enum (
      'draft', 'assigned', 'dispatched', 'at_pickup', 'loaded',
      'in_transit', 'at_delivery', 'delivered', 'invoiced', 'paid', 'cancelled'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'load_type') then
    create type public.load_type as enum ('ftl', 'ltl', 'partial');
  end if;
  if not exists (select 1 from pg_type where typname = 'load_currency') then
    create type public.load_currency as enum ('CAD', 'USD');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Role helpers (extend the is_admin pattern from Phase 1)
-- ---------------------------------------------------------------------------
create or replace function public.has_role(p_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
     where id = auth.uid() and role = p_role and active = true
  );
$$;

create or replace function public.is_dispatcher_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
     where id = auth.uid() and role in ('admin','dispatcher') and active = true
  );
$$;

grant execute on function public.has_role(public.app_role) to authenticated;
grant execute on function public.is_dispatcher_or_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- customers
-- ---------------------------------------------------------------------------
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text,
  email text,
  phone text,
  address text,
  billing_address text,
  payment_terms_days integer not null default 30,
  credit_limit_cad numeric(12, 2),
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customers_active_idx on public.customers (active);
create index if not exists customers_name_idx on public.customers (lower(name));

drop trigger if exists customers_set_updated_at on public.customers;
create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- trucks (full schema; Phase 3 will surface compliance fields in UI)
-- ---------------------------------------------------------------------------
create table if not exists public.trucks (
  id uuid primary key default gen_random_uuid(),
  truck_number text not null unique,
  make text,
  model text,
  year integer,
  plate text,
  plate_province text,
  plate_expiry date,
  vin text,
  status public.equipment_status not null default 'active',
  current_odometer_km integer,
  insurance_policy text,
  insurance_expiry date,
  ifta_decal_year integer,
  ifta_decal_expiry date,
  safety_sticker_expiry date,
  cvor_certificate_expiry date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trucks_status_idx on public.trucks (status);

drop trigger if exists trucks_set_updated_at on public.trucks;
create trigger trucks_set_updated_at
  before update on public.trucks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- trailers
-- ---------------------------------------------------------------------------
create table if not exists public.trailers (
  id uuid primary key default gen_random_uuid(),
  trailer_number text not null unique,
  type public.trailer_type not null default 'dry_van',
  plate text,
  plate_province text,
  plate_expiry date,
  vin text,
  status public.equipment_status not null default 'active',
  last_inspection_date date,
  next_inspection_due date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trailers_status_idx on public.trailers (status);

drop trigger if exists trailers_set_updated_at on public.trailers;
create trigger trailers_set_updated_at
  before update on public.trailers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Atomic load_number generator: L-YYYY-NNNN with the year reset every Jan 1.
-- ---------------------------------------------------------------------------
create table if not exists public.load_number_counter (
  year integer primary key,
  next_value integer not null default 1
);

create or replace function public.next_load_number()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_year integer := extract(year from (now() at time zone 'America/Toronto'))::integer;
  v_next integer;
begin
  insert into public.load_number_counter (year, next_value)
  values (v_year, 2)
  on conflict (year) do update
    set next_value = public.load_number_counter.next_value + 1
  returning next_value - 1 into v_next;
  return 'L-' || v_year::text || '-' || lpad(v_next::text, 4, '0');
end;
$$;

revoke all on public.load_number_counter from public, anon, authenticated;
revoke all on function public.next_load_number() from public, anon;
grant execute on function public.next_load_number() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- loads
--
-- Money columns are CAD-normalized (rate_cad, fuel_surcharge_cad, etc.).
-- The form lets the dispatcher enter in CAD or USD; the server action
-- converts using the FX rate of the day, stores the rate in fx_rate_to_cad,
-- and records the entered currency in `currency`. Display reverses the
-- conversion. KPIs always use the *_cad columns.
-- ---------------------------------------------------------------------------
create table if not exists public.loads (
  id uuid primary key default gen_random_uuid(),
  load_number text not null unique,

  customer_id uuid not null references public.customers(id) on delete restrict,
  driver_id uuid references public.profiles(id) on delete set null,
  truck_id uuid references public.trucks(id) on delete set null,
  trailer_id uuid references public.trailers(id) on delete set null,

  origin_company text,
  origin_address text,
  origin_city text,
  origin_province text,
  origin_country text default 'CA',

  destination_company text,
  destination_address text,
  destination_city text,
  destination_province text,
  destination_country text default 'CA',

  pickup_date date,
  pickup_window_start timestamptz,
  pickup_window_end timestamptz,
  delivery_date date,
  delivery_window_start timestamptz,
  delivery_window_end timestamptz,

  status public.load_status not null default 'draft',
  load_type public.load_type not null default 'ftl',
  commodity text,
  weight_kg numeric(10, 2),
  pieces integer,
  equipment_required text,

  currency public.load_currency not null default 'CAD',
  fx_rate_to_cad numeric(10, 6) not null default 1.0,
  rate_cad numeric(12, 2),
  fuel_surcharge_cad numeric(12, 2),
  accessorial_charges_cad numeric(12, 2),
  total_billed_cad numeric(12, 2),

  is_cross_border boolean not null default false,
  customs_broker text,
  pars_pass_number text,
  aci_aces_number text,

  reference_number text,
  po_number text,

  notes text,
  internal_notes text,

  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists loads_status_idx on public.loads (status);
create index if not exists loads_driver_idx on public.loads (driver_id);
create index if not exists loads_customer_idx on public.loads (customer_id);
create index if not exists loads_truck_idx on public.loads (truck_id);
create index if not exists loads_pickup_date_idx on public.loads (pickup_date);
create index if not exists loads_delivery_date_idx on public.loads (delivery_date);

drop trigger if exists loads_set_updated_at on public.loads;
create trigger loads_set_updated_at
  before update on public.loads
  for each row execute function public.set_updated_at();

-- Auto-fill load_number on insert if the caller didn't supply one.
create or replace function public.set_load_number()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.load_number is null or new.load_number = '' then
    new.load_number := public.next_load_number();
  end if;
  return new;
end;
$$;

drop trigger if exists loads_set_load_number on public.loads;
create trigger loads_set_load_number
  before insert on public.loads
  for each row execute function public.set_load_number();

-- ---------------------------------------------------------------------------
-- load_status_events (immutable audit trail of status transitions)
-- ---------------------------------------------------------------------------
create table if not exists public.load_status_events (
  id bigserial primary key,
  load_id uuid not null references public.loads(id) on delete cascade,
  status public.load_status not null,
  location_note text,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists load_status_events_load_idx
  on public.load_status_events (load_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Audit triggers for ops tables
-- ---------------------------------------------------------------------------
create or replace function public.audit_generic()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.audit_log (actor_id, action, entity_type, entity_id, before_json, after_json)
  values (
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    coalesce(new.id::text, old.id::text),
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists customers_audit on public.customers;
create trigger customers_audit
  after insert or update or delete on public.customers
  for each row execute function public.audit_generic();

drop trigger if exists trucks_audit on public.trucks;
create trigger trucks_audit
  after insert or update or delete on public.trucks
  for each row execute function public.audit_generic();

drop trigger if exists trailers_audit on public.trailers;
create trigger trailers_audit
  after insert or update or delete on public.trailers
  for each row execute function public.audit_generic();

drop trigger if exists loads_audit on public.loads;
create trigger loads_audit
  after insert or update or delete on public.loads
  for each row execute function public.audit_generic();

-- ---------------------------------------------------------------------------
-- RLS: customers
-- Admin & dispatcher can read/write. Driver & accounting can read.
-- ---------------------------------------------------------------------------
alter table public.customers enable row level security;

drop policy if exists "customers: read all"          on public.customers;
drop policy if exists "customers: dispatcher write"  on public.customers;

create policy "customers: read all"
  on public.customers for select
  using (auth.uid() is not null);

create policy "customers: dispatcher write"
  on public.customers for all
  using (public.is_dispatcher_or_admin())
  with check (public.is_dispatcher_or_admin());

-- ---------------------------------------------------------------------------
-- RLS: trucks
-- ---------------------------------------------------------------------------
alter table public.trucks enable row level security;

drop policy if exists "trucks: read all"          on public.trucks;
drop policy if exists "trucks: dispatcher write"  on public.trucks;

create policy "trucks: read all"
  on public.trucks for select
  using (auth.uid() is not null);

create policy "trucks: dispatcher write"
  on public.trucks for all
  using (public.is_dispatcher_or_admin())
  with check (public.is_dispatcher_or_admin());

-- ---------------------------------------------------------------------------
-- RLS: trailers
-- ---------------------------------------------------------------------------
alter table public.trailers enable row level security;

drop policy if exists "trailers: read all"          on public.trailers;
drop policy if exists "trailers: dispatcher write"  on public.trailers;

create policy "trailers: read all"
  on public.trailers for select
  using (auth.uid() is not null);

create policy "trailers: dispatcher write"
  on public.trailers for all
  using (public.is_dispatcher_or_admin())
  with check (public.is_dispatcher_or_admin());

-- ---------------------------------------------------------------------------
-- RLS: loads
-- Admin/dispatcher: full RW.
-- Driver: select+update only loads where driver_id = auth.uid().
-- Accounting: select all; update all (server action gates which columns).
-- ---------------------------------------------------------------------------
alter table public.loads enable row level security;

drop policy if exists "loads: dispatcher all"      on public.loads;
drop policy if exists "loads: driver own"          on public.loads;
drop policy if exists "loads: driver own update"   on public.loads;
drop policy if exists "loads: accounting read"     on public.loads;
drop policy if exists "loads: accounting update"   on public.loads;

create policy "loads: dispatcher all"
  on public.loads for all
  using (public.is_dispatcher_or_admin())
  with check (public.is_dispatcher_or_admin());

create policy "loads: driver own"
  on public.loads for select
  using (driver_id = auth.uid());

create policy "loads: driver own update"
  on public.loads for update
  using (driver_id = auth.uid())
  with check (driver_id = auth.uid());

create policy "loads: accounting read"
  on public.loads for select
  using (public.has_role('accounting'));

create policy "loads: accounting update"
  on public.loads for update
  using (public.has_role('accounting'))
  with check (public.has_role('accounting'));

-- ---------------------------------------------------------------------------
-- RLS: load_status_events
-- Dispatcher/admin: full. Driver: select+insert for own loads. Accounting: read.
-- Events are immutable: no update or delete from clients.
-- ---------------------------------------------------------------------------
alter table public.load_status_events enable row level security;

drop policy if exists "lse: dispatcher all"      on public.load_status_events;
drop policy if exists "lse: driver read own"     on public.load_status_events;
drop policy if exists "lse: driver insert own"   on public.load_status_events;
drop policy if exists "lse: accounting read"     on public.load_status_events;

create policy "lse: dispatcher all"
  on public.load_status_events for all
  using (public.is_dispatcher_or_admin())
  with check (public.is_dispatcher_or_admin());

create policy "lse: driver read own"
  on public.load_status_events for select
  using (
    exists (
      select 1 from public.loads l
       where l.id = load_status_events.load_id
         and l.driver_id = auth.uid()
    )
  );

create policy "lse: driver insert own"
  on public.load_status_events for insert
  with check (
    exists (
      select 1 from public.loads l
       where l.id = load_status_events.load_id
         and l.driver_id = auth.uid()
    )
  );

create policy "lse: accounting read"
  on public.load_status_events for select
  using (public.has_role('accounting'));
