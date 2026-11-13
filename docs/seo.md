# SEO and AEO for client websites

**Goal (agreed 13 Nov 2026):** The Lab optimises clients' **existing** websites (and their Google Business Profiles), not new MRKD-hosted sites. SEO = ranking in Google for local searches ("jiu jitsu Renton"). AEO = being the gym AI assistants (ChatGPT, Google AI answers, Perplexity) name when asked.

## What the sites are built on (checked 13 Nov 2026)

`site-check` (Edge Function, read-only, cron secret) opened the home page of all 46 Active/New clients. Code: `shared/domain/siteCheck.ts` (tests: `siteCheck.test.ts`).

| Built on | Clients | Can The Lab change it automatically? |
|---|---|---|
| **WordPress** | 16: AACE, Affinity, AON, Andys Buildings, Atlantic MMA, DeSantos, FLO Stouffville, GB Cloverdale, GB Marysville, GB Ottawa HQ, GB Renton, GB Tacoma, GB White Rock, Saga, Tri Cities, Valle | **Yes**, through WordPress's REST API with an application password per site (plus an SEO plugin such as Yoast or Rank Math for titles and schema) |
| **GHL / LeadLabz** | 7: 100% Martial Arts, Apex Sterling, Grappletown, the three Rising Tide clients, Solidarity | Probably not through GHL's API (to confirm); fixes applied by hand in GHL's site builder, or by a browser agent |
| Squarespace, Wix, Webflow, GoDaddy | CULTR, Gentle Arts (Squarespace); Aegis (Wix); DST (Webflow); Flux (GoDaddy) | Webflow has a content API; the others mostly by hand |
| Gym software pages | Artemis (Kicksite), Rising Tide Foundation (Gymdesk) | No: these are booking pages, not real websites |
| Not identified | 8: Apex Performance, Bataille, Dan Covel, Haus of Athletes, Infinity TN, Jiu Jitsu FLO, Reyson Gracie Boca, Barrhaven | Check by hand |
| Couldn't open / no site on file | Double Five, GB Stittsville, Legion SD, Westbrook Roofing (none on file); Marcus Aurelio (address in GHL doesn't exist: likely a typo); **New Level Grappling (invalid security certificate: visitors and Google see a warning)**; Socius, Train and Nourish (blocked the check) | Fix the data in GHL; New Level's certificate is urgent |

GB Renton and GB Marysville redirect to pages on **graciebarratacoma.com**: one WordPress site serves three clients.

## Quick wins found

- **No business details for Google (LocalBusiness structured data)** on 18 sites, including GB Tacoma (so also Renton and Marysville), GB Cloverdale, GB White Rock, Grappletown, the Rising Tide sites, Saga, Solidarity, Jiu Jitsu FLO, Infinity TN, Gentle Arts.
- **No meta description** (the text under the link in Google): Gentle Arts, Grappletown, the Rising Tide sites, Artemis.
- **New Level Grappling:** security certificate invalid.
- **Marcus Aurelio:** website address in GHL doesn't resolve.

## The optimising system (proposed)

A loop per client: **check → decide → change → measure**, every week.

1. **Check:** site-check grows into a full crawl (titles, descriptions, headings, structured data, page speed via Google's free PageSpeed API, broken links, business details vs The Lab's client info), plus Google Search Console (clicks, searches, indexing; needs each site added to MRKD's Search Console), the Google Business Profile, and a monthly **AI visibility** check (ask the AI assistants 5–10 standard questions per client, record whether the gym is named).
2. **Decide:** Claude proposes the next fixes from the client's real details (never invented facts), using the same mistake checks as ad approval.
3. **Change:**
   - Automatic (safe): structured data, titles and descriptions, fixing mismatched business details, FAQ answers built only from approved facts.
   - One-click approval in The Lab: new pages (program, city, FAQ), Google Business Profile posts and replies to negative reviews.
   - Every change logged with before/after and undo, like Turn off.
4. **Measure** 2–4 weeks later; keep what worked.

**Order:** WordPress sites first (16, biggest share, fully automatable) → Google Business Profiles (needs Google API access approval) → Webflow → GHL/other sites as a fix list or browser agent.

**Access needed per WordPress site:** an admin creates an **application password** for a "The Lab" user (Users → Profile → Application passwords). Stored as a secret, never in chat.
