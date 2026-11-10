-- =============================================================================
-- 2500 Staff and client controls in The Lab (docs/sop/staff-and-access.md,
-- docs/sop/new-client-or-ad-account.md).
--
--  * employee_overrides: owners/admins mark someone as not on the team (or back)
--    in The Lab. Retool's employees table is still copied, but this wins.
--    Inactive staff can't see any data and drop out of every list.
--  * set_employee_active(): the safe way to do that from the app (can't turn
--    off yourself, only owners can turn off owners, never the last owner).
--  * set_client_control(): one call for the Clients screen: status, ads manager
--    and ad account links, each optional, stored as overrides (migration 2400).
--  * client_list(): the Clients screen in one call, with what's overridden.
-- =============================================================================

create table public.employee_overrides (
  employee_id text primary key references public.employees (id) on delete cascade,
  active      boolean,
  note        text,
  set_by      text references public.employees (id),
  set_at      timestamptz not null default now()
);
alter table public.employee_overrides enable row level security;
create policy staff_read on public.employee_overrides for select to authenticated using ((select public.is_staff()));
create policy admin_insert on public.employee_overrides for insert to authenticated with check ((select public.is_admin()));
create policy admin_update on public.employee_overrides for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy admin_delete on public.employee_overrides for delete to authenticated using ((select public.is_admin()));

create or replace function private.employees_apply_override()
returns trigger language plpgsql security definer set search_path = '' as $$
declare a boolean;
begin
  select active into a from public.employee_overrides where employee_id = new.id;
  if a is not null then new.active := a; end if;
  return new;
end $$;
create trigger employees_apply_override before insert or update on public.employees
  for each row execute function private.employees_apply_override();

create or replace function private.employee_override_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.employees set active = active where id = new.employee_id;
  return null;
end $$;
create trigger employee_override_changed after insert or update on public.employee_overrides
  for each row execute function private.employee_override_changed();
create trigger employee_overrides_log after insert or update or delete on public.employee_overrides
  for each row execute function private.log_override();

-- log_override() reads client_id / account_id; teach it employee_id too.
create or replace function private.log_override()
returns trigger language plpgsql security definer set search_path = '' as $$
declare k text := case tg_table_name when 'client_overrides' then 'client_id'
                                     when 'employee_overrides' then 'employee_id'
                                     else 'account_id' end;
begin
  insert into public.actions_log (actor_id, action, target_type, target_id, before, after)
  values (public.current_employee_id(), 'override.' || tg_op::text, tg_table_name,
          coalesce(to_jsonb(new) ->> k, to_jsonb(old) ->> k),
          case when tg_op = 'INSERT' then null else to_jsonb(old) end,
          case when tg_op = 'DELETE' then null else to_jsonb(new) end);
  return null;
end $$;

create or replace function public.set_employee_active(p_employee text, p_active boolean, p_note text default null)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  me_id   text := public.current_employee_id();
  me_role text;
  t       public.employees;
begin
  select role into me_role from public.employees where id = me_id and active;
  if me_role is null or me_role not in ('admin', 'owner') then
    raise exception 'Only owners and admins can change who is on the team.' using errcode = '42501';
  end if;
  select * into t from public.employees where id = p_employee;
  if not found then raise exception 'Staff member not found.' using errcode = 'P0002'; end if;
  if p_employee = me_id and not p_active then
    raise exception 'You can''t remove yourself.' using errcode = '22023';
  end if;
  if t.role = 'owner' and me_role <> 'owner' then
    raise exception 'Only an owner can remove an owner.' using errcode = '42501';
  end if;
  if t.role = 'owner' and not p_active
     and (select count(*) from public.employees where role = 'owner' and active and id <> p_employee) = 0 then
    raise exception 'This is the last owner.' using errcode = '22023';
  end if;
  insert into public.employee_overrides (employee_id, active, note, set_by)
  values (p_employee, p_active, p_note, me_id)
  on conflict (employee_id) do update set active = excluded.active, note = excluded.note, set_by = excluded.set_by, set_at = now();
  return jsonb_build_object('active', p_active);
end $$;
revoke all on function public.set_employee_active(text, boolean, text) from public, anon;
grant execute on function public.set_employee_active(text, boolean, text) to authenticated;

-- Clients screen: change status, ads manager and ad account links in one call.
-- Pass only what changes. p_clear = true removes the client's overrides so GHL
-- and Retool decide again (on the next copy, within 15 minutes).
create or replace function public.set_client_control(
  p_client integer,
  p_status text default null,
  p_manager text default null,
  p_link_accounts text[] default null,
  p_unlink_accounts text[] default null,
  p_note text default null,
  p_clear boolean default false
) returns jsonb
language plpgsql
security definer   -- unlinking writes meta_ad_accounts, which the app can't; the admin check below guards it
set search_path = ''
as $$
declare me_id text := public.current_employee_id();
begin
  if not public.is_admin() then
    raise exception 'Only owners and admins can change clients.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.clients where id = p_client) then
    raise exception 'Client not found.' using errcode = 'P0002';
  end if;
  if p_status is not null and p_status not in ('New', 'Active', 'Paused', 'Inactive') then
    raise exception 'Status must be New, Active, Paused or Inactive.' using errcode = '22023';
  end if;
  if p_manager is not null and not exists (select 1 from public.employees where id = p_manager and active) then
    raise exception 'That ads manager isn''t on the team.' using errcode = '22023';
  end if;

  if p_clear then
    delete from public.client_overrides where client_id = p_client;
    delete from public.ad_account_overrides where client_id = p_client;
    return jsonb_build_object('cleared', true);
  end if;

  if p_status is not null or p_manager is not null then
    insert into public.client_overrides (client_id, ad_manager_id, active_status, note, set_by)
    values (p_client, p_manager, p_status, p_note, me_id)
    on conflict (client_id) do update set
      ad_manager_id = coalesce(excluded.ad_manager_id, public.client_overrides.ad_manager_id),
      active_status = coalesce(excluded.active_status, public.client_overrides.active_status),
      note = coalesce(excluded.note, public.client_overrides.note),
      set_by = excluded.set_by, set_at = now();
  end if;

  if p_link_accounts is not null then
    insert into public.ad_account_overrides (account_id, client_id, note, set_by)
    select a, p_client, p_note, me_id from unnest(p_link_accounts) a
    where exists (select 1 from public.meta_ad_accounts m where m.account_id = a)
    on conflict (account_id) do update set client_id = excluded.client_id, set_by = excluded.set_by, set_at = now();
  end if;

  if p_unlink_accounts is not null then
    delete from public.ad_account_overrides where account_id = any (p_unlink_accounts);
    -- Unlinked here; Retool's link (if any) comes back on the next copy unless removed in Retool.
    update public.meta_ad_accounts set client_id = null where account_id = any (p_unlink_accounts) and client_id = p_client;
  end if;

  -- Open suggestions for clients that are no longer Active/New are cleared.
  update public.suggestions set status = 'resolved'
   where client_id = p_client and status in ('open', 'snoozed')
     and (select active_status from public.clients where id = p_client) not in ('Active', 'New');

  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.set_client_control(integer, text, text, text[], text[], text, boolean) from public, anon;
grant execute on function public.set_client_control(integer, text, text, text[], text[], text, boolean) to authenticated;

create or replace function public.client_list()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(row_to_json(x)::jsonb order by x.name), '[]'::jsonb)
  from (
    select c.id, coalesce(c.business_name, 'Client ' || c.id) as name, c.active_status as status,
           c.ad_manager_id as "managerId",
           nullif(trim(e.first_name || ' ' || e.last_name), '') as "managerName",
           c.city, c.state,
           o.client_id is not null as overridden,
           o.active_status as "statusOverride", o.ad_manager_id as "managerOverride", o.note,
           nullif(trim(sb.first_name || ' ' || sb.last_name), '') as "overrideBy", o.set_at as "overrideAt",
           coalesce((select jsonb_agg(jsonb_build_object(
                       'id', a.account_id, 'name', a.name, 'status', a.account_status,
                       'linkedInLab', exists (select 1 from public.ad_account_overrides ao where ao.account_id = a.account_id))
                     order by a.name)
                     from public.meta_ad_accounts a where a.client_id = c.id), '[]'::jsonb) as accounts
    from public.clients c
    left join public.employees e on e.id = c.ad_manager_id
    left join public.client_overrides o on o.client_id = c.id
    left join public.employees sb on sb.id = o.set_by
  ) x
$$;
revoke all on function public.client_list() from public, anon;
grant execute on function public.client_list() to authenticated;

-- Ad accounts not linked to any client (for "Link an ad account").
create or replace function public.unlinked_ad_accounts()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', account_id, 'name', name, 'status', account_status) order by name), '[]'::jsonb)
  from public.meta_ad_accounts where client_id is null and account_status not in ('CLOSED')
$$;
revoke all on function public.unlinked_ad_accounts() from public, anon;
grant execute on function public.unlinked_ad_accounts() to authenticated;
