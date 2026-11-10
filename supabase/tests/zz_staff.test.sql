-- Staff roles (migration 2300). Logins from security.test.sql:
-- ...0a = emp_alex (staff), ...0c = emp_owner (owner).
reset role;
-- A second staff member to promote, signed in as ...0e.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000e', 'jo2@example.com') on conflict do nothing;
insert into public.employees (id, first_name, last_name, email, role, active, auth_user_id)
values ('emp_jo2', 'Jo', 'Two', 'jo2@example.com', 'staff', true, '00000000-0000-0000-0000-00000000000e')
on conflict (id) do update set auth_user_id = excluded.auth_user_id, role = 'staff';

set role authenticated;

-- Staff: can see the list, can't change roles or edit staff rows.
do $$ begin perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false); perform set_config('request.jwt.claims', '{}', false); end $$;
do $$ begin
  assert jsonb_array_length(public.staff_overview()) >= 3, 'staff see the staff list';
  begin
    perform public.set_employee_role('emp_alex', 'owner');
    assert false, 'staff must not change roles';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Owner: can promote, every change logged; direct edits blocked; last owner protected.
do $$ begin perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false); perform set_config('request.jwt.claims', '{"aal":"aal2"}', false); end $$;
do $$ begin
  perform public.set_employee_role('emp_jo2', 'admin');
  assert (select role from public.employees where id = 'emp_jo2') = 'admin', 'owner made an admin';
  assert (select count(*) from public.actions_log where action = 'staff.role' and target_id = 'emp_jo2') = 1, 'logged';
  begin
    update public.employees set role = 'owner' where id = 'emp_jo2';
    assert false, 'direct role edit must be blocked';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.employees set email = 'x@example.com' where id = 'emp_alex';
    assert false, 'direct edits of staff rows must be blocked';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.set_employee_role('emp_owner', 'staff');
    assert false, 'the last owner must not be demoted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.set_employee_role('emp_jo2', 'boss');
    assert false, 'unknown role refused';
  exception when invalid_parameter_value then null;
  end;
end $$;

-- Admin (not owner): can make staff/admin, can't touch owners.
do $$ begin perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000e', false); perform set_config('request.jwt.claims', '{"aal":"aal2"}', false); end $$;
do $$ begin
  perform public.set_employee_role('emp_alex', 'admin');
  assert (select role from public.employees where id = 'emp_alex') = 'admin', 'admin made an admin';
  perform public.set_employee_role('emp_alex', 'staff');
  begin
    perform public.set_employee_role('emp_jo2', 'owner');
    assert false, 'admin must not make an owner';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.set_employee_role('emp_owner', 'admin');
    assert false, 'admin must not demote an owner';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- Signed out: nothing.
set role anon;
do $$ begin
  begin
    perform public.staff_overview();
    assert false, 'anon must not list staff';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select 'staff tests ok' as result;

-- Two-step sign-in (migration 2600): an owner without the authenticator code
-- has no owner/admin powers.
set role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false); perform set_config('request.jwt.claims', '{"aal":"aal1"}', false); end $$;
do $$ begin
  assert public.is_admin() = false, 'owner without code is not admin';
  assert public.mfa_ok() = false, 'mfa_ok false at aal1';
  begin
    perform public.save_rule_settings('{"expensiveCpl": 51}');
    assert false, 'thresholds need the code';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.set_employee_role('emp_alex', 'admin');
    assert false, 'roles need the code';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.set_client_control(1, 'Paused');
    assert false, 'clients need the code';
  exception when insufficient_privilege then null;
  end;
  assert (select count(*) from public.suggestions where manager_id is distinct from 'emp_owner') = 0, 'without the code: only own suggestions, like staff';
end $$;
do $$ begin perform set_config('request.jwt.claims', '{"aal":"aal2"}', false); end $$;
do $$ begin assert public.is_admin(), 'with the code: admin again'; end $$;
reset role;
select 'two-step sign-in tests ok' as result;

-- Lost phone: an owner resets someone's two-step sign-in (migration 2600).
insert into auth.mfa_factors (user_id, status) values ('00000000-0000-0000-0000-00000000000a', 'verified');
set role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false); perform set_config('request.jwt.claims', '{"aal":"aal2"}', false); end $$;
do $$ begin
  assert (select x->>'twoStep' from jsonb_array_elements(public.staff_overview()) x where x->>'id' = 'emp_alex') = 'true', 'shows two-step on';
  assert (public.reset_two_step('emp_alex')->>'removed')::int = 1, 'owner reset it';
  assert (select x->>'twoStep' from jsonb_array_elements(public.staff_overview()) x where x->>'id' = 'emp_alex') = 'false', 'now off';
  begin
    perform public.reset_two_step('emp_owner');
    assert false, 'cannot reset your own';
  exception when invalid_parameter_value then null;
  end;
end $$;
do $$ begin perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false); perform set_config('request.jwt.claims', '{}', false); end $$;
do $$ begin
  begin
    perform public.reset_two_step('emp_owner');
    assert false, 'staff cannot reset';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select 'two-step reset tests ok' as result;
