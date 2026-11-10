-- =============================================================================
-- 2400 Overrides set in The Lab (docs/data-model.md#2400, docs/sop/new-client-or-ad-account.md).
--
-- Normally a client's ads manager comes from GHL ("Assigned to"), and its status
-- and ad account link from Retool, copied every 15 minutes. Owners and admins
-- can override those in The Lab without touching GHL or Retool:
--   client_overrides:      ads manager and/or status for a client
--   ad_account_overrides:  which client an ad account belongs to
-- BEFORE triggers on clients and meta_ad_accounts apply the override on every
-- write, so the Retool copy can't undo it. Removing an override hands control
-- back to GHL/Retool on the next copy (within 15 minutes).
-- First use: the four Rising Tide locations, moved to Zohirul (11 Nov 2026).
-- =============================================================================

create table public.client_overrides (
  client_id     integer primary key references public.clients (id) on delete cascade,
  ad_manager_id text references public.employees (id) on delete set null,
  active_status text references public.client_statuses (name) on update cascade,
  note          text,
  set_by        text references public.employees (id),
  set_at        timestamptz not null default now()
);

create table public.ad_account_overrides (
  account_id text primary key references public.meta_ad_accounts (account_id) on delete cascade,
  client_id  integer not null references public.clients (id) on delete cascade,
  note       text,
  set_by     text references public.employees (id),
  set_at     timestamptz not null default now()
);

alter table public.client_overrides enable row level security;
alter table public.ad_account_overrides enable row level security;
create policy staff_read on public.client_overrides for select to authenticated using ((select public.is_staff()));
create policy staff_read on public.ad_account_overrides for select to authenticated using ((select public.is_staff()));
do $$
declare t text;
begin
  foreach t in array array['client_overrides', 'ad_account_overrides'] loop
    execute format('create policy admin_insert on public.%I for insert to authenticated with check ((select public.is_admin()))', t);
    execute format('create policy admin_update on public.%I for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', t);
    execute format('create policy admin_delete on public.%I for delete to authenticated using ((select public.is_admin()))', t);
  end loop;
end $$;

-- Apply overrides on every write to the synced rows.
create or replace function private.clients_apply_override()
returns trigger language plpgsql security definer set search_path = '' as $$
declare o public.client_overrides;
begin
  select * into o from public.client_overrides where client_id = new.id;
  if found then
    if o.ad_manager_id is not null then new.ad_manager_id := o.ad_manager_id; end if;
    if o.active_status is not null then new.active_status := o.active_status; end if;
  end if;
  return new;
end $$;
create trigger clients_apply_override before insert or update on public.clients
  for each row execute function private.clients_apply_override();

create or replace function private.ad_accounts_apply_override()
returns trigger language plpgsql security definer set search_path = '' as $$
declare cid integer;
begin
  select client_id into cid from public.ad_account_overrides where account_id = new.account_id;
  if found then new.client_id := cid; end if;
  return new;
end $$;
create trigger ad_accounts_apply_override before insert or update on public.meta_ad_accounts
  for each row execute function private.ad_accounts_apply_override();

-- When an override is added or changed, apply it straight away.
create or replace function private.client_override_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Listing the columns makes the "move open suggestions" trigger (0900) fire too.
  update public.clients set ad_manager_id = ad_manager_id, active_status = active_status where id = new.client_id;
  return null;
end $$;
create trigger client_override_changed after insert or update on public.client_overrides
  for each row execute function private.client_override_changed();

create or replace function private.ad_account_override_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.meta_ad_accounts set client_id = client_id where account_id = new.account_id;
  return null;
end $$;
create trigger ad_account_override_changed after insert or update on public.ad_account_overrides
  for each row execute function private.ad_account_override_changed();

-- Every change is logged.
create or replace function private.log_override()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.actions_log (actor_id, action, target_type, target_id, before, after)
  values (public.current_employee_id(), 'override.' || tg_op::text, tg_table_name,
          coalesce((to_jsonb(new) ->> case when tg_table_name = 'client_overrides' then 'client_id' else 'account_id' end),
                   (to_jsonb(old) ->> case when tg_table_name = 'client_overrides' then 'client_id' else 'account_id' end)),
          case when tg_op = 'INSERT' then null else to_jsonb(old) end,
          case when tg_op = 'DELETE' then null else to_jsonb(new) end);
  return null;
end $$;
create trigger client_overrides_log after insert or update or delete on public.client_overrides
  for each row execute function private.log_override();
create trigger ad_account_overrides_log after insert or update or delete on public.ad_account_overrides
  for each row execute function private.log_override();
