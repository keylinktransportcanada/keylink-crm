-- next_employee_id() now self-heals when the counter falls behind the
-- highest existing profiles.employee_id (can happen after manual edits,
-- imports, or partial rollbacks). Without this guard the function returned
-- a value that violated profiles_employee_id_key on the very next insert.

create or replace function public.next_employee_id()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_next integer;
  v_max_existing integer;
begin
  select coalesce(
           max((regexp_replace(employee_id, '^KL-', ''))::int),
           0
         )
    into v_max_existing
    from public.profiles
   where employee_id ~ '^KL-\d+$';

  update public.employee_id_counter
     set next_value = greatest(next_value, v_max_existing + 1) + 1
   where id = 1
   returning next_value - 1 into v_next;

  return 'KL-' || lpad(v_next::text, 4, '0');
end;
$$;
