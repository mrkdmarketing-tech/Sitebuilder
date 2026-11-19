# Open items

Everything that's waiting, who it's waiting on, and where the steps are. Updated 19 Nov 2026. Tick off by editing this file in the same change that finishes the item.

## Waiting on Jordan / Trent

| Item | Unlocks | Steps |
|---|---|---|
| Slack webhook for #mrkd-internal-app (`SLACK_APPROVALS_WEBHOOK_URL`) | Ad approval messages (new ad, changes requested, approved) | [sop/tokens-and-secrets.md](sop/tokens-and-secrets.md#connect-slack-ad-approval-messages) |
| Team moves off Retool's Ad Preview and Meta Ads Insights | Retool can be retired for those (4 ads still went through Retool the week of 11 Nov) | [sop/ad-approval-submit.md](sop/ad-approval-submit.md), [sop/acting-on-suggestions.md](sop/acting-on-suggestions.md) |
| Try one real Turn off and Undo on Today | Confirms the Meta read-back live | [sop/acting-on-suggestions.md](sop/acting-on-suggestions.md) |
| GB Whiterock ad account: give MRKDPlatformTools Manage campaigns | Turn off on that account | [setup/meta-access-checklist.md](setup/meta-access-checklist.md) |
| GB Cloverdale and GB Renton Facebook Pages: ask the clients to share them with MRKD | Turn off on their lead ads | [setup/meta-access-checklist.md](setup/meta-access-checklist.md) |
| Double Five: settle the ad account balance | Meta allows changes again | Ads Manager → Billing |
| Meta developer status + admin of the Meta app, then `pages_manage_ads` on the token (optional) | Lead form search; later, pushing approved ads to Meta | [setup/meta-access-checklist.md](setup/meta-access-checklist.md#3-token-only-if-lead-form-search-is-wanted) |
| Claude API key (optional, about $1 to $5 a month) | Reading text inside ad images on Submit | [sop/tokens-and-secrets.md](sop/tokens-and-secrets.md#add-the-claude-key-ai-ad-check) |
| Google sign-in | No more email codes, no 2-per-hour email limit | [setup/hosting-and-signin.md](setup/hosting-and-signin.md#google-sign-in-staff-use-their-mrkdca-google-account) |
| Two-step for Trent; Adam and Zohirul to sign in | Owner actions for Trent; staff using Today | [sop/security.md](sop/security.md), [sop/signing-in.md](sop/signing-in.md) |
| SEO pilot: pick 2 or 3 WordPress clients; admin access to their sites | Automatic SEO fixes | [seo.md](seo.md) |
| Elite Team Monterey: share its Meta ad account with MRKD (system user MRKDPlatformTools), then link it on Clients | It shows on Insights (it's Active, but has no ad account in The Lab) | [sop/new-client-or-ad-account.md](sop/new-client-or-ad-account.md) |
| AACE and Barrhaven: confirm Inactive (set in The Lab 16 Nov) or switch back on Clients | Status matches GHL | [ghl.md](ghl.md#19-nov-2026-status-from-ghl) |
| Tidy GHL: clients changed in The Lab, test contact "Business Name", 7 email-only contacts with a Client Status | GHL and The Lab agree | [ghl.md](ghl.md#first-run-12-nov-2026) |
| New Level Grappling's website certificate is broken; Marcus Aurelio's website address in GHL is wrong | Their sites and SEO | [seo.md](seo.md) |
| Renew Claude's Supabase access token before it expires (made 18 Nov) | Claude can keep deploying | [sop/tokens-and-secrets.md](sop/tokens-and-secrets.md#renew-claudes-supabase-access-token) |

## Next to build (Claude), when agreed

| Item | Notes |
|---|---|
| Switch the rest of client data to GHL directly | Status, ads manager and new clients already come from GHL (19 Nov); name, city and website still from Retool ([ghl.md](ghl.md)) |
| More Ad Studio styles | Next candidates: COMIC, KJB, GBP, KCE, F15, CK/KS, GRG, LS ([ad-studio.md](ad-studio.md)) |
| Client photos and new people in Ad Studio (Higgsfield, with approval) | Never send photos of minors to AI |
| Lead quality next to CPL (booked rate, cost per booking / sale) | Data already in `sheet_leads` |
| Fair within-account comparisons in What's working | So one big account can't skew a row |
| Budget pacing on Today | Monthly budgets are in onboarding data |
| ClickUp task on approval; LeadLabz website campaign requests | Ad approval extras |
| Writing back to GHL (status, ads manager) | Off until Jordan says go |
| Claude connector (ask Claude about your own accounts) | [claude-connector.md](claude-connector.md) |
| GHL sidebar link + GHL sign-on; own web address | Phase 0 leftovers ([plan.md](plan.md)) |
