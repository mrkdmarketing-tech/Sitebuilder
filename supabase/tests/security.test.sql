-- Row-level security: who can see and change what.
-- Every public table must have RLS on.
do $$
declare missing text;
begin
  select string_agg(tablename, ', ') into missing
  from pg_tables where schemaname = 'public' and not rowsecurity;
  assert missing is null, format('tables without RLS: %s', missing);
end $$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'alex@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'stranger@example.com'),
  ('00000000-0000-0000-0000-00000000000c', 'owner@example.com');
update public.employees set auth_user_id = '00000000-0000-0000-0000-00000000000a' where id = 'emp_alex';
update public.employees set auth_user_id = '00000000-0000-0000-0000-00000000000c' where id = 'emp_owner';

-- Not signed in: sees nothing.
set role anon;
do $$ begin
  assert (select count(*) from public.clients) = 0, 'anon must not see clients';
  assert jsonb_array_length(public.report('account', '2026-11-01', '2026-11-07')) = 0, 'anon report empty';
end $$;
reset role;

-- Signed in but not an employee: sees nothing.
set role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false); end $$;
do $$ begin
  assert (select count(*) from public.clients) = 0, 'stranger must not see clients';
end $$;

-- Staff: reads everything, can create an ad review, cannot write synced data or settings.
do $$ begin perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false); end $$;
do $$ begin
  assert (select count(*) from public.clients) = 3, 'staff sees clients';
  assert jsonb_array_length(public.report('account', '2026-11-01', '2026-11-07')) = 2, 'staff report';
  insert into public.ad_reviews (name, client_id, created_by) values ('Test ad', 1, 'emp_alex');
  assert (select count(*) from public.ad_reviews) = 1, 'staff created a review';

  begin
    insert into public.meta_ads (id, adset_id, campaign_id, account_id) values ('x', 's1', 'c1', '1001');
    assert false, 'staff must not write Meta data';
  exception when insufficient_privilege then null;
  end;

  update public.rule_settings set params = '{}'::jsonb where scope = 'global';
  assert (select params->>'expensiveCpl' from public.rule_settings where scope = 'global') = '50',
    'staff update of thresholds must be silently ignored by RLS';

  begin
    insert into public.actions_log (actor_id, action) values ('emp_sam', 'pretend');
    assert false, 'staff must not log actions as someone else';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Owner: can change thresholds.
do $$ begin perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false); end $$;
do $$ begin
  update public.rule_settings set params = params || '{"expensiveCpl": 60}'::jsonb where scope = 'global';
  assert (select params->>'expensiveCpl' from public.rule_settings where scope = 'global') = '60',
    'owner can update thresholds';
end $$;
reset role;
select 'security tests ok' as result;
