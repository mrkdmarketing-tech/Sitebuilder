-- creatives_to_tag (migration 2800) timed out: it added up spend once per
-- creative. Add it up once for all creatives instead.
create or replace function public.creatives_to_tag(p_limit integer)
returns table (id text, title text, body text)
language sql
stable
set search_path = ''
as $$
  with spend as (
    select a.creative_id, sum(i.spend) spend
    from public.meta_ad_insights_daily i
    join public.meta_ads a on a.id = i.ad_id
    where i.date >= current_date - 90 and a.creative_id is not null
    group by a.creative_id
  )
  select c.id, c.title, c.body
  from public.meta_ad_creatives c
  left join public.creative_tags t on t.creative_id = c.id
  left join spend s on s.creative_id = c.id
  where t.creative_id is null
    and (coalesce(c.body, '') <> '' or coalesce(c.title, '') <> '')
  order by s.spend desc nulls last, c.id
  limit p_limit
$$;
revoke all on function public.creatives_to_tag(integer) from public, anon, authenticated;
grant execute on function public.creatives_to_tag(integer) to service_role;
