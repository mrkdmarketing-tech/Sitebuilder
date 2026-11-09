-- =============================================================================
-- 0700 Security: row-level security (RLS) on every table.
--
-- Rules (docs/auth.md):
--   * Nobody who isn't signed in sees anything (the public "anon" key is useless alone).
--   * Signed-in users see data only if they're an ACTIVE employee.
--   * Staff can create/edit ad approvals, templates, comments, and act on suggestions.
--   * Admins/owners can also change thresholds, settings, staff and the checklist.
--   * Synced data (Meta, Retool bridge, sync logs) is written only by background
--     jobs using the service-role key, which bypasses RLS. No browser writes.
-- =============================================================================

create or replace function public.current_employee_id() returns text
language sql stable security definer set search_path = public as $$
  select id from public.employees where auth_user_id = auth.uid() and active
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.employees where auth_user_id = auth.uid() and active)
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.employees
    where auth_user_id = auth.uid() and active and role in ('admin', 'owner')
  )
$$;

-- 1. Turn on RLS everywhere and give active staff read access to every table.
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
    execute format(
      'create policy staff_read on public.%I for select to authenticated using (public.is_staff())',
      t.tablename);
  end loop;
end $$;

-- 2. Staff can write the ad-approval tables and templates.
do $$
declare t text;
begin
  foreach t in array array[
    'ad_reviews', 'ad_review_assets', 'ad_review_comments', 'ad_review_checklist',
    'ad_review_events', 'ad_review_findings', 'ad_creative_templates', 'leadform_templates'
  ] loop
    execute format('create policy staff_insert on public.%I for insert to authenticated with check (public.is_staff())', t);
    execute format('create policy staff_update on public.%I for update to authenticated using (public.is_staff()) with check (public.is_staff())', t);
  end loop;
end $$;

-- Only admins delete approvals/templates (staff archive instead).
create policy admin_delete on public.ad_reviews for delete to authenticated using (public.is_admin());
create policy admin_delete on public.ad_creative_templates for delete to authenticated using (public.is_admin());
create policy admin_delete on public.leadform_templates for delete to authenticated using (public.is_admin());
create policy own_delete on public.ad_review_comments for delete to authenticated
  using (author_id = public.current_employee_id());
create policy staff_delete on public.ad_review_assets for delete to authenticated using (public.is_staff());

-- Staff can add a new ad type (same as Retool today).
create policy staff_insert on public.ad_types for insert to authenticated with check (public.is_staff());

-- 3. Suggestions: staff can change status (Not now / Dismiss). "Do it" actions go
-- through the meta-action function, which uses the service role and logs to actions_log.
create policy staff_update on public.suggestions for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- 4. Audit log: staff may add entries only as themselves; nobody edits or deletes.
create policy staff_insert_self on public.actions_log for insert to authenticated
  with check (public.is_staff() and actor_id = public.current_employee_id());

-- 5. Admin-only settings.
do $$
declare t text;
begin
  foreach t in array array['rule_settings', 'app_settings', 'review_checklist_items', 'employees',
                           'client_statuses', 'booking_types', 'cta_options'] loop
    execute format('create policy admin_insert on public.%I for insert to authenticated with check (public.is_admin())', t);
    execute format('create policy admin_update on public.%I for update to authenticated using (public.is_admin()) with check (public.is_admin())', t);
    execute format('create policy admin_delete on public.%I for delete to authenticated using (public.is_admin())', t);
  end loop;
end $$;

-- Any NEW table added later must get its own policies. Tests in
-- supabase/tests/security.sql fail if a public table has RLS turned off.
