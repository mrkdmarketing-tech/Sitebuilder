# Logins, roles and permissions

## Who can sign in

Only **active employees** (`employees.active = true`). Anyone else who manages to sign in sees nothing, because the database blocks it. Clients never have access.

## How people sign in (live once Google is set up, see [setup/hosting-and-signin.md](setup/hosting-and-signin.md))

Now: **Continue with Google** (restricted to @mrkd.ca) and an **email sign-in code** as backup (the email has a 6-digit code and a link; the code signs in the device it's typed on, which avoids the iPhone home-screen app vs Safari problem). Sessions don't expire on their own (no time limit or idle timeout), so people stay signed in on each device. The built-in email sender allows only 2 sign-in emails per hour project-wide, which is a reason to switch to Google sign-in. The login is linked to the staff record with the same email on first sign-in (migration 1400). GHL single sign-on inside the GHL sidebar comes later, as planned below.

## Planned: sign-in inside GHL

| Where | How |
|---|---|
| **Inside GHL** (sidebar item) | **Single sign-on through GHL.** The page is part of MRKD's existing GHL marketplace app; GHL tells us which GHL user is looking, and since `employees.id` *is* the GHL user id, they're signed in automatically. No separate password. |
| **Direct link** (phones, home-screen app) | **Sign in with Google** (or an email magic link) using the email on their `employees` row. Stays signed in. |

On first sign-in, the person's Supabase login is linked to their `employees` row (`auth_user_id`).

Both go through **Supabase Auth**. The GHL sign-on step runs in a small Edge Function that verifies GHL's signed user data with the marketplace app's shared secret before creating the session. Implementation: Phase 0.

Why not just Google inside GHL too: Safari blocks logins inside embedded pages often enough to be annoying; GHL sign-on avoids it.

## Two-step sign-in

Owners and admins confirm each sign-in with a 6-digit code from an authenticator app (Supabase MFA, TOTP); staff can turn it on in Settings. Screens: `web/src/app/MfaGate.tsx`, `web/src/features/settings/TwoStepCard.tsx`. The database enforces it: `is_admin()` is true only when the session was confirmed with the code (`mfa_ok()`, JWT `aal` = `aal2`; migration 2600), so every owner/admin rule needs it. Owners/admins can reset someone's (lost phone) with `reset_two_step()`; status shows in Settings → Staff. Procedures: [sop/security.md](sop/security.md).

## Roles

| Role | Can |
|---|---|
| `staff` | See all insights, but **only their own suggestions** (accounts assigned to them in GHL). Create/edit ad approvals, templates and comments. Snooze/dismiss suggestions and use "Turn off". Add new ad types. |
| `admin` | Everything staff can, plus change thresholds, settings, the review checklist, staff list and lookup lists. Delete approvals/templates. |
| `owner` | Same as admin (kept separate so owners can't be demoted by admins later). |

Roles are changed in **Settings → Staff** through `set_employee_role()` (migration 2300): owners and admins can change roles, only owners can make or change owners, the last owner can't be demoted, and every change is logged (`actions_log`, `staff.role`). A trigger blocks any other edit of `employees` from the app; names, emails, ads manager and active come from Retool. New employees default to `staff`.

## How it's enforced

Row-level security (RLS) policies in [`…0700_security.sql`](../supabase/migrations/20261109000700_security.sql):

- **Every** table has RLS on. A database test fails if one doesn't.
- **Read:** any active employee, except **suggestions**: staff see only rows where `manager_id` is them; admins/owners see all (migration 0900).
- **Write:** only where listed above. Synced tables (Meta, Retool bridge, sync logs) can't be written from the browser at all, only by background jobs using the service role.
- **Audit log:** staff can only add entries as themselves; nobody can edit or delete entries.
- **Files** (ad images/videos): private bucket, staff only, short-lived signed links.

Tested in [`supabase/tests/security.test.sql`](../supabase/tests/security.test.sql): not signed in → nothing; signed in but not an employee → nothing; staff → can read and create reviews but not change thresholds or Meta data; owner → can change thresholds.

## Performance note

Policies must call the helpers as `(select public.is_staff())`, not `public.is_staff()`, or Postgres runs them once per row and reports time out (migration 1500). New policies should follow the same pattern.

## Supabase security advisor

Run after every database change. As of 9 Nov 2026 the only items left are 4 intended warnings: `is_staff()`, `is_admin()`, `current_employee_id()` and `me()` can be called by signed-in users. They must be, because the access rules and the app use them, and each one only returns the caller's own employee record. Signed-out visitors can't call them (migration 1000).

## Keys and secrets

| Thing | Where it lives | Safe in the browser? |
|---|---|---|
| Supabase URL + **anon** key | `web/.env.local`, Cloudflare env vars | Yes, by design. RLS protects the data. |
| Supabase **service role** key | Supabase only (auto-provided to Edge Functions) | **Never** |
| Meta, Retool DB, Claude, cron secrets | Supabase Edge Function secrets | **Never** |
