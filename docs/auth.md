# Logins, roles and permissions

## Who can sign in

Only **active employees** (`employees.active = true`). Anyone else who manages to sign in sees nothing, because the database blocks it. Clients never have access.

## How people sign in (Phase 0)

| Where | How |
|---|---|
| **Inside GHL** (sidebar item) | **Single sign-on through GHL.** The page is part of MRKD's existing GHL marketplace app; GHL tells us which GHL user is looking, and since `employees.id` *is* the GHL user id, they're signed in automatically. No separate password. |
| **Direct link** (phones, home-screen app) | **Sign in with Google** (or an email magic link) using the email on their `employees` row. Stays signed in. |

On first sign-in, the person's Supabase login is linked to their `employees` row (`auth_user_id`).

Both go through **Supabase Auth**. The GHL sign-on step runs in a small Edge Function that verifies GHL's signed user data with the marketplace app's shared secret before creating the session. Implementation: Phase 0.

Why not just Google inside GHL too: Safari blocks logins inside embedded pages often enough to be annoying; GHL sign-on avoids it.

## Roles

| Role | Can |
|---|---|
| `staff` | See everything. Create/edit ad approvals, templates and comments. Snooze/dismiss suggestions and use "Turn off". Add new ad types. |
| `admin` | Everything staff can, plus change thresholds, settings, the review checklist, staff list and lookup lists. Delete approvals/templates. |
| `owner` | Same as admin (kept separate so owners can't be demoted by admins later). |

Roles are set on the `employees` row by an admin. New employees default to `staff`.

## How it's enforced

Row-level security (RLS) policies in [`…0700_security.sql`](../supabase/migrations/20261109000700_security.sql):

- **Every** table has RLS on. A database test fails if one doesn't.
- **Read:** any active employee.
- **Write:** only where listed above. Synced tables (Meta, Retool bridge, sync logs) can't be written from the browser at all, only by background jobs using the service role.
- **Audit log:** staff can only add entries as themselves; nobody can edit or delete entries.
- **Files** (ad images/videos): private bucket, staff only, short-lived signed links.

Tested in [`supabase/tests/security.test.sql`](../supabase/tests/security.test.sql): not signed in → nothing; signed in but not an employee → nothing; staff → can read and create reviews but not change thresholds or Meta data; owner → can change thresholds.

## Keys and secrets

| Thing | Where it lives | Safe in the browser? |
|---|---|---|
| Supabase URL + **anon** key | `web/.env.local`, Cloudflare env vars | Yes, by design. RLS protects the data. |
| Supabase **service role** key | Supabase only (auto-provided to Edge Functions) | **Never** |
| Meta, Retool DB, Claude, cron secrets | Supabase Edge Function secrets | **Never** |
