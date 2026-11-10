-- =============================================================================
-- 1900 Show the ad name next to each "Turn off" in the audit log.
-- actions_log gets an optional ad_id (set by meta-action). If an ad is later
-- removed, the log entry stays and keeps its target_id.
-- =============================================================================
alter table public.actions_log
  add column if not exists ad_id text constraint actions_log_ad_fk references public.meta_ads (id) on delete set null;

update public.actions_log l set ad_id = l.target_id
where l.action = 'meta.pause_ad' and l.ad_id is null
  and exists (select 1 from public.meta_ads a where a.id = l.target_id);

create index if not exists actions_log_ad_idx on public.actions_log (ad_id);
