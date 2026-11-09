# Feature checklist: everything the Retool tools do today

A line-by-line list of what each live Retool app and workflow does, taken from the Nov 2026 export (every table column, KPI tile, filter, button and background job). **Go through it and mark anything that's wrong, missing or no longer used.** Anything not on this list won't be rebuilt unless someone adds it.

Legend for the "New app" column:
- ✅ **Keep**: rebuilt as is
- ⬆️ **Improve**: rebuilt and made better (note says how)
- ❓ **Decide**: needs your call
- ❌ **Drop**: not rebuilt

Phase numbers refer to [plan.md](plan.md) §5.

> **Current focus:** sections 1 (Meta Ads Insights), 3 (Ad Preview), 5 (Templates) and 6 (Search) are being built now, in Phases 0–2. Everything else **stays in Retool for now** and is marked *Later*.

---

## 1. Meta Ads Insights (the screen in your screenshot)

| Feature | Details today | New app | Phase |
|---|---|---|---|
| Top-level nav | Clients View · Onboarding · LeadLabz · Meta Ads Insights · Ad Preview | ⬆️ One app with a sidebar, inside GHL | 0 |
| Date range | Picker plus presets: today, yesterday, this week, last week, last 7/14/30 days, this month, last month | ✅ | 1a |
| **KPI tiles** | Active Acc. · Leads · CPL · CPM · CR % → second page: CPR · CPLC · Value Generated | ✅ plus comparison vs previous period on every tile | 1a |
| Tabs with counts | Ad Accounts [n] · Campaigns [n] · Adsets [n] · Ads [n] · Leads | ✅ | 1a |
| Ads manager filter | Multi-select, e.g. "Adam Schmidt" | ⬆️ Defaults to the signed-in manager | 1a |
| "Ad Filters & Alerts" | Active-status filter | ✅ Merged into suggestions (M2) | 1a–1b |
| **Ad Accounts table** | Client ID · Account (+ client status badge) · Ad Manager · Status · CPM · CPR · CPL · CPLC · CR % · Spend · Impressions · Reach · Link Clicks · Clicks · Leads · Leads Sheet · Booked · Shown · Closed · Closed Value | ✅ | 1a (booked/shown/closed via Retool bridge) |
| **Campaigns table** | Same metrics + Name · Account · Status · Daily Budget · Buying type · Pacing · Bid Strategy · Objective | ✅ | 1a |
| **Ad sets table** | Same metrics + Campaign · Genders · Age range · Optimization goal · ADV+ · Learning stage | ✅ | 1a |
| **Ads table** | Same metrics + Campaign · Ad set · 🌄 creative thumbnail · CTR · Link CTR · Comments · Page likes · Messages | ✅ | 1a |
| Creative popup | Click 🌄 → image or video thumbnail, title, body, video ID | ⬆️ Also shows its performance and AI notes | 1a |
| **Leads tab** | Name · Email (mailto) · Created at · Form · Ad | ✅ | 1a |
| Click a row → Meta Ads Manager | Opens that account, campaign, ad set or ad in Ads Manager | ✅ | 1a |
| Download CSV / refresh per table | Toolbar buttons | ✅ CSV export. Refresh not needed (live). | 1a |
| "Sync" and "Fetch Creatives" buttons | Manually trigger the Meta sync workflows | ⬆️ Not needed: syncs every 30 min. Admin "sync now" on the sync health page. | 1a |

## 2. Clients View

| Feature | Details today | New app | Phase |
|---|---|---|---|
| Filters | By ads manager (checkboxes), client ID/name, Active clients only, LeadLabz clients only | ✅ | Later |
| Date range | Picker plus presets (stats recalculate) | ✅ | Later |
| Column groups | "Filter Columns by Group": General Information / Leads Data / LeadLabz / Stripe MRKD / Stripe LeadLabz / … | ⬆️ Saved views per person | Later |
| **KPI tiles** | Active Clients · Synced Leads · MRR (000s) · Amount Billed (000s) · Value Generated · Unread Msg MRKD · Unread Msg LeadLabz · Active Sub-accounts | ✅ | 1 (billing tiles 3) |
| **Clients table**: core | ID · Business name · Advertisement (status, editable) · Ad manager · Account type · Ad account status · Ads spend (Meta) · # Leads (Meta) | ✅ | Later |
| Clients table: lead outcomes | Synced leads · Booked · Shown · Closed · Closed in interval · New members · Active members · Upfront cash · Total value · Current MRR · Lead count last 3 days · Leads sync status | ✅ | Later |
| Clients table: messages | Contact unread · Location unread · Contact last msg at · Message type | ✅ | Later |
| Clients table: Stripe LeadLabz (LL) | Last billed · Next billed · Active subs · LTV · Subs amount · Payment method | ✅ | Later |
| Clients table: Stripe MRKD (MM) | Last billed · Next billed · Active subs · LTV · Subs amount · Payment method | ✅ | Later |
| Clients table: LeadLabz | LeadLabz account · Active location | ✅ | Later |
| **Inline edit client status** | Edit "Advertisement" status in the table → Save → pushes to the client's GHL contact | ✅ Logged in audit trail | Later |
| Inline edit location active | Saves to `ghl_locations` | ✅ | Later |
| **Row actions** | Facebook (Ads Manager) · Drive · Zapier · Leads · Onboarding · Sync Leads · Google Sheet · Ad account | ✅ (Zapier link ❓ still used?) | Later |
| Click cell links | Stripe customer · client's GHL contact · LeadLabz sub-account dashboard | ✅ | Later |
| **Client info drawer** | Business + contact details. Buttons: Website, Zapier, FB, G Drive, Assets, Lead Sheet, Leads Data, LeadLabz CRM. Copy details. Click email → Gmail compose. | ✅ | Later |
| **Leads data view** | All leads for a client: date, email, phone, reach-out method, notes/appt date, communication status, appointment status, closed value, date closed, membership value, first payment, date left, campaign/ad set/ad, platform | ✅ | Later |
| **"Show alerts" highlighting** | 🔴 0 leads in 3 days · 🔴 unread messages · 🔴 not billed 14+ days · 🟡 LeadLabz active without subscription | ⬆️ Becomes the suggestions engine (M2) | Later |
| Sync buttons | "Sync GHL data", "Sync leads" | ⬆️ Automatic. Manual button kept for admins. | Later |

## 3. Ad Preview 🤖 (ad approval)

| Feature | Details today | New app | Phase |
|---|---|---|---|
| Ad preview list | Name · Client ID · Business · Ad account · Ad type · Booking type · Created · Completed · Review started/completed · Status. Row action "Mark Complete". Filter by status. | ✅ | 2 |
| Create preview | Pick client → name it → choose ad creative template + lead form template, ad type, booking type | ✅ | 2 |
| **Ad creative form** | Primary text · Headline · Description · CTA · Tracking (pixel etc.) · URL parameters · images (upload or Canva URL, multiple, next/previous/delete) | ✅ | 2 |
| **Lead form form** | Name · Form type (more volume / higher intent / rich creative) · Greeting headline + description · Questions (add/remove) · Privacy policy URL · Thank-you message: headline, description, CTA, URL, additional action · or pick an existing Meta lead form | ✅ | 2 |
| Business info panel | Client's onboarding and GHL data shown beside the form, filterable. LeadLabz booking URL. Pixel ID. Notes (save to GHL). Area callouts (save). | ✅ | 2 |
| **Statuses** | Review Pending → Request Changes → Approved → Completed (split button) | ✅ | 2 |
| Send for review | Choose ads manager → **Slack notification** to them. Separate alerts for first review, review again, changes requested, review completed. | ✅ | 2 |
| Comments | Thread per preview with author, latest comment pinned | ✅ | 2 |
| **Review checklist** | 1 logo · 2 address & phone · 3 spelling · 4 image CTA = headline · 5 image CTA = primary copy · 6 alignment · 7 city matches copy · 8 tracking on · 9 campaign naming · 10 lead forms connected · 11 tell Trent about new lead forms | ⬆️ Real tick-boxes saved per preview | 2 |
| **AI review** | Retool AI reads the text and images and compares them with the client's business data, returning a list of fixes | ⬆️ Claude, run automatically when sent for review | 2 |
| ClickUp card | Zapier webhook creates a card (client, ads manager, formatted brief) | ⬆️ ClickUp API directly | 2 |
| LeadLabz website campaign requests | Table: status, timeline, client, budget, Drive link, ad type, requested by | ✅ | 2 |
| "Fetch LeadForms" | Pulls the client's Meta lead forms | ⬆️ Automatic sync | 1a |

## 4. Clients Onboarding

| Feature | Details today | New app | Phase |
|---|---|---|---|
| Client picker + filter by ads manager, active only | | ✅ | Later |
| General business info | Company name, website, address (street/city/state/country), Google Drive, CRM used, lead nurturing tool, client status, GHL contact ID | ✅ | Later |
| Facebook access | Page ID, page link, pixel ID, ad account name/ID/link, dataset name, monthly budget | ✅ | Later |
| Gym info | What makes the gym special, core values, area callouts | ✅ | Later |
| Instructor info | Name, years of experience, certifications, belts, teaching style | ✅ | Later |
| Programs | Program names, intro offers, sign-up requirements, length/what's included, sessions per week | ✅ | Later |
| Kids program | Age range, class times, free trial (+ details) | ✅ | Later |
| Pricing | Membership fee for 3/6/12 months | ✅ | Later |
| **Campaign specifics** (up to 2 per client, plus table of existing) | Name · Ad type (or add new type) · Monthly budget + optional upper limit · CTA · Goals & objective · Landing page · Booking calendar link · Area callouts · Marked-area image (upload, override) · Access to push leads + details · Lead goals · Follow-up process · Ads lead flow · Integration details · CRM integrated? + details · Who handles leads | ⬆️ No 2-campaign limit. Adds target CPL. | Later |
| Push updates to GHL | "Push updates" writes changes to the client's GHL contact, with a changes preview | ✅ | Later |
| Sync GHL contact data | Button | ⬆️ Automatic | Later |

## 5. Meta Ad Components Templates

| Feature | New app | Phase |
|---|---|---|
| Lead form templates: add/update (questions, form type, CTA, greeting, thank-you) | ✅ | 2 |
| Ad creative templates: add/update (primary text, headline, description, CTA) with custom-field placeholders (Field key / Label list from GHL) | ✅ | 2 |

## 6. Search Meta Lead Forms

| Feature | New app | Phase |
|---|---|---|
| Search lead forms by name / page / content → view context card, privacy policy, thank-you page | ✅ (safe search, fixing the current SQL-injection risk) | 1a |
| Search ad copy by name / account / content → view title, body, CTA, permalink | ✅ | 1a |

## 7. LeadLabz ⚙️ (GHL admin)

| Feature | New app | Phase |
|---|---|---|
| MRKD contacts: general fields + custom fields editor, **editable custom fields** config | ✅ | Later |
| **Assign client #** to a contact (creates `clients` row) | ✅ | Later |
| **Create sub-account** from a snapshot | ✅ with progress and retry | Later |
| Users: list (name, email, type, phone, locations, role, permissions), add user with assigned locations, bulk edit, delete | ✅ | Later |
| **Permission templates**: create/update, apply to users | ✅ | Later |
| Sub-account (location) data editor: general fields, country | ✅ | Later |
| Location **custom values** editor (filterable, bulk) + "Sync CV" | ✅ | Later |
| **Custom value mapping** (static value / contact key / custom field → custom value) | ✅ | Later |
| "Sync GHL" button (wait for Slack alert) | ⬆️ Automatic + webhooks | Later |
| **Onboarding checklist** page (Example Client A/B/C, statuses; looks unfinished) | ❓ Finish it in the new app? | Later |

## 8. Leadlabz (Website) ⚙️

| Feature | New app | Phase |
|---|---|---|
| Website users: email, name, photo, verified, authorized, assigned contacts, add-contact access | ✅ | Later |
| Row actions: Authorize/Deauthorize · Accounts/Contacts access · Reset password · Toggle "Add Contact" access | ✅ | Later |
| Add new user (Firebase + DB) | ✅ | Later |
| Subscription plans: name, details, tag, amount, discount, active | ✅ | Later |
| Client onboarding progress: onboarding / contract / payment flags | ✅ | Later |

## 9. Dev / test apps with features worth keeping

| App | Feature | New app |
|---|---|---|
| Ad Ai Analyzer / Ad Copy Generator | AI ad and lead-form copy from client data + templates + booking type, preview, "submit for approval" | ⬆️ Part of Ad Preview (Phase 2) |
| Test view multi creatives | **Creative analysis**: AI tags each creative (hook, angle, CTA, personas, offer, logo present, people count, areas called out, quality score) and ranks creatives by CPL | ❓ Want this? Great input for suggestions. |
| Go High Level | Bulk edit MRKD and client custom fields/values | ✅ Merged into GHL admin (Later) |
| Leadlabz calendar embed | Generate booking calendar embed HTML | ❓ Still used? |
| Stripe Subscriptions Dash | Raw Stripe subscriptions/customers/invoices tables | ✅ Covered by billing (Later) |
| MRKD Mobile, Untitled-2 | Early mobile attempts | ❌ The new app is mobile-first |

## 10. Background jobs

| Job | New app | Phase |
|---|---|---|
| Meta: ad accounts, campaigns, ad sets, ads, creatives (+ images/videos), ad insights, account insights, leads, pages & lead forms | ⬆️ Independent jobs every 30 min (not a 30–300 min chain) | 1a |
| GHL: MRKD contacts → clients (+ ads manager), locations data, custom fields & values, location contacts, single contact webhook, token refresh | ✅ Retool keeps running these; new app reads clients/managers via the Retool bridge | Later |
| GHL: create sub-account for contact (snapshot → location → token → write back → Slack ads manager) | ✅ | Later |
| GHL: custom value mapping jobs | ✅ | Later |
| GHL: conversations / unread counts | ⬆️ Background, not on page load | Later |
| Lead Google Sheets → leads (all clients, failed retry, single) | ✅ Retool keeps running it; outcomes reach the new app via the Retool bridge | Later |
| Stripe ×2: customers, subscriptions, invoices | ⬆️ Webhooks | Later |
| Slack alerts (sync failures, sub-account created, ad preview steps) | ✅ + morning digest | 1a–2 |
| New FB lead webhook (test) | ❓ Instant lead alerts wanted? | – |
| DELETE CONTACTS | ❌ unless needed | – |
| Demo / test workflows | ❌ | – |

---

## Still unknown (not in the export)

1. **Two Retool Forms** that couldn't be exported: *Leadlabz Onboarding form*, *Untitled (1)*. Screenshots needed.
2. **Which workflows actually run** and how often. The export shows them all disabled, so check Retool → Workflows → run history.
3. **Retool resource settings**: which Slack channels alerts go to, which Google account reads the lead sheets, the Zapier webhook for ClickUp.
4. **Who uses what.** Which screens each person opens daily, and which features nobody uses anymore.
5. **Retool permissions**: who can see or edit what today.
