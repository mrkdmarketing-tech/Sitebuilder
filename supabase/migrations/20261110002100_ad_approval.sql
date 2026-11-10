-- =============================================================================
-- 2100 Ad approval screens (docs/ad-approval.md, docs/sop/ad-approval-*.md).
--
--  * set_review_status(): the only way to change an ad's status. Checks the move
--    is allowed (same list as shared/domain/approvals.ts MOVES), stamps the
--    times, records how many AI findings were still open on submit, and writes
--    the history row. A trigger stops the app changing status any other way.
--  * ad_review_list(): the Approvals list in one call.
--  * client_brief(): the business info shown next to the editor and used to fill
--    template {{placeholders}} and by the AI check.
--  * Ads imported from Retool (legacy_id set) are read-only history.
--  * ad_review_assets.frames: small JPEG previews made in the browser at upload
--    (one per image, several per video) for thumbnails and the AI check.
-- =============================================================================

alter table public.ad_reviews add column if not exists legacy jsonb;
alter table public.ad_review_assets add column if not exists frames jsonb not null default '[]'::jsonb;
alter table public.ad_review_findings add column if not exists finding_key text;

-- ---------------------------------------------------------------------------
-- Status changes go through set_review_status only.
-- ---------------------------------------------------------------------------
create or replace function public.ad_reviews_guard_status()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status is distinct from old.status
     and current_user = 'authenticated'
     and coalesce(current_setting('app.review_move', true), '') <> 'on' then
    raise exception 'Change the status with set_review_status().' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger ad_reviews_guard_status before update on public.ad_reviews
  for each row execute function public.ad_reviews_guard_status();

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

-- ---------------------------------------------------------------------------
-- Imported Retool history is read-only (restrictive policies add to the others).
-- ---------------------------------------------------------------------------
create or replace function public.review_is_editable(p_review uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.ad_reviews where id = p_review and legacy_id is null)
$$;
revoke all on function public.review_is_editable(uuid) from public, anon;
grant execute on function public.review_is_editable(uuid) to authenticated;

create policy not_legacy on public.ad_reviews as restrictive for update to authenticated
  using (legacy_id is null) with check (legacy_id is null);
create policy not_legacy_insert on public.ad_reviews as restrictive for insert to authenticated
  with check (legacy_id is null and created_by = (select public.current_employee_id()));

do $$
declare t text;
begin
  foreach t in array array['ad_review_assets', 'ad_review_comments', 'ad_review_checklist', 'ad_review_findings', 'ad_review_events'] loop
    execute format('create policy not_legacy_insert on public.%I as restrictive for insert to authenticated
                      with check (public.review_is_editable(review_id))', t);
    execute format('create policy not_legacy_update on public.%I as restrictive for update to authenticated
                      using (public.review_is_editable(review_id)) with check (public.review_is_editable(review_id))', t);
  end loop;
end $$;

-- Comments are added as yourself.
create policy own_comment on public.ad_review_comments as restrictive for insert to authenticated
  with check (author_id = (select public.current_employee_id()));

-- ---------------------------------------------------------------------------
-- The Approvals list.
-- ---------------------------------------------------------------------------
create or replace function public.ad_review_list()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(row_to_json(x)::jsonb order by x."updatedAt" desc), '[]'::jsonb)
  from (
    select r.id, r.name, r.client_id as "clientId", c.business_name as "clientName", r.status,
           r.created_by as "createdBy", nullif(trim(cb.first_name || ' ' || cb.last_name), '') as "createdByName",
           r.reviewer_id as "reviewerId", nullif(trim(rv.first_name || ' ' || rv.last_name), '') as "reviewerName",
           r.ad_type as "adType", r.booking_type as "bookingType",
           r.created_at as "createdAt", r.updated_at as "updatedAt", r.submitted_at as "submittedAt",
           r.legacy_id is not null as legacy,
           (select count(*) from public.ad_review_findings f where f.review_id = r.id and f.status = 'open')::int as "openFindings",
           (select a.frames->0->>'path' from public.ad_review_assets a where a.review_id = r.id
             order by a.position, a.created_at limit 1) as "thumbPath"
    from public.ad_reviews r
    left join public.clients c on c.id = r.client_id
    left join public.employees cb on cb.id = r.created_by
    left join public.employees rv on rv.id = r.reviewer_id
  ) x
$$;
revoke all on function public.ad_review_list() from public, anon;
grant execute on function public.ad_review_list() to authenticated;

-- ---------------------------------------------------------------------------
-- Business info for one client: shown beside the editor, fills {{placeholders}},
-- and tells the AI check what the ad should say (city, phone, offer...).
-- Billing ids, payment links and internal document links are left out.
-- ---------------------------------------------------------------------------
create or replace function public.client_brief(p_client integer)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  c   public.clients;
  gc  jsonb;
  o   public.client_onboarding;
  cs  public.campaign_specifics;
  mgr text;
  facts jsonb := '[]'::jsonb;
  ph  jsonb := '{}'::jsonb;
  cf  record;
begin
  select * into c from public.clients where id = p_client;
  if not found then return null; end if;
  gc := coalesce(c.profile->'ghl_contact', '{}'::jsonb);
  select * into o from public.client_onboarding where client_id = p_client;
  select * into cs from public.campaign_specifics where client_id = p_client order by id desc limit 1;
  select nullif(trim(first_name || ' ' || last_name), '') into mgr from public.employees where id = c.ad_manager_id;

  -- Decoded GHL custom fields (names from ghl_custom_fields), minus private ones.
  for cf in
    select f.name, f.field_key, e.value->>'value' as v
    from jsonb_array_elements(case when jsonb_typeof(gc->'customFields') = 'array' then gc->'customFields' else '[]'::jsonb end) e(value)
    join public.ghl_custom_fields f on f.id = e.value->>'id'
    where coalesce(e.value->>'value', '') <> ''
      and f.name !~* '(stripe|subscription|customer id|invoice|payment|billing|token|password|secret|pandadoc|clickup|drive|folder|onboarding status|tier|retainer|ghl|location id|pixel|sheet)'
    order by f.name
  loop
    facts := facts || jsonb_build_array(jsonb_build_object('label', cf.name, 'value', cf.v));
    if cf.field_key is not null then ph := ph || jsonb_build_object(cf.field_key, cf.v); end if;
  end loop;

  ph := ph || jsonb_strip_nulls(jsonb_build_object(
    'business_name', coalesce(gc->>'companyName', c.business_name),
    'city', coalesce(gc->>'city', c.city),
    'state', coalesce(gc->>'state', c.state),
    'address', gc->>'address1',
    'postal_code', gc->>'postalCode',
    'phone', gc->>'phone',
    'website', coalesce(gc->>'website', c.website),
    'call_to_action', cs.cta_for_ad,
    'booking_link', cs.booking_calendar_link,
    'landing_page', cs.landing_page_link,
    'offer', o.special_introductory_offers,
    'programs', case when jsonb_typeof(o.name_of_programs) = 'array'
                     then (select string_agg(x, ', ') from jsonb_array_elements_text(o.name_of_programs) x)
                     else o.name_of_programs #>> '{}' end,
    'pricing', o.pricing_details,
    'instructor', o.instructor_name,
    'kids_ages', o.kid_program_age_range,
    'kids_class_time', o.kid_program_class_time,
    'area_callouts', case when jsonb_typeof(coalesce(cs.area_callouts, o.area_callouts)) = 'array'
                          then (select string_agg(x, ', ') from jsonb_array_elements_text(coalesce(cs.area_callouts, o.area_callouts)) x) end
  ));

  return jsonb_build_object(
    'clientId', c.id,
    'businessName', coalesce(gc->>'companyName', c.business_name),
    'status', c.active_status,
    'adsManagerId', c.ad_manager_id,
    'adsManager', mgr,
    'placeholders', ph,
    'facts', facts,
    'onboarding', case when o.client_id is null then null else jsonb_strip_nulls(jsonb_build_object(
      'Speciality', o.gyms_speciality, 'Core value', o.gyms_core_value, 'Instructor', o.instructor_name,
      'Instructor experience (years)', o.instructor_years_of_experience, 'Belts', o.instructor_belts,
      'Programs', ph->>'programs', 'Introductory offer', o.special_introductory_offers,
      'What to sign up for', o.what_to_sign_up_for_program, 'Program details', o.program_details,
      'Sessions per week', o.no_of_training_session_per_week, 'Pricing', o.pricing_details,
      'Kids ages', o.kid_program_age_range, 'Kids class time', o.kid_program_class_time,
      'Kids free trial', o.free_trial_for_kid_program_specifications)) end,
    'campaign', case when cs.id is null then null else jsonb_strip_nulls(jsonb_build_object(
      'Ad type', cs.ad_type, 'Call to action', cs.cta_for_ad, 'Objective', cs.objective_and_goal,
      'Landing page', cs.landing_page_link, 'Booking link', cs.booking_calendar_link,
      'Monthly budget', cs.monthly_adspend_budget, 'Lead goals', cs.lead_goals,
      'Area callouts', ph->>'area_callouts')) end
  );
end $$;
revoke all on function public.client_brief(integer) from public, anon;
grant execute on function public.client_brief(integer) to authenticated, service_role;

create index if not exists ad_review_findings_key_idx on public.ad_review_findings (review_id, finding_key);
