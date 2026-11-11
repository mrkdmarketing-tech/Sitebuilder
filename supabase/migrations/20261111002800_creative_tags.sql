-- Creative tags (docs/creative-tags.md): offer, audience and opening hook for
-- each ad creative, read from its copy by TypeSafe's Jev model (tag-creatives
-- function), and a report comparing cost per lead by tag across all accounts.

create table public.creative_tags (
  creative_id text primary key references public.meta_ad_creatives (id) on delete cascade,
  offer       text,
  audience    text,
  hook        text,
  confidence  jsonb not null default '{}',
  model       text,
  -- Hash of the text that was read; re-tagged only when the copy changes.
  input_hash  text not null,
  tagged_at   timestamptz not null default now()
);
comment on table public.creative_tags is 'What each ad creative offers, who it speaks to, how it opens. Written by tag-creatives (Jev).';

alter table public.creative_tags enable row level security;
create policy staff_read on public.creative_tags for select to authenticated using ((select public.is_staff()));
-- Written only by the tag-creatives function (service role).

/** Cost per lead by tag, across every Active/New client's ads that spent in the period. */
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

-- Every hour at :50, tag creatives that have no tags yet (once the backlog is done, most runs find little).
do $$
begin
  perform cron.unschedule('tag-creatives') where exists (select 1 from cron.job where jobname = 'tag-creatives');
  perform cron.schedule('tag-creatives', '50 * * * *', 'select private.call_function(''tag-creatives'')');
end $$;

-- For the tag-creatives function: creatives with copy and no tags yet, the ones
-- that spent most in the last 90 days first. (Meta creatives can't be edited, so
-- one tagging per creative is enough.)
create or replace function public.creatives_to_tag(p_limit integer)
returns table (id text, title text, body text)
language sql
stable
set search_path = ''
as $$
  select c.id, c.title, c.body
  from public.meta_ad_creatives c
  left join public.creative_tags t on t.creative_id = c.id
  left join lateral (
    select sum(i.spend) spend
    from public.meta_ads a
    join public.meta_ad_insights_daily i on i.ad_id = a.id and i.date >= current_date - 90
    where a.creative_id = c.id
  ) s on true
  where t.creative_id is null
    and (coalesce(c.body, '') <> '' or coalesce(c.title, '') <> '')
  order by s.spend desc nulls last, c.id
  limit p_limit
$$;
revoke all on function public.creatives_to_tag(integer) from public, anon, authenticated;
grant execute on function public.creatives_to_tag(integer) to service_role;
