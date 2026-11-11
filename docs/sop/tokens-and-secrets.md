# SOP: Tokens and secrets

**Who:** owners (Jordan, Trent). **When:** a token expires, may have leaked, or someone with access leaves. Check the dates below every quarter.

All secrets live in **Supabase → Edge Functions → Secrets** (supabase.com/dashboard/project/mhayvuxqrlwyvalceerw/functions/secrets). Never in chat, Slack, email, GitHub or ClickUp.

## What exists

| Secret | What it is | Expires | Used for |
|---|---|---|---|
| `META_SYSTEM_USER_TOKEN` | Meta system user **MRKDPlatformTools** token | Never | Meta sync, Turn off |
| `RETOOL_DB_URL` | Retool Database connection string | When Retool's DB password is reset | Copying from Retool |
| `ANTHROPIC_API_KEY` | Claude API key (not added yet) | When revoked | AI ad check |
| `CRON_SECRET` | Random string that lets the schedule start jobs | Never | Scheduled jobs (also stored in Supabase Vault) |
| `SLACK_APPROVALS_WEBHOOK_URL` | Slack incoming webhook for #mrkd-internal-app | When the Slack app is removed | Ad approval messages |
| `TYPESAFE_API_KEY` | TypeSafe AI key for the Jev model | When revoked | Ad tagging, Insights → What's working |
| Supabase access token `mrkd-sitebuilder-claude-3` | Lets Claude deploy changes | **16 Nov 2026**, renew before | Claude's cloud environment only |

## Replace the Meta token

1. Follow [../setup/meta.md](../setup/meta.md) step 4 (Generate token on MRKDPlatformTools, same scopes, Never expires).
2. In Supabase Secrets, edit `META_SYSTEM_USER_TOKEN`, paste the new value, **Save**.
3. Business settings → System users → MRKDPlatformTools → **Revoke tokens** for the old one (only after step 2).
4. Within 30 minutes, **Sync status** should show a green Meta sync.

## Retool connection changed

If someone clicked **Reset password** on Retool's Database Connection screen, the copy from Retool stops ("Retool copy failed" on Sync status). Copy the new **Postgres connection URL** (Retool → Database → Settings → Connection) into the `RETOOL_DB_URL` secret.

## Connect Slack (ad approval messages)

The Lab posts in **#mrkd-internal-app** when an ad is submitted (tags the reviewer), sent back or approved (tags whoever made it). It needs one Slack link:

1. Go to **api.slack.com/apps** (signed in to MRKD's Slack) → **Create New App** → **From scratch**. Name it **The Lab**, pick the MRKD workspace, **Create App**.
2. Left menu → **Incoming Webhooks** → switch **Activate Incoming Webhooks** on.
3. **Add New Webhook** (bottom of the page) → choose **#mrkd-internal-app** → **Allow**.
4. Click **Copy** next to the new Webhook URL (starts with `https://hooks.slack.com/services/`). Treat it like a password: anyone with it can post in the channel.
5. In Supabase Secrets, **Add new secret**: name `SLACK_APPROVALS_WEBHOOK_URL`, paste the URL, **Save**.
6. Submit a test ad in The Lab. The message should appear within a few seconds.

To stop the messages, delete the secret (or remove the app in Slack). If the link leaks: in the Slack app's Incoming Webhooks page, remove that webhook, add a new one, and replace the secret.

## Add the TypeSafe key (Jev ad tagging)

1. Go to **console.typesafe.ai** and sign in or create an account (use MRKD's email, not a personal one).
2. Add billing if it asks. The first tagging of every ad costs about 10 cents; after that, a few cents a month. Set a monthly limit (for example $10) if the console offers one.
3. **API keys** → **Create key**, name it "The Lab ad tagging", and copy it. Treat it like a password.
4. In Supabase Secrets, **Add new secret**: name `TYPESAFE_API_KEY`, paste the key, **Save**.
5. The next hourly run (at :50) starts tagging. Check **Sync** for "Ad tagging (Jev)", then Insights → **What's working**.

If the key leaks: delete it in the TypeSafe console, create a new one, and replace the secret.

## Add the Claude key (AI ad check)

1. **console.anthropic.com** (MRKD's account) → API keys → **Create key**, name it "The Lab ad check".
2. Set a monthly spend limit in **Billing → Limits** (for example $50).
3. Add it in Supabase Secrets as `ANTHROPIC_API_KEY`. The ad check starts working straight away.

## Someone with access leaves

1. Remove them from Meta Business settings, Supabase (Organization → Members), Cloudflare, Retool and GitHub.
2. If they could have seen a secret, replace it (steps above). The Meta token and Claude key are the important ones.
3. Supabase access tokens are personal: remove theirs in Supabase → Account → Access Tokens.

## A secret may have leaked

Replace it straight away using the steps above, revoke the old one, and check **Sync status** for anything unusual. Tell Jordan.
