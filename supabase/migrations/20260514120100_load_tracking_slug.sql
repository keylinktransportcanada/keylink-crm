-- Phase 12 — customer-facing tracking links.
-- Adds a long, unguessable slug to each load that can be shared with
-- shippers/consignees so they can poll status without an account.
-- The public /track/[slug] route reads through a SECURITY DEFINER
-- function so we never have to weaken loads RLS for the unauth path.

alter table public.loads
  add column if not exists tracking_slug text;

-- Backfill existing rows with a 32-char hex slug. Two random calls
-- glued together cover the full uuid entropy without dashes.
update public.loads
   set tracking_slug = replace(gen_random_uuid()::text, '-', '')
                    || replace(gen_random_uuid()::text, '-', '')
 where tracking_slug is null;

alter table public.loads
  alter column tracking_slug set not null;

create unique index if not exists loads_tracking_slug_key
  on public.loads (tracking_slug);

-- Auto-fill on insert when the caller didn't supply one.
create or replace function public.set_load_tracking_slug()
returns trigger
language plpgsql
as $$
begin
  if new.tracking_slug is null or new.tracking_slug = '' then
    new.tracking_slug :=
      replace(gen_random_uuid()::text, '-', '')
   || replace(gen_random_uuid()::text, '-', '');
  end if;
  return new;
end;
$$;

drop trigger if exists loads_set_tracking_slug on public.loads;
create trigger loads_set_tracking_slug
before insert on public.loads
for each row execute function public.set_load_tracking_slug();

-- Public read function for the tracking page. Returns a curated subset
-- of load fields + status timeline. SECURITY DEFINER so the anon role
-- can call it through the API without any direct table grants.
create or replace function public.get_load_by_tracking_slug(p_slug text)
returns table (
  load_number text,
  status public.load_status,
  customer_name text,
  origin_company text,
  origin_city text,
  origin_province text,
  origin_country text,
  destination_company text,
  destination_city text,
  destination_province text,
  destination_country text,
  pickup_date date,
  delivery_date date,
  is_cross_border boolean,
  reference_number text,
  events jsonb
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  select
    l.load_number,
    l.status,
    c.name as customer_name,
    l.origin_company,
    l.origin_city,
    l.origin_province,
    l.origin_country,
    l.destination_company,
    l.destination_city,
    l.destination_province,
    l.destination_country,
    l.pickup_date,
    l.delivery_date,
    l.is_cross_border,
    l.reference_number,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'status', e.status,
            'location_note', e.location_note,
            'created_at', e.created_at
          )
          order by e.created_at asc
        )
        from public.load_status_events e
        where e.load_id = l.id
      ),
      '[]'::jsonb
    ) as events
  from public.loads l
  left join public.customers c on c.id = l.customer_id
  where l.tracking_slug = p_slug
  limit 1;
end;
$$;

revoke all on function public.get_load_by_tracking_slug(text) from public;
grant execute on function public.get_load_by_tracking_slug(text)
  to anon, authenticated, service_role;
