-- Direct GHL connection, read-only (docs/ghl.md). The ghl-sync function reads
-- MRKD's own GHL sub-account (where every client is a contact) with a private
-- integration token and stores what it sees here. For now The Lab keeps using
-- the Retool copy; ghl_compare() shows where the two disagree, so we can switch
-- once they match. Nothing is ever written to GHL.

create table public.ghl_contacts_live (
  contact_id    text primary key,
  location_id   text not null,
  client_id     integer,          -- GHL custom field "Client ID"
  name          text,
  client_status text,             -- GHL custom field "Client Status"
  assigned_to   text,             -- GHL user id (the ads manager)
  data          jsonb not null,   -- the contact as GHL returned it
  fetched_at    timestamptz not null default now()
);
comment on table public.ghl_contacts_live is 'Client contacts read directly from GHL by ghl-sync (read-only).';

create table public.ghl_users_live (
  id         text primary key,
  name       text,
  email      text,
  data       jsonb not null,
  fetched_at timestamptz not null default now()
);
comment on table public.ghl_users_live is 'Users of MRKD''s GHL sub-account, read directly by ghl-sync.';

alter table public.ghl_contacts_live enable row level security;
alter table public.ghl_users_live enable row level security;
create policy staff_read on public.ghl_contacts_live for select to authenticated using ((select public.is_staff()));
create policy staff_read on public.ghl_users_live for select to authenticated using ((select public.is_staff()));
-- Written only by the ghl-sync function (service role).

/**
 * Where GHL (read directly) and the Retool copy disagree, client by client.
 * "lab_change" says when The Lab has its own value on top (client_overrides),
 * which GHL won't know about until writing back to GHL is switched on.
 */
create or replace function public.ghl_compare()
returns table (client_id integer, business_name text, field text, retool_copy text, ghl_direct text, lab_change text)
language sql
stable
security invoker
set search_path = ''
as $$
  with status_field as (
    select id from public.ghl_custom_fields where field_key = 'contact.client_status' limit 1
  ),
  copy as (
    select c.id, c.business_name, c.ghl_contact_id,
      (select cf->>'value' from jsonb_array_elements(coalesce(c.profile->'ghl_contact'->'customFields', '[]')) cf
        where cf->>'id' = (select id from status_field)) as status,
      c.profile->'ghl_contact'->>'assignedTo' as assigned_to
    from public.clients c
  ),
  pairs as (
    select k.id, k.business_name, 'Client status' as field, k.status as retool_copy, g.client_status as ghl_direct,
           o.active_status as lab_value
    from copy k join public.ghl_contacts_live g on g.contact_id = k.ghl_contact_id
    left join public.client_overrides o on o.client_id = k.id
    union all
    select k.id, k.business_name, 'Ads manager',
           coalesce(eu.first_name || ' ' || eu.last_name, k.assigned_to),
           coalesce(eg.first_name || ' ' || eg.last_name, g.assigned_to),
           (select e.first_name || ' ' || e.last_name from public.employees e where e.id = o.ad_manager_id)
    from copy k join public.ghl_contacts_live g on g.contact_id = k.ghl_contact_id
    left join public.employees eu on eu.id = k.assigned_to
    left join public.employees eg on eg.id = g.assigned_to
    left join public.client_overrides o on o.client_id = k.id
  )
  select id, business_name, field, retool_copy, ghl_direct,
         case when lab_value is not null then 'Set in The Lab: ' || lab_value end
  from pairs
  where retool_copy is distinct from ghl_direct
  order by business_name, field
$$;
revoke all on function public.ghl_compare() from public, anon;
grant execute on function public.ghl_compare() to authenticated;

-- Hourly at :25 while we compare (switch to every 15 min when GHL becomes the source).
do $$
begin
  perform cron.unschedule('ghl-sync') where exists (select 1 from cron.job where jobname = 'ghl-sync');
  perform cron.schedule('ghl-sync', '25 * * * *', 'select private.call_function(''ghl-sync'')');
end $$;
