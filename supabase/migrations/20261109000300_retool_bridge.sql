-- =============================================================================
-- 0300 Retool bridge tables.
--
-- While Clients View and Onboarding stay in Retool (plan.md §5), this data is
-- still created there. supabase/functions/retool-bridge copies it here every
-- 15 minutes, read-only. Column names mirror Retool's tables on purpose, so the
-- copy is a straight mapping and the eventual migration is trivial.
-- Docs: docs/retool-bridge.md
-- =============================================================================

-- Lead outcomes from each client's Google Sheet (Retool: leads).
create table public.sheet_leads (
  id                       text primary key,
  client_id                integer references public.clients (id) on delete cascade,
  date_added               date,
  first_name               text,
  last_name                text,
  email                    text,
  phone_number             text,
  reach_out_date_method    text,
  notes_appt_date          text,
  communication_status     text,
  appointment_status       text,        -- not null = booked; 'Shown' = showed up
  closed_value             numeric,     -- not null = closed / new member
  date_closed              date,
  monthly_membership_value numeric,
  first_month_payment_date date,
  date_left                date,
  campaign_name            text,
  adset_name               text,
  ad_name                  text,
  platform                 text,
  active                   boolean not null default true,
  synced_at                timestamptz not null default now()
);
create index sheet_leads_client_date_idx on public.sheet_leads (client_id, date_added);

-- Onboarding answers (Retool: campaign_onboarding_info). One row per client.
create table public.client_onboarding (
  client_id                                  integer primary key references public.clients (id) on delete cascade,
  retool_id                                  integer,
  gyms_speciality                            text,
  gyms_core_value                            text,
  instructor_name                            text,
  instructor_years_of_experience             integer,
  instructor_certifications_and_specializations text,
  instructor_teaching_style                  text,
  instructor_belts                           text,
  kid_program_age_range                      text,
  kid_program_class_time                     text,
  free_trial_for_kid_program                 boolean,
  free_trial_for_kid_program_specifications  text,
  name_of_programs                           jsonb,
  special_introductory_offers                text,
  what_to_sign_up_for_program                text,
  program_details                            text,
  no_of_training_session_per_week            text,
  pricing_details                            text,
  marked_locations_images                    text,
  area_callouts                              jsonb,
  synced_at                                  timestamptz not null default now()
);

-- Campaign setup per client (Retool: campaign_specifics).
create table public.campaign_specifics (
  id                                   integer primary key,
  client_id                            integer references public.clients (id) on delete cascade,
  name                                 text,
  ad_type                              text,
  monthly_adspend_budget               numeric,
  monthly_adspend_budget_upper_limit   numeric,
  cta_for_ad                           text,
  objective_and_goal                   text,
  landing_page_link                    text,
  booking_calendar_link                text,
  push_lead_into_details               text,
  lead_goals                           text,
  follow_up_process_details            text,
  ads_lead_flow_details                text,
  integration_and_automation_details   text,
  is_crm_integrated                    boolean,
  crm_details                          text,
  lead_handling_responsibility_details text,
  marked_locations_images              jsonb,
  area_callouts                        jsonb,
  access_to_push_leads                 boolean,
  synced_at                            timestamptz not null default now()
);
create index campaign_specifics_client_idx on public.campaign_specifics (client_id);

-- Campaign requests from the LeadLabz website, shown in ad approval
-- (Retool: website_campaign_requests).
create table public.website_campaign_requests (
  id          integer primary key,
  client_id   integer references public.clients (id) on delete set null,
  contact_id  text,
  name        text,
  budget      integer,
  timeline    date,
  ad_type     text,
  status      text,
  drive_link  text,
  requested_by text,
  raw_data    jsonb not null default '{}'::jsonb,
  created_at  timestamptz,
  updated_at  timestamptz,
  synced_at   timestamptz not null default now()
);

-- GHL custom field definitions for MRKD's agency location (id → name/key),
-- needed to decode client profiles and template placeholders.
create table public.ghl_custom_fields (
  id         text primary key,
  field_key  text,
  name       text,
  data_type  text,
  options    jsonb,
  synced_at  timestamptz not null default now()
);

-- Bookkeeping: which bridge tables last copied successfully.
create table public.retool_bridge_state (
  table_name    text primary key,
  last_success  timestamptz,
  last_row_count integer,
  last_error    text
);
