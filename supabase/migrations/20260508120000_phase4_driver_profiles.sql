-- Phase 4: driver_profiles (1:1 with profiles where role = driver) and the
-- compliance fields the alerts engine surfaces. The schema follows CLAUDE.md
-- but uses generic names where Ontario-specific terminology would mislead a
-- BC carrier (e.g. "abstract_last_pulled" stays generic — works for BC NSC
-- driver abstracts as well as Ontario CVOR pulls).

-- ---------------------------------------------------------------------------
-- Enum: licence class is province-coded (BC/AB/ON all use 1-7) — no enum
-- needed, plain text fits all jurisdictions.
-- ---------------------------------------------------------------------------

create table if not exists public.driver_profiles (
  profile_id uuid primary key references public.profiles(id) on delete cascade,

  -- Driver licence
  licence_number   text,
  licence_class    text,                                  -- "1", "1A", "AZ" etc.
  licence_province text,                                  -- 2-letter code (BC/AB/ON/...)
  licence_expiry   date,

  -- Medical certification (DOT physical / Canadian commercial driver medical)
  medical_cert_expiry date,

  -- FAST card (cross-border trusted-traveller, 5-year expiry)
  fast_card_number text,
  fast_card_expiry date,

  -- Last time the driver's abstract / record was pulled and reviewed.
  -- BC: NSC driver abstract. ON: CVOR abstract. Both fit this column.
  abstract_last_pulled date,

  -- Emergency contact (free-form for v1; can normalize later if needed)
  emergency_contact_name  text,
  emergency_contact_phone text,

  hire_date date,
  notes     text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists driver_profiles_licence_expiry_idx
  on public.driver_profiles (licence_expiry);
create index if not exists driver_profiles_medical_expiry_idx
  on public.driver_profiles (medical_cert_expiry);
create index if not exists driver_profiles_fast_expiry_idx
  on public.driver_profiles (fast_card_expiry);

drop trigger if exists driver_profiles_set_updated_at on public.driver_profiles;
create trigger driver_profiles_set_updated_at
  before update on public.driver_profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- Admin: full. Dispatcher: read all (so they know who's in compliance) but
-- cannot edit compliance fields — that's an admin-only signal. Driver: read
-- + self-update on operational fields only (emergency contact). Compliance
-- writes are admin-only.
-- ---------------------------------------------------------------------------
alter table public.driver_profiles enable row level security;

drop policy if exists "driver_profiles: admin all"             on public.driver_profiles;
drop policy if exists "driver_profiles: dispatcher read"       on public.driver_profiles;
drop policy if exists "driver_profiles: self read"             on public.driver_profiles;
drop policy if exists "driver_profiles: self emergency update" on public.driver_profiles;

create policy "driver_profiles: admin all"
  on public.driver_profiles for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "driver_profiles: dispatcher read"
  on public.driver_profiles for select
  using (public.has_role('dispatcher'));

create policy "driver_profiles: self read"
  on public.driver_profiles for select
  using (profile_id = auth.uid());

-- A driver may update only their own emergency contact info via this policy.
-- The accompanying trigger (below) blocks any other field change from a non-
-- admin caller so it can't be bypassed by the policy alone.
create policy "driver_profiles: self emergency update"
  on public.driver_profiles for update
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- Trigger guard: when the row's owner (a driver) self-updates, only
-- emergency_contact_name and emergency_contact_phone may change. Compliance
-- fields require admin.
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
    then
      raise exception
        'driver_profiles: only emergency contact fields are self-editable';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists driver_profiles_guard on public.driver_profiles;
create trigger driver_profiles_guard
  before update on public.driver_profiles
  for each row execute function public.driver_profiles_self_update_guard();

-- ---------------------------------------------------------------------------
-- Auto-create driver_profiles on profile insert when role = driver. Lets the
-- existing employee-onboarding flow continue to work without changes; the
-- compliance row is then editable by admin once the user exists.
-- ---------------------------------------------------------------------------
create or replace function public.profiles_seed_driver_profile()
returns trigger
language plpgsql
as $$
begin
  if new.role = 'driver' then
    insert into public.driver_profiles (profile_id)
    values (new.id)
    on conflict (profile_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_seed_driver_profile on public.profiles;
create trigger profiles_seed_driver_profile
  after insert on public.profiles
  for each row execute function public.profiles_seed_driver_profile();

-- And one-shot backfill for any existing driver profiles that don't have a
-- compliance row yet.
insert into public.driver_profiles (profile_id)
select p.id
  from public.profiles p
 where p.role = 'driver'
   and not exists (
     select 1 from public.driver_profiles dp where dp.profile_id = p.id
   )
on conflict (profile_id) do nothing;
