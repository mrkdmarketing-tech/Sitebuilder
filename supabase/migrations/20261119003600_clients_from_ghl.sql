-- Clients that exist only in GHL (e.g. Truro BJJ, 19 Nov 2026: Active and
-- assigned in GHL, never set up in Retool, so no Client ID) are added by
-- ghl-sync. docs/ghl.md
--
-- Lab-added clients get ids from 900001 up (Retool's are small numbers) and
-- source = 'ghl'. If Retool later creates the same client (same GHL contact),
-- apply_ghl_live() moves everything to Retool's row and removes the Lab one.

create sequence if not exists private.ghl_client_id_seq start 900001;

/** Add GHL-only clients (called by ghl-sync). p: [{contactId, name, status, assignedTo, city, website}]. */
create or replace function public.add_ghl_clients(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r jsonb; added jsonb := '[]';
begin
  for r in select * from jsonb_array_elements(p) loop
    continue when exists (select 1 from public.clients c where c.ghl_contact_id = r->>'contactId');
    continue when coalesce(r->>'status', '') not in ('Active', 'New', 'Paused');
    insert into public.clients (id, business_name, active_status, ad_manager_id, ghl_contact_id, city, website, source, profile, synced_at)
    values (nextval('private.ghl_client_id_seq'), coalesce(nullif(trim(r->>'name'), ''), 'GHL client'), r->>'status',
            (select e.id from public.employees e where e.id = r->>'assignedTo'), r->>'contactId', r->>'city', r->>'website',
            'ghl', jsonb_build_object('added_from_ghl', now()), now());
    added := added || jsonb_build_array(r->>'name');
  end loop;
  return jsonb_build_object('added', jsonb_array_length(added), 'clients', added);
end $$;
revoke all on function public.add_ghl_clients(jsonb) from public, anon, authenticated;
grant execute on function public.add_ghl_clients(jsonb) to service_role;

/** Merge a Lab-added client into Retool's row for the same GHL contact (every table that points at clients). */
create or replace function private.merge_ghl_clients()
returns integer language plpgsql security definer set search_path = '' as $$
declare m record; fk record; n integer := 0;
begin
  for m in
    select l.id lab_id, r.id retool_id from public.clients l
    join public.clients r on r.ghl_contact_id = l.ghl_contact_id and r.id <> l.id and r.source <> 'ghl'
    where l.source = 'ghl'
  loop
    -- Keep Retool's own Lab changes if it has any; otherwise carry the Lab client's over.
    if exists (select 1 from public.client_overrides where client_id = m.retool_id) then
      delete from public.client_overrides where client_id = m.lab_id;
    end if;
    for fk in
      select cl.relname tbl, att.attname col, ns.nspname sch
      from pg_constraint con
      join pg_class cl on cl.oid = con.conrelid join pg_namespace ns on ns.oid = cl.relnamespace
      join pg_attribute att on att.attrelid = con.conrelid and att.attnum = con.conkey[1]
      where con.contype = 'f' and con.confrelid = 'public.clients'::regclass and array_length(con.conkey, 1) = 1
    loop
      execute format('update %I.%I set %I = $1 where %I = $2', fk.sch, fk.tbl, fk.col, fk.col) using m.retool_id, m.lab_id;
    end loop;
    delete from public.clients where id = m.lab_id;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function private.merge_ghl_clients() from public, anon, authenticated;

-- apply_ghl_live also merges duplicates first.
create or replace function public.apply_ghl_live()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare before jsonb; changed jsonb; merged integer;
begin
  merged := private.merge_ghl_clients();
  select coalesce(jsonb_object_agg(c.id, jsonb_build_array(c.active_status, c.ad_manager_id)), '{}') into before
  from public.clients c join public.ghl_contacts_live g on g.contact_id = c.ghl_contact_id;
  update public.clients c set ghl_contact_id = c.ghl_contact_id
  from public.ghl_contacts_live g where g.contact_id = c.ghl_contact_id;
  select coalesce(jsonb_agg(jsonb_build_object('client', c.business_name, 'status', c.active_status, 'was', before -> c.id::text -> 0)), '[]') into changed
  from public.clients c
  where before ? c.id::text and (before -> c.id::text) is distinct from jsonb_build_array(c.active_status, c.ad_manager_id);
  return jsonb_build_object('changed', jsonb_array_length(changed), 'clients', changed, 'merged', merged);
end $$;
revoke all on function public.apply_ghl_live() from public, anon, authenticated;
grant execute on function public.apply_ghl_live() to service_role;
