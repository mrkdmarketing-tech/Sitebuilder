-- save_rule_settings(): admins only, values checked, change logged (migration 2000).
-- Logins created in security.test.sql (alex = staff, owner = owner).
set role authenticated;

-- Staff cannot save.
do $$ begin perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false); end $$;
do $$ begin
  begin
    perform public.save_rule_settings('{"expensiveCpl": 70}');
    assert false, 'staff must not change thresholds';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Owner can; bad values are refused; every save is logged.
do $$ begin perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false); end $$;
do $$
declare before_count int := (select count(*) from public.actions_log where action = 'rules.update');
begin
  perform public.save_rule_settings('{"expensiveCpl": 55, "lowCtr": 0.7}');
  assert (select params->>'expensiveCpl' from public.rule_settings where scope = 'global') = '55', 'saved CPL';
  assert (select params->>'lowCtr' from public.rule_settings where scope = 'global') = '0.7', 'saved CTR';
  assert (select params->>'noLeadSpend' from public.rule_settings where scope = 'global') = '50', 'other values kept';
  assert (select updated_by from public.rule_settings where scope = 'global') = 'emp_owner', 'who changed it';
  assert (select count(*) from public.actions_log where action = 'rules.update') = before_count + 1, 'logged';

  begin
    perform public.save_rule_settings('{"expensiveCpl": -5}');
    assert false, 'negative value must be refused';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.save_rule_settings('{"somethingElse": 5}');
    assert false, 'unknown key must be refused';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.save_rule_settings('{"budgetHogShare": "60%"}');
    assert false, 'text must be refused';
  exception when invalid_parameter_value then null;
  end;
end $$;
reset role;

-- Signed-out visitors can't call it at all.
set role anon;
do $$ begin
  begin
    perform public.save_rule_settings('{"expensiveCpl": 70}');
    assert false, 'anon must not call save_rule_settings';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select 'settings tests ok' as result;
