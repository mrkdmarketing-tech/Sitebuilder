# SOP: Security

**Who:** owners (Jordan, Trent). **When:** set up once (checklist below), then review every quarter with [tokens-and-secrets.md](tokens-and-secrets.md).

## How The Lab protects data

| Protection | What it means |
|---|---|
| Staff only | Only active people on the staff list see anything. Removing someone (Settings → Staff) cuts access at once. |
| Rules in the database | Row-level security on every table: ads managers see only their own suggestions; only owners/admins change settings, roles and clients. Tested automatically ([../auth.md](../auth.md)). |
| Two-step sign-in for owners and admins | They confirm each sign-in with a 6-digit code from an authenticator app. The database refuses owner/admin actions without it. |
| No secrets in the browser | Meta, Retool and Claude keys live only in Supabase secrets ([tokens-and-secrets.md](tokens-and-secrets.md)). |
| Everything logged | Turn off, roles, team, clients, thresholds: who and when, in a log nobody can edit. |
| Live ads never change by themselves | Turn off always needs a person to click and confirm. |

## Setup checklist (owners)

| # | Step | Who | Status |
|---|---|---|---|
| 1 | **Two-step sign-in in The Lab** for owners and admins | Built (11 Nov 2026). Jordan and Trent: set it up at your next sign-in | Live |
| 2 | **2-Step Verification for every @mrkd.ca Google account** | Google Workspace admin | To do |
| 3 | **Google sign-in** for The Lab ([../setup/hosting-and-signin.md](../setup/hosting-and-signin.md#google-sign-in-staff-use-their-mrkdca-google-account)) | Google Workspace admin, then Claude checks | To do (last) |
| 4 | **Switch off email-link sign-in** once Google sign-in works | Ask Claude | After 3 |
| 5 | **2FA on the accounts behind The Lab**: Supabase, Cloudflare, GitHub, Meta Business, Retool, GHL | Each account owner | To do |
| 6 | Optional: **Cloudflare Access** (only @mrkd.ca can load the page at all) | Owner, with Claude | Later; test with GHL first |

### 2. Google 2-Step Verification (about 5 minutes)

1. **admin.google.com** (signed in as an @mrkd.ca admin) → **Security** → **Authentication** → **2-Step Verification**.
2. Tick **Allow users to turn on 2-Step Verification**.
3. **Enforcement: On**, starting from a date a week out so everyone has time to set it up. **Save**.
4. Tell the team in Slack to turn it on at **myaccount.google.com → Security → 2-Step Verification**.

Once on, both ways into The Lab (Google sign-in and email links, which land in that same inbox) are behind 2-step.

### 5. 2FA on the behind-the-scenes accounts

Whoever has access to each should turn on 2FA (authenticator app, not SMS, where offered):

| Account | Where |
|---|---|
| Supabase | supabase.com → Account → Security → Multi-factor authentication. Owners can also require it for the organization. |
| Cloudflare | dash.cloudflare.com → My Profile → Authentication → Two-Factor Authentication |
| GitHub | github.com → Settings → Password and authentication → Two-factor authentication |
| Meta Business | business.facebook.com → Business settings → Security Center → Two-factor authentication: **Required for everyone** |
| Retool | Retool → Settings → Account → Two-factor authentication (admins can require it) |
| GHL | Profile → My Staff / Profile → Two-factor authentication |

These matter more than The Lab itself: each one has full access to something important.

### 6. Cloudflare Access (optional)

Zero Trust → Access → Applications → Add → Self-hosted → `sitebuilder-6iw.pages.dev` → policy "Emails ending in @mrkd.ca". Then nobody outside MRKD even sees the sign-in page. **Test inside GHL before relying on it**: it can block the page when shown in GHL's sidebar.

## Two-step sign-in in The Lab

- **Owners and admins:** required. The first sign-in after it went live (11 Nov 2026) shows **Set up two-step sign-in**: install an authenticator app (Google Authenticator, Microsoft Authenticator, Authy or 1Password), scan the QR code, enter the 6-digit code. After that, every sign-in asks for the code.
- **Staff:** optional, recommended. **Settings → Two-step sign-in → Turn on**.
- **New phone:** Settings → Two-step sign-in → **Move to a new phone** (while you still have the old one).
- **Lost phone:** another owner or admin opens **Settings → Staff → Reset two-step** on that person. They set it up again at their next sign-in. You can't reset your own, so with two owners each can reset the other. If both owners lose their phones, a developer can clear it in Supabase (SQL: `delete from auth.mfa_factors where user_id = '<their auth id>'`).
- Without the code, an owner or admin can't do owner/admin things (roles, team, clients, thresholds, everyone's suggestions), even by calling the database directly (migration 2600, `is_admin()` needs a confirmed session).
- Who has it on: Settings → Staff ("Two-step on" / "Two-step off"). Resets are logged.
