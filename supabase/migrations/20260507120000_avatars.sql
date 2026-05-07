-- Avatars: add a nullable avatar_url to profiles. Defaults are computed at
-- query time from the user id (DiceBear notionists), so this column only
-- holds a value when the user has explicitly picked one.

alter table public.profiles
  add column if not exists avatar_url text;

-- Replace the self-update guard so users can also update their own avatar_url
-- (in addition to phone). The list of fields that admin-only updates are
-- still enforced for: role, full_name, employee_id, hire_date, active.
create or replace function public.profiles_self_update_guard()
returns trigger
language plpgsql
as $$
begin
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
      raise exception 'profiles: only phone and avatar_url may be self-updated';
    end if;
  end if;

  return new;
end;
$$;
