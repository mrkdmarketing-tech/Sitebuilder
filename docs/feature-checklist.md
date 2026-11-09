# Feature checklist: everything the Retool tools do today

A line-by-line list of what each live Retool app and workflow does, taken from the Nov 2026 export (every table column, KPI tile, filter, button and background job). **Go through it and mark anything that's wrong, missing or no longer used.** Anything not on this list won't be rebuilt unless someone adds it.

Legend for the "New app" column:
- **Keep**: rebuilt as is
- **Improve**: rebuilt and made better (note says how)
- **Decide**: needs your call
- **Drop**: not rebuilt

Phase numbers refer to [plan.md](plan.md) §5.

> **Current focus:** sections 1 (Meta Ads Insights), 3 (Ad Preview), 5 (Templates) and 6 (Search) are being built now, in Phases 0–2. Everything else **stays in Retool for now** and is marked *Later*.

---

## 1. Meta Ads Insights (the screen in your screenshot)

| Feature | Details today | New app | Phase |
|---|---|---|---|
| Top-level nav | Clients View · Onboarding · LeadLabz · Meta Ads Insights · Ad Preview | Improve: One app with a sidebar, inside GHL | 0 |
| Date range | Picker plus presets: today, yesterday, this week, last week, last 7/14/30 days, this month, last month | Keep | 1a |
| **KPI tiles** | Active Acc. · Leads · CPL · CPM · CR % → second page: CPR · CPLC · Value Generated | Keep: plus comparison vs previous period on every tile | 1a |
| Tabs with counts | Ad Accounts [n] · Campaigns [n] · Adsets [n] · Ads [n] · Leads | Keep | 1a |
| Ads manager filter | Multi-select, e.g. "Adam Schmidt" | Improve: Defaults to the signed-in manager | 1a |
| "Ad Filters & Alerts" | Active-status filter | Keep: Merged into suggestions (M2) | 1a–1b |
| **Ad Accounts table** | Client ID · Account (+ client status badge) · Ad Manager · Status · CPM · CPR · CPL · CPLC · CR % · Spend · Impressions · Reach · Link Clicks · Clicks · Leads · Leads Sheet · Booked · Shown · Closed · Closed Value | Keep | 1a (booked/shown/closed via Retool bridge) |
| **Campaigns table** | Same metrics + Name · Account · Status · Daily Budget · Buying type · Pacing · Bid Strategy · Objective | Keep | 1a |
| **Ad sets table** | Same metrics + Campaign · Genders · Age range · Optimization goal · ADV+ · Learning stage | Keep | 1a |
| **Ads table** | Same metrics + Campaign · Ad set · creative thumbnail · CTR · Link CTR · Comments · Page likes · Messages | Keep | 1a |
| Creative popup | Click the thumbnail → image or video thumbnail, title, body, video ID | Improve: Also shows its performance and AI notes | 1a |
| **Leads tab** | Name · Email (mailto) · Created at · Form · Ad | Keep | 1a |
| Click a row → Meta Ads Manager | Opens that account, campaign, ad set or ad in Ads Manager | Keep | 1a |
| Download CSV / refresh per table | Toolbar buttons | Keep: CSV export. Refresh not needed (live). | 1a |
| "Sync" and "Fetch Creatives" buttons | Manually trigger the Meta sync workflows | Improve: Not needed: syncs every 30 min. Admin "sync now" on the sync health page. | 1a |

## 2. Clients View

| Feature | Details today | New app | Phase |
|---|---|---|---|
| Filters | By ads manager (checkboxes), client ID/name, Active clients only, LeadLabz clients only | Keep | Later |
| Date range | Picker plus presets (stats recalculate) | Keep | Later |
| Column groups | "Filter Columns by Group": General Information / Leads Data / LeadLabz / Stripe MRKD / Stripe LeadLabz / … | Improve: Saved views per person | Later |
| **KPI tiles** | Active Clients · Synced Leads · MRR (000s) · Amount Billed (000s) · Value Generated · Unread Msg MRKD · Unread Msg LeadLabz · Active Sub-accounts | Keep | 1 (billing tiles 3) |
| **Clients table**: core | ID · Business name · Advertisement (status, editable) · Ad manager · Account type · Ad account status · Ads spend (Meta) · # Leads (Meta) | Keep | Later |
| Clients table: lead outcomes | Synced leads · Booked · Shown · Closed · Closed in interval · New members · Active members · Upfront cash · Total value · Current MRR · Lead count last 3 days · Leads sync status | Keep | Later |
| Clients table: messages | Contact unread · Location unread · Contact last msg at · Message type | Keep | Later |
| Clients table: Stripe LeadLabz (LL) | Last billed · Next billed · Active subs · LTV · Subs amount · Payment method | Keep | Later |
| Clients table: Stripe MRKD (MM) | Last billed · Next billed · Active subs · LTV · Subs amount · Payment method | Keep | Later |
| Clients table: LeadLabz | LeadLabz account · Active location | Keep | Later |
| **Inline edit client status** | Edit "Advertisement" status in the table → Save → pushes to the client's GHL contact | Keep: Logged in audit trail | Later |
| Inline edit location active | Saves to `ghl_locations` | Keep | Later |
| **Row actions** | Facebook (Ads Manager) · Drive · Zapier · Leads · Onboarding · Sync Leads · Google Sheet · Ad account | Keep (Zapier link Decide: still used?) | Later |
| Click cell links | Stripe customer · client's GHL contact · LeadLabz sub-account dashboard | Keep | Later |
| **Client info drawer** | Business + contact details. Buttons: Website, Zapier, FB, G Drive, Assets, Lead Sheet, Leads Data, LeadLabz CRM. Copy details. Click email → Gmail compose. | Keep | Later |
| **Leads data view** | All leads for a client: date, email, phone, reach-out method, notes/appt date, communication status, appointment status, closed value, date closed, membership value, first payment, date left, campaign/ad set/ad, platform | Keep | Later |
| **"Show alerts" highlighting** | red: 0 leads in 3 days · red: unread messages · red: not billed 14+ days · yellow: LeadLabz active without subscription | Improve: Becomes the suggestions engine (M2) | Later |
| Sync buttons | "Sync GHL data", "Sync leads" | Improve: Automatic. Manual button kept for admins. | Later |

## 3. Ad Preview (ad approval)

| Feature | Details today | New app | Phase |
|---|---|---|---|
| Ad preview list | Name · Client ID · Business · Ad account · Ad type · Booking type · Created · Completed · Review started/completed · Status. Row action "Mark Complete". Filter by status. | Keep | 2 |
| Create preview | Pick client → name it → choose ad creative template + lead form template, ad type, booking type | Keep | 2 |
| **Ad creative form** | Primary text · Headline · Description · CTA · Tracking (pixel etc.) · URL parameters · images (upload or Canva URL, multiple, next/previous/delete) | Keep | 2 |
| **Lead form form** | Name · Form type (more volume / higher intent / rich creative) · Greeting headline + description · Questions (add/remove) · Privacy policy URL · Thank-you message: headline, description, CTA, URL, additional action · or pick an existing Meta lead form | Keep | 2 |
| Business info panel | Client's onboarding and GHL data shown beside the form, filterable. LeadLabz booking URL. Pixel ID. Notes (save to GHL). Area callouts (save). | Keep | 2 |
| **Statuses** | Review Pending → Request Changes → Approved → Completed (split button) | Keep | 2 |
| Send for review | Choose ads manager → **Slack notification** to them. Separate alerts for first review, review again, changes requested, review completed. | Keep | 2 |
| Comments | Thread per preview with author, latest comment pinned | Keep | 2 |
| **Review checklist** | 1 logo · 2 address & phone · 3 spelling · 4 image CTA = headline · 5 image CTA = primary copy · 6 alignment · 7 city matches copy · 8 tracking on · 9 campaign naming · 10 lead forms connected · 11 tell Trent about new lead forms | Improve: Real tick-boxes saved per preview | 2 |
| **AI review** | Retool AI reads the text and images and compares them with the client's business data, returning a list of fixes | Improve: Claude checks copy, image text **and video subtitles** for spelling, grammar and things that don't make sense. Runs automatically on upload; a "Hey, just double checking" prompt lists issues when they submit for approval (they can still submit). | 2 |
| ClickUp card | Zapier webhook creates a card (client, ads manager, formatted brief) | Improve: ClickUp API directly | 2 |
| LeadLabz website campaign requests | Table: status, timeline, client, budget, Drive link, ad type, requested by | Keep | 2 |
| "Fetch LeadForms" | Pulls the client's Meta lead forms | Improve: Automatic sync | 1a |

## 4. Clients Onboarding

| Feature | Details today | New app | Phase |
|---|---|---|---|
| Client picker + filter by ads manager, active only | | Keep | Later |
| General business info | Company name, website, address (street/city/state/country), Google Drive, CRM used, lead nurturing tool, client status, GHL contact ID | Keep | Later |
| Facebook access | Page ID, page link, pixel ID, ad account name/ID/link, dataset name, monthly budget | Keep | Later |
| Gym info | What makes the gym special, core values, area callouts | Keep | Later |
| Instructor info | Name, years of experience, certifications, belts, teaching style | Keep | Later |
| Programs | Program names, intro offers, sign-up requirements, length/what's included, sessions per week | Keep | Later |
| Kids program | Age range, class times, free trial (+ details) | Keep | Later |
| Pricing | Membership fee for 3/6/12 months | Keep | Later |
| **Campaign specifics** (up to 2 per client, plus table of existing) | Name · Ad type (or add new type) · Monthly budget + optional upper limit · CTA · Goals & objective · Landing page · Booking calendar link · Area callouts · Marked-area image (upload, override) · Access to push leads + details · Lead goals · Follow-up process · Ads lead flow · Integration details · CRM integrated? + details · Who handles leads | Improve: No 2-campaign limit. Adds target CPL. | Later |
| Push updates to GHL | "Push updates" writes changes to the client's GHL contact, with a changes preview | Keep | Later |
| Sync GHL contact data | Button | Improve: Automatic | Later |

## 5. Meta Ad Components Templates

| Feature | New app | Phase |
|---|---|---|
| Lead form templates: add/update (questions, form type, CTA, greeting, thank-you) | Keep | 2 |
| Ad creative templates: add/update (primary text, headline, description, CTA) with custom-field placeholders (Field key / Label list from GHL) | Keep | 2 |

## 6. Search Meta Lead Forms

| Feature | New app | Phase |
|---|---|---|
| Search lead forms by name / page / content → view context card, privacy policy, thank-you page | Keep (safe search, fixing the current SQL-injection risk) | 1a |
| Search ad copy by name / account / content → view title, body, CTA, permalink | Keep | 1a |

## 7. LeadLabz (GHL admin)

| Feature | New app | Phase |
|---|---|---|
| MRKD contacts: general fields + custom fields editor, **editable custom fields** config | Keep | Later |
| **Assign client #** to a contact (creates `clients` row) | Keep | Later |
| **Create sub-account** from a snapshot | Keep: with progress and retry | Later |
| Users: list (name, email, type, phone, locations, role, permissions), add user with assigned locations, bulk edit, delete | Keep | Later |
| **Permission templates**: create/update, apply to users | Keep | Later |
| Sub-account (location) data editor: general fields, country | Keep | Later |
| Location **custom values** editor (filterable, bulk) + "Sync CV" | Keep | Later |
| **Custom value mapping** (static value / contact key / custom field → custom value) | Keep | Later |
| "Sync GHL" button (wait for Slack alert) | Improve: Automatic + webhooks | Later |
| **Onboarding checklist** page (Example Client A/B/C, statuses; looks unfinished) | Decide: Finish it in the new app? | Later |

## 8. Leadlabz (Website)

| Feature | New app | Phase |
|---|---|---|
| Website users: email, name, photo, verified, authorized, assigned contacts, add-contact access | Keep | Later |
| Row actions: Authorize/Deauthorize · Accounts/Contacts access · Reset password · Toggle "Add Contact" access | Keep | Later |
| Add new user (Firebase + DB) | Keep | Later |
| Subscription plans: name, details, tag, amount, discount, active | Keep | Later |
| Client onboarding progress: onboarding / contract / payment flags | Keep | Later |

## 9. Dev / test apps with features worth keeping

| App | Feature | New app |
|---|---|---|
| Ad Ai Analyzer / Ad Copy Generator | AI ad and lead-form copy from client data + templates + booking type, preview, "submit for approval" | Improve: Part of Ad Preview (Phase 2) |
| Test view multi creatives | **Creative analysis**: AI tags each creative (hook, angle, CTA, personas, offer, logo present, people count, areas called out, quality score) and ranks creatives by CPL | Decide: Want this? Great input for suggestions. |
| Go High Level | Bulk edit MRKD and client custom fields/values | Keep: Merged into GHL admin (Later) |
| Leadlabz calendar embed | Generate booking calendar embed HTML | Decide: Still used? |
| Stripe Subscriptions Dash | Raw Stripe subscriptions/customers/invoices tables | Keep: Covered by billing (Later) |
| MRKD Mobile, Untitled-2 | Early mobile attempts | Drop: The new app is mobile-first |

## 10. Background jobs

| Job | New app | Phase |
|---|---|---|
| Meta: ad accounts, campaigns, ad sets, ads, creatives (+ images/videos), ad insights, account insights, leads, pages & lead forms | Improve: Independent jobs every 30 min (not a 30–300 min chain) | 1a |
| GHL: MRKD contacts → clients (+ ads manager), locations data, custom fields & values, location contacts, single contact webhook, token refresh | Keep: Retool keeps running these; new app reads clients/managers via the Retool bridge | Later |
| GHL: create sub-account for contact (snapshot → location → token → write back → Slack ads manager) | Keep | Later |
| GHL: custom value mapping jobs | Keep | Later |
| GHL: conversations / unread counts | Improve: Background, not on page load | Later |
| Lead Google Sheets → leads (all clients, failed retry, single) | Keep: Retool keeps running it; outcomes reach the new app via the Retool bridge | Later |
| Stripe ×2: customers, subscriptions, invoices | Improve: Webhooks | Later |
| Slack alerts (sync failures, sub-account created, ad preview steps) | Keep: Sync failures + ad approval steps (suggestions are in-app only, no Slack) | 1a–2 |
| New FB lead webhook (test) | Decide: Instant lead alerts wanted? | – |
| DELETE CONTACTS | Drop: unless needed | – |
| Demo / test workflows | Drop | – |

---

## Still unknown (not in the export)

1. **Two Retool Forms** that couldn't be exported: *Leadlabz Onboarding form*, *Untitled (1)*. Screenshots needed.
2. **Which workflows actually run** and how often. The export shows them all disabled, so check Retool → Workflows → run history.
3. **Retool resource settings**: which Slack channels alerts go to, which Google account reads the lead sheets, the Zapier webhook for ClickUp.
4. **Who uses what.** Which screens each person opens daily, and which features nobody uses anymore.
5. **Retool permissions**: who can see or edit what today.
