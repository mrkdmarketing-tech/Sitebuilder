-- =============================================================================
-- 1400 Link sign-ins to staff records (docs/auth.md).
--
-- When someone signs in for the first time (Google or email link), Supabase
-- creates an auth.users row. This trigger finds the ACTIVE employee with the
-- same email (case-insensitive) and stores the login on employees.auth_user_id.
-- Anyone whose email isn't on the staff list gets a login but no employee
-- link, so row-level security shows them nothing.
-- =============================================================================
create or replace function private.link_employee_login() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.email is null then
    return new;
  end if;
  update public.employees
     set auth_user_id = new.id
   where lower(email) = lower(new.email)
     and active
     and (auth_user_id is null or auth_user_id = new.id);
  return new;
end $$;
revoke all on function private.link_employee_login() from public, anon, authenticated;

drop trigger if exists on_auth_user_link_employee on auth.users;
create trigger on_auth_user_link_employee
  after insert or update of email on auth.users
  for each row execute function private.link_employee_login();

-- Link anyone who already signed in before this existed.
update public.employees e set auth_user_id = u.id
from auth.users u
where lower(u.email) = lower(e.email) and e.active and e.auth_user_id is null;
