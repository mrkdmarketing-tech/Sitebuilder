# Ad Studio: create ads in an approved style

**What it is:** in ad approval, **Create with a style** makes ads in MRKD's approved styles from a short form, for the ad's client. The MRKD style kit's own Python draws them, so they look exactly like the approved examples. Picked ads are added to the ad like uploaded files and then go through the same mistake checks, Submit and review.

**Status (18 Nov 2026):** pilot with one style, **EC Echo** (adults, split layout, 1:1). Tested end to end on the real build: 3 ads for GB Renton made in about 6 seconds (engine load included) and added to the ad.

## How it works

1. **The kit lives in The Lab, privately.** Each style's code, fonts, starter configs and approved people are stored in `style_kit_files` (migration 3400), readable by staff only. Small previews of each person (`thumbs/`) and of the examples are stored next to them. Loaded with `scripts/style-kit/load_style.py <CODE> <kit>/styles/<CODE>-...`.
2. **Python runs in the browser.** `web/src/lib/pyRender.worker.ts` loads Pyodide 0.27.7 (Python compiled for the browser) with Pillow, numpy and scipy from the jsDelivr CDN, about 25 MB the first time, then cached. No server, no monthly cost. The kit's script runs unchanged: `python3 ec_ad.py configs/studio.json out`.
3. **Files are cached by fingerprint** in the browser (`web/src/data/styleKit.ts`), so each person photo downloads once.
4. **The form** (`web/src/features/studio/AdStudio.tsx`) builds the style's config. Rules from the style's BUILD.md are in `shared/domain/styleKit.ts` (tested):
   - Gym: Gracie Barra or generic, guessed from the client name. GB people (GB patches) are only offered for Gracie Barra; the kit's script also refuses them otherwise.
   - Start from one of the kit's shipped configs; the client's name, city and a short code are filled in.
   - Lines copied from the example are flagged, and **"I've checked every line matches this client's real offer"** must be ticked before making ads (the kit's rule: never invent offers, ages, dates or prices).
   - "Black Friday" only with the "real Black Friday offer" box ticked. Prices and savings get a reminder. Big lines over 6 characters get a warning. The usual spelling checks run on every line.
   - Up to 6 ads at a time: person (from the approved people only), colours (cream, charcoal, navy, red), colour or black-and-white photo, person left or right.
5. **Results** show as a grid; tap to un-pick; **Add N to this ad** uploads them (with previews) to the ad.

## Adding the next styles

The newer kit styles (Oct and Nov 2026) are config-driven like Echo, so each needs: its zips loaded with the script, a definition in `shared/domain/styleKit.ts` (fields, starters, rules from its BUILD.md), and a style card in Ad Studio. Older styles that are changed by editing code (constants, copy in `build()`) need a small settings layer first.

The Google Drive connector can only fetch files up to 10 MB, so the core zip (12.5 MB) and Offer Stack (14 MB parts) need another route (attach them to a Claude session, or split them). Echo didn't need the core zip.

**Retired styles** (kit readme, Nov 3.0): SP, PC, 3S, INK, TEEN. Don't add them.

## Not built yet

- Other styles (next candidates: COMIC, KJB, GBP, KCE, F15, CK/KS, GRG, LS).
- Uploading a client's own photos as people (needs background removal; Higgsfield or rembg) and generating new people with Higgsfield, with approval before use. Photos of minors are never sent to AI generation (kit house rule).
- Black Friday Canva template (BF): stays in Canva; paste the Canva link in the ad.
- B-roll video edits.
