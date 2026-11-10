-- =============================================================================
-- 2300 Staff screen (Settings -> Staff, docs/sop/staff-and-access.md).
--
-- set_employee_role(employee, role) is the only way to change a role from the
-- app. Rules:
--   * owners and admins can change roles; staff can't
--   * only an owner can make someone an owner, or change an owner's role
--   * the last owner can't be demoted (someone must always be able to manage roles)
--   * every change is written to actions_log (staff.role) with before/after
-- A trigger stops the app editing staff rows directly: names, emails, ads
-- manager and active come from Retool (bridge), and roles only change here.
-- staff_overview() lists staff with sign-in status and how many Active/New
-- clients each looks after in GHL.
-- =============================================================================

create or replace function public.employees_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' and coalesce(current_setting('app.staff_change', true), '') <> 'on' then
    raise exception 'Change roles with set_employee_role(). Names, emails and ads manager come from Retool.'
      using errcode = '42501';
  end if;
  return new;
end $$;
create trigger employees_guard before update on public.employees
  for each row execute function public.employees_guard();

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
revoke all on function public.set_employee_role(text, text) from public, anon;
grant execute on function public.set_employee_role(text, text) to authenticated;

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
           (select count(*) from public.clients c
             where c.ad_manager_id = e.id and c.active_status in ('Active', 'New'))::int as "clients",
           (select max(a.created_at) from public.actions_log a
             where a.action = 'staff.role' and a.target_id = e.id) as "roleChangedAt"
    from public.employees e
  ) x
$$;
revoke all on function public.staff_overview() from public, anon;
grant execute on function public.staff_overview() to authenticated;
