-- =============================================================================
-- 1000 Hardening (from Supabase's security advisor, Nov 2026).
--
-- 1. Pin search_path on every function in public, so a function can't be
--    tricked into using a same-named object from another schema.
-- 2. Signed-out visitors (anon) can't call the security-definer helpers at all.
--    Signed-in users still can: row-level security policies call is_staff(),
--    is_admin() and current_employee_id(), and the app calls me(). Each of
--    those only ever reveals the caller's own employee record.
-- 3. The trigger function isn't callable directly by anyone.
-- Docs: docs/auth.md
-- =============================================================================
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
  loop
    execute format('alter function %s set search_path = public, pg_temp', f.sig);
  end loop;
end $$;

revoke execute on function public.is_staff() from public, anon;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.current_employee_id() from public, anon;
revoke execute on function public.me() from public, anon;
revoke execute on function public.sync_suggestion_manager() from public, anon, authenticated;
