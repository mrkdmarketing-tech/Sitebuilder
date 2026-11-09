# Ad approval (Phase 2)

Replaces Retool's **Ad Preview** and **Meta Ad Components Templates**. Design agreed with Jordan, Nov 2026. Status: **designed, database ready, screen not built yet** (the app shows a placeholder at `/approvals`).

## Flow

1. **Create**: pick the client, name the ad, choose the ad type and booking type, and start from an ad creative template and a lead form template (or an existing Meta lead form). The client's onboarding info and campaign specifics show alongside.
2. **Upload**: employees **upload images and/or videos manually** (or paste a Canva link) and write the copy: primary text, headline, description, CTA, tracking, URL parameters, plus the lead form (type, greeting, questions, privacy policy, thank-you message).
3. **AI quality check**: runs automatically as soon as copy or files are added (below).
4. **Submit for approval** ("publish"): if any findings are still open, a prompt appears: *"Hey, just double checking. We spotted 3 possible issues: …"* with **Fix** (jumps to the spot) or **Submit anyway**. Submitting anyway is **allowed** and recorded (who, which warnings).
5. **Review**: the reviewer (ads manager chosen on submit, notified on Slack as today) works through the 11-point checklist, comments, and either **Requests changes** or **Approves**. A ClickUp task is created through the ClickUp API, replacing the Zapier webhook.
6. **Completed** once it's live in Meta. The app doesn't create the ad in Meta; that stays manual.

Statuses: `draft → review_pending ⇄ request_changes → approved → completed` (stored in `ad_reviews.status`; every change logged in `ad_review_events`).

## AI quality check (Claude)

| Asset | Checks |
|---|---|
| Copy (primary text, headline, description, lead form) | Spelling and grammar. Things that don't make sense: contradictions ("free trial" vs "$49 trial"), impossible dates or days, broken sentences. Mismatches with the client: city, gym name, phone, offer, pricing, program names, booking type. |
| Images | Reads all text in the image and runs the same checks. Image CTA vs headline and primary copy. Logo present. Address/phone readable and correct. |
| Videos | Frames are extracted **in the browser** at upload (no video server). Claude reads on-screen text and **burned-in subtitles** and checks spelling, grammar and logic. **No audio check** (agreed). |

Each finding stores: field or file, location (e.g. "image 2", "video 0:12"), category, the problem text, a suggested fix, and status (open / fixed / ignored). See `ad_review_findings` in [data-model.md](data-model.md#0500-ad-approval).

The AI also **pre-fills** the checklist items it can judge (logo, address/phone, spelling, CTA matches, city). The reviewer still ticks them.

Implementation: `supabase/functions/ad-check` (skeleton). Needs secret `ANTHROPIC_API_KEY`. Unchanged content isn't re-checked (`input_hash`).

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

## Notifications

Slack, as today, at: first review requested, review again, changes requested, review completed. (Suggestions don't use Slack; ad approval does.)

## History

At the start of Phase 2, Retool's 594 `ads_preview` rows and all templates are copied in (`legacy_id` keeps the Retool id). Then Retool's Ad Preview is retired.
