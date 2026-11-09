-- =============================================================================
-- 0600 Reporting functions for the Meta insights screen.
--
-- These return RAW TOTALS only (spend, leads, clicks…). Derived KPIs (CPL, CPM,
-- CR %…) are calculated in shared/domain/metrics.ts so there is exactly one
-- formula for each, used by the dashboard and the suggestion rules alike.
--
-- Matches Retool's Meta Ads Insights logic (docs/metrics.md):
--   * only clients whose status is Active or New (unless p_include_inactive)
--   * an entity is ACTIVE only if it and all its parents are active
--   * booked / shown / closed come from the clients' lead sheets, matched to
--     campaigns / ad sets / ads by NAME (that's all the sheets record)
-- Called from the app as supabase.rpc('report', {...}).
-- =============================================================================

-- Simplified delivery status shared by every level.
create or replace function public.delivery_status(p_account_status text, variadic p_statuses text[])
returns text language sql immutable as $$
  select case
    when not public.meta_account_is_active(p_account_status) then 'DISABLED'
    when 'DELETED' = any (p_statuses) or 'ARCHIVED' = any (p_statuses) then 'REMOVED'
    when 'PAUSED' = any (p_statuses) then 'PAUSED'
    when array_position(p_statuses, null) is null
         and 'ACTIVE' = all (p_statuses) then 'ACTIVE'
    else 'OTHER'
  end
$$;

-- Lead-sheet outcomes per lead, with the value-generated formula from Retool's
-- Clients View: closed value + whole months as a member × monthly membership.
create or replace function public.sheet_outcomes(p_from date, p_to date)
returns table (
  client_id integer, campaign_name text, adset_name text, ad_name text,
  booked int, shown int, closed int, closed_value numeric, value_generated numeric
) language sql stable as $$
  select
    l.client_id, l.campaign_name, l.adset_name, l.ad_name,
    (l.appointment_status is not null)::int,
    (l.appointment_status = 'Shown')::int,
    (l.appointment_status = 'Shown' and l.closed_value is not null)::int,
    coalesce(l.closed_value, 0),
    coalesce(l.closed_value, 0)
      + case when l.first_month_payment_date is null then 0 else
          (extract(year  from age(coalesce(l.date_left, current_date), l.first_month_payment_date)) * 12
         + extract(month from age(coalesce(l.date_left, current_date), l.first_month_payment_date)))
          * coalesce(l.monthly_membership_value, 0)
        end
  from public.sheet_leads l
  where l.active and l.date_added between p_from and p_to
$$;

-- One row per ad with its totals for the range and all parent details.
create or replace function public.report_ad_base(p_from date, p_to date, p_include_inactive boolean default false)
returns table (
  ad_id text, ad_name text, ad_status text, ad_effective_status text, creative_id text, thumbnail_url text,
  adset_id text, adset_name text, adset_status text, optimization_goal text, advantage_plus boolean,
  learning_stage text, age_min int, age_max int, genders text,
  campaign_id text, campaign_name text, campaign_status text, daily_budget numeric, objective text,
  buying_type text, bid_strategy text, pacing_type text,
  account_id text, account_name text, account_status text, currency text,
  client_id integer, client_name text, client_status text, lead_sheet_url text,
  manager_id text, manager_name text,
  spend numeric, impressions bigint, reach bigint, clicks bigint, link_clicks bigint, leads bigint,
  comments bigint, page_likes bigint, messages bigint
) language sql stable as $$
  with ins as (
    select i.ad_id,
      sum(i.spend) spend, sum(i.impressions) impressions, sum(i.reach) reach, sum(i.clicks) clicks,
      sum(i.link_clicks) link_clicks, sum(i.leads) leads, sum(i.comments) comments,
      sum(i.page_likes) page_likes, sum(i.messages) messages
    from public.meta_ad_insights_daily i
    where i.date between p_from and p_to
    group by i.ad_id
  )
  select
    a.id, a.name, a.status, a.effective_status, a.creative_id,
    coalesce(cr.thumbnail_url, cr.image_url, cr.video_thumbnail_url),
    s.id, s.name, s.status, s.optimization_goal, s.advantage_plus, s.learning_stage, s.age_min, s.age_max, s.genders,
    c.id, c.name, c.status, c.daily_budget, c.objective, c.buying_type, c.bid_strategy, c.pacing_type,
    acc.account_id, acc.name, acc.account_status, acc.currency,
    cl.id, cl.business_name, cl.active_status, cl.lead_sheet_url,
    e.id, nullif(trim(coalesce(e.first_name, '') || ' ' || coalesce(e.last_name, '')), ''),
    coalesce(ins.spend, 0), coalesce(ins.impressions, 0)::bigint, coalesce(ins.reach, 0)::bigint,
    coalesce(ins.clicks, 0)::bigint, coalesce(ins.link_clicks, 0)::bigint, coalesce(ins.leads, 0)::bigint,
    coalesce(ins.comments, 0)::bigint, coalesce(ins.page_likes, 0)::bigint, coalesce(ins.messages, 0)::bigint
  from public.meta_ads a
  join public.meta_adsets s on s.id = a.adset_id
  join public.meta_campaigns c on c.id = a.campaign_id
  join public.meta_ad_accounts acc on acc.account_id = a.account_id
  left join public.clients cl on cl.id = acc.client_id
  left join public.employees e on e.id = cl.ad_manager_id
  left join public.meta_ad_creatives cr on cr.id = a.creative_id
  left join ins on ins.ad_id = a.id
  where p_include_inactive or cl.active_status in ('Active', 'New')
$$;

-- Builds the raw-totals part of a report row (camelCase keys = shared/domain/types.ts Totals).
create or replace function public.totals_json(
  spend numeric, impressions numeric, reach numeric, clicks numeric, link_clicks numeric,
  leads numeric, comments numeric, page_likes numeric, messages numeric,
  booked numeric, shown numeric, closed numeric, closed_value numeric, value_generated numeric
) returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'spend', round(coalesce(spend, 0), 2), 'impressions', coalesce(impressions, 0),
    'reach', coalesce(reach, 0), 'clicks', coalesce(clicks, 0), 'linkClicks', coalesce(link_clicks, 0),
    'leads', coalesce(leads, 0), 'comments', coalesce(comments, 0), 'pageLikes', coalesce(page_likes, 0),
    'messages', coalesce(messages, 0), 'booked', coalesce(booked, 0), 'shown', coalesce(shown, 0),
    'closed', coalesce(closed, 0), 'closedValue', round(coalesce(closed_value, 0), 2),
    'valueGenerated', round(coalesce(value_generated, 0), 2))
$$;

-- Main entry point: report rows for one level ('account' | 'campaign' | 'adset' | 'ad').
-- Returns a JSON array of objects shaped like shared/domain/types.ts ReportRow.
create or replace function public.report(
  p_level text, p_from date, p_to date, p_include_inactive boolean default false
) returns jsonb language plpgsql stable as $$
declare
  result jsonb;
begin
  if p_level not in ('account', 'campaign', 'adset', 'ad') then
    raise exception 'report: unknown level %', p_level;
  end if;

  if p_level = 'account' then
    with t as (
      select b.account_id, sum(b.spend) spend, sum(b.impressions) impressions, sum(b.reach) reach,
        sum(b.clicks) clicks, sum(b.link_clicks) link_clicks, sum(b.leads) leads, sum(b.comments) comments,
        sum(b.page_likes) page_likes, sum(b.messages) messages
      from public.report_ad_base(p_from, p_to, p_include_inactive) b group by b.account_id
    ), o as (
      select client_id, sum(booked) booked, sum(shown) shown, sum(closed) closed,
        sum(closed_value) closed_value, sum(value_generated) value_generated
      from public.sheet_outcomes(p_from, p_to) group by client_id
    )
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'level', 'account', 'id', acc.account_id, 'name', acc.name,
        'status', public.delivery_status(acc.account_status, 'ACTIVE'),
        'statusLabel', coalesce(acc.account_status, 'UNKNOWN'),
        'accountId', acc.account_id, 'accountName', acc.name,
        'accountActive', public.meta_account_is_active(acc.account_status),
        'currency', acc.currency, 'clientId', cl.id, 'clientName', cl.business_name,
        'clientStatus', cl.active_status, 'managerId', e.id,
        'managerName', nullif(trim(coalesce(e.first_name, '') || ' ' || coalesce(e.last_name, '')), ''),
        'leadsSheetUrl', cl.lead_sheet_url
      ) || public.totals_json(t.spend, t.impressions, t.reach, t.clicks, t.link_clicks, t.leads, t.comments,
                              t.page_likes, t.messages, o.booked, o.shown, o.closed, o.closed_value, o.value_generated)
      order by coalesce(t.spend, 0) desc, acc.name), '[]'::jsonb)
    into result
    from public.meta_ad_accounts acc
    left join public.clients cl on cl.id = acc.client_id
    left join public.employees e on e.id = cl.ad_manager_id
    left join t on t.account_id = acc.account_id
    left join o on o.client_id = acc.client_id
    where p_include_inactive or cl.active_status in ('Active', 'New');

  elsif p_level = 'campaign' then
    with b as (select * from public.report_ad_base(p_from, p_to, p_include_inactive)),
    t as (
      select b.campaign_id, min(b.campaign_name) campaign_name, min(b.campaign_status) campaign_status,
        min(b.daily_budget) daily_budget, min(b.objective) objective, min(b.buying_type) buying_type,
        min(b.bid_strategy) bid_strategy, min(b.pacing_type) pacing_type,
        min(b.account_id) account_id, min(b.account_name) account_name, min(b.account_status) account_status,
        min(b.currency) currency, min(b.client_id) client_id, min(b.client_name) client_name,
        min(b.client_status) client_status, min(b.manager_id) manager_id, min(b.manager_name) manager_name,
        sum(b.spend) spend, sum(b.impressions) impressions, sum(b.reach) reach, sum(b.clicks) clicks,
        sum(b.link_clicks) link_clicks, sum(b.leads) leads, sum(b.comments) comments,
        sum(b.page_likes) page_likes, sum(b.messages) messages
      from b group by b.campaign_id
    ), o as (
      select client_id, campaign_name, sum(booked) booked, sum(shown) shown, sum(closed) closed,
        sum(closed_value) closed_value
      from public.sheet_outcomes(p_from, p_to) group by client_id, campaign_name
    )
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'level', 'campaign', 'id', t.campaign_id, 'name', t.campaign_name,
        'status', public.delivery_status(t.account_status, t.campaign_status),
        'statusLabel', coalesce(t.campaign_status, 'UNKNOWN'),
        'accountId', t.account_id, 'accountName', t.account_name,
        'accountActive', public.meta_account_is_active(t.account_status), 'currency', t.currency,
        'campaignId', t.campaign_id, 'campaignName', t.campaign_name,
        'clientId', t.client_id, 'clientName', t.client_name, 'clientStatus', t.client_status,
        'managerId', t.manager_id, 'managerName', t.manager_name,
        'dailyBudget', t.daily_budget, 'objective', t.objective, 'buyingType', t.buying_type,
        'bidStrategy', t.bid_strategy, 'pacingType', t.pacing_type
      ) || public.totals_json(t.spend, t.impressions, t.reach, t.clicks, t.link_clicks, t.leads, t.comments,
                              t.page_likes, t.messages, o.booked, o.shown, o.closed, o.closed_value, 0)
      order by t.spend desc, t.campaign_name), '[]'::jsonb)
    into result
    from t left join o on o.client_id = t.client_id and o.campaign_name = t.campaign_name
    where t.spend > 0 or t.impressions > 0
       or public.delivery_status(t.account_status, t.campaign_status) = 'ACTIVE';

  elsif p_level = 'adset' then
    with b as (select * from public.report_ad_base(p_from, p_to, p_include_inactive)),
    t as (
      select b.adset_id, min(b.adset_name) adset_name, min(b.adset_status) adset_status,
        min(b.campaign_id) campaign_id, min(b.campaign_name) campaign_name, min(b.campaign_status) campaign_status,
        min(b.optimization_goal) optimization_goal, bool_or(b.advantage_plus) advantage_plus,
        min(b.learning_stage) learning_stage, min(b.age_min) age_min, min(b.age_max) age_max, min(b.genders) genders,
        min(b.account_id) account_id, min(b.account_name) account_name, min(b.account_status) account_status,
        min(b.currency) currency, min(b.client_id) client_id, min(b.client_name) client_name,
        min(b.client_status) client_status, min(b.manager_id) manager_id, min(b.manager_name) manager_name,
        sum(b.spend) spend, sum(b.impressions) impressions, sum(b.reach) reach, sum(b.clicks) clicks,
        sum(b.link_clicks) link_clicks, sum(b.leads) leads, sum(b.comments) comments,
        sum(b.page_likes) page_likes, sum(b.messages) messages
      from b group by b.adset_id
    ), o as (
      select client_id, adset_name, sum(booked) booked, sum(shown) shown, sum(closed) closed,
        sum(closed_value) closed_value
      from public.sheet_outcomes(p_from, p_to) group by client_id, adset_name
    )
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'level', 'adset', 'id', t.adset_id, 'name', t.adset_name,
        'status', public.delivery_status(t.account_status, t.campaign_status, t.adset_status),
        'statusLabel', coalesce(t.adset_status, 'UNKNOWN'),
        'accountId', t.account_id, 'accountName', t.account_name,
        'accountActive', public.meta_account_is_active(t.account_status), 'currency', t.currency,
        'campaignId', t.campaign_id, 'campaignName', t.campaign_name,
        'adsetId', t.adset_id, 'adsetName', t.adset_name,
        'clientId', t.client_id, 'clientName', t.client_name, 'clientStatus', t.client_status,
        'managerId', t.manager_id, 'managerName', t.manager_name,
        'optimizationGoal', t.optimization_goal, 'advantagePlus', t.advantage_plus,
        'learningStage', t.learning_stage, 'ageMin', t.age_min, 'ageMax', t.age_max, 'genders', t.genders
      ) || public.totals_json(t.spend, t.impressions, t.reach, t.clicks, t.link_clicks, t.leads, t.comments,
                              t.page_likes, t.messages, o.booked, o.shown, o.closed, o.closed_value, 0)
      order by t.spend desc, t.adset_name), '[]'::jsonb)
    into result
    from t left join o on o.client_id = t.client_id and o.adset_name = t.adset_name
    where t.spend > 0 or t.impressions > 0
       or public.delivery_status(t.account_status, t.campaign_status, t.adset_status) = 'ACTIVE';

  else -- 'ad'
    with b as (select * from public.report_ad_base(p_from, p_to, p_include_inactive)),
    o as (
      select client_id, ad_name, sum(booked) booked, sum(shown) shown, sum(closed) closed,
        sum(closed_value) closed_value
      from public.sheet_outcomes(p_from, p_to) group by client_id, ad_name
    )
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'level', 'ad', 'id', b.ad_id, 'name', b.ad_name,
        'status', public.delivery_status(b.account_status, b.campaign_status, b.adset_status, b.ad_status),
        'statusLabel', coalesce(b.ad_effective_status, b.ad_status, 'UNKNOWN'),
        'accountId', b.account_id, 'accountName', b.account_name,
        'accountActive', public.meta_account_is_active(b.account_status), 'currency', b.currency,
        'campaignId', b.campaign_id, 'campaignName', b.campaign_name,
        'adsetId', b.adset_id, 'adsetName', b.adset_name,
        'clientId', b.client_id, 'clientName', b.client_name, 'clientStatus', b.client_status,
        'managerId', b.manager_id, 'managerName', b.manager_name,
        'creativeId', b.creative_id, 'thumbnailUrl', b.thumbnail_url
      ) || public.totals_json(b.spend, b.impressions, b.reach, b.clicks, b.link_clicks, b.leads, b.comments,
                              b.page_likes, b.messages, o.booked, o.shown, o.closed, o.closed_value, 0)
      order by b.spend desc, b.ad_name), '[]'::jsonb)
    into result
    from b left join o on o.client_id = b.client_id and o.ad_name = b.ad_name
    where b.spend > 0 or b.impressions > 0
       or public.delivery_status(b.account_status, b.campaign_status, b.adset_status, b.ad_status) = 'ACTIVE';
  end if;

  return result;
end $$;

-- Meta leads per ad account over the last N days (suggestion rule 7).
create or replace function public.recent_leads_by_account(p_days integer default 3)
returns table (account_id text, leads bigint) language sql stable as $$
  select i.account_id, sum(i.leads)::bigint
  from public.meta_ad_insights_daily i
  where i.date >= (now() at time zone 'America/Toronto')::date - p_days
    and i.date <  (now() at time zone 'America/Toronto')::date
  group by i.account_id
$$;

-- Lead list for the "Leads" tab.
create or replace function public.leads_report(p_from date, p_to date, p_include_inactive boolean default false)
returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', l.id, 'createdAt', l.created_time, 'name', l.full_name, 'email', l.email, 'phone', l.phone,
    'formId', l.form_id, 'formName', f.name, 'adId', l.ad_id, 'adName', a.name,
    'accountId', coalesce(a.account_id, l.account_id), 'clientId', cl.id, 'managerId', cl.ad_manager_id
  ) order by l.created_time desc), '[]'::jsonb)
  from public.meta_leads l
  left join public.meta_ads a on a.id = l.ad_id
  left join public.meta_leadgen_forms f on f.id = l.form_id
  left join public.meta_ad_accounts acc on acc.account_id = coalesce(a.account_id, l.account_id)
  left join public.clients cl on cl.id = acc.client_id
  where (l.created_time at time zone 'America/Toronto')::date between p_from and p_to
    and (p_include_inactive or cl.active_status in ('Active', 'New'))
$$;

-- Safe search (parameterised; replaces Retool's string-built SQL).
create or replace function public.search_lead_forms(p_query text, p_limit integer default 100)
returns setof public.meta_leadgen_forms language sql stable as $$
  select * from public.meta_leadgen_forms
  where p_query is null or p_query = ''
     or name ilike '%' || p_query || '%' or page_id = p_query or raw::text ilike '%' || p_query || '%'
  order by name nulls last limit least(p_limit, 500)
$$;

create or replace function public.search_ad_copy(p_query text, p_limit integer default 100)
returns setof public.meta_ad_creatives language sql stable as $$
  select * from public.meta_ad_creatives
  where p_query is null or p_query = ''
     or name ilike '%' || p_query || '%' or title ilike '%' || p_query || '%'
     or body ilike '%' || p_query || '%' or account_id = p_query
  order by name nulls last limit least(p_limit, 500)
$$;
