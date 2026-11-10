# Standard operating procedures

Step-by-step instructions for running MRKD on **The Lab** (https://sitebuilder-6iw.pages.dev). Each SOP says who does it, how often, and exactly what to click.

The other docs explain how The Lab is built. These explain how to **use and run** it.

## For everyone (ads managers)

| SOP | When |
|---|---|
| [Signing in](signing-in.md) | First day, new phone, or "Not on the MRKD staff list" |
| [Daily account check](daily-account-check.md) | Every working morning |
| [Acting on suggestions (Turn off, Not now, Dismiss)](acting-on-suggestions.md) | Every working day, after the account check |
| [Submitting an ad for approval](ad-approval-submit.md) | Every new ad or ad change |
| [Reviewing an ad](ad-approval-review.md) | When an ad is waiting for your review |

## For owners and admins

| SOP | When |
|---|---|
| [Adding or removing staff](staff-and-access.md) | Someone joins or leaves |
| [New client or new ad account](new-client-or-ad-account.md) | A client is onboarded, paused or leaves, a new ad account is created, or a client moves to another ads manager |
| [Changing suggestion thresholds](changing-thresholds.md) | Suggestions are too noisy or too quiet |
| [Tokens and secrets](tokens-and-secrets.md) | A token expires, leaks, or someone with access leaves |
| [Weekly health check](weekly-health-check.md) | Every Monday |
| [Troubleshooting](troubleshooting.md) | Something looks wrong |

## Rules that apply to every SOP

1. **Never paste a token, password or connection string** into chat, Slack, email, ClickUp or GitHub. Secrets go only into the Supabase secrets screen (or the secure form Claude shows).
2. **The Lab never changes a live ad on its own.** Ads only change when a person clicks Turn off and confirms.
3. **Retool is read-only from The Lab.** Clients View, Onboarding and LeadLabz still run in Retool until they are moved. Don't click "Reset password" on Retool's database Connection screen; it breaks the copy into The Lab.
4. **Who looks after a client comes from GHL**, unless an owner or admin changed it on The Lab's **Clients** page (Lab changes win). GHL changes are picked up within 15 minutes.
5. If an SOP is wrong or out of date, fix the doc in the same change as the app (see [../development.md](../development.md)).
