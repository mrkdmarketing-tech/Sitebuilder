-- =============================================================================
-- 2600 Two-step sign-in for owners and admins (docs/sop/security.md).
--
-- Owners and admins confirm each sign-in with a 6-digit code from an
-- authenticator app (Supabase MFA, TOTP). The database checks it: the
-- session's assurance level must be aal2 for any owner/admin power, so the
-- rule can't be skipped by calling the database directly.
--   mfa_ok()    true when this session was confirmed with an authenticator code
--   is_admin()  now also needs mfa_ok(). Every admin-only policy and function
--               (thresholds, roles, staff, clients, overrides, deletes) uses it.
-- Without the code an owner/admin can still use The Lab like staff (their own
-- suggestions, insights, ad approval); the app asks for the code at sign-in.
-- =============================================================================

create or replace function public.mfa_ok()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
$$;
revoke all on function public.mfa_ok() from public, anon;
grant execute on function public.mfa_ok() to authenticated;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.employees
    where auth_user_id = auth.uid() and active and role in ('admin', 'owner')
  ) and public.mfa_ok()
$$;

-- Role and team changes check the role directly; add the same rule there with a clear message.
create or replace function public.set_employee_role(p_employee text, p_role text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  me_id   text := public.current_employee_id();
  me_role text;
  target  public.employees;
  owners  integer;
begin
  select role into me_role from public.employees where id = me_id and active;
  if me_role in ('admin', 'owner') and not public.mfa_ok() then
    raise exception 'Enter your authenticator code first (owners and admins need two-step sign-in for this).' using errcode = '42501';
  end if;
  if me_role is null or me_role not in ('admin', 'owner') then
    raise exception 'Only owners and admins can change roles.' using errcode = '42501';
  end if;
  if p_role not in ('staff', 'admin', 'owner') then
    raise exception 'Role must be staff, admin or owner.' using errcode = '22023';
  end if;
  select * into target from public.employees where id = p_employee;
  if not found then
    raise exception 'Staff member not found.' using errcode = 'P0002';
  end if;
  if target.role = p_role then
    return jsonb_build_object('role', p_role, 'changed', false);
  end if;
  if (p_role = 'owner' or target.role = 'owner') and me_role <> 'owner' then
    raise exception 'Only an owner can make someone an owner or change an owner''s role.' using errcode = '42501';
  end if;
  if target.role = 'owner' then
    select count(*) into owners from public.employees where role = 'owner' and active;
    if owners <= 1 then
      raise exception 'This is the last owner. Make someone else an owner first.' using errcode = '22023';
    end if;
  end if;

  perform set_config('app.staff_change', 'on', true);
  update public.employees set role = p_role where id = p_employee;
  perform set_config('app.staff_change', '', true);

  insert into public.actions_log (actor_id, action, target_type, target_id, before, after)
  values (me_id, 'staff.role', 'employee', p_employee,
          jsonb_build_object('role', target.role), jsonb_build_object('role', p_role));

  return jsonb_build_object('role', p_role, 'changed', true);
end $$;

create or replace function public.set_employee_active(p_employee text, p_active boolean, p_note text default null)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  me_id   text := public.current_employee_id();
  me_role text;
  t       public.employees;
begin
  select role into me_role from public.employees where id = me_id and active;
  if me_role in ('admin', 'owner') and not public.mfa_ok() then
    raise exception 'Enter your authenticator code first (owners and admins need two-step sign-in for this).' using errcode = '42501';
  end if;
  if me_role is null or me_role not in ('admin', 'owner') then
    raise exception 'Only owners and admins can change who is on the team.' using errcode = '42501';
  end if;
  select * into t from public.employees where id = p_employee;
  if not found then raise exception 'Staff member not found.' using errcode = 'P0002'; end if;
  if p_employee = me_id and not p_active then
    raise exception 'You can''t remove yourself.' using errcode = '22023';
  end if;
  if t.role = 'owner' and me_role <> 'owner' then
    raise exception 'Only an owner can remove an owner.' using errcode = '42501';
  end if;
  if t.role = 'owner' and not p_active
     and (select count(*) from public.employees where role = 'owner' and active and id <> p_employee) = 0 then
    raise exception 'This is the last owner.' using errcode = '22023';
  end if;
  insert into public.employee_overrides (employee_id, active, note, set_by)
  values (p_employee, p_active, p_note, me_id)
  on conflict (employee_id) do update set active = excluded.active, note = excluded.note, set_by = excluded.set_by, set_at = now();
  return jsonb_build_object('active', p_active);
end $$;

-- Who has two-step sign-in on (for Settings -> Staff). Reads auth.mfa_factors,
-- so it runs with elevated rights; only active staff can call it, and it returns
-- yes/no only, never the factor itself.
create or replace function public.two_step_on(p_auth_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_staff() and exists (
    select 1 from auth.mfa_factors f where f.user_id = p_auth_user and f.status = 'verified')
$$;
revoke all on function public.two_step_on(uuid) from public, anon;
grant execute on function public.two_step_on(uuid) to authenticated;

create or replace function public.staff_overview()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(row_to_json(x)::jsonb order by x.active desc, x."firstName", x."lastName"), '[]'::jsonb)
  from (
    select e.id, e.first_name as "firstName", e.last_name as "lastName", e.email,
           e.is_ad_manager as "isAdManager", e.active, e.role,
           e.auth_user_id is not null as "signedIn",
           coalesce(public.two_step_on(e.auth_user_id), false) as "twoStep",
           (select count(*) from public.clients c
             where c.ad_manager_id = e.id and c.active_status in ('Active', 'New'))::int as "clients",
           (select max(a.created_at) from public.actions_log a
             where a.action = 'staff.role' and a.target_id = e.id) as "roleChangedAt"
    from public.employees e
  ) x
$$;

-- Lost phone: an owner (with their own code) resets someone else's two-step
-- sign-in. Owners can reset anyone but themselves; admins can reset staff and
-- admins. The person sets it up again at their next sign-in. Logged.
create or replace function public.reset_two_step(p_employee text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me_id   text := public.current_employee_id();
  me_role text;
  t       public.employees;
  n       integer;
begin
  select role into me_role from public.employees where id = me_id and active;
  if me_role is null or me_role not in ('admin', 'owner') or not public.mfa_ok() then
    raise exception 'Only owners and admins (signed in with their code) can reset two-step sign-in.' using errcode = '42501';
  end if;
  select * into t from public.employees where id = p_employee;
  if not found or t.auth_user_id is null then
    raise exception 'That person has never signed in.' using errcode = 'P0002';
  end if;
  if p_employee = me_id then
    raise exception 'You can''t reset your own; ask another owner.' using errcode = '22023';
  end if;
  if t.role = 'owner' and me_role <> 'owner' then
    raise exception 'Only an owner can reset an owner.' using errcode = '42501';
  end if;
  delete from auth.mfa_factors where user_id = t.auth_user_id;
  get diagnostics n = row_count;
  insert into public.actions_log (actor_id, action, target_type, target_id, after)
  values (me_id, 'staff.reset_two_step', 'employee', p_employee, jsonb_build_object('removed', n));
  return jsonb_build_object('removed', n);
end $$;
revoke all on function public.reset_two_step(text) from public, anon;
grant execute on function public.reset_two_step(text) to authenticated;
