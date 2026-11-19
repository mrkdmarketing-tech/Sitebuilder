-- Client status and ads manager now come from GHL directly (ghl-sync), not from
-- Retool's copy, which can lag days behind GHL (19 Nov 2026: Elite Team
-- Monterey, AACE and Barrhaven were changed in GHL but still old in Retool).
-- docs/ghl.md
--
-- Order on every write to clients (BEFORE triggers run alphabetically):
--   1. clients_00_from_ghl     GHL's latest value (ghl_contacts_live), when GHL has one
--   2. clients_apply_override  changes made in The Lab still win
-- So the Retool copy can't put an old status back, and Lab changes keep working.

create or replace function private.clients_from_ghl()
returns trigger language plpgsql security definer set search_path = '' as $$
declare g public.ghl_contacts_live;
begin
  if new.ghl_contact_id is null then return new; end if;
  select * into g from public.ghl_contacts_live where contact_id = new.ghl_contact_id;
  if not found then return new; end if;
  if g.client_status is not null and exists (select 1 from public.client_statuses s where s.name = g.client_status) then
    new.active_status := g.client_status;
  end if;
  -- Assigned to: a GHL user who isn't on the team becomes "no ads manager" (same rule as the Retool copy).
  new.ad_manager_id := (select e.id from public.employees e where e.id = g.assigned_to);
  return new;
end $$;
revoke all on function private.clients_from_ghl() from public, anon, authenticated;

drop trigger if exists clients_00_from_ghl on public.clients;
create trigger clients_00_from_ghl before insert or update on public.clients
  for each row execute function private.clients_from_ghl();

/** Called by ghl-sync after each read: re-applies GHL's values to every client it read. Returns how many changed. */
create or replace function public.apply_ghl_live()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare before jsonb; changed jsonb;
begin
  select coalesce(jsonb_object_agg(c.id, jsonb_build_array(c.active_status, c.ad_manager_id)), '{}') into before
  from public.clients c join public.ghl_contacts_live g on g.contact_id = c.ghl_contact_id;
  update public.clients c set ghl_contact_id = c.ghl_contact_id
  from public.ghl_contacts_live g where g.contact_id = c.ghl_contact_id;
  select coalesce(jsonb_agg(jsonb_build_object('client', c.business_name, 'status', c.active_status, 'was', before -> c.id::text -> 0)), '[]') into changed
  from public.clients c
  where before ? c.id::text and (before -> c.id::text) is distinct from jsonb_build_array(c.active_status, c.ad_manager_id);
  return jsonb_build_object('changed', jsonb_array_length(changed), 'clients', changed);
end $$;
revoke all on function public.apply_ghl_live() from public, anon, authenticated;
grant execute on function public.apply_ghl_live() to service_role;
