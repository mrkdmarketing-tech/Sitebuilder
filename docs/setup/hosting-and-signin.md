# Hosting (Cloudflare Pages) and Google sign-in

## Cloudflare Pages: build settings

Cloudflare builds the app from the GitHub repo on every push and serves it. It only holds the app's screens; all data stays in Supabase behind sign-in and row-level security ([auth.md](../auth.md)).

| Setting | Value |
|---|---|
| Repository | `mrkdmarketing-tech/Sitebuilder` |
| Production branch | `claude/retool-overview-hsg1ch` (switch to `main` once the work is merged) |
| Framework preset | None |
| Build command | `npm run build` |
| Build output directory | `web/dist` |
| Root directory | *(leave blank: repo root)* |
| Environment variables | None needed. Node version comes from `.nvmrc` (22). Supabase URL and publishable key are in `web/.env.production` (both public by design). |

`web/public/_redirects` sends every path to the app so links like `/suggestions` work when opened directly.

**Optional, recommended: Cloudflare Access** (free for up to 50 users). Zero Trust → Access → Applications → Add → Self-hosted → the app's domain → policy "Emails ending in `@mrkd.ca`". Then nobody outside MRKD even sees the sign-in page. Check that it doesn't block the app inside GHL before turning it on there.

## Google sign-in (staff use their @mrkd.ca Google account)

Done once by someone with admin access to MRKD's Google Workspace.

1. **console.cloud.google.com** (signed in with an @mrkd.ca admin account) → create a project **MRKD Platform**.
2. **Google Auth Platform → Branding** (older menus: APIs & Services → OAuth consent screen): app name **MRKD Platform**, support email, then **Audience → Internal**. *Internal* means only @mrkd.ca Google accounts can sign in.
3. **Clients → Create client** (older: Credentials → Create credentials → OAuth client ID):
   - Application type: **Web application**, name **MRKD Platform**
   - **Authorized redirect URI:** `https://mhayvuxqrlwyvalceerw.supabase.co/auth/v1/callback`
   - **Create**, then copy the **Client ID** and **Client secret**.
4. **Supabase → Authentication → Sign In / Providers → Google**: turn on, paste the Client ID and Client secret, **Save**. The secret goes only there, never in chat.

Claude then sets Supabase's **Site URL** and allowed redirect URLs to the Cloudflare address.

## How sign-in works

- **Continue with Google** (asks Google for an @mrkd.ca account) or **Email me a sign-in link** (backup; Supabase's built-in email sender allows only a few emails per hour, so Google is the main way in).
- First sign-in creates a login; the database links it to the staff record with the same email (migration 1400). Staff records come from Retool's `employees` table (all six use @mrkd.ca).
- A login whose email isn't on the staff list sees "Not on the MRKD staff list" and no data.
- Sign out: click your initials in the top bar.
