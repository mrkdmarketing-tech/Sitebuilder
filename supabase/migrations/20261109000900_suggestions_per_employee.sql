-- =============================================================================
-- 0900 Suggestions belong to the employee the client is assigned to in GHL.
--
-- A client's ads manager is the GHL contact's "Assigned to" (copied into
-- clients.ad_manager_id by the Retool bridge). suggestions.manager_id is set
-- from it by run-rules. Rules (agreed with Jordan, Nov 2026):
--   * staff see and act on ONLY their own suggestions
--   * admins/owners see and act on everyone's
-- Docs: docs/suggestions.md, docs/auth.md
-- =============================================================================

drop policy staff_read on public.suggestions;
drop policy staff_update on public.suggestions;

create policy own_or_admin_read on public.suggestions for select to authenticated
  using (public.is_admin() or (public.is_staff() and manager_id = public.current_employee_id()));

create policy own_or_admin_update on public.suggestions for update to authenticated
  using (public.is_admin() or (public.is_staff() and manager_id = public.current_employee_id()))
  with check (public.is_admin() or (public.is_staff() and manager_id = public.current_employee_id()));

-- The signed-in employee (used by the app to know who you are and your role).
create or replace function public.me() returns jsonb
language sql stable security definer set search_path = public as $$
  select to_jsonb(e) - 'auth_user_id'
  from public.employees e
  where e.auth_user_id = auth.uid() and e.active
$$;

-- Keep a suggestion's owner in step with GHL: if a client is reassigned, its
-- open suggestions move to the new ads manager straight away.
create or replace function public.sync_suggestion_manager() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.ad_manager_id is distinct from old.ad_manager_id then
    update public.suggestions set manager_id = new.ad_manager_id
    where client_id = new.id and status in ('open', 'snoozed');
  end if;
  return new;
end $$;

create trigger clients_reassign_suggestions after update of ad_manager_id on public.clients
  for each row execute function public.sync_suggestion_manager();
