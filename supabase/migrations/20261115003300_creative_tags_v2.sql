-- Creative tags v2 (docs/creative-tags.md): four yes/no tags (mentions a price,
-- deadline, city or area, free uniform) and a version, so tag-creatives re-tags
-- older rows; plus a lookup used by Insights to label and filter ads.

alter table public.creative_tags
  add column if not exists price    boolean,
  add column if not exists deadline boolean,
  add column if not exists place    boolean,
  add column if not exists uniform  boolean,
  add column if not exists version  integer not null default 1;

drop function if exists public.creatives_to_tag(integer);
create or replace function public.creatives_to_tag(p_limit integer, p_version integer default 1)
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
  where (t.creative_id is null or t.version < p_version)
    and (coalesce(c.body, '') <> '' or coalesce(c.title, '') <> '')
  order by (t.creative_id is null) desc, s.spend desc nulls last, c.id
  limit p_limit
$$;
revoke all on function public.creatives_to_tag(integer, integer) from public, anon, authenticated;
grant execute on function public.creatives_to_tag(integer, integer) to service_role;

/** Tags for a list of creatives (Insights labels and filters). */
create or replace function public.creative_tags_for(p_ids text[])
returns table (creative_id text, offer text, audience text, hook text, price boolean, deadline boolean, place boolean, uniform boolean)
language sql
stable
security invoker
set search_path = ''
as $$
  select creative_id, offer, audience, hook, price, deadline, place, uniform
  from public.creative_tags where creative_id = any (p_ids)
$$;
revoke all on function public.creative_tags_for(text[]) from public, anon;
grant execute on function public.creative_tags_for(text[]) to authenticated;
