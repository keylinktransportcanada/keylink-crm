-- Phase 8 fixup: team chat needs two things the original RLS didn't grant.
--
-- 1. Every signed-in employee needs to see the team roster (name, role,
--    employee_id, avatar_url) so the chat picker can list teammates. The
--    init phase-1 policies only let admins / self read profiles — that's
--    fine for editing but breaks any cross-role discovery feature.
--
-- 2. Creating a direct thread is a two-step write (insert thread, then
--    insert two members). Doing this from a server action races with RLS
--    on the implicit RETURNING-SELECT after the thread insert. Wrap both
--    writes in a SECURITY DEFINER function so the trip is atomic and
--    RLS-safe.

-- ---------------------------------------------------------------------------
-- 1. Team directory read
-- ---------------------------------------------------------------------------
drop policy if exists "profiles: team directory read" on public.profiles;

create policy "profiles: team directory read"
  on public.profiles for select
  using (
    -- Anyone authenticated may read active profiles. This exposes columns
    -- like full_name / role / employee_id / avatar_url — same surface as
    -- the existing avatar API already returns. It does NOT widen write
    -- permissions; only admin can mutate.
    auth.uid() is not null
    and active = true
  );

-- ---------------------------------------------------------------------------
-- 2. Atomic direct-thread creation
-- ---------------------------------------------------------------------------
create or replace function public.create_direct_chat(
  p_other_profile_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_existing uuid;
  v_thread_id uuid;
begin
  if v_me is null then
    raise exception 'not authenticated';
  end if;
  if v_me = p_other_profile_id then
    raise exception 'cannot start a chat with yourself';
  end if;

  -- Look for an existing direct thread where both of us are members.
  select t.id
    into v_existing
    from public.chat_threads t
    join public.chat_thread_members me_m
      on me_m.thread_id = t.id and me_m.profile_id = v_me
    join public.chat_thread_members other_m
      on other_m.thread_id = t.id and other_m.profile_id = p_other_profile_id
   where t.type = 'direct'
   limit 1;

  if v_existing is not null then
    return v_existing;
  end if;

  -- Make sure the other party actually exists and is active.
  if not exists (
    select 1 from public.profiles
     where id = p_other_profile_id and active = true
  ) then
    raise exception 'teammate not found or inactive';
  end if;

  insert into public.chat_threads (type, created_by)
    values ('direct', v_me)
    returning id into v_thread_id;

  insert into public.chat_thread_members (thread_id, profile_id)
    values (v_thread_id, v_me), (v_thread_id, p_other_profile_id);

  return v_thread_id;
end;
$$;

grant execute on function public.create_direct_chat(uuid) to authenticated;
