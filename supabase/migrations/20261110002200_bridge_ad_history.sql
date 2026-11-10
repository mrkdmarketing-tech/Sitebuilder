-- =============================================================================
-- 2200 Retool bridge, part 2 (docs/retool-bridge.md, docs/ad-approval.md#history).
--
-- private.retool_bridge_ad_history(conn) copies, read-only, every 15 minutes
-- alongside retool_bridge_run():
--   * GHL custom field names for MRKD's agency location (to decode client info)
--   * ad creative and lead form templates
--   * Ad Preview history (ads_preview) as read-only ads in The Lab
--
-- Images in Retool's ads_preview are stored inside the row as base64. They are
-- removed ON RETOOL'S SIDE in the SELECT, so only the text crosses over; the
-- history shows how many images there were and any Canva links.
-- Same rules as 1100: plain SELECTs, nothing written to Retool, the connection
-- string is only an argument, each part independent, results in
-- retool_bridge_state.
-- =============================================================================

create or replace function private.retool_bridge_ad_history(p_conn text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  conn constant text := 'retool_bridge_ads';
  result jsonb := '{}'::jsonb;
  n integer;
  step text;
begin
  perform extensions.dblink_connect(conn, p_conn);

  -- ------------------------------------------------------- GHL custom fields
  begin
    step := 'ghl_custom_fields';
    insert into public.ghl_custom_fields as f (id, field_key, name, data_type, options, synced_at)
    select e.key, e.value->>'fieldKey', e.value->>'name', e.value->>'dataType',
           coalesce(e.value->'picklistOptions', e.value->'options'), now()
    from extensions.dblink(conn,
      'select custom_fields_metadata::jsonb from ghl_locations where id = ''1Pbw0cdWjFMBsIFPrA0d''')
      as r(meta jsonb)
    cross join lateral jsonb_each(case when jsonb_typeof(r.meta) = 'object' then r.meta else '{}'::jsonb end) e
    where jsonb_typeof(e.value) = 'object'
    on conflict (id) do update set
      field_key = excluded.field_key, name = excluded.name, data_type = excluded.data_type,
      options = excluded.options, synced_at = excluded.synced_at;
    get diagnostics n = row_count;
    result := result || jsonb_build_object(step, n);
  exception when others then
    result := result || jsonb_build_object(step, 'error: ' || sqlerrm);
  end;

  -- ---------------------------------------------------------------- templates
  begin
    step := 'ad_creative_templates';
    create temp table if not exists _tpl (id text, name text, body jsonb) on commit drop;
    truncate _tpl;
    insert into _tpl
    select * from extensions.dblink(conn, 'select id, name, coalesce(metadata, ''{}''::jsonb) from ad_creative_templates')
      as r(id text, name text, body jsonb);
    insert into public.ad_creative_templates as t (legacy_id, name, body)
    select id, coalesce(nullif(name, ''), 'Untitled template'), body from _tpl
    on conflict (legacy_id) do update set name = excluded.name, body = excluded.body;
    get diagnostics n = row_count;
    delete from public.ad_creative_templates t
     where t.legacy_id is not null and not exists (select 1 from _tpl x where x.id = t.legacy_id);
    result := result || jsonb_build_object(step, n);
  exception when others then
    result := result || jsonb_build_object(step, 'error: ' || sqlerrm);
  end;

  begin
    step := 'leadform_templates';
    truncate _tpl;
    insert into _tpl
    select * from extensions.dblink(conn, 'select id, name, coalesce(metadata, ''{}''::jsonb) from leadform_templates')
      as r(id text, name text, body jsonb);
    insert into public.leadform_templates as t (legacy_id, name, body)
    select id, coalesce(nullif(name, ''), 'Untitled template'), body from _tpl
    on conflict (legacy_id) do update set name = excluded.name, body = excluded.body;
    get diagnostics n = row_count;
    delete from public.leadform_templates t
     where t.legacy_id is not null and not exists (select 1 from _tpl x where x.id = t.legacy_id);
    result := result || jsonb_build_object(step, n);
  exception when others then
    result := result || jsonb_build_object(step, 'error: ' || sqlerrm);
  end;

  -- ------------------------------------------------------------ ads_preview
  begin
    step := 'ads_preview';
    create temp table if not exists _ap (
      id text, name text, client_id integer, created_at timestamp, updated_at timestamp,
      completed_at timestamp, review_started_at timestamp, review_completed_at timestamp,
      step text, current_status text, comments jsonb, ai_response text, meta jsonb, image_count integer
    ) on commit drop;
    truncate _ap;
    -- Base64 images are stripped by Retool's database before sending.
    insert into _ap
    select * from extensions.dblink(conn, $q$
      select id, name, client_id, created_at, updated_at, completed_at, review_started_at, review_completed_at,
             step, current_status, comments::jsonb, ai_response,
             (coalesce(metadata, '{}'::jsonb) #- '{adCreative,imageBase64}')
               || jsonb_build_object('adCreative',
                    (coalesce(metadata->'adCreative', '{}'::jsonb) - 'imageBase64')
                    || jsonb_build_object('images', coalesce((
                         select jsonb_agg(case when jsonb_typeof(e) = 'object' then e - 'imageBase64' else 'null'::jsonb end)
                         from jsonb_array_elements(case when jsonb_typeof(metadata->'adCreative'->'images') = 'array'
                                                        then metadata->'adCreative'->'images' else '[]'::jsonb end) e), '[]'::jsonb))),
             (case when jsonb_typeof(metadata->'adCreative'->'images') = 'array'
                   then jsonb_array_length(metadata->'adCreative'->'images') else 0 end)
             + (case when coalesce(metadata->'adCreative'->>'imageBase64', '') <> '' then 1 else 0 end)
      from ads_preview $q$)
      as r(id text, name text, client_id integer, created_at timestamp, updated_at timestamp,
           completed_at timestamp, review_started_at timestamp, review_completed_at timestamp,
           step text, current_status text, comments jsonb, ai_response text, meta jsonb, image_count integer);

    insert into public.ad_reviews as a (
      legacy_id, client_id, name, ad_type, booking_type, status, creative, leadform, legacy,
      submitted_at, review_started_at, review_completed_at, completed_at, created_at)
    select p.id,
           (select c.id from public.clients c where c.id = p.client_id),
           coalesce(nullif(p.name, ''), p.meta->'config'->>'name', 'Untitled ad'),
           p.meta->'config'->>'adType', p.meta->'config'->>'bookingType',
           case
             when lower(coalesce(p.current_status, '')) in ('completed', 'complete', 'live', 'done') then 'completed'
             when lower(coalesce(p.current_status, '')) in ('approved', 'approve') then 'approved'
             when lower(coalesce(p.current_status, '')) like '%change%' then 'request_changes'
             when lower(coalesce(p.current_status, '')) like '%review%' then 'review_pending'
             else 'draft'
           end,
           jsonb_strip_nulls(jsonb_build_object(
             'primaryText', p.meta->'adCreative'->>'primaryText',
             'headline', p.meta->'adCreative'->>'headline',
             'description', coalesce(p.meta->'adCreative'->>'descriptionAdCreative', p.meta->'adCreative'->>'description'),
             'callToAction', p.meta->'adCreative'->>'callToAction',
             'tracking', case when jsonb_typeof(p.meta->'adCreative'->'tracking') = 'array' then p.meta->'adCreative'->'tracking' end,
             'urlParameters', p.meta->'adCreative'->>'urlParameters')),
           jsonb_strip_nulls(jsonb_build_object(
             'formName', p.meta->'leadform'->>'formName',
             'formType', p.meta->'leadform'->>'formType',
             'greetingHeadline', p.meta->'leadform'->>'greetingHeadline',
             'greetingDescription', p.meta->'leadform'->>'greetingDescription',
             'questions', case when jsonb_typeof(p.meta->'leadform'->'questions') = 'array' then p.meta->'leadform'->'questions' end,
             'privacyPolicyUrl', p.meta->'leadform'->>'privacyPolicyUrl',
             'thankYouHeadline', p.meta->'leadform'->>'messageForLeadsHeadline',
             'thankYouDescription', p.meta->'leadform'->>'messageForLeadsDescription',
             'thankYouCallToAction', p.meta->'leadform'->>'messageForLeadsCallToAction',
             'thankYouUrl', p.meta->'leadform'->>'messageForLeadsUrl')),
           jsonb_build_object(
             'step', p.step, 'currentStatus', p.current_status, 'comments', coalesce(p.comments, '[]'::jsonb),
             'aiResponse', p.ai_response, 'imageCount', p.image_count,
             'canvaLinks', coalesce((select jsonb_agg(distinct v) from (
                 select e->>'canvaLink' as v from jsonb_array_elements(p.meta->'adCreative'->'images') e
                 union all select p.meta->'adCreative'->>'canvaLink') l where coalesce(v, '') <> ''), '[]'::jsonb),
             'metadata', p.meta,
             'updatedAt', p.updated_at),
           case when p.review_started_at is not null or p.review_completed_at is not null then coalesce(p.review_started_at, p.updated_at) end,
           p.review_started_at, p.review_completed_at, p.completed_at,
           coalesce(p.created_at, now())
    from _ap p
    where p.id is not null
    on conflict (legacy_id) do update set
      client_id = excluded.client_id, name = excluded.name, ad_type = excluded.ad_type,
      booking_type = excluded.booking_type, status = excluded.status, creative = excluded.creative,
      leadform = excluded.leadform, legacy = excluded.legacy, submitted_at = excluded.submitted_at,
      review_started_at = excluded.review_started_at, review_completed_at = excluded.review_completed_at,
      completed_at = excluded.completed_at, created_at = excluded.created_at;
    get diagnostics n = row_count;
    delete from public.ad_reviews r
     where r.legacy_id is not null and not exists (select 1 from _ap p where p.id = r.legacy_id);
    result := result || jsonb_build_object(step, n);
  exception when others then
    result := result || jsonb_build_object(step, 'error: ' || sqlerrm);
  end;

  perform extensions.dblink_disconnect(conn);

  insert into public.retool_bridge_state (table_name, last_success, last_row_count, last_error)
  select key,
         case when jsonb_typeof(value) = 'number' then now() end,
         case when jsonb_typeof(value) = 'number' then value::int end,
         case when jsonb_typeof(value) = 'string' then value #>> '{}' end
  from jsonb_each(result)
  on conflict (table_name) do update set
    last_success = coalesce(excluded.last_success, public.retool_bridge_state.last_success),
    last_row_count = coalesce(excluded.last_row_count, public.retool_bridge_state.last_row_count),
    last_error = excluded.last_error;

  return result;
exception when others then
  begin
    perform extensions.dblink_disconnect(conn);
  exception when others then null;
  end;
  raise;
end $$;

revoke all on function private.retool_bridge_ad_history(text) from public, anon, authenticated;
grant execute on function private.retool_bridge_ad_history(text) to service_role;
