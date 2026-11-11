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

To change a list, edit `TAG_QUESTIONS`. Changed options apply to newly tagged ads; to re-tag everything, delete the rows in `creative_tags` and the hourly job redoes them.

## How it runs

- **`tag-creatives`** (Edge Function, hourly at :50, migration 2800): takes up to 400 ad creatives with copy and no tags yet, biggest spenders of the last 90 days first, and asks Jev three choice questions about each (one request per creative, 6 at a time). Answers are saved in `creative_tags` with Jev's confidence. Meta creatives can't be edited, so each is tagged once.
- **API:** `POST https://api.typesafe.ai/v1/systemone` with `model`, `state` (the headline and primary text) and `questions`. Model `jev-latest` (override with the `JEV_MODEL` secret).
- **Safety:** an answer Jev doesn't give, or gives outside the list, is saved as nothing rather than guessed. If no answer in a run can be read, the run fails on the **Sync** screen ("Ad tagging (Jev)") with an example of what came back. A rejected key stops the run.
- **Report:** `creative_tag_report(from, to)` adds up spend and leads by tag for ads that spent in the period. Any staff member can see it.

## Cost

Jev is priced at about $0.042 per million input tokens, with output free (Nov 2026 rate card). The first pass over the ~5,800 creatives with copy is roughly 2 million tokens, about **10 cents**. After that, only new ads, a few cents a month.

## Setup

One secret, `TYPESAFE_API_KEY`: steps in [sop/tokens-and-secrets.md](sop/tokens-and-secrets.md#add-the-typesafe-key-jev-ad-tagging). Until it's added, the Sync screen shows the job as skipped and What's working shows only image vs video.

**Done 11 Nov 2026:** the key was added and all 5,811 creatives with copy were tagged in about 4 minutes (batches of up to 1,000, the most one run can take; about 400 every 17 seconds), none failed. To force a run: `select private.call_function('tag-creatives', '?limit=1000')`.

## First results (last 30 days, 11 Nov 2026)

- **Seasonal offers** (mostly Black Friday): 47 ads, 4 accounts, $1,787 for 10 leads, **$179 a lead** vs about $28 overall. Many were just launched, so check again in a week.
- **Video** $39.83 a lead vs **image** $27.18.
- **Opening hook:** calling out the place or group ("HOWARD COUNTY PARENTS") $27.55, benefit-led $31.70, urgency-led $36.13.
- **Kids and adults** cost the same (about $28). The women-only ads ($318 a lead) are one account, so that's about that client, not women's ads in general.
- 64 ads have no copy Meta shares (some dynamic creatives), so they show as not tagged.

## Reading the numbers

- Green: cost per lead at least 10% below the average for the period. Red: at least 10% above, or spend with no leads.
- "(few ads)": under 5 ads or under 3 accounts. Treat it as a hint, not a result.
- It shows what went together, not what caused it: kids ads may be cheaper because of the offer, the season or the gyms that run them. Use it to decide what to test next.
