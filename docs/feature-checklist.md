# Feature checklist: everything the Retool tools do today

A line-by-line list of what each live Retool app and workflow does, taken from the Nov 2026 export (every table column, KPI tile, filter, button and background job). **Go through it and mark anything that's wrong, missing or no longer used.** Anything not on this list won't be rebuilt unless someone adds it.

Legend for the "New app" column:
- ✅ **Keep**: rebuilt as is
- ⬆️ **Improve**: rebuilt and made better (note says how)
- ❓ **Decide**: needs your call
- ❌ **Drop**: not rebuilt

Phase numbers refer to [plan.md](plan.md) §5.

---

## 1. Meta Ads Insights (the screen in your screenshot)

| Feature | Details today | New app | Phase |
|---|---|---|---|
| Top-level nav | Clients View · Onboarding · LeadLabz · Meta Ads Insights · Ad Preview | ⬆️ One app with a sidebar, inside GHL | 0 |
| Date range | Picker plus presets: today, yesterday, this week, last week, last 7/14/30 days, this month, last month | ✅ | 1 |
| **KPI tiles** | Active Acc. · Leads · CPL · CPM · CR % → second page: CPR · CPLC · Value Generated | ✅ plus comparison vs previous period on every tile | 1 |
| Tabs with counts | Ad Accounts [n] · Campaigns [n] · Adsets [n] · Ads [n] · Leads | ✅ | 1 |
| Ads manager filter | Multi-select, e.g. "Adam Schmidt" | ⬆️ Defaults to the signed-in manager | 1 |
| "Ad Filters & Alerts" | Active-status filter | ✅ Merged into suggestions (M2) | 1–2 |
| **Ad Accounts table** | Client ID · Account (+ client status badge) · Ad Manager · Status · CPM · CPR · CPL · CPLC · CR % · Spend · Impressions · Reach · Link Clicks · Clicks · Leads · Leads Sheet · Booked · Shown · Closed · Closed Value | ✅ | 1 (booked/shown/closed in 3) |
| **Campaigns table** | Same metrics + Name · Account · Status · Daily Budget · Buying type · Pacing · Bid Strategy · Objective | ✅ | 1 |
| **Ad sets table** | Same metrics + Campaign · Genders · Age range · Optimization goal · ADV+ · Learning stage | ✅ | 1 |
| **Ads table** | Same metrics + Campaign · Ad set · 🌄 creative thumbnail · CTR · Link CTR · Comments · Page likes · Messages | ✅ | 1 |
| Creative popup | Click 🌄 → image or video thumbnail, title, body, video ID | ⬆️ Also shows its performance and AI notes | 1 |
| **Leads tab** | Name · Email (mailto) · Created at · Form · Ad | ✅ | 1 |
| Click a row → Meta Ads Manager | Opens that account, campaign, ad set or ad in Ads Manager | ✅ | 1 |
| Download CSV / refresh per table | Toolbar buttons | ✅ CSV export. Refresh not needed (live). | 1 |
| "Sync" and "Fetch Creatives" buttons | Manually trigger the Meta sync workflows | ⬆️ Not needed: syncs every 30 min. Admin "sync now" on the sync health page. | 1 |

## 2. Clients View

| Feature | Details today | New app | Phase |
|---|---|---|---|
| Filters | By ads manager (checkboxes), client ID/name, Active clients only, LeadLabz clients only | ✅ | 1 |
| Date range | Picker plus presets (stats recalculate) | ✅ | 1 |
| Column groups | "Filter Columns by Group": General Information / Leads Data / LeadLabz / Stripe MRKD / Stripe LeadLabz / … | ⬆️ Saved views per person | 1 |
| **KPI tiles** | Active Clients · Synced Leads · MRR (000s) · Amount Billed (000s) · Value Generated · Unread Msg MRKD · Unread Msg LeadLabz · Active Sub-accounts | ✅ | 1 (billing tiles 3) |
| **Clients table**: core | ID · Business name · Advertisement (status, editable) · Ad manager · Account type · Ad account status · Ads spend (Meta) · # Leads (Meta) | ✅ | 1 |
| Clients table: lead outcomes | Synced leads · Booked · Shown · Closed · Closed in interval · New members · Active members · Upfront cash · Total value · Current MRR · Lead count last 3 days · Leads sync status | ✅ | 3 |
| Clients table: messages | Contact unread · Location unread · Contact last msg at · Message type | ✅ | 3 |
| Clients table: Stripe LeadLabz (LL) | Last billed · Next billed · Active subs · LTV · Subs amount · Payment method | ✅ | 3 |
| Clients table: Stripe MRKD (MM) | Last billed · Next billed · Active subs · LTV · Subs amount · Payment method | ✅ | 3 |
| Clients table: LeadLabz | LeadLabz account · Active location | ✅ | 3 |
| **Inline edit client status** | Edit "Advertisement" status in the table → Save → pushes to the client's GHL contact | ✅ Logged in audit trail | 1 |
| Inline edit location active | Saves to `ghl_locations` | ✅ | 5 |
| **Row actions** | Facebook (Ads Manager) · Drive · Zapier · Leads · Onboarding · Sync Leads · Google Sheet · Ad account | ✅ (Zapier link ❓ still used?) | 1 |
| Click cell links | Stripe customer · client's GHL contact · LeadLabz sub-account dashboard | ✅ | 1 |
| **Client info drawer** | Business + contact details. Buttons: Website, Zapier, FB, G Drive, Assets, Lead Sheet, Leads Data, LeadLabz CRM. Copy details. Click email → Gmail compose. | ✅ | 1 |
| **Leads data view** | All leads for a client: date, email, phone, reach-out method, notes/appt date, communication status, appointment status, closed value, date closed, membership value, first payment, date left, campaign/ad set/ad, platform | ✅ | 3 |
| **"Show alerts" highlighting** | 🔴 0 leads in 3 days · 🔴 unread messages · 🔴 not billed 14+ days · 🟡 LeadLabz active without subscription | ⬆️ Becomes the suggestions engine (M2) | 2 |
| Sync buttons | "Sync GHL data", "Sync leads" | ⬆️ Automatic. Manual button kept for admins. | 1/3 |

## 3. Ad Preview 🤖 (ad approval)

| Feature | Details today | New app | Phase |
|---|---|---|---|
| Ad preview list | Name · Client ID · Business · Ad account · Ad type · Booking type · Created · Completed · Review started/completed · Status. Row action "Mark Complete". Filter by status. | ✅ | 4 |
| Create preview | Pick client → name it → choose ad creative template + lead form template, ad type, booking type | ✅ | 4 |
| **Ad creative form** | Primary text · Headline · Description · CTA · Tracking (pixel etc.) · URL parameters · images (upload or Canva URL, multiple, next/previous/delete) | ✅ | 4 |
| **Lead form form** | Name · Form type (more volume / higher intent / rich creative) · Greeting headline + description · Questions (add/remove) · Privacy policy URL · Thank-you message: headline, description, CTA, URL, additional action · or pick an existing Meta lead form | ✅ | 4 |
| Business info panel | Client's onboarding and GHL data shown beside the form, filterable. LeadLabz booking URL. Pixel ID. Notes (save to GHL). Area callouts (save). | ✅ | 4 |
| **Statuses** | Review Pending → Request Changes → Approved → Completed (split button) | ✅ | 4 |
| Send for review | Choose ads manager → **Slack notification** to them. Separate alerts for first review, review again, changes requested, review completed. | ✅ | 4 |
| Comments | Thread per preview with author, latest comment pinned | ✅ | 4 |
| **Review checklist** | 1 logo · 2 address & phone · 3 spelling · 4 image CTA = headline · 5 image CTA = primary copy · 6 alignment · 7 city matches copy · 8 tracking on · 9 campaign naming · 10 lead forms connected · 11 tell Trent about new lead forms | ⬆️ Real tick-boxes saved per preview | 4 |
| **AI review** | Retool AI reads the text and images and compares them with the client's business data, returning a list of fixes | ⬆️ Claude, run automatically when sent for review | 4 |
| ClickUp card | Zapier webhook creates a card (client, ads manager, formatted brief) | ⬆️ ClickUp API directly | 4 |
| LeadLabz website campaign requests | Table: status, timeline, client, budget, Drive link, ad type, requested by | ✅ | 4 |
| "Fetch LeadForms" | Pulls the client's Meta lead forms | ⬆️ Automatic sync | 1 |

## 4. Clients Onboarding

| Feature | Details today | New app | Phase |
|---|---|---|---|
| Client picker + filter by ads manager, active only | | ✅ | 4 |
| General business info | Company name, website, address (street/city/state/country), Google Drive, CRM used, lead nurturing tool, client status, GHL contact ID | ✅ | 4 |
| Facebook access | Page ID, page link, pixel ID, ad account name/ID/link, dataset name, monthly budget | ✅ | 4 |
| Gym info | What makes the gym special, core values, area callouts | ✅ | 4 |
| Instructor info | Name, years of experience, certifications, belts, teaching style | ✅ | 4 |
| Programs | Program names, intro offers, sign-up requirements, length/what's included, sessions per week | ✅ | 4 |
| Kids program | Age range, class times, free trial (+ details) | ✅ | 4 |
| Pricing | Membership fee for 3/6/12 months | ✅ | 4 |
| **Campaign specifics** (up to 2 per client, plus table of existing) | Name · Ad type (or add new type) · Monthly budget + optional upper limit · CTA · Goals & objective · Landing page · Booking calendar link · Area callouts · Marked-area image (upload, override) · Access to push leads + details · Lead goals · Follow-up process · Ads lead flow · Integration details · CRM integrated? + details · Who handles leads | ⬆️ No 2-campaign limit. Adds target CPL. | 4 |
| Push updates to GHL | "Push updates" writes changes to the client's GHL contact, with a changes preview | ✅ | 4 |
| Sync GHL contact data | Button | ⬆️ Automatic | 1 |

## 5. Meta Ad Components Templates

| Feature | New app | Phase |
|---|---|---|
| Lead form templates: add/update (questions, form type, CTA, greeting, thank-you) | ✅ | 4 |
| Ad creative templates: add/update (primary text, headline, description, CTA) with custom-field placeholders (Field key / Label list from GHL) | ✅ | 4 |

## 6. Search Meta Lead Forms

| Feature | New app | Phase |
|---|---|---|
| Search lead forms by name / page / content → view context card, privacy policy, thank-you page | ✅ (safe search, fixing the current SQL-injection risk) | 1 |
| Search ad copy by name / account / content → view title, body, CTA, permalink | ✅ | 1 |

## 7. LeadLabz ⚙️ (GHL admin)

| Feature | New app | Phase |
|---|---|---|
| MRKD contacts: general fields + custom fields editor, **editable custom fields** config | ✅ | 5 |
| **Assign client #** to a contact (creates `clients` row) | ✅ | 5 |
| **Create sub-account** from a snapshot | ✅ with progress and retry | 5 |
| Users: list (name, email, type, phone, locations, role, permissions), add user with assigned locations, bulk edit, delete | ✅ | 5 |
| **Permission templates**: create/update, apply to users | ✅ | 5 |
| Sub-account (location) data editor: general fields, country | ✅ | 5 |
| Location **custom values** editor (filterable, bulk) + "Sync CV" | ✅ | 5 |
| **Custom value mapping** (static value / contact key / custom field → custom value) | ✅ | 5 |
| "Sync GHL" button (wait for Slack alert) | ⬆️ Automatic + webhooks | 1 |
| **Onboarding checklist** page (Example Client A/B/C, statuses; looks unfinished) | ❓ Finish it in the new app? | – |

## 8. Leadlabz (Website) ⚙️

| Feature | New app | Phase |
|---|---|---|
| Website users: email, name, photo, verified, authorized, assigned contacts, add-contact access | ✅ | 5 |
| Row actions: Authorize/Deauthorize · Accounts/Contacts access · Reset password · Toggle "Add Contact" access | ✅ | 5 |
| Add new user (Firebase + DB) | ✅ | 5 |
| Subscription plans: name, details, tag, amount, discount, active | ✅ | 5 |
| Client onboarding progress: onboarding / contract / payment flags | ✅ | 5 |

## 9. Dev / test apps with features worth keeping

| App | Feature | New app |
|---|---|---|
| Ad Ai Analyzer / Ad Copy Generator | AI ad and lead-form copy from client data + templates + booking type, preview, "submit for approval" | ⬆️ Part of Ad Preview (Phase 4) |
| Test view multi creatives | **Creative analysis**: AI tags each creative (hook, angle, CTA, personas, offer, logo present, people count, areas called out, quality score) and ranks creatives by CPL | ❓ Want this? Great input for suggestions. |
| Go High Level | Bulk edit MRKD and client custom fields/values | ✅ Merged into GHL admin (5) |
| Leadlabz calendar embed | Generate booking calendar embed HTML | ❓ Still used? |
| Stripe Subscriptions Dash | Raw Stripe subscriptions/customers/invoices tables | ✅ Covered by billing (3) |
| MRKD Mobile, Untitled-2 | Early mobile attempts | ❌ The new app is mobile-first |

## 10. Background jobs

| Job | New app | Phase |
|---|---|---|
| Meta: ad accounts, campaigns, ad sets, ads, creatives (+ images/videos), ad insights, account insights, leads, pages & lead forms | ⬆️ Independent jobs every 30 min (not a 30–300 min chain) | 1 |
| GHL: MRKD contacts → clients (+ ads manager), locations data, custom fields & values, location contacts, single contact webhook, token refresh | ✅ | 1 / 5 |
| GHL: create sub-account for contact (snapshot → location → token → write back → Slack ads manager) | ✅ | 5 |
| GHL: custom value mapping jobs | ✅ | 5 |
| GHL: conversations / unread counts | ⬆️ Background, not on page load | 3 |
| Lead Google Sheets → leads (all clients, failed retry, single) | ✅ every 30 min with per-client error status | 3 |
| Stripe ×2: customers, subscriptions, invoices | ⬆️ Webhooks | 3 |
| Slack alerts (sync failures, sub-account created, ad preview steps) | ✅ + morning digest | 1–4 |
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
