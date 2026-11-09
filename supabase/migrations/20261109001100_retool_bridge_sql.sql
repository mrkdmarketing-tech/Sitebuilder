-- =============================================================================
-- 1100 Retool bridge, done inside the database (docs/retool-bridge.md).
--
-- The `retool-bridge` Edge Function reads the Retool connection string from its
-- secret (RETOOL_DB_URL) and calls private.retool_bridge_run(conn) over the
-- database's own connection. This function then pulls each table from Retool
-- with dblink — plain read-only SELECTs, nothing ever written to Retool, no
-- session settings changed on Retool's shared pool — and upserts it here.
-- The connection string is only ever a function argument; it is not stored.
--
-- Order matters (foreign keys): employees → clients → ad accounts → the rest.
-- Each table is copied independently: one failing table doesn't stop the others,
-- and every result is recorded in retool_bridge_state.
-- =============================================================================

create extension if not exists dblink with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.retool_bridge_run(p_conn text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  conn constant text := 'retool_bridge';
  result jsonb := '{}'::jsonb;
  n integer;
  step text;
begin
  perform extensions.dblink_connect(conn, p_conn);

  -- ---------------------------------------------------------------- employees
  begin
    step := 'employees';
    insert into public.employees as e (id, first_name, last_name, email, is_ad_manager, slack_id, active)
    -- Emails must be unique here (they're used for sign-in). If two people share
    -- one, or it belongs to someone else already, it's left blank for an admin to fix.
    select t.id, coalesce(t.first_name, ''), coalesce(t.last_name, ''),
           case when t.email_rank = 1
                 and not exists (select 1 from public.employees x where lower(x.email) = lower(t.email) and x.id <> t.id)
                then t.email end,
           coalesce(t.is_ad_manager, false), t.slack_id, coalesce(t.active, true)
    from (
      select r.*, row_number() over (partition by lower(nullif(r.email, '')) order by r.id) as email_rank
      from extensions.dblink(conn,
        'select id, first_name, last_name, nullif(trim(email), '''') as email, is_ad_manager, slack_id, active from employees')
        as r(id text, first_name text, last_name text, email text, is_ad_manager boolean, slack_id text, active boolean)
    ) t
    where t.id is not null
    on conflict (id) do update set
      first_name = excluded.first_name, last_name = excluded.last_name,
      -- keep an email an admin set here if Retool's is blank or clashes
      email = coalesce(excluded.email, e.email),
      is_ad_manager = excluded.is_ad_manager, slack_id = excluded.slack_id, active = excluded.active;
    get diagnostics n = row_count;
    result := result || jsonb_build_object(step, n);
  exception when others then
    result := result || jsonb_build_object(step, 'error: ' || sqlerrm);
  end;

  -- ------------------------------------------------------------------ clients
  -- Ads manager = the GHL contact's "assignedTo" (same source as Retool's
  -- Meta Ads Insights). Unknown GHL users → null.
  begin
    step := 'clients';
    insert into public.clients as c (id, business_name, contact_person_name, active_status, ad_manager_id,
                                     ghl_contact_id, ghl_location_id, website, city, state, country, profile, synced_at)
    select t.id, t.business_name, t.contact_person_name,
           case when t.active_status in ('New', 'Active', 'Paused', 'Inactive') then t.active_status end,
           (select e.id from public.employees e where e.id = t.assigned_to),
           t.contact_id, t.location_id,
           t.metadata->>'website', t.metadata->>'city', t.metadata->>'state', t.metadata->>'country',
           jsonb_build_object('ghl_contact', coalesce(t.metadata, '{}'::jsonb)),
           now()
    from extensions.dblink(conn,
      'select c.id, c.business_name, c.contact_person_name, c.active_status, c.contact_id, c.location_id,
              gc.metadata->>''assignedTo'', gc.metadata
       from clients c left join ghl_contacts gc on gc.id = c.contact_id')
      as t(id integer, business_name text, contact_person_name text, active_status text, contact_id text,
           location_id text, assigned_to text, metadata jsonb)
    on conflict (id) do update set
      business_name = excluded.business_name, contact_person_name = excluded.contact_person_name,
      active_status = excluded.active_status, ad_manager_id = excluded.ad_manager_id,
      ghl_contact_id = excluded.ghl_contact_id, ghl_location_id = excluded.ghl_location_id,
      website = excluded.website, city = excluded.city, state = excluded.state, country = excluded.country,
      profile = excluded.profile, synced_at = excluded.synced_at;
    get diagnostics n = row_count;
    result := result || jsonb_build_object(step, n);
  exception when others then
    result := result || jsonb_build_object(step, 'error: ' || sqlerrm);
  end;

  -- --------------------------------------------- ad accounts → client links
  -- Which ad account belongs to which client lives in Retool. New accounts are
  -- created here; existing ones only get their client link (and name/status
  -- until the Meta sync takes those over).
  begin
    step := 'meta_ad_accounts';
    insert into public.meta_ad_accounts as a (account_id, name, currency, account_status, disable_reason, client_id, amount_spent)
    select t.account_id, t.name, t.currency, t.account_status, t.disable_reason,
           (select c.id from public.clients c where c.id = t.client_id), t.amount_spent
    from extensions.dblink(conn,
      'select account_id, name, currency, account_status, disable_reason, client_id, amount_spent from meta_ad_accounts')
      as t(account_id text, name text, currency text, account_status text, disable_reason text,
           client_id integer, amount_spent double precision)
    where t.account_id is not null
    on conflict (account_id) do update set
      client_id = excluded.client_id,
      name = coalesce(a.name, excluded.name),
      currency = coalesce(a.currency, excluded.currency),
      account_status = case when a.raw = '{}'::jsonb then excluded.account_status else a.account_status end,
      disable_reason = case when a.raw = '{}'::jsonb then excluded.disable_reason else a.disable_reason end;
    get diagnostics n = row_count;
    result := result || jsonb_build_object(step, n);
  exception when others then
    result := result || jsonb_build_object(step, 'error: ' || sqlerrm);
  end;

  -- ---------------------------------------------------------- sheet_leads
  begin
    step := 'sheet_leads';
    create temp table _leads on commit drop as
    select * from extensions.dblink(conn,
      'select id, client_id, date_added, first_name, last_name, email, phone_number, reach_out_date_method,
              notes_appt_date, communication_status, appointment_status, closed_value, date_closed,
              monthly_membership_value, first_month_payment_date, date_left, campaign_name, adset_name,
              ad_name, platform, active
       from leads')
      as t(id text, client_id integer, date_added date, first_name text, last_name text, email text,
           phone_number text, reach_out_date_method text, notes_appt_date text, communication_status text,
           appointment_status text, closed_value double precision, date_closed date,
           monthly_membership_value double precision, first_month_payment_date date, date_left date,
           campaign_name text, adset_name text, ad_name text, platform text, active boolean);

    insert into public.sheet_leads as l (id, client_id, date_added, first_name, last_name, email, phone_number,
      reach_out_date_method, notes_appt_date, communication_status, appointment_status, closed_value, date_closed,
      monthly_membership_value, first_month_payment_date, date_left, campaign_name, adset_name, ad_name, platform,
      active, synced_at)
    select t.id, c.id, t.date_added, t.first_name, t.last_name, t.email, t.phone_number, t.reach_out_date_method,
      t.notes_appt_date, t.communication_status, t.appointment_status, t.closed_value, t.date_closed,
      t.monthly_membership_value, t.first_month_payment_date, t.date_left, t.campaign_name, t.adset_name,
      t.ad_name, t.platform, coalesce(t.active, true), now()
    from _leads t left join public.clients c on c.id = t.client_id
    where t.id is not null
    on conflict (id) do update set
      client_id = excluded.client_id, date_added = excluded.date_added, first_name = excluded.first_name,
      last_name = excluded.last_name, email = excluded.email, phone_number = excluded.phone_number,
      reach_out_date_method = excluded.reach_out_date_method, notes_appt_date = excluded.notes_appt_date,
      communication_status = excluded.communication_status, appointment_status = excluded.appointment_status,
      closed_value = excluded.closed_value, date_closed = excluded.date_closed,
      monthly_membership_value = excluded.monthly_membership_value,
      first_month_payment_date = excluded.first_month_payment_date, date_left = excluded.date_left,
      campaign_name = excluded.campaign_name, adset_name = excluded.adset_name, ad_name = excluded.ad_name,
      platform = excluded.platform, active = excluded.active, synced_at = excluded.synced_at;
    get diagnostics n = row_count;

    -- Rows removed in Retool are removed here too.
    delete from public.sheet_leads s where not exists (select 1 from _leads t where t.id = s.id);
    result := result || jsonb_build_object(step, n);
    drop table if exists _leads;
  exception when others then
    result := result || jsonb_build_object(step, 'error: ' || sqlerrm);
  end;

  -- --------------------------------------------------- campaign_specifics
  begin
    step := 'campaign_specifics';
    insert into public.campaign_specifics as s (id, client_id, name, ad_type, monthly_adspend_budget,
      monthly_adspend_budget_upper_limit, cta_for_ad, objective_and_goal, landing_page_link, booking_calendar_link,
      push_lead_into_details, lead_goals, follow_up_process_details, ads_lead_flow_details,
      integration_and_automation_details, is_crm_integrated, crm_details, lead_handling_responsibility_details,
      marked_locations_images, area_callouts, access_to_push_leads, synced_at)
    select t.id, c.id, t.name, t.ad_type, t.monthly_adspend_budget, t.monthly_adspend_budget_upper_limit,
      t.cta_for_ad, t.objective_and_goal, t.landing_page_link, t.booking_calendar_link, t.push_lead_into_details,
      t.lead_goals, t.follow_up_process_details, t.ads_lead_flow_details, t.integration_and_automation_details,
      t.is_crm_integrated, t.crm_details, t.lead_handling_responsibility_details, t.marked_locations_images,
      t.area_callouts, t.access_to_push_leads, now()
    from extensions.dblink(conn,
      'select id, client_id, name, ad_type, monthly_adspend_budget, monthly_adspend_budget_upper_limit, cta_for_ad,
              objective_and_goal, landing_page_link, booking_calendar_link, push_lead_into_details, lead_goals,
              follow_up_process_details, ads_lead_flow_details, integration_and_automation_details,
              is_crm_integrated, crm_details, lead_handling_responsibility_details, marked_locations_images,
              area_callouts, access_to_push_leads
       from campaign_specifics')
      as t(id integer, client_id integer, name text, ad_type text, monthly_adspend_budget double precision,
           monthly_adspend_budget_upper_limit double precision, cta_for_ad text, objective_and_goal text,
           landing_page_link text, booking_calendar_link text, push_lead_into_details text, lead_goals text,
           follow_up_process_details text, ads_lead_flow_details text, integration_and_automation_details text,
           is_crm_integrated boolean, crm_details text, lead_handling_responsibility_details text,
           marked_locations_images jsonb, area_callouts jsonb, access_to_push_leads boolean)
    left join public.clients c on c.id = t.client_id
    on conflict (id) do update set
      client_id = excluded.client_id, name = excluded.name, ad_type = excluded.ad_type,
      monthly_adspend_budget = excluded.monthly_adspend_budget,
      monthly_adspend_budget_upper_limit = excluded.monthly_adspend_budget_upper_limit,
      cta_for_ad = excluded.cta_for_ad, objective_and_goal = excluded.objective_and_goal,
      landing_page_link = excluded.landing_page_link, booking_calendar_link = excluded.booking_calendar_link,
      push_lead_into_details = excluded.push_lead_into_details, lead_goals = excluded.lead_goals,
      follow_up_process_details = excluded.follow_up_process_details,
      ads_lead_flow_details = excluded.ads_lead_flow_details,
      integration_and_automation_details = excluded.integration_and_automation_details,
      is_crm_integrated = excluded.is_crm_integrated, crm_details = excluded.crm_details,
      lead_handling_responsibility_details = excluded.lead_handling_responsibility_details,
      marked_locations_images = excluded.marked_locations_images, area_callouts = excluded.area_callouts,
      access_to_push_leads = excluded.access_to_push_leads, synced_at = excluded.synced_at;
    get diagnostics n = row_count;
    result := result || jsonb_build_object(step, n);
  exception when others then
    result := result || jsonb_build_object(step, 'error: ' || sqlerrm);
  end;

  -- ----------------------------------------------------- client_onboarding
  begin
    step := 'client_onboarding';
    insert into public.client_onboarding as o (client_id, retool_id, gyms_speciality, gyms_core_value, instructor_name,
      instructor_years_of_experience, instructor_certifications_and_specializations, instructor_teaching_style,
      instructor_belts, kid_program_age_range, kid_program_class_time, free_trial_for_kid_program,
      free_trial_for_kid_program_specifications, name_of_programs, special_introductory_offers,
      what_to_sign_up_for_program, program_details, no_of_training_session_per_week, pricing_details,
      marked_locations_images, area_callouts, synced_at)
    select distinct on (t.client_id) t.client_id, t.id, t.gyms_speciality, t.gyms_core_value, t.instructor_name,
      t.instructor_years_of_experience, t.instructor_certifications_and_specializations,
      t.instructor_teaching_style, t.instructor_belts, t.kid_program_age_range, t.kid_program_class_time,
      t.free_trial_for_kid_program, t.free_trial_for_kid_program_specifications, t.name_of_programs,
      t.special_introductory_offers, t.what_to_sign_up_for_program, t.program_details,
      t.no_of_training_session_per_week, t.pricing_details, t.marked_locations_images, t.area_callouts, now()
    from extensions.dblink(conn,
      'select id, client_id, gyms_speciality, gyms_core_value, instructor_name, instructor_years_of_experience,
              instructor_certifications_and_specializations, instructor_teaching_style, instructor_belts,
              kid_program_age_range, kid_program_class_time, free_trial_for_kid_program,
              free_trial_for_kid_program_specifications, name_of_programs, special_introductory_offers,
              what_to_sign_up_for_program, program_details, no_of_training_session_per_week, pricing_details,
              marked_locations_images, area_callouts
       from campaign_onboarding_info where client_id is not null')
      as t(id integer, client_id integer, gyms_speciality text, gyms_core_value text, instructor_name text,
           instructor_years_of_experience integer, instructor_certifications_and_specializations text,
           instructor_teaching_style text, instructor_belts text, kid_program_age_range text,
           kid_program_class_time text, free_trial_for_kid_program boolean,
           free_trial_for_kid_program_specifications text, name_of_programs jsonb,
           special_introductory_offers text, what_to_sign_up_for_program text, program_details text,
           no_of_training_session_per_week text, pricing_details text, marked_locations_images text,
           area_callouts jsonb)
    join public.clients c on c.id = t.client_id
    order by t.client_id, t.id desc
    on conflict (client_id) do update set
      retool_id = excluded.retool_id, gyms_speciality = excluded.gyms_speciality,
      gyms_core_value = excluded.gyms_core_value, instructor_name = excluded.instructor_name,
      instructor_years_of_experience = excluded.instructor_years_of_experience,
      instructor_certifications_and_specializations = excluded.instructor_certifications_and_specializations,
      instructor_teaching_style = excluded.instructor_teaching_style, instructor_belts = excluded.instructor_belts,
      kid_program_age_range = excluded.kid_program_age_range, kid_program_class_time = excluded.kid_program_class_time,
      free_trial_for_kid_program = excluded.free_trial_for_kid_program,
      free_trial_for_kid_program_specifications = excluded.free_trial_for_kid_program_specifications,
      name_of_programs = excluded.name_of_programs, special_introductory_offers = excluded.special_introductory_offers,
      what_to_sign_up_for_program = excluded.what_to_sign_up_for_program, program_details = excluded.program_details,
      no_of_training_session_per_week = excluded.no_of_training_session_per_week,
      pricing_details = excluded.pricing_details, marked_locations_images = excluded.marked_locations_images,
      area_callouts = excluded.area_callouts, synced_at = excluded.synced_at;
    get diagnostics n = row_count;
    result := result || jsonb_build_object(step, n);
  exception when others then
    result := result || jsonb_build_object(step, 'error: ' || sqlerrm);
  end;

  -- --------------------------------------------- website_campaign_requests
  begin
    step := 'website_campaign_requests';
    insert into public.website_campaign_requests as w (id, client_id, contact_id, name, budget, timeline, ad_type,
      status, drive_link, requested_by, raw_data, created_at, updated_at, synced_at)
    select t.id, c.id, t.contact_id, t.name, t.budget, t.timeline, t.ad_type, t.status, t.drive_link, t.user_id,
           coalesce(t.raw_data, '{}'::jsonb), t.created_at, t.updated_at, now()
    from extensions.dblink(conn,
      'select id, contact_id, user_id, name, budget, timeline, ad_type, status::text, drive_link, raw_data,
              created_at, updated_at
       from website_campaign_requests')
      as t(id integer, contact_id text, user_id text, name text, budget integer, timeline date, ad_type text,
           status text, drive_link text, raw_data jsonb, created_at timestamptz, updated_at timestamptz)
    left join public.clients c on c.ghl_contact_id = t.contact_id
    on conflict (id) do update set
      client_id = excluded.client_id, contact_id = excluded.contact_id, name = excluded.name,
      budget = excluded.budget, timeline = excluded.timeline, ad_type = excluded.ad_type, status = excluded.status,
      drive_link = excluded.drive_link, requested_by = excluded.requested_by, raw_data = excluded.raw_data,
      created_at = excluded.created_at, updated_at = excluded.updated_at, synced_at = excluded.synced_at;
    get diagnostics n = row_count;
    result := result || jsonb_build_object(step, n);
  exception when others then
    result := result || jsonb_build_object(step, 'error: ' || sqlerrm);
  end;

  perform extensions.dblink_disconnect(conn);

  -- Record the outcome per table.
  insert into public.retool_bridge_state (table_name, last_success, last_row_count, last_error)
  select key,
         case when jsonb_typeof(value) = 'number' then now() end,
         case when jsonb_typeof(value) = 'number' then value::int end,
         case when jsonb_typeof(value) = 'string' then value #>> '{}' end
  from jsonb_each(result)
  on conflict (table_name) do update set
    last_success = coalesce(excluded.last_success, public.retool_bridge_state.last_success),
    last_row_count = coalesce(excluded.last_row_count, public.retool_bridge_state.last_row_count),
    last_error = excluded.last_error;

  return result;
exception when others then
  -- Connection-level failure: make sure the link is closed, then report.
  begin
    perform extensions.dblink_disconnect(conn);
  exception when others then null;
  end;
  raise;
end $$;

-- Only the background job (service role) may run it.
revoke all on function private.retool_bridge_run(text) from public, anon, authenticated;
grant usage on schema private to service_role;
grant execute on function private.retool_bridge_run(text) to service_role;
