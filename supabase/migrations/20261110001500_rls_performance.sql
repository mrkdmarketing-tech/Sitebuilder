-- =============================================================================
-- 1500 Faster access checks (same rules).
--
-- Policies called is_staff() / is_admin() / current_employee_id() directly,
-- which Postgres runs once PER ROW. Reports read tens of thousands of rows, so
-- the dashboard hit the 8-second limit for signed-in users. Wrapping each call
-- as (select …) makes Postgres run it once per query (Supabase's recommended
-- pattern). The rules themselves don't change; supabase/tests/security.test.sql
-- still checks them.
-- =============================================================================
do $$
declare
  p record;
  new_qual text;
  new_check text;
  fix constant text := '(public\.)?(is_staff|is_admin|current_employee_id)\(\)';
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname in ('public', 'storage')
      and (coalesce(qual, '') ~ fix or coalesce(with_check, '') ~ fix)
  loop
    new_qual := case when p.qual is null then null
                     else regexp_replace(p.qual, fix, '(select public.\2())', 'g') end;
    new_check := case when p.with_check is null then null
                      else regexp_replace(p.with_check, fix, '(select public.\2())', 'g') end;
    if new_qual is not null and new_check is not null then
      execute format('alter policy %I on %I.%I using (%s) with check (%s)', p.policyname, p.schemaname, p.tablename, new_qual, new_check);
    elsif new_qual is not null then
      execute format('alter policy %I on %I.%I using (%s)', p.policyname, p.schemaname, p.tablename, new_qual);
    else
      execute format('alter policy %I on %I.%I with check (%s)', p.policyname, p.schemaname, p.tablename, new_check);
    end if;
  end loop;
end $$;

-- Lead-sheet outcomes are filtered by date for every report.
create index if not exists sheet_leads_date_idx on public.sheet_leads (date_added) where active;
