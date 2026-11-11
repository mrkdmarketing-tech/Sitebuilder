# SOP: Submitting an ad for approval

**Who:** whoever builds the ad. **When:** every new ad, and every change to a live ad's copy or creative. Replaces Retool's Ad Preview.

How it works behind the scenes: [../ad-approval.md](../ad-approval.md).

## Steps

1. Open **Ad approval** and click **New ad**.
2. Pick the **client** (location) and give the ad a **name** (follow the campaign naming convention). Click **Create**. It's saved as a draft and you can come back to it any time.
3. **Images and videos:** click **Add files** and choose them from your computer, or paste a **Canva link**. Files are private to MRKD staff.
4. **Copy:** primary text and headline. Or pick a template under **Start from a template**; its `{{placeholders}}` are filled from the client's info (shown on the right). Call to action, description, tracking and URL parameters are under **More**.
5. **Ad type and booking:** pick the ad type. It's used to spot the wrong discipline (Muay Thai in a jiu jitsu ad).
6. **Lead form** (optional, folded): form name, type, greeting, questions, privacy policy link, thank-you message. Or note the existing Meta lead form you're reusing.
7. Watch for **red or amber notes under the fields** as you type. They're the built-in checks: misspelled words, the wrong discipline, a phone number or address that isn't the client's, a weekday that doesn't match the date, another location's name or city, placeholders left in. Fix them, or click **Ignore** in the Mistake check panel if it's not a mistake.
8. Click **Submit for approval** (top right). It saves, runs the full check (a few seconds), then asks who should review.
9. If anything is still open, the box is titled **"Hey, just double checking"** and lists it. Click **Go back and fix** or **Submit anyway**. Submitting anyway is allowed; it's recorded which issues were open.

## After submitting

- Status goes to **Waiting for review**. The reviewer (Jordan unless you picked someone else) is tagged in **#mrkd-internal-app** on Slack and sees it in their **Needs me** view.
- You're tagged in Slack when it's sent back or approved.
- If the reviewer clicks **Request changes**, it comes back to you with their comments. Fix, then **Submit again**.
- Once **Approved**, build or update the ad in Meta by hand, then click **Mark as live** (status **Live**).

## Good to know

- The checks are a second pair of eyes, not a gate. They can be wrong; trust your judgement.
- A phone or address warning on every ad for one client usually means the details on file in GHL are out of date. Update GHL rather than ignoring it each time.
- Until the Claude key is added (see [tokens-and-secrets.md](tokens-and-secrets.md#add-the-claude-key-ai-ad-check)), only the built-in checks run. Reading the text inside images and videos needs the Claude check.
- **Full check** in the Mistake check panel runs the same check as Submit without submitting. Running it again without changing anything doesn't re-run Claude (no charge).
- Video: the browser takes up to 8 stills from the video when you upload it, and the check reads those. iPhone HEVC `.mov` files often can't be read by the browser; export as MP4.
- Old ads from Retool's Ad Preview are under **From Retool**, read-only. Their images weren't copied; open them in Retool.
