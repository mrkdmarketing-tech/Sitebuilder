# Ad approval (Phase 2)

Replaces Retool's **Ad Preview** and **Meta Ad Components Templates**. Design agreed with Jordan, Nov 2026.

**Status (10 Nov 2026): built and live** at `/approvals`, except the AI call itself, which starts working when the Claude key is added (`ANTHROPIC_API_KEY`, see [sop/tokens-and-secrets.md](sop/tokens-and-secrets.md#add-the-claude-key-ai-ad-check)). Until then "Check for mistakes" says "The AI check isn't set up yet" and everything else works. Step-by-step use: [sop/ad-approval-submit.md](sop/ad-approval-submit.md), [sop/ad-approval-review.md](sop/ad-approval-review.md).

Not built yet: Slack and ClickUp notifications (below), and choosing an existing Meta lead form from a list (for now its name or ID is typed in).

## Where things are

| Piece | File |
|---|---|
| List, New ad | `web/src/features/approvals/ApprovalsPage.tsx` |
| Editor, mistake check panel, checklist, comments, "Hey, just double checking" | `web/src/features/approvals/ReviewPage.tsx` |
| Data (live / sample) | `web/src/data/approvalsSupabase.ts`, `web/src/data/approvalsMock.ts`, types in `web/src/data/approvals.ts` |
| Image previews and video frames, made in the browser | `web/src/lib/media.ts` |
| Statuses, allowed moves, placeholders, finding format | `shared/domain/approvals.ts` (tests: `approvals.test.ts`) |
| Database rules: `set_review_status`, `ad_review_list`, `client_brief`, read-only Retool history | migration 2100 (tests: `supabase/tests/zz_ad_approval.test.sql`) |
| Retool history and templates copy | migration 2200 (tests: `supabase/tests/retool_bridge.test.sql`) |
| AI check | `supabase/functions/ad-check/index.ts` |

## Flow

1. **Create**: pick the client, name the ad, choose the ad type and booking type, and start from an ad creative template and a lead form template (or an existing Meta lead form). The client's onboarding info and campaign specifics show alongside.
2. **Upload**: employees **upload images and/or videos manually** (or paste a Canva link) and write the copy: primary text, headline, description, CTA, tracking, URL parameters, plus the lead form (type, greeting, questions, privacy policy, thank-you message).
3. **AI quality check**: the person clicks **Check for mistakes** (it isn't run on every keystroke, to keep cost down and avoid flagging half-written text). See below.
4. **Submit for approval** ("publish"): if any findings are still open, a prompt appears: *"Hey, just double checking. We spotted 3 possible issues: …"* with **Go back and fix** or **Submit anyway**. Submitting anyway is **allowed** and recorded (who, which warnings).
5. **Review**: the reviewer (chosen on submit; the client's ads manager by default) sees it in **Needs me**, works through the 11-point checklist, comments, and either **Requests changes** (a comment is required) or **Approves**. Slack and ClickUp notifications are planned (below).
6. **Live**: once it's built in Meta, someone clicks **Mark as live**. The app doesn't create the ad in Meta; that stays manual.

Who can do what: any active employee can create, edit (while Draft or Changes requested), check, submit, review and comment, the same as Retool. Status changes only go through `set_review_status()`, which enforces the allowed moves (`MOVES` in `shared/domain/approvals.ts`); comments are always posted as yourself; only admins can delete an ad.

Statuses: `draft → review_pending ⇄ request_changes → approved → completed`, shown as Draft, Waiting for review, Changes requested, Approved, Live (stored in `ad_reviews.status`; every change logged in `ad_review_events`, including which open findings were acknowledged on "Submit anyway"). Approved can also go back to Changes requested.

## AI quality check (Claude)

| Asset | Checks |
|---|---|
| Copy (primary text, headline, description, lead form) | Spelling and grammar. Things that don't make sense: contradictions ("free trial" vs "$49 trial"), impossible dates or days, broken sentences. Mismatches with the client: city, gym name, phone, offer, pricing, program names, booking type. |
| Images | Reads all text in the image and runs the same checks. Image CTA vs headline and primary copy. Logo present. Address/phone readable and correct. |
| Videos | Frames are extracted **in the browser** at upload (no video server). Claude reads on-screen text and **burned-in subtitles** and checks spelling, grammar and logic. **No audio check** (agreed). |

Each finding stores: field or file, location (e.g. "image 2", "video 0:12"), category, the problem text, a suggested fix, and status (open / fixed / ignored). See `ad_review_findings` in [data-model.md](data-model.md#0500-ad-approval).

The AI also **pre-fills** the checklist items it can judge (logo, address/phone, spelling, CTA matches, city). The reviewer still ticks them.

### How the check works (built 10 Nov 2026)

1. **At upload**, the browser turns each image into one JPEG preview (longest side 1568 px) and each video into up to 8 stills spread across it (`web/src/lib/media.ts`). They are stored next to the original in the private bucket (`ad-assets/<ad>/<file>/preview-N.jpg`) and listed in `ad_review_assets.frames`. Files the browser can't read (often iPhone HEVC `.mov`) get no previews and are skipped by the check, with a note on screen.
2. **"Check for mistakes"** saves the ad, then calls `ad-check` with the person's login. The function checks they're an active employee who can see the ad, then sends Claude (`claude-opus-5-5`, effort medium) the copy and lead form with stable field names, the client's details from `client_brief()` (business name, address, city, phone, website, offer, programs, pricing, booking link, CTA, onboarding answers; billing ids and internal links are left out), and the previews, numbered File 1, 2...
3. Claude answers as **strict JSON** (structured outputs): findings (field, file number, location, category, severity, exact text, explanation, corrected text) and pass / fail / unsure for the AI-checkable checklist items. The prompt tells it not to flag normal ad style (emojis, caps, fragments, Canadian vs US spelling). If Claude declines, the request falls back to another model on Anthropic's side (`fallbacks: "default"`); if that also declines, the check says to check by hand.
4. The answer is validated (`parseCheckResult` in `shared/domain/approvals.ts`), then replaces the ad's findings. Issues the person marked **Ignore** stay ignored if found again (matched on field, text and category). The checklist's AI column is filled; ticks are never changed.
5. Each run is recorded in `ad_review_check_runs` with the model and **cost in USD**. If the copy, files and client details haven't changed since the last good run, it answers "Nothing changed since the last check" without calling Claude (`input_hash`).

**Cost:** roughly one to five cents per check, more for long videos (each still is an image). See `select sum(cost_usd) from ad_review_check_runs`.

## Reviewer checklist (from Retool)

1. Correct logo
2. Address and phone number (check small print)
3. All spelling on the image is correct
4. Image CTA matches the headline
5. Image CTA matches the primary copy
6. Image is aligned properly
7. City matches the primary copy
8. Tracking events are on (if available)
9. Campaign naming is correct
10. Lead forms are connected and correct
11. Inform Trent of any new campaign lead forms

Editable by admins (`review_checklist_items`).

## Notifications (not built yet)

Planned: Slack, as today, at: first review requested, review again, changes requested, review completed, and a ClickUp task on approval (replacing the Zapier webhook). Until then, the reviewer sees new ads in their **Needs me** view. (Suggestions don't use Slack; ad approval will.)

## History from Retool

Live since 10 Nov 2026 (migration 2200): every 15 minutes the Retool bridge copies, read-only, Retool's `ads_preview` (596 ads on the first run: 498 completed, 47 approved, 22 waiting for review, 8 changes requested, 21 drafts), the 13 ad creative templates and 8 lead form templates, and the 147 GHL custom field names used to decode client info.

- Imported ads show under **From Retool**, read-only (database rule, not just the screen). `legacy_id` keeps the Retool id; Retool's metadata, comments, AI notes and image count are kept in `ad_reviews.legacy`.
- **Images are not copied.** Retool stored them inside the row as base64; they are removed by Retool's own database in the SELECT so only text crosses over. The screen says how many there were, and shows any Canva links.
- Status mapping: Retool `completed` → Live, `approved` → Approved, `review_pending` → Waiting for review, `request_changes` → Changes requested, `create` → Draft.
- Templates imported from Retool keep their Retool field names (`messageForLeadsHeadline`...) and placeholders (`{{ company_name }}`, `{{ business_address }}`, `{{ contact.privacy_policy }}`); the editor understands both (`toLeadForm`, `placeholderValues`).

When everyone has moved to The Lab, Retool's Ad Preview can be switched off; the copy then just stops changing.
