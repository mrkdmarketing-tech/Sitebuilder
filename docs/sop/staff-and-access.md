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
6. They start as **staff**. To make someone an admin or owner, an owner opens **Settings → Staff** and picks the role (a confirmation box shows what the role can do). Every change is logged with who made it.

## Someone leaves

1. **Settings → Staff → Remove from team** (owners and admins). They lose access straight away, even if signed in, and drop out of every list. (Setting them inactive in Retool's employees table works too, within 15 minutes.)
2. Reassign their clients: on the **Clients** page (straight away), or in GHL (**Assigned to**, picked up within 15 minutes). Their open suggestions move to the new ads manager.
3. If they ever had access to Meta Business settings, Supabase, Cloudflare or Retool admin, remove it there and follow [tokens-and-secrets.md](tokens-and-secrets.md#someone-with-access-leaves).

## Roles

Set in **Settings → Staff** (owners and admins only):

| Role | Can |
|---|---|
| Staff | See all insights and their own suggestions, use ad approval |
| Admin | Also see everyone's suggestions, change thresholds, change staff roles (not owners) |
| Owner | Same as admin, and make or change owners |

Rules, enforced by the database: only owners can make or change owners, there must always be at least one owner, and you can't remove yourself. Names and emails can't be edited in The Lab; they come from Retool. "Remove from team" in The Lab wins over Retool.

The same screen shows who has **signed in** yet and how many Active/New clients each ads manager has in GHL, which is a quick way to spot someone missing an email or clients.

## Email doesn't match

If two staff records share an email, The Lab blanks it on the copy (emails are used for sign-in). Fix the duplicate in Retool; it's picked up on the next copy.
