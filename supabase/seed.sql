-- =============================================================================
-- Small, fictional sample data for local development and the database tests.
-- Names and numbers are made up. Never run against the production project.
-- Week covered: 1–7 Nov 2026.
-- =============================================================================

insert into public.employees (id, first_name, last_name, email, is_ad_manager, role) values
  ('emp_alex', 'Alex', 'Rivera', 'alex@example.com', true,  'staff'),
  ('emp_sam',  'Sam',  'Patel',  'sam@example.com',  true,  'staff'),
  ('emp_owner','Olive','Owner',  'owner@example.com', false, 'owner');

insert into public.clients (id, business_name, active_status, ad_manager_id, city) values
  (1, 'Northside Jiu Jitsu', 'Active',   'emp_alex', 'Springfield'),
  (2, 'Harbor Yoga',         'New',      'emp_sam',  'Bayview'),
  (3, 'Old Town Boxing',     'Inactive', 'emp_alex', 'Oldtown');

insert into public.meta_ad_accounts (account_id, name, currency, account_status, client_id) values
  ('1001', 'Northside Jiu Jitsu Ads', 'USD', 'ACTIVE',    1),
  ('1002', 'Harbor Yoga',             'CAD', 'UNSETTLED', 2),
  ('1003', 'Old Town Boxing',         'USD', 'ACTIVE',    3);

insert into public.meta_campaigns (id, account_id, name, status, objective, daily_budget) values
  ('c1', '1001', 'NJJ | Beginners | Leads', 'ACTIVE', 'OUTCOME_LEADS', 30),
  ('c2', '1002', 'HY | Intro Offer',        'ACTIVE', 'OUTCOME_LEADS', 10),
  ('c3', '1003', 'OTB | Boxing',            'ACTIVE', 'OUTCOME_LEADS', 10);

insert into public.meta_adsets (id, campaign_id, account_id, name, status, optimization_goal, genders, age_min, age_max) values
  ('s1', 'c1', '1001', 'NJJ | Broad 25-55', 'ACTIVE', 'LEAD_GENERATION', 'All', 25, 55),
  ('s2', 'c2', '1002', 'HY | Women 25-45',  'ACTIVE', 'LEAD_GENERATION', 'Female', 25, 45),
  ('s3', 'c3', '1003', 'OTB | Broad',       'ACTIVE', 'LEAD_GENERATION', 'All', 18, 65);

insert into public.meta_ad_creatives (id, account_id, name, title, body, call_to_action) values
  ('cr1', '1001', 'Free class video', 'Your first class is free', 'Try jiu jitsu in Springfield…', 'SIGN_UP'),
  ('cr2', '1001', 'Kids photo',       'Confidence for kids',      'Kids classes in Springfield…', 'LEARN_MORE');

insert into public.meta_ads (id, adset_id, campaign_id, account_id, name, status, creative_id) values
  ('a1', 's1', 'c1', '1001', 'Ad hog',      'ACTIVE', 'cr1'),
  ('a2', 's1', 'c1', '1001', 'Ad steady',   'ACTIVE', 'cr2'),
  ('a3', 's1', 'c1', '1001', 'Ad paused',   'PAUSED', null),
  ('a4', 's2', 'c2', '1002', 'Ad low ctr',  'ACTIVE', null),
  ('a5', 's3', 'c3', '1003', 'Ad inactive client', 'ACTIVE', null);

-- 7 days of insights. a1 = $175 for 2 leads (budget hog), a2 = $35 for 3 leads,
-- a4 = $70, 1 lead, CTR 0.5%, a5 belongs to an Inactive client.
insert into public.meta_ad_insights_daily
  (ad_id, date, account_id, campaign_id, adset_id, spend, impressions, reach, clicks, link_clicks, leads)
select ad_id, d::date, account_id, campaign_id, adset_id, spend, impressions, reach, clicks, link_clicks,
  case
    when ad_id = 'a1' and extract(day from d) in (1, 4) then 1
    when ad_id = 'a2' and extract(day from d) in (2, 3, 5) then 1
    when ad_id = 'a4' and extract(day from d) = 6 then 1
    else 0 end
from generate_series('2026-11-01'::date, '2026-11-07'::date, interval '1 day') d
cross join (values
  ('a1', '1001', 'c1', 's1', 25, 1000, 800, 20, 10),
  ('a2', '1001', 'c1', 's1',  5,  300, 250,  6,  4),
  ('a4', '1002', 'c2', 's2', 10,  800, 700,  4,  2),
  ('a5', '1003', 'c3', 's3', 10,  500, 400, 10,  5)
) as v(ad_id, account_id, campaign_id, adset_id, spend, impressions, reach, clicks, link_clicks);

-- Lead sheet outcomes for client 1.
insert into public.sheet_leads (id, client_id, date_added, appointment_status, closed_value,
  monthly_membership_value, first_month_payment_date, campaign_name, adset_name, ad_name) values
  ('L1', 1, '2026-11-02', 'Shown',  200, 150, '2026-11-03', 'NJJ | Beginners | Leads', 'NJJ | Broad 25-55', 'Ad hog'),
  ('L2', 1, '2026-11-03', 'Booked', null, null, null,       'NJJ | Beginners | Leads', 'NJJ | Broad 25-55', 'Ad steady'),
  ('L3', 1, '2026-11-05', null,     null, null, null,       'NJJ | Beginners | Leads', 'NJJ | Broad 25-55', 'Ad steady'),
  ('L4', 1, '2026-10-20', 'Shown',  999, null, null,        'NJJ | Beginners | Leads', 'NJJ | Broad 25-55', 'Ad hog'); -- outside range
