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
-- Nobody but the service role can run the bridge.
set role authenticated;
do $$ begin
  begin
    perform private.retool_bridge_run('x');
    assert false, 'authenticated must not run the bridge';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select 'retool bridge tests ok' as result;
