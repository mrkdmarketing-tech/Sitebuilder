-- What's working compares cost per lead, so only lead campaigns belong in it.
-- Sales campaigns (e.g. Jiu Jitsu FLO's Black Friday product sale, 11 Nov 2026)
-- aim for purchases, and their few leads made "Seasonal" offers look like $179 a lead.

create or replace function public.creative_tag_report(p_from date, p_to date)
returns table (dimension text, value text, ads bigint, accounts bigint, spend numeric, leads bigint, tagged boolean)
language sql
stable
security invoker
set search_path = ''
as $$
  with perf as (
    select i.ad_id, i.account_id, sum(i.spend) spend, sum(i.leads) leads
    from public.meta_ad_insights_daily i
    join public.meta_ad_accounts acc on acc.account_id = i.account_id
    join public.clients c on c.id = acc.client_id and c.active_status in ('Active', 'New')
    join public.meta_campaigns camp on camp.id = i.campaign_id and camp.objective in ('OUTCOME_LEADS', 'LEAD_GENERATION')
    where i.date between p_from and p_to
    group by i.ad_id, i.account_id
    having sum(i.spend) > 0
  ),
  tagged as (
    select p.*, t.offer, t.audience, t.hook,
           case when cr.video_id is not null then 'video' when cr.id is not null then 'image' end as format,
           t.creative_id is not null as has_tags
    from perf p
    left join public.meta_ads a on a.id = p.ad_id
    left join public.meta_ad_creatives cr on cr.id = a.creative_id
    left join public.creative_tags t on t.creative_id = a.creative_id
  ),
  long as (
    select 'offer' dimension, offer value, * from tagged
    union all select 'audience', audience, * from tagged
    union all select 'hook', hook, * from tagged
    union all select 'format', format, * from tagged
  )
  select dimension, value, count(distinct ad_id), count(distinct account_id), round(sum(spend), 2), sum(leads)::bigint,
         bool_or(has_tags) or dimension = 'format'
  from long
  group by dimension, value
  order by dimension, sum(spend) desc
$$;
revoke all on function public.creative_tag_report(date, date) from public, anon;
grant execute on function public.creative_tag_report(date, date) to authenticated;
