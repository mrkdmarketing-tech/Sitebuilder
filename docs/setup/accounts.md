# Account setup (for Jordan / Trent)

Step-by-step for the accounts the platform needs. Do them in order. **Never paste passwords, tokens or connection strings into chat, Slack or the repo**; each step says where they go instead.

## Progress

| Step | Status |
|---|---|
| Supabase project | **Done** (9 Nov 2026). Project ref `mhayvuxqrlwyvalceerw`, region Canada (Central), PostgreSQL 17. |
| Database installed | **Done.** All migrations applied and verified: 36 tables, row-level security on every table, 84 access rules, private `ad-assets` bucket, thresholds and checklist loaded. Supabase security advisor clean apart from 4 intended items (see [auth.md](../auth.md#supabase-security-advisor)). |
| Supabase access token for Claude | **Done.** Stored encrypted in the `mrkd-sitebuilder` Claude cloud environment (never in chat or the repo). Expires after 7 days; make a new one when asked. |
| Retool DB connection (`RETOOL_DB_URL`) | To do |
| Cloudflare | To do |
| Meta System User | To do (Phase 1a) |
| GHL menu link + sign-on | To do (Phase 0) |

**How Claude installs database changes:** with the access token above, through Supabase's management API. Each migration file in `supabase/migrations/` runs as one all-or-nothing step and is recorded in `supabase_migrations.schema_migrations`, the same table the Supabase CLI uses, so either method can be used later.

## 1. Supabase (database, logins, background jobs): about 10 min

1. Go to **supabase.com** → **Start your project** → sign up with Google.
2. Create an **organization** called "MRKD Marketing" and choose the **Pro** plan ($25/month).
3. **New project:**
   - Name: `mrkd-platform`
   - Database password: click **Generate**, then **save it in your password manager**. Don't send it to anyone.
   - Region: **East US (North Virginia)**
4. Wait for it to finish (a couple of minutes).
5. Go to **Project Settings → API** and send Claude these two (both are safe to share):
   - **Project URL** (`https://xxxx.supabase.co`)
   - **anon / publishable key**
6. **Do not** share the **service_role** key.

## 2. Cloudflare (hosting the app): about 5 min, free

1. Sign up at **dash.cloudflare.com** (free plan).
2. That's it for now. In Phase 0 we connect it to the GitHub repo so every change goes live automatically, and point `app.mrkdmarketing.com` (or whatever you choose) at it.

## 3. Retool Database connection (for the bridge): about 5 min

1. In Retool, open **Database** → look for **Connect** / connection settings → copy the **PostgreSQL connection string**.
2. In Supabase → **Project Settings → Edge Functions → Secrets** → **Add new secret**:
   - Name: `RETOOL_DB_URL`
   - Value: the connection string
3. Done. Don't paste it anywhere else.

## 4. Meta System User (permanent access to ad accounts): about 15 min

Done in Phase 1a; Claude will walk through it live. Overview:
1. **business.facebook.com** → MRKD's Business Manager → **Business settings → Users → System users → Add** (name: `mrkd-platform`, role: Admin).
2. **Add assets** → Ad accounts → select every client ad account → permissions: **Manage ad accounts** (needed for "Turn off").
3. **Generate new token** → choose the app → permissions `ads_read`, `ads_management`, `business_management` → copy the token.
4. Supabase → Edge Functions → Secrets → `META_SYSTEM_USER_TOKEN` = the token.

## 5. GoHighLevel (sidebar item + sign-on): about 10 min

Done in Phase 0 with Claude:
1. Agency admin access to add a **Custom Menu Link** (visible only in MRKD's agency view / own sub-account, never client sub-accounts).
2. Access to MRKD's GHL **marketplace app** settings, to add the app page and get its shared secret for single sign-on (stored as a Supabase secret).

## Checklist

- [ ] Supabase project created (Pro), URL + anon key sent
- [ ] Cloudflare account created
- [ ] `RETOOL_DB_URL` secret added in Supabase
- [ ] Meta System User token added (Phase 1a)
- [ ] GHL menu link + marketplace app access (Phase 0)
