-- The Retool bridge copies the right rows from a fake Retool (retool-fake.sql).
-- run-local.sh passes the fake's connection string as :bridge_conn.
select private.retool_bridge_run(:'bridge_conn') as first_run;
do $$
begin
  assert (select count(*) from public.employees where id like 'ghl_user_%') = 2, 'employees copied';
  assert (select email from public.employees where id = 'ghl_user_a') is null, 'email already used by another employee is left blank, not a failure';
  assert (select ad_manager_id from public.clients where id = 501) = 'ghl_user_a', 'ads manager from GHL assignedTo';
  assert (select ad_manager_id from public.clients where id = 502) is null, 'unknown GHL user → null';
  assert (select active_status from public.clients where id = 502) is null, 'unknown status → null';
  assert (select city from public.clients where id = 501) = 'Springfield', 'city from GHL contact';
  assert (select client_id from public.meta_ad_accounts where account_id = '7001') = 501, 'ad account linked to client';
  assert (select client_id from public.meta_ad_accounts where account_id = '7002') is null, 'unknown client → null link';
  assert (select count(*) from public.sheet_leads where id in ('L1','L2')) = 2, 'leads copied';
  assert (select client_id from public.sheet_leads where id = 'L2') is null, 'lead of unknown client kept, unlinked';
  assert (select gyms_speciality from public.client_onboarding where client_id = 501) = 'newest answer', 'latest onboarding row wins';
  assert (select monthly_adspend_budget from public.campaign_specifics where id = 1) = 900, 'campaign specifics';
  assert (select status from public.website_campaign_requests where id = 1) = 'new', 'enum status as text';
  assert (select client_id from public.website_campaign_requests where id = 1) = 501, 'request linked by GHL contact';
  assert (select count(*) from public.retool_bridge_state where last_error is null) = 7, 'all 7 tables recorded ok';
end $$;
-- Second run is idempotent and removes leads deleted in Retool.
select extensions.dblink_exec(:'bridge_conn', 'delete from leads where id = ''L2''');
select private.retool_bridge_run(:'bridge_conn') is not null as second_run;
do $$ begin
  assert (select count(*) from public.sheet_leads where id = 'L2') = 0, 'deleted lead removed';
  assert (select count(*) from public.clients where id in (501,502)) = 2, 'no duplicates';
end $$;
-- Part 2: custom fields, templates, ad history (migration 2200).
select private.retool_bridge_ad_history(:'bridge_conn') as ad_history;
do $$ begin
  assert (select name from public.ghl_custom_fields where id = 'cf_phone') = 'Business Phone', 'custom field names';
  assert (select count(*) from public.ad_creative_templates where legacy_id = 'tpl1') = 1, 'creative template';
  assert (select body->'questions'->>1 from public.leadform_templates where legacy_id = 'lf1') = 'Phone', 'lead form template';
  assert (select status from public.ad_reviews where legacy_id = 'ap1') = 'completed', 'status mapped';
  assert (select creative->>'description' from public.ad_reviews where legacy_id = 'ap1') = 'Free class', 'description mapped';
  assert (select leadform->>'thankYouHeadline' from public.ad_reviews where legacy_id = 'ap1') = 'Thanks!', 'thank-you mapped';
  assert (select (legacy->>'imageCount')::int from public.ad_reviews where legacy_id = 'ap1') = 3, 'image count kept';
  assert (select legacy::text from public.ad_reviews where legacy_id = 'ap1') not like '%AAAA%', 'base64 images not copied';
  assert (select legacy->'canvaLinks'->>0 from public.ad_reviews where legacy_id = 'ap1') = 'https://canva.example/x', 'canva link kept';
  assert (select client_id from public.ad_reviews where legacy_id = 'ap2') is null, 'unknown client unlinked';
  assert (select status from public.ad_reviews where legacy_id = 'ap2') = 'draft', 'create -> draft';
end $$;
select extensions.dblink_exec(:'bridge_conn', 'delete from ads_preview where id = ''ap2''');
select private.retool_bridge_ad_history(:'bridge_conn') is not null as second_history_run;
do $$ begin
  assert (select count(*) from public.ad_reviews where legacy_id = 'ap2') = 0, 'deleted in Retool -> removed';
  assert (select count(*) from public.ad_reviews where legacy_id = 'ap1') = 1, 'no duplicates';
end $$;

-- Nobody but the service role can run the bridge.
set role authenticated;
do $$ begin
  begin
    perform private.retool_bridge_run('x');
    assert false, 'authenticated must not run the bridge';
  exception when insufficient_privilege then null;
  end;
  begin
    perform private.retool_bridge_ad_history('x');
    assert false, 'authenticated must not run the ad history copy';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select 'retool bridge tests ok' as result;
