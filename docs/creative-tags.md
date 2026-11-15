# Creative tags and "What's working"

**What it is:** every ad's copy is read by **Jev**, TypeSafe AI's decision model, and tagged with what it offers, who it speaks to and how it opens. Insights → **What's working** then compares cost per lead for each tag across every Active and New client. One ads manager can see what's working across 40+ accounts without opening each one.

## Tags

Defined once in `shared/domain/creativeTags.ts` (tests: `creativeTags.test.ts`); the same list drives the questions sent to Jev and the labels on screen.

| Tag | Options |
|---|---|
| Offer | Free trial class, Free week, Paid intro or price, Seasonal or limited sale, No clear offer |
| Audience | Kids (parents), Teens, Adults, Women, Families |
| Opening hook | Calls out a place or group, Problem or frustration, Result or benefit, Urgency or scarcity, Social proof, Question |
| Format | Image or Video (from Meta, no AI) |
| Yes/no (since 15 Nov 2026) | Mentions a price or saving (a free class alone doesn't count), has a deadline or limited spots, names the city or area, mentions a free uniform or gear |

To change a list, edit `TAG_QUESTIONS`. Changed options apply to newly tagged ads; to re-tag everything, delete the rows in `creative_tags` and the hourly job redoes them.

## On Insights (since 15 Nov 2026)

- **Ads tab:** each ad shows its tags as small labels under its name (Free trial · Kids · Place callout · Deadline · City).
- **Campaigns and Ad sets tabs:** a one-line summary of their ads in the period, e.g. "3 ads: 2 free trial, 1 seasonal · kids".
- **Filters** ("What the ad says", on the Campaigns, Ad sets and Ads tabs): Offer, Audience, Opening hook, and Price / Deadline / City / Uniform. The Ads tab shows matching ads; Campaigns and Ad sets show the ones running them. Remembered per browser; **Clear** resets. Combine with Sort, e.g. Offer "Free trial" + CPL high to low finds the weakest free-trial ad.
- **CSV:** ads get a column per tag; campaigns and ad sets get the summary.
- Labels come from `creative_tags_for(ids)` (migration 3300). Helpers: `tagChips`, `matchesTagFilter`, `summariseTags` in `shared/domain/creativeTags.ts`.

## How it runs

- **`tag-creatives`** (Edge Function, hourly at :50, migration 2800): takes up to 400 ad creatives with copy and no tags yet, biggest spenders of the last 90 days first, and asks Jev three choice questions about each (one request per creative, 6 at a time). Answers are saved in `creative_tags` with Jev's confidence. Meta creatives can't be edited, so each is tagged once per `TAG_VERSION` (bump it when the questions change and the hourly job re-tags everything; version 2 on 15 Nov 2026 took about 6 runs of 1,000).
- **Ad text:** some ads keep their text in the post spec or, with several texts, in the asset feed rather than in title/body. The Meta sync reads those too (`creativeCopy`), so those ads get tagged (68 of the week's 345 ads were missing before 15 Nov 2026).
- **API:** `POST https://api.typesafe.ai/v1/systemone` with `model`, `state` (the headline and primary text) and `questions`. Model `jev-latest` (override with the `JEV_MODEL` secret).
- **Safety:** an answer Jev doesn't give, or gives outside the list, is saved as nothing rather than guessed. If no answer in a run can be read, the run fails on the **Sync** screen ("Ad tagging (Jev)") with an example of what came back. A rejected key stops the run.
- **Report:** `creative_tag_report(from, to)` adds up spend and leads by tag for lead-campaign ads that spent in the period (sales campaigns left out). Any staff member can see it.

## Cost

Jev is priced at about $0.042 per million input tokens, with output free (Nov 2026 rate card). The first pass over the ~5,800 creatives with copy is roughly 2 million tokens, about **10 cents**. After that, only new ads, a few cents a month.

## Setup

One secret, `TYPESAFE_API_KEY`: steps in [sop/tokens-and-secrets.md](sop/tokens-and-secrets.md#add-the-typesafe-key-jev-ad-tagging). Until it's added, the Sync screen shows the job as skipped and What's working shows only image vs video.

**Done 11 Nov 2026:** the key was added and all 5,811 creatives with copy were tagged in about 4 minutes (batches of up to 1,000, the most one run can take; about 400 every 17 seconds), none failed. To force a run: `select private.call_function('tag-creatives', '?limit=1000')`.

## First results (last 30 days, 11 Nov 2026, lead campaigns only)

- **Video** $36.56 a lead vs **image** $26.33 (13 accounts run video). The clearest difference.
- **Opening hook:** calling out the place or group $27.29, benefit-led $28.60, urgency-led $30.21. Small differences; not enough to act on yet.
- **Kids** $27.91 vs **adults** $25.54. The women-only ads ($318 a lead) are one account, so that's about that client.
- **Seasonal / Black Friday** offers: only 10 ads, $157 so far. Too early to judge.
- 64 ads have no copy Meta shares (some dynamic creatives), so they show as not tagged.

**Correction:** the first version of this report also counted sales campaigns, which made seasonal offers look like $179 a lead. Almost all of that was Jiu Jitsu FLO's Black Friday product sale (a Sales campaign: 37 ads, $1,630, 6 leads), which aims for purchases, not leads. Since migration 3000 the report counts lead campaigns only (`OUTCOME_LEADS`), which is 96% of spend.

## Reading the numbers

- Green: cost per lead at least 10% below the average for the period. Red: at least 10% above, or spend with no leads.
- "(few ads)": under 5 ads or under 3 accounts. Treat it as a hint, not a result.
- It shows what went together, not what caused it: kids ads may be cheaper because of the offer, the season or the gyms that run them. Use it to decide what to test next.
