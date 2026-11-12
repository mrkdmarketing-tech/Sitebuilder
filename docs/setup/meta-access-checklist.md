# Meta access checklist (12 Nov 2026)

**Done 12 Nov 2026 (via Cowork).** Re-check straight after: 54 of 55 ad accounts can now be changed by The Lab (was 33), 52 Pages visible (was 26), and **21 of 26 suggested ads can be turned off** (was 7 of 19). Still open:
- **Gracie Barra Whiterock** ad account: still view-only.
- **Gracie Barra Cloverdale** Page (100942154821406) and **Gracie Barra Renton** Page (1675215389229834): not visible to The Lab (probably not shared with MRKD's business). Cloverdale's 4 suggested ads can't be turned off until then.
- **Double Five**: "Ad account not writable" (account unsettled: billing).
- Step 3 (token with leads_retrieval) not done yet: Leads tab still empty.


What MRKDPlatformTools (The Lab's Meta login) is missing, worked out from live data. Fixing both lists makes Turn off work everywhere and lets the Leads tab fill. After each batch, ask Claude to re-check (meta-check `?ads=` validate only).

Where: **Business settings → Users → System users → MRKDPlatformTools → Assign assets**. Both screens let you tick many at once.

## 1. Ad accounts: give Manage campaigns (22)

Choose **Ad accounts**, tick these, set **Partial access → Manage campaigns** (or Full control), **Assign**.

- [ ] Affinity Academy
- [ ] Flo Martial Arts
- [ ] Jiu Jitsu Flow
- [ ] Barrhaven Martial Arts
- [ ] Gracie Barra Whiterock
- [ ] Gracie Barra Cloverdale
- [ ] Gracie Barra Renton
- [ ] AONJiuJitsu
- [ ] Train&Nourish
- [ ] DST Renzo Gracie (Winnipeg)
- [ ] Haus of Athletes 2.0
- [ ] APEX PERFORMANCE - ANDREW
- [ ] RDC JiuJitsu
- [ ] Andys Buildings #2
- [ ] Atos Jiu Jitsu Temecula
- [ ] CULTR Fight Club
- [ ] Gracie Barra Marysville
- [ ] Marcus Aurelio BJJ - ACADEMY
- [ ] Gracie Barra Ottawa
- [ ] Grappletown
- [ ] Swampfox Jiu Jitsu
- [ ] Double Five

## 2. Pages: give Ads and Leads (28)

Choose **Pages**, tick these, turn on **Ads** and **Leads** (Partial access), **Assign**. A Page missing from the list isn't shared with MRKD's business yet: ask the client to add MRKD as a partner on it first (Page ID shown to find it).

- [ ] AFFINITY ACADEMY OF MARTIAL ARTS (Page ID 1427233800827559)
- [ ] AON Jiu Jitsu (Page ID 106265128365756)
- [ ] Andys Buildings (Page ID 105939048435044)
- [ ] Apex Jiu- Jitsu & MMA Sterling (Page ID 825898190609992)
- [ ] Apex Performance Gym (Page ID 293370324186539)
- [ ] Artemis Jiu Jitsu (Page ID 990977337440760)
- [ ] Atlantic MMA, Inc./Fight for It & Co. (Page ID 1531894357106459)
- [ ] Bataille Jiu Jitsu Academy (Page ID 225441760650586)
- [ ] CULTR Fight Club (Page ID 121842217565967)
- [ ] DAN COVEL MARTIAL ARTS/JIUJITSU (Page ID 653599011361925)
- [ ] Don't Survive Thrive Academy (Page ID 259185380815828)
- [ ] Double Five Mid-Cities (Page ID 198307900037229)
- [ ] FLO Martial Arts Stouffville (Page ID 332178673322645)
- [ ] Flux MMA (Page ID 1427661300821977)
- [ ] Gentle Arts Dojo (Page ID 109640345139270)
- [ ] Gracie Barra Cloverdale (Page ID 100942154821406)
- [ ] Gracie Barra Marysville (Page ID 107048105297055)
- [ ] Gracie Barra Ottawa HQ (Page ID 205661869301081)
- [ ] Gracie Barra Renton (Page ID 1675215389229834)
- [ ] Gracie Barra Tacoma (Page ID 105805249127859)
- [ ] Jiu Jitsu FLO (Page ID 114171366678108)
- [ ] Legion American Jiu Jitsu San Diego (Page ID 106826640744133)
- [ ] Marcus Aurelio Jiu-Jitsu Academy (Page ID 220802657790653)
- [ ] New Level Grappling Academy (Page ID 199786343385284)
- [ ] Reyson Gracie Boca Raton (Page ID 101887652502872)
- [ ] Train and Nourish (Page ID 204601510446837)
- [ ] Tri Cities Jiu Jitsu Club llc (Page ID 105007684206577)
- [ ] barrhaven martial arts centre (Page ID 1053113931451653)

## 3. Token (only if lead form search is wanted)

**Decided 12 Nov 2026: The Lab doesn't need people's names or contact details**, so `leads_retrieval` isn't needed and the Leads tab was removed. Lead counts and cost per lead come from Meta's ad results and are unaffected.

Lead form **search** (form names, questions, thank-you pages; no personal data) needs `pages_manage_ads` on the token (Meta answered "Requires pages_manage_ads permission" when tested). If wanted: System users → MRKDPlatformTools → **Generate new token** → app The Lab → tick the current permissions plus **pages_manage_ads** → Never expires → copy → Supabase Secrets → edit `META_SYSTEM_USER_TOKEN` → Save → tell Claude to check it → revoke the old token. Do this yourself, not through Cowork (the token shows on screen). A form sync would then need building.
