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

-- Two suggestions: one for Alex's client, one for Sam's (seed: client 1 → Alex, client 2 → Sam).
insert into public.suggestions (key, rule, severity, account_id, client_id, manager_id, level, entity_id, message, question, action)
values
  ('expensive_cpl:a1', 'expensive_cpl', 'high', '1001', 1, 'emp_alex', 'ad', 'a1', 'Ad hog has 1 lead at $120 each.', 'Turn it off?', '{"type":"pause_ad","adId":"a1"}'),
  ('low_ctr:a4',       'low_ctr',       'medium', '1002', 2, 'emp_sam', 'ad', 'a4', 'Ad low ctr has a low CTR.', 'Refresh the creative?', '{"type":"review_creative","adId":"a4"}');

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
  assert (select count(*) from public.clients) >= 3, 'staff sees clients';
  assert jsonb_array_length(public.report('account', '2026-11-01', '2026-11-07')) >= 2, 'staff report';
  -- Suggestions: Alex only sees and can act on his own (assigned to him in GHL).
  assert (select count(*) from public.suggestions) = 1, 'staff sees only own suggestions';
  assert (select manager_id from public.suggestions) = 'emp_alex', 'the one he sees is his';
  update public.suggestions set status = 'dismissed' where key = 'low_ctr:a4';
  assert (select count(*) from public.suggestions where status = 'dismissed') = 0, 'cannot touch someone else''s';
  update public.suggestions set status = 'snoozed' where key = 'expensive_cpl:a1';
  assert (select status from public.suggestions where key = 'expensive_cpl:a1') = 'snoozed', 'can act on own';
  assert (public.me()->>'id') = 'emp_alex' and (public.me() ? 'auth_user_id') = false, 'me() returns the employee';

  insert into public.ad_reviews (name, client_id, created_by) values ('Test ad', 1, 'emp_alex');
  assert (select count(*) from public.ad_reviews where legacy_id is null) = 1, 'staff created a review';

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
  assert (select count(*) from public.suggestions) = 2, 'owner sees everyone''s suggestions';
  assert (select status from public.suggestions where key = 'low_ctr:a4') = 'open', 'Alex''s attempt to dismiss Sam''s suggestion had no effect';
  update public.rule_settings set params = params || '{"expensiveCpl": 60}'::jsonb where scope = 'global';
  assert (select params->>'expensiveCpl' from public.rule_settings where scope = 'global') = '60',
    'owner can update thresholds';
end $$;
reset role;

-- Reassigning a client in GHL moves its open suggestions to the new manager.
update public.clients set ad_manager_id = 'emp_sam' where id = 1;
do $$ begin
  assert (select manager_id from public.suggestions where key = 'expensive_cpl:a1') = 'emp_sam', 'suggestion follows reassignment';
end $$;
select 'security tests ok' as result;

-- First sign-in links the login to the staff record with the same email.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000dd', 'SAM@example.com');
do $$ begin
  assert (select auth_user_id from public.employees where id = 'emp_sam') = '00000000-0000-0000-0000-0000000000dd',
    'login linked to employee by email (case-insensitive)';
end $$;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000ee', 'nobody@example.com');
do $$ begin
  assert (select count(*) from public.employees where auth_user_id = '00000000-0000-0000-0000-0000000000ee') = 0,
    'unknown email links to nobody';
end $$;
select 'auth link tests ok' as result;
