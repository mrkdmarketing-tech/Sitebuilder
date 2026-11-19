# Prospects (owners only)

People MRKD is selling to who haven't signed yet: chats from GHL, sorted by stage, with how warm each one is and what it's worth. **Only Jordan and Trent can see it.** Built 19 Nov 2026. How to use it: [sop/prospects.md](sop/prospects.md).

## Who can see it

- **Owners only** (role `owner`: Jordan and Trent), and only after two-step sign-in.
- The database enforces it, not just the screen: `public.is_owner()` (migration 3700) is the only thing that lets anyone read `prospects` or `prospect_messages`. Admins and staff get zero rows, even with the address or a direct database call. Tested 19 Nov: staff 0 rows, owner without the code 0, owner with the code all of them, anonymous refused.
- Staff don't see the **Prospects** tab (desktop sidebar or phone bar), and the page says "only for the owners" if they type the address.
- Owner changes are **not** written to `actions_log`, because staff can read that table. Each prospect keeps who changed it last and when.
- Giving someone else access means making them an owner (Settings → Staff), which gives every owner power. Ask Claude for a separate permission first if that's ever needed.

## Where the data comes from

`prospects-sync` (Edge Function, every 30 minutes at :05 and :35) reads MRKD's own GHL sub-account. It never writes to GHL.

1. **Pipelines and opportunities**: the GHL stage and value of each contact's latest sales opportunity.
2. **Chats from the last 120 days** (`/conversations/search`). Left out: clients (anyone with a Client Status or in The Lab's clients), the team (matched by email, MRKD's email domain or phone), and contacts that are only in client, hiring or training pipelines (`NOT_SALES_PIPELINES` in `shared/domain/prospects.ts`).
3. **The latest 40 messages** of each chat that changed since the last run (`prospect_messages`).
4. **Jev reads each changed chat** and suggests three things:
   - **Who they are**: prospect, client, job applicant, member of the public, or other (vendor, spam, nothing to tell). Only prospects go on the board.
   - **Type**: Jiu jitsu (any martial arts gym, or a chat about gym members, classes or leads), Steel structures (steel or metal buildings, carports, barns, storage), or Other.
   - **Temperature**: Hot (asking about price, start or next steps, recent replies), Warm (interested, nothing agreed), Cold (stopped replying, not now, or only MRKD writing).

What Jev gets: the chat text only, with names, email addresses, phone numbers and links removed (`chatTranscript`). Jev reads a chat again only when there's a new message, or when the questions change (`PROSPECT_VERSION`).

## What the owners set

| Field | Notes |
|---|---|
| Temperature, Type | Jev's suggestion shows with a `*` until an owner picks one. Jev never changes an owner's choice. |
| Stage | New, Call 1 booked, Call 1 done, Proposal sent, Call 2, Won, Lost. Until set, it follows the GHL stage where one matches (e.g. "Call Booked" → Call 1 booked, "Proposal Sent" → Proposal sent, "Won" → Won), otherwise New. |
| Value | Dollars a month. The GHL opportunity value shows next to it as a hint. |
| Next step and date | Shown on the card; red once the date has passed. |
| Notes | Free text, owners only. |
| Not a prospect | Takes it off the board (it stays under "Not on the board"). |

Prospects can also be **added by hand** for chats GHL can't see (e.g. a personal Facebook profile). Facebook and Instagram messages to MRKD's Page do come through GHL by themselves.

## First run (19 Nov 2026)

130 chats in the last 120 days, 78 kept after leaving out clients and the team, 43 read as prospects (2 hot, 5 warm, 36 cold). The steel structures and jiu jitsu people the owners named all came out with the right type once the wording was improved so a chat about "leads for gyms" counts as jiu jitsu. 23 were calls or activity with no text, so there was nothing to read.

No prospect names are kept in this repository: they live only in the database, behind the owners-only lock.

## Pieces

| Piece | Where |
|---|---|
| Rules (stages, types, temperature, Jev questions, totals) | `shared/domain/prospects.ts` (tests: `prospects.test.ts`) |
| Tables and access | `supabase/migrations/20261119003700_prospects.sql` |
| Sync job | `supabase/functions/prospects-sync/index.ts` (`?probe=shape` shows GHL's field names, no values) |
| Screen | `web/src/features/prospects/ProspectsPage.tsx`, data in `web/src/data/prospects.ts` |

GHL permissions needed on "The Lab (read-only)": View Conversations, View Conversation Messages, View Opportunities (added 19 Nov), plus the ones in [sop/tokens-and-secrets.md](sop/tokens-and-secrets.md#connect-ghl-read-only).

## Later, when wanted

- Tie Proposal sent to the proposal work.
- Write stage and value back to GHL's own pipeline (off until the owners say go).
- A daily nudge for next steps that are due.
