-- =============================================================================
-- 2000 Settings screen (docs/sop/changing-thresholds.md).
--
-- save_rule_settings(params): owners/admins change the global suggestion
-- thresholds from the app. Checks every value, saves who changed it, and writes
-- the before/after to actions_log in the same transaction. Runs as the caller
-- (security invoker), so the admin-only rules on rule_settings still apply.
-- =============================================================================
create or replace function public.save_rule_settings(p_params jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  me_id  text := public.current_employee_id();
  old    jsonb;
  clean  jsonb := '{}'::jsonb;
  k      text;
  v      jsonb;
  n      numeric;
  limits constant jsonb := '{
    "expensiveCpl":      [1, 10000],
    "noLeadSpend":       [1, 10000],
    "budgetHogShare":    [0.1, 1],
    "budgetHogCpl":      [1, 10000],
    "lowCtr":            [0.01, 100],
    "lowLinkCtr":        [0.01, 100],
    "minImpressions":    [0, 10000000],
    "noRecentLeadsDays": [1, 60]
  }';
begin
  if not public.is_admin() then
    raise exception 'Only owners and admins can change thresholds.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_params) is distinct from 'object' then
    raise exception 'Settings must be an object.' using errcode = '22023';
  end if;

  for k, v in select * from jsonb_each(p_params) loop
    if not limits ? k then
      raise exception 'Unknown setting: %', k using errcode = '22023';
    end if;
    if jsonb_typeof(v) <> 'number' then
      raise exception 'Setting % must be a number.', k using errcode = '22023';
    end if;
    n := v::numeric;
    if n < (limits->k->>0)::numeric or n > (limits->k->>1)::numeric then
      raise exception 'Setting % must be between % and %.', k, limits->k->>0, limits->k->>1 using errcode = '22023';
    end if;
    clean := clean || jsonb_build_object(k, n);
  end loop;

  select params into old from public.rule_settings where scope = 'global';
  if old is null then
    insert into public.rule_settings (scope, scope_key, params, updated_by)
    values ('global', null, clean, me_id);
  else
    update public.rule_settings
       set params = old || clean, updated_by = me_id, updated_at = now()
     where scope = 'global';
  end if;

  insert into public.actions_log (actor_id, action, target_type, target_id, before, after)
  values (me_id, 'rules.update', 'rule_settings', 'global', old, coalesce(old, '{}'::jsonb) || clean);

  return coalesce(old, '{}'::jsonb) || clean;
end $$;

revoke all on function public.save_rule_settings(jsonb) from public, anon;
grant execute on function public.save_rule_settings(jsonb) to authenticated;
