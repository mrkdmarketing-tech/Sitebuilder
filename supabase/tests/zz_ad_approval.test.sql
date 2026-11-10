-- Ad approval rules (migration 2100). Runs last ("zz_"): uses the logins from
-- security.test.sql (alex = staff, owner = owner) and the Retool history from
-- retool_bridge.test.sql (legacy ad 'ap1').
set role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false); perform set_config('request.jwt.claims', '{}', false); end $$;
do $$
declare rid uuid;
begin
  insert into public.ad_reviews (name, client_id, created_by) values ('Kids fall offer', 1, 'emp_alex') returning id into rid;
  perform set_config('test.rid', rid::text, false);

  -- Can't skip review, can't change status directly.
  begin
    perform public.set_review_status(rid, 'approved');
    assert false, 'draft cannot jump to approved';
  exception when invalid_parameter_value then null;
  end;
  begin
    update public.ad_reviews set status = 'approved' where id = rid;
    assert false, 'status must not change without set_review_status';
  exception when insufficient_privilege then null;
  end;

  -- Submitting with an open finding records it.
  insert into public.ad_review_findings (review_id, category, message, field) values (rid, 'spelling', 'Typo', 'creative.headline');
  perform public.set_review_status(rid, 'review_pending', null, null, array[(select id from public.ad_review_findings where review_id = rid)]);
  assert (select status from public.ad_reviews where id = rid) = 'review_pending', 'submitted';
  assert (select submitted_with_open_findings from public.ad_reviews where id = rid) = 1, 'open findings counted';
  assert (select reviewer_id from public.ad_reviews where id = rid) is not null, 'reviewer defaults to the ads manager';
  assert (select array_length(acknowledged_findings, 1) from public.ad_review_events where review_id = rid) = 1, 'acknowledged warnings recorded';

  perform public.set_review_status(rid, 'request_changes', 'Headline says Tuesday, image says Thursday');
  assert (select count(*) from public.ad_review_comments where review_id = rid) = 1, 'note saved as a comment';
  perform public.set_review_status(rid, 'review_pending');
  perform public.set_review_status(rid, 'approved');
  perform public.set_review_status(rid, 'completed');
  assert (select completed_at from public.ad_reviews where id = rid) is not null, 'completed time';
  assert (select count(*) from public.ad_review_events where review_id = rid) = 5, 'every move in the history';

  -- Comments only as yourself.
  begin
    insert into public.ad_review_comments (review_id, author_id, body) values (rid, 'emp_sam', 'pretend');
    assert false, 'comment as someone else';
  exception when insufficient_privilege then null;
  end;

  -- Retool history is read-only.
  update public.ad_reviews set name = 'changed' where legacy_id = 'ap1';
  assert (select name from public.ad_reviews where legacy_id = 'ap1') = 'Fall offer', 'legacy ad unchanged';
  begin
    insert into public.ad_review_comments (review_id, author_id, body)
    values ((select id from public.ad_reviews where legacy_id = 'ap1'), 'emp_alex', 'hi');
    assert false, 'no comments on legacy ads';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.set_review_status((select id from public.ad_reviews where legacy_id = 'ap1'), 'review_pending');
    assert false, 'legacy status cannot move';
  exception when insufficient_privilege then null;
  end;

  -- List and client info.
  assert jsonb_array_length(public.ad_review_list()) >= 2, 'list includes new and legacy ads';
  assert (select x->>'openFindings' from jsonb_array_elements(public.ad_review_list()) x where x->>'id' = rid::text) = '1', 'open findings in list';
  assert public.client_brief(1)->>'businessName' is not null, 'client brief';
  assert public.client_brief(1)->'placeholders' ? 'business_name', 'placeholders';
end $$;
reset role;

-- Strangers see nothing.
set role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false); perform set_config('request.jwt.claims', '{}', false); end $$;
do $$ begin
  assert jsonb_array_length(public.ad_review_list()) = 0, 'stranger sees no ads';
  assert public.client_brief(1) is null, 'stranger sees no client info';
end $$;
reset role;
select 'ad approval tests ok' as result;
