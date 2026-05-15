-- Phase 12: driver settlement / payroll
--
-- Adds a pay configuration (method + rate) to every driver, plus three
-- tables that model a pay-period statement:
--
--   driver_settlements           — one row per driver per pay period
--   driver_settlement_lines      — one row per load included on a settlement
--   driver_settlement_adjustments — bonuses / deductions / advances on a
--                                   settlement
--
-- Totals on driver_settlements are kept in-sync by triggers so the list
-- screen can rank/filter by amount without a join. A load can only appear
-- on a single settlement (unique constraint on driver_settlement_lines.
-- load_id) so accounting can't accidentally double-pay.

-- ---------------------------------------------------------------------------
-- Driver pay configuration
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'driver_pay_method' and n.nspname = 'public'
  ) then
    create type public.driver_pay_method as enum (
      'percent_revenue',  -- pay_rate is a fraction, e.g. 0.25 == 25% of load rate_cad
      'flat_per_load',    -- pay_rate is a CAD amount per delivered load
      'per_km'            -- pay_rate is CAD per kilometre across the load's trip_distances
    );
  end if;
end$$;

alter table public.driver_profiles
  add column if not exists pay_method public.driver_pay_method not null default 'percent_revenue',
  add column if not exists pay_rate numeric(10, 4) not null default 0;

-- The existing self-update guard already blocks compliance writes from
-- drivers. Pay configuration is admin-only too, so extend the guard.
create or replace function public.driver_profiles_self_update_guard()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null or auth.uid() <> new.profile_id then
    return new;
  end if;

  if not public.is_admin() then
    if new.licence_number       is distinct from old.licence_number
       or new.licence_class       is distinct from old.licence_class
       or new.licence_province    is distinct from old.licence_province
       or new.licence_expiry      is distinct from old.licence_expiry
       or new.medical_cert_expiry is distinct from old.medical_cert_expiry
       or new.fast_card_number    is distinct from old.fast_card_number
       or new.fast_card_expiry    is distinct from old.fast_card_expiry
       or new.abstract_last_pulled is distinct from old.abstract_last_pulled
       or new.hire_date           is distinct from old.hire_date
       or new.notes               is distinct from old.notes
       or new.pay_method          is distinct from old.pay_method
       or new.pay_rate            is distinct from old.pay_rate
    then
      raise exception
        'driver_profiles: only emergency contact fields are self-editable';
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Settlement enums
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'settlement_status' and n.nspname = 'public'
  ) then
    create type public.settlement_status as enum ('draft', 'finalized', 'paid');
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'settlement_adjustment_kind' and n.nspname = 'public'
  ) then
    create type public.settlement_adjustment_kind as enum (
      'bonus',
      'deduction',
      'reimbursement',
      'advance'
    );
  end if;
end$$;

-- ---------------------------------------------------------------------------
-- driver_settlements — one row per driver per pay period
-- ---------------------------------------------------------------------------
create table if not exists public.driver_settlements (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.profiles(id) on delete restrict,
  period_start date not null,
  period_end date not null,
  status public.settlement_status not null default 'draft',

  -- snapshot of pay configuration at the time the settlement was created.
  -- If the driver's pay_method/pay_rate is changed later, in-flight
  -- settlements are unaffected.
  pay_method public.driver_pay_method not null,
  pay_rate numeric(10, 4) not null,

  -- aggregates maintained by triggers on lines + adjustments
  loads_count integer not null default 0,
  gross_load_cad numeric(12, 2) not null default 0,
  adjustments_cad numeric(12, 2) not null default 0,
  total_cad numeric(12, 2) not null default 0,

  -- payment metadata, filled when status flips to 'paid'
  paid_at timestamptz,
  paid_method text,         -- 'etransfer' | 'cheque' | 'direct_deposit' | ...
  paid_reference text,      -- cheque #, e-transfer confirmation, etc.

  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (period_end >= period_start)
);

create index if not exists driver_settlements_driver_idx
  on public.driver_settlements (driver_id);
create index if not exists driver_settlements_status_idx
  on public.driver_settlements (status);
create index if not exists driver_settlements_period_idx
  on public.driver_settlements (period_start, period_end);

drop trigger if exists driver_settlements_set_updated_at on public.driver_settlements;
create trigger driver_settlements_set_updated_at
  before update on public.driver_settlements
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- driver_settlement_lines — one row per load included
-- ---------------------------------------------------------------------------
create table if not exists public.driver_settlement_lines (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid not null references public.driver_settlements(id) on delete cascade,
  load_id uuid not null references public.loads(id) on delete restrict,

  -- snapshot of inputs for transparency on the statement
  pay_method public.driver_pay_method not null,
  pay_rate numeric(10, 4) not null,
  load_rate_cad numeric(12, 2),       -- load.rate_cad at time of generation
  total_km numeric(10, 2),            -- sum of trip_distances at time of generation

  amount_cad numeric(12, 2) not null,
  notes text,
  created_at timestamptz not null default now(),

  -- a load can only appear on one settlement (no double-pay)
  unique (load_id)
);

create index if not exists driver_settlement_lines_settlement_idx
  on public.driver_settlement_lines (settlement_id);

-- ---------------------------------------------------------------------------
-- driver_settlement_adjustments — bonuses, deductions, advances, reimbursements
-- ---------------------------------------------------------------------------
create table if not exists public.driver_settlement_adjustments (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid not null references public.driver_settlements(id) on delete cascade,
  kind public.settlement_adjustment_kind not null,
  description text not null,
  amount_cad numeric(12, 2) not null,
  created_at timestamptz not null default now()
);

create index if not exists driver_settlement_adjustments_settlement_idx
  on public.driver_settlement_adjustments (settlement_id);

-- ---------------------------------------------------------------------------
-- Totals are derived. Recompute them whenever lines or adjustments change.
-- Sign convention: bonus + reimbursement add to the driver; deduction +
-- advance subtract.
-- ---------------------------------------------------------------------------
create or replace function public.recompute_settlement_totals(p_settlement_id uuid)
returns void
language plpgsql
as $$
declare
  v_loads_count integer;
  v_gross numeric(12, 2);
  v_adj   numeric(12, 2);
begin
  select count(*), coalesce(sum(amount_cad), 0)
    into v_loads_count, v_gross
    from public.driver_settlement_lines
   where settlement_id = p_settlement_id;

  select coalesce(sum(
           case when kind in ('bonus', 'reimbursement') then amount_cad
                else -amount_cad
           end
         ), 0)
    into v_adj
    from public.driver_settlement_adjustments
   where settlement_id = p_settlement_id;

  update public.driver_settlements
     set loads_count     = v_loads_count,
         gross_load_cad  = v_gross,
         adjustments_cad = v_adj,
         total_cad       = v_gross + v_adj
   where id = p_settlement_id;
end;
$$;

create or replace function public.driver_settlement_lines_after_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recompute_settlement_totals(old.settlement_id);
    return old;
  else
    perform public.recompute_settlement_totals(new.settlement_id);
    return new;
  end if;
end;
$$;

drop trigger if exists driver_settlement_lines_recompute on public.driver_settlement_lines;
create trigger driver_settlement_lines_recompute
  after insert or update or delete on public.driver_settlement_lines
  for each row execute function public.driver_settlement_lines_after_change();

create or replace function public.driver_settlement_adjustments_after_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recompute_settlement_totals(old.settlement_id);
    return old;
  else
    perform public.recompute_settlement_totals(new.settlement_id);
    return new;
  end if;
end;
$$;

drop trigger if exists driver_settlement_adjustments_recompute on public.driver_settlement_adjustments;
create trigger driver_settlement_adjustments_recompute
  after insert or update or delete on public.driver_settlement_adjustments
  for each row execute function public.driver_settlement_adjustments_after_change();

-- ---------------------------------------------------------------------------
-- RLS
-- admin + accounting: full read/write
-- dispatcher:         no access (financial data)
-- driver:             read-only on their own settlement + lines + adjustments
-- ---------------------------------------------------------------------------
alter table public.driver_settlements enable row level security;
alter table public.driver_settlement_lines enable row level security;
alter table public.driver_settlement_adjustments enable row level security;

drop policy if exists "settlements: admin all"           on public.driver_settlements;
drop policy if exists "settlements: accounting all"      on public.driver_settlements;
drop policy if exists "settlements: driver self read"    on public.driver_settlements;

create policy "settlements: admin all"
  on public.driver_settlements for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "settlements: accounting all"
  on public.driver_settlements for all
  using (public.has_role('accounting'))
  with check (public.has_role('accounting'));

create policy "settlements: driver self read"
  on public.driver_settlements for select
  using (driver_id = auth.uid());

drop policy if exists "settlement_lines: admin all"        on public.driver_settlement_lines;
drop policy if exists "settlement_lines: accounting all"   on public.driver_settlement_lines;
drop policy if exists "settlement_lines: driver self read" on public.driver_settlement_lines;

create policy "settlement_lines: admin all"
  on public.driver_settlement_lines for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "settlement_lines: accounting all"
  on public.driver_settlement_lines for all
  using (public.has_role('accounting'))
  with check (public.has_role('accounting'));

create policy "settlement_lines: driver self read"
  on public.driver_settlement_lines for select
  using (exists (
    select 1
      from public.driver_settlements s
     where s.id = settlement_id
       and s.driver_id = auth.uid()
  ));

drop policy if exists "settlement_adjustments: admin all"        on public.driver_settlement_adjustments;
drop policy if exists "settlement_adjustments: accounting all"   on public.driver_settlement_adjustments;
drop policy if exists "settlement_adjustments: driver self read" on public.driver_settlement_adjustments;

create policy "settlement_adjustments: admin all"
  on public.driver_settlement_adjustments for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "settlement_adjustments: accounting all"
  on public.driver_settlement_adjustments for all
  using (public.has_role('accounting'))
  with check (public.has_role('accounting'));

create policy "settlement_adjustments: driver self read"
  on public.driver_settlement_adjustments for select
  using (exists (
    select 1
      from public.driver_settlements s
     where s.id = settlement_id
       and s.driver_id = auth.uid()
  ));
