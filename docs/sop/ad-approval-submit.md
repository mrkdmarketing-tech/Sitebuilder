# SOP: Submitting an ad for approval

**Who:** whoever builds the ad. **When:** every new ad, and every change to a live ad's copy or creative. Replaces Retool's Ad Preview.

How it works behind the scenes: [../ad-approval.md](../ad-approval.md).

## Steps

1. Open **Approvals** and click **New ad**.
2. Pick the **client** and give the ad a **name** (follow the campaign naming convention). Click **Create**. It's saved as a draft and you can come back to it any time.
3. Fill in the **setup**: ad type and booking type. Optionally pick an **ad creative template** and **lead form template**; their `{{placeholders}}` are filled from the client's business info (shown on the right).
4. **Creative:** primary text, headline, description, call to action, tracking, URL parameters.
5. **Images and videos:** click **Add files** and choose them from your computer, or paste a **Canva link**. Files are private to MRKD staff.
6. **Lead form:** form name, type, greeting, questions, privacy policy URL, thank-you message. Or note the existing Meta lead form you're reusing.
7. Click **Save** as you go.
8. Click **Check for mistakes**. The AI check reads the copy, the text in images and the subtitles in videos (no audio), and lists anything that looks wrong: spelling, grammar, things that don't make sense, or details that don't match the client (city, gym name, phone, offer). For each one choose **Fixed** or **Ignore**.
9. Choose the **reviewer** (the client's ads manager is pre-selected) and click **Submit for approval**.
10. If any issues are still open, you'll see **"Hey, just double checking"** with the list. Click **Go back and fix** or **Submit anyway**. Submitting anyway is allowed; it's recorded which issues you saw.

## After submitting

- Status goes to **Waiting for review**. The reviewer sees it at the top of their Approvals list.
- If the reviewer clicks **Request changes**, it comes back to you with their comments. Fix, then **Submit again**.
- Once **Approved**, build or update the ad in Meta by hand, then click **Mark as live** (status **Live**).

## Good to know

- The AI check is a second pair of eyes, not a gate. It can be wrong; trust your judgement.
- Until the Claude key is added (see [tokens-and-secrets.md](tokens-and-secrets.md)), the check shows "AI check isn't set up yet" and everything else works.
