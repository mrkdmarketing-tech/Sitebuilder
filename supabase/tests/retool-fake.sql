-- A tiny stand-in for Retool's database (same table and column names as the
-- Nov 2026 export) so the bridge can be tested locally. Fictional data.
create table employees (id text primary key, first_name text, last_name text, email text, highlevel_user_type text,
  is_ad_manager boolean, slack_id text, active boolean);
create table ghl_contacts (id text primary key, metadata jsonb, location_id text, name text);
create table clients (id integer primary key, contact_id text, contact_person_name text, business_name text,
  active_status text, location_id text);
create table meta_ad_accounts (id text, name text, amount_spent double precision, disable boolean, account_id text,
  created_at timestamp, disable_reason text, currency text, account_status text, client_id integer);
create type wcr_status as enum ('new', 'done');
create table website_campaign_requests (id integer primary key, contact_id text, user_id text, name text, budget integer,
  timeline date, ad_type text, created_at timestamptz, updated_at timestamptz, status wcr_status, raw_data jsonb, drive_link text);
create table leads (id text primary key, client_id integer, date_added date, first_name text, last_name text, email text,
  phone_number text, reach_out_date_method text, notes_appt_date text, communication_status text, appointment_status text,
  closed_value double precision, date_closed date, monthly_membership_value double precision, first_month_payment_date date,
  date_left date, campaign_name text, adset_name text, ad_name text, contact_id text, subaccount_id text, platform text, active boolean);
create table campaign_specifics (id integer primary key, name text, client_id integer, ad_type text,
  monthly_adspend_budget double precision, monthly_adspend_budget_upper_limit double precision, cta_for_ad text,
  objective_and_goal text, landing_page_link text, booking_calendar_link text, push_lead_into_details text, lead_goals text,
  follow_up_process_details text, ads_lead_flow_details text, integration_and_automation_details text,
  is_crm_integrated boolean, crm_details text, lead_handling_responsibility_details text, marked_locations_images jsonb,
  area_callouts jsonb, access_to_push_leads boolean not null default false);
create table campaign_onboarding_info (id integer primary key, client_id integer, gyms_speciality text, gyms_core_value text,
  instructor_name text, instructor_years_of_experience integer, instructor_certifications_and_specializations text,
  instructor_teaching_style text, instructor_belts text, kid_program_age_range text, kid_program_class_time text,
  free_trial_for_kid_program boolean, free_trial_for_kid_program_specifications text, name_of_programs jsonb,
  special_introductory_offers text, what_to_sign_up_for_program text, program_details text,
  no_of_training_session_per_week text, pricing_details text, marked_locations_images text, area_callouts jsonb);

insert into employees values ('ghl_user_a', 'Alex', 'Rivera', 'alex@example.com', 'account', true, 'U1', true),
                             ('ghl_user_b', 'Sam', 'Patel', null, 'account', true, 'U2', true);
insert into ghl_contacts values ('ct1', '{"assignedTo":"ghl_user_a","city":"Springfield","website":"njj.example"}', 'loc', 'Northside'),
                                ('ct2', '{"assignedTo":"someone_not_in_employees"}', 'loc', 'Harbor');
insert into clients values (501, 'ct1', 'Pat', 'Northside Jiu Jitsu', 'Active', 'sub1'),
                           (502, 'ct2', 'Lee', 'Harbor Yoga', 'Weird status', null);
insert into meta_ad_accounts (account_id, name, currency, account_status, disable_reason, client_id, amount_spent) values
  ('7001', 'Northside Ads', 'USD', 'ACTIVE', 'NONE', 501, 1000), ('7002', 'Orphan', 'CAD', 'DISABLED', 'RISK', 999, 0);
insert into leads (id, client_id, date_added, appointment_status, closed_value, campaign_name, ad_name, active) values
  ('L1', 501, '2026-11-02', 'Shown', 200, 'NJJ | Leads', 'Ad A', true),
  ('L2', 999, '2026-11-03', null, null, 'X', 'Y', true);
insert into campaign_specifics (id, name, client_id, ad_type, monthly_adspend_budget) values (1, 'NJJ main', 501, 'jiu jitsu beginners program', 900);
insert into campaign_onboarding_info (id, client_id, gyms_speciality, name_of_programs) values
  (1, 501, 'old answer', '["Adults"]'), (2, 501, 'newest answer', '["Adults","Kids"]');
insert into website_campaign_requests values (1, 'ct1', 'webuser1', 'Spring push', 500, '2026-12-01', 'jiu jitsu', now(), now(), 'new', '{}', null);

-- Ad approval history (migration 2200).
create table ghl_locations (id text primary key, name text, access_token text, custom_fields_metadata jsonb);
insert into ghl_locations values ('1Pbw0cdWjFMBsIFPrA0d', 'Mrkd Marketing', 'SECRET-never-copied',
  '{"cf_phone": {"name": "Business Phone", "fieldKey": "contact.business_phone", "dataType": "PHONE"},
    "cf_stripe": {"name": "Stripe Customer ID", "fieldKey": "contact.stripe_customer_id", "dataType": "TEXT"}}');
create table ad_creative_templates (id text primary key, name text, metadata jsonb);
insert into ad_creative_templates values ('tpl1', 'Free week', '{"headline": "Free week in {{ city }}"}');
create table leadform_templates (id text primary key, name text, metadata jsonb);
insert into leadform_templates values ('lf1', 'Basic form', '{"questions": ["Full name", "Phone"]}');
create table ads_preview (id text primary key, name text, metadata jsonb default '{}', client_id integer,
  updated_at timestamp, created_at timestamp, completed_at timestamp, review_started_at timestamp,
  review_completed_at timestamp, step text default 'create', comments json default '[]', current_status text default 'create',
  ai_response text);
insert into ads_preview (id, name, client_id, created_at, current_status, comments, metadata) values
  ('ap1', 'Fall offer', 501, '2026-09-01', 'completed', '[{"comment": "Looks good"}]',
   '{"config": {"adType": "jiu jitsu kids program", "bookingType": "Landing Page"},
     "adCreative": {"headline": "Kids BJJ", "primaryText": "Join us", "descriptionAdCreative": "Free class",
                    "imageBase64": "AAAABIG", "images": [{"imageBase64": "AAAA", "canvaLink": "https://canva.example/x"}, {"imageBase64": "BBBB"}],
                    "tracking": ["CRM Event"]},
     "leadform": {"formName": "Kids form", "questions": ["Child age"], "messageForLeadsHeadline": "Thanks!"}}'),
  ('ap2', 'Draft thing', 999, '2026-10-01', 'create', '[]', '{}');
