-- Overrides set in The Lab (migration 2400). Logins from security.test.sql:
-- ...0a = emp_alex (staff), ...0c = emp_owner (owner). Seed: client 2 -> emp_sam.
set role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false); end $$;
do $$ begin
  begin
    insert into public.client_overrides (client_id, ad_manager_id) values (2, 'emp_alex');
    assert false, 'staff must not add overrides';
  exception when insufficient_privilege then null;
  end;
end $$;

do $$ begin perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false); end $$;
do $$ begin
  insert into public.client_overrides (client_id, ad_manager_id, active_status, note, set_by)
  values (2, 'emp_alex', 'Active', 'test', 'emp_owner');
  assert (select ad_manager_id from public.clients where id = 2) = 'emp_alex', 'override applied at once';
  insert into public.ad_account_overrides (account_id, client_id, set_by) values ('1002', 1, 'emp_owner');
  assert (select client_id from public.meta_ad_accounts where account_id = '1002') = 1, 'account link applied';
  assert (select count(*) from public.actions_log where action like 'override.%') = 2, 'overrides logged';
end $$;
reset role;

-- A Retool/GHL copy (service role) can't undo it.
update public.clients set ad_manager_id = 'emp_sam', active_status = 'Paused' where id = 2;
update public.meta_ad_accounts set client_id = 2 where account_id = '1002';
do $$ begin
  assert (select ad_manager_id from public.clients where id = 2) = 'emp_alex', 'override survives the copy';
  assert (select active_status from public.clients where id = 2) = 'Active', 'status override survives';
  assert (select client_id from public.meta_ad_accounts where account_id = '1002') = 1, 'link survives';
end $$;

-- Removed: the next copy decides again.
delete from public.client_overrides where client_id = 2;
update public.clients set ad_manager_id = 'emp_sam' where id = 2;
do $$ begin
  assert (select ad_manager_id from public.clients where id = 2) = 'emp_sam', 'GHL value back after removal';
end $$;
delete from public.ad_account_overrides;
update public.meta_ad_accounts set client_id = 2 where account_id = '1002';
select 'override tests ok' as result;

-- Clients screen and staff on/off (migration 2500).
set role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false); end $$;
do $$ begin
  begin
    perform public.set_client_control(2, 'Inactive');
    assert false, 'staff must not change clients';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.set_employee_active('emp_sam', false);
    assert false, 'staff must not remove staff';
  exception when insufficient_privilege then null;
  end;
end $$;
do $$ begin perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false); end $$;
do $$ begin
  perform public.set_client_control(2, 'Paused', 'emp_alex', array['1002'], null, 'test');
  assert (select active_status from public.clients where id = 2) = 'Paused', 'status set';
  assert (select ad_manager_id from public.clients where id = 2) = 'emp_alex', 'manager set';
  assert (select client_id from public.meta_ad_accounts where account_id = '1002') = 2, 'link set';
  assert (select x->>'overridden' from jsonb_array_elements(public.client_list()) x where (x->>'id')::int = 2) = 'true', 'list shows override';
  perform public.set_client_control(2, null, null, null, array['1002']);
  assert (select client_id from public.meta_ad_accounts where account_id = '1002') is null, 'unlinked';
  perform public.set_client_control(2, p_clear => true);
  assert (select count(*) from public.client_overrides where client_id = 2) = 0, 'cleared';
  begin
    perform public.set_client_control(2, 'Gone');
    assert false, 'bad status refused';
  exception when invalid_parameter_value then null;
  end;

  perform public.set_employee_active('emp_sam', false, 'left');
  assert (select active from public.employees where id = 'emp_sam') = false, 'removed from team';
  begin
    perform public.set_employee_active('emp_owner', false);
    assert false, 'cannot remove yourself';
  exception when invalid_parameter_value then null;
  end;
end $$;
reset role;
-- The Retool copy can't bring them back.
update public.employees set active = true where id = 'emp_sam';
do $$ begin assert (select active from public.employees where id = 'emp_sam') = false, 'stays off after copy'; end $$;
delete from public.employee_overrides where employee_id = 'emp_sam';
update public.employees set active = true where id = 'emp_sam';
update public.meta_ad_accounts set client_id = 2 where account_id = '1002';
select 'client and staff control tests ok' as result;
