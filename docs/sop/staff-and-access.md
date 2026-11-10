# SOP: Adding or removing staff

**Who:** an owner or admin. **When:** someone joins, leaves, or changes role.

## How staff records work

- The staff list comes from **Retool's `employees` table** and is copied into The Lab every 15 minutes. An employee's id is their **GHL user id**.
- A person can sign in only if they are **active** on the staff list and sign in with the **same email** as their record.
- Roles (`staff`, `admin`, `owner`) are set **in The Lab**, not Retool. See [../auth.md](../auth.md#roles).

## Someone joins

1. Add them as a user in **MRKD's GHL** (so they have a GHL user id).
2. Add them to **Retool's employees** table as you do today (first name, last name, @mrkd.ca email, GHL user id, "is ad manager" if they run ads).
3. Wait up to 15 minutes, then check they appear in The Lab: **Insights**, Ads manager filter (ads managers only) or ask them to sign in.
4. Ask them to follow [signing-in.md](signing-in.md).
5. To give them clients, set them as **Assigned to** on each client's contact in MRKD's GHL. Their suggestions follow automatically.
6. They start as **staff**. To make someone an admin or owner, ask Jordan; a role change is never made without the owners' approval. It's done in Supabase (Table editor, `employees`, `role` column) until The Lab has a staff screen.

## Someone leaves

1. In Retool's employees table, set them **inactive** (or remove them). Within 15 minutes they can no longer see any data in The Lab, even if still signed in.
2. In GHL, reassign their clients (**Assigned to**). Their open suggestions move to the new ads manager on the next copy.
3. If they ever had access to Meta Business settings, Supabase, Cloudflare or Retool admin, remove it there and follow [tokens-and-secrets.md](tokens-and-secrets.md#someone-with-access-leaves).

## Email doesn't match

If two staff records share an email, The Lab blanks it on the copy (emails are used for sign-in). Fix the duplicate in Retool; it's picked up on the next copy.
