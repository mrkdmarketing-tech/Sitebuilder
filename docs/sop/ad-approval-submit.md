# SOP: Submitting an ad for approval

**Who:** whoever builds the ad. **When:** every new ad, and every change to a live ad's copy or creative. Replaces Retool's Ad Preview.

How it works behind the scenes: [../ad-approval.md](../ad-approval.md).

## Steps

1. Open **Ad approval** and click **New ad**.
2. Pick the **client** and give the ad a **name** (follow the campaign naming convention). Click **Create**. It's saved as a draft and you can come back to it any time.
3. Fill in the **setup**: ad type and booking type. Optionally pick an **ad creative template** and **lead form template**; their `{{placeholders}}` are filled from the client's business info (shown on the right).
4. **Creative:** primary text, headline, description, call to action, tracking, URL parameters.
5. **Images and videos:** click **Add files** and choose them from your computer, or paste a **Canva link**. Files are private to MRKD staff.
6. **Lead form:** form name, type, greeting, questions, privacy policy URL, thank-you message. Or note the existing Meta lead form you're reusing.
7. Click **Save** as you go.
8. Click **Check for mistakes**. The AI check reads the copy, the text in images and the subtitles in videos (no audio), and lists anything that looks wrong: spelling, grammar, things that don't make sense, or details that don't match the client (city, gym name, phone, offer). For each one choose **Fixed** or **Ignore**.
9. Click **Submit for approval** (top right). It saves first, then asks who should review (the client's ads manager is pre-selected).
10. If any issues are still open, the box is titled **"Hey, just double checking"** and lists them. Click **Go back and fix** or **Submit anyway**. Submitting anyway is allowed; it's recorded which issues were open.

## After submitting

- Status goes to **Waiting for review**. The reviewer sees it in their **Needs me** view.
- If the reviewer clicks **Request changes**, it comes back to you with their comments. Fix, then **Submit again**.
- Once **Approved**, build or update the ad in Meta by hand, then click **Mark as live** (status **Live**).

## Good to know

- The AI check is a second pair of eyes, not a gate. It can be wrong; trust your judgement.
- Until the Claude key is added (see [tokens-and-secrets.md](tokens-and-secrets.md#add-the-claude-key-ai-ad-check)), the check says "The AI check isn't set up yet" and everything else works.
- Checking again without changing anything says "Nothing changed since the last check" (it isn't re-run or charged).
- Video: the browser takes up to 8 stills from the video when you upload it, and the check reads those. iPhone HEVC `.mov` files often can't be read by the browser; export as MP4.
- Old ads from Retool's Ad Preview are under **From Retool**, read-only. Their images weren't copied; open them in Retool.
