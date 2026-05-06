-- Phase 1: profiles, audit_log, role enum, RLS, triggers, employee-id helper.

-- ---------------------------------------------------------------------------
-- Role enum
-- ---------------------------------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('admin', 'dispatcher', 'driver', 'accounting');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- profiles (extends auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'driver',
  full_name text not null default '',
  phone text,
  employee_id text unique,
  hire_date date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_active_idx on public.profiles (active);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- audit_log (admin-read-only, written by triggers, never by clients)
-- ---------------------------------------------------------------------------
create table if not exists public.audit_log (
  id bigserial primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  before_json jsonb,
  after_json jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_entity_idx on public.audit_log (entity_type, entity_id);
create index if not exists audit_log_actor_idx on public.audit_log (actor_id);
create index if not exists audit_log_created_idx on public.audit_log (created_at desc);

-- ---------------------------------------------------------------------------
-- handle_new_user: when an auth.users row is inserted, mirror it into profiles.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, full_name, role, active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce((new.raw_user_meta_data ->> 'role')::public.app_role, 'driver'),
    true
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Atomic employee-id generator. Uses a row-locked singleton counter so two
-- concurrent admins never get the same KL-NNNN.
-- ---------------------------------------------------------------------------
create table if not exists public.employee_id_counter (
  id smallint primary key default 1,
  next_value integer not null default 1,
  constraint employee_id_counter_singleton check (id = 1)
);

insert into public.employee_id_counter (id, next_value)
values (1, 1)
on conflict (id) do nothing;

create or replace function public.next_employee_id()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_next integer;
begin
  update public.employee_id_counter
     set next_value = next_value + 1
   where id = 1
   returning next_value - 1 into v_next;
  return 'KL-' || lpad(v_next::text, 4, '0');
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles audit trigger
-- ---------------------------------------------------------------------------
create or replace function public.audit_profiles()
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
    'profile',
    coalesce(new.id::text, old.id::text),
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists profiles_audit on public.profiles;
create trigger profiles_audit
  after insert or update or delete on public.profiles
  for each row execute function public.audit_profiles();

-- ---------------------------------------------------------------------------
-- is_admin() helper used by RLS policies
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
     where id = auth.uid() and role = 'admin' and active = true
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS: profiles
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists "profiles: admin full read"   on public.profiles;
drop policy if exists "profiles: admin full write"  on public.profiles;
drop policy if exists "profiles: self read"         on public.profiles;
drop policy if exists "profiles: self update"       on public.profiles;

create policy "profiles: admin full read"
  on public.profiles for select
  using (public.is_admin());

create policy "profiles: admin full write"
  on public.profiles for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "profiles: self read"
  on public.profiles for select
  using (id = auth.uid());

create policy "profiles: self update"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- A self-update is permitted by RLS, but the trigger below restricts it to
-- the phone column only. role/active/employee_id/etc. are admin-only.
create or replace function public.profiles_self_update_guard()
returns trigger
language plpgsql
as $$
begin
  -- Service role and trigger-driven inserts have no auth.uid(); skip.
  if auth.uid() is null or auth.uid() <> new.id then
    return new;
  end if;

  if not public.is_admin() then
    if new.role        is distinct from old.role
       or new.full_name   is distinct from old.full_name
       or new.employee_id is distinct from old.employee_id
       or new.hire_date   is distinct from old.hire_date
       or new.active      is distinct from old.active
    then
      raise exception 'profiles: only phone may be self-updated';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_self_update_guard on public.profiles;
create trigger profiles_self_update_guard
  before update on public.profiles
  for each row execute function public.profiles_self_update_guard();

-- ---------------------------------------------------------------------------
-- RLS: audit_log (admin reads; no client writes; trigger inserts bypass RLS
-- because the trigger function is security definer)
-- ---------------------------------------------------------------------------
alter table public.audit_log enable row level security;

drop policy if exists "audit_log: admin read" on public.audit_log;

create policy "audit_log: admin read"
  on public.audit_log for select
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------
revoke all on public.employee_id_counter from public, anon, authenticated;

revoke all on function public.next_employee_id() from public, anon;
grant execute on function public.next_employee_id() to authenticated, service_role;

grant execute on function public.is_admin() to authenticated, anon;
