-- Ad approval: Slack messages in #mrkd-internal-app, and Jordan as the default reviewer.
-- docs/ad-approval.md#slack-messages
--
-- 1. app_settings 'approvals.default_reviewer': who reviews a submitted ad when
--    nobody is picked (Jordan). Used by set_review_status and the Submit box.
-- 2. set_review_status: reviewer = picked, else the ad's reviewer so far, else the
--    default reviewer (if still active), else the client's ads manager.
-- 3. After each status change of an ad made in The Lab (not Retool imports), the
--    database asks the approval-notify function to post in Slack (pg_net, so it
--    never slows the click down or fails it).

insert into public.app_settings (key, value)
select 'approvals.default_reviewer', to_jsonb(e.id)
from public.employees e
where e.first_name = 'Jordan' and e.last_name = 'Bosley' and e.active
on conflict (key) do nothing;

create or replace function public.set_review_status(
  p_review uuid,
  p_to text,
  p_note text default null,
  p_reviewer text default null,
  p_acknowledged uuid[] default null
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r       public.ad_reviews;
  me_id   text := public.current_employee_id();
  open_n  integer;
  allowed constant jsonb := '{
    "draft":           ["review_pending"],
    "request_changes": ["review_pending"],
    "review_pending":  ["approved", "request_changes"],
    "approved":        ["completed", "request_changes"],
    "completed":       []
  }';
begin
  if me_id is null then
    raise exception 'Not signed in as an MRKD employee.' using errcode = '42501';
  end if;
  select * into r from public.ad_reviews where id = p_review;
  if not found then
    raise exception 'Ad not found.' using errcode = 'P0002';
  end if;
  if r.legacy_id is not null then
    raise exception 'This ad was imported from Retool and is read-only here.' using errcode = '42501';
  end if;
  if not (allowed->r.status) ? p_to then
    raise exception 'An ad that is % cannot move to %.', r.status, p_to using errcode = '22023';
  end if;

  select count(*) into open_n from public.ad_review_findings where review_id = p_review and status = 'open';

  perform set_config('app.review_move', 'on', true);
  update public.ad_reviews set
    status = p_to,
    reviewer_id = case when p_to = 'review_pending'
                       then coalesce(p_reviewer, reviewer_id,
                                     (select e.id from public.employees e
                                       where e.active and e.id = (select s.value #>> '{}' from public.app_settings s where s.key = 'approvals.default_reviewer')),
                                     (select c.ad_manager_id from public.clients c where c.id = r.client_id))
                       else reviewer_id end,
    submitted_at = case when p_to = 'review_pending' then now() else submitted_at end,
    submitted_with_open_findings = case when p_to = 'review_pending' then open_n else submitted_with_open_findings end,
    review_started_at = case when p_to = 'review_pending' and review_started_at is null then now() else review_started_at end,
    review_completed_at = case when p_to in ('approved', 'request_changes') then now() else review_completed_at end,
    completed_at = case when p_to = 'completed' then now() else completed_at end
  where id = p_review and status = r.status;   -- someone else may have moved it meanwhile
  if not found then
    raise exception 'Someone else just changed this ad. Reload and try again.' using errcode = '40001';
  end if;
  perform set_config('app.review_move', '', true);

  insert into public.ad_review_events (review_id, actor_id, from_status, to_status, note, acknowledged_findings)
  values (p_review, me_id, r.status, p_to, nullif(trim(p_note), ''), p_acknowledged);

  if nullif(trim(p_note), '') is not null then
    insert into public.ad_review_comments (review_id, author_id, body) values (p_review, me_id, trim(p_note));
  end if;

  return jsonb_build_object('status', p_to, 'openFindings', open_n);
end $$;
revoke all on function public.set_review_status(uuid, text, text, text, uuid[]) from public, anon;
grant execute on function public.set_review_status(uuid, text, text, text, uuid[]) to authenticated;

create or replace function private.notify_review_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.to_status in ('review_pending', 'request_changes', 'approved', 'completed')
     and exists (select 1 from public.ad_reviews r where r.id = new.review_id and r.legacy_id is null) then
    perform private.call_function('approval-notify', '?event=' || new.id::text);
  end if;
  return null;
end $$;
revoke all on function private.notify_review_event() from public, anon, authenticated;

drop trigger if exists ad_review_events_notify on public.ad_review_events;
create trigger ad_review_events_notify
  after insert on public.ad_review_events
  for each row execute function private.notify_review_event();
