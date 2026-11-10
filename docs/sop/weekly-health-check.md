# SOP: Weekly health check

**Who:** an owner or admin. **When:** every Monday. **Time:** 10 minutes.

## Steps

1. **Sync status** screen:
   - Meta sync: green runs every 30 minutes, and the 2:20am **37-day backfill** each night.
   - Retool copy: green every 15 minutes.
   - Suggestions run: green at :10 and :40.
   - Any red or "partial" run: open it and read the error. Repeated errors: [troubleshooting.md](troubleshooting.md).
2. **Insights**, **All ads managers**, last 7 days: pick two accounts and compare spend and leads with Ads Manager for the same dates. They should match (small differences on today's numbers are normal).
3. **Suggestions**, **All ads managers**: look for suggestions more than 3 days old that nobody has acted on. Nudge the ads manager.
4. **Recently turned off**: anything marked **Failed**? Usually an account needing Manage campaigns ([new-client-or-ad-account.md](new-client-or-ad-account.md#2-share-the-ad-account-with-the-lab)).
5. **Approvals**: anything waiting for review for more than 2 working days?
6. Once a month: open Supabase → **Advisors** (Security and Performance) and check for new warnings. Known, expected ones are listed in [../auth.md](../auth.md#supabase-security-advisor).
