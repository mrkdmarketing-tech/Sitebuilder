-- Reporting functions return the numbers Retool would (see seed.sql for the data).
do $$
declare r jsonb; acc jsonb;
begin
  -- Account level: Inactive client excluded, $0 accounts kept.
  r := public.report('account', '2026-11-01', '2026-11-07');
  assert jsonb_array_length(r) = 2, format('expected 2 accounts, got %s', jsonb_array_length(r));

  select e into acc from jsonb_array_elements(r) e where e->>'id' = '1001';
  assert (acc->>'spend')::numeric = 210, format('acc 1001 spend %s', acc->>'spend');
  assert (acc->>'leads')::int = 5, 'acc 1001 leads';
  assert (acc->>'impressions')::int = 9100, 'acc 1001 impressions';
  assert (acc->>'booked')::int = 2 and (acc->>'shown')::int = 1 and (acc->>'closed')::int = 1, 'outcomes';
  assert (acc->>'closedValue')::numeric = 200, 'closed value (lead outside range ignored)';
  assert (acc->>'valueGenerated')::numeric >= 200, 'value generated';
  assert acc->>'managerName' = 'Alex Rivera', 'manager name';
  assert acc->>'status' = 'ACTIVE', 'status';

  select e into acc from jsonb_array_elements(r) e where e->>'id' = '1002';
  assert (acc->>'accountActive')::boolean, 'UNSETTLED still counts as an active account (Retool parity)';

  -- Including inactive clients.
  r := public.report('account', '2026-11-01', '2026-11-07', true);
  assert jsonb_array_length(r) = 3, 'include inactive';

  -- Ad level: paused ad with no spend is left out; ordered by spend.
  r := public.report('ad', '2026-11-01', '2026-11-07');
  assert jsonb_array_length(r) = 3, format('expected 3 ads, got %s', jsonb_array_length(r));
  assert r->0->>'id' = 'a1', 'highest spend first';
  assert (r->0->>'spend')::numeric = 175 and (r->0->>'leads')::int = 2, 'a1 totals';
  assert (r->0->>'booked')::int = 1, 'a1 outcomes matched by ad name';
  assert r->0->>'adsetId' = 's1' and r->0->>'campaignName' = 'NJJ | Beginners | Leads', 'parents';

  -- Ad set + campaign levels add up.
  r := public.report('adset', '2026-11-01', '2026-11-07');
  select e into acc from jsonb_array_elements(r) e where e->>'id' = 's1';
  assert (acc->>'spend')::numeric = 210, 'adset s1 spend';
  r := public.report('campaign', '2026-11-01', '2026-11-07');
  select e into acc from jsonb_array_elements(r) e where e->>'id' = 'c1';
  assert (acc->>'leads')::int = 5 and (acc->>'booked')::int = 2, 'campaign c1';

  -- Partial range.
  r := public.report('ad', '2026-11-01', '2026-11-01');
  assert (r->0->>'spend')::numeric = 25, 'single day';

  -- Status rules.
  assert public.delivery_status('ACTIVE', 'ACTIVE', 'PAUSED') = 'PAUSED';
  assert public.delivery_status('DISABLED', 'ACTIVE') = 'DISABLED';
  assert public.delivery_status('ACTIVE', 'ARCHIVED') = 'REMOVED';

  begin
    perform public.report('nope', '2026-11-01', '2026-11-07');
    assert false, 'unknown level should fail';
  exception when raise_exception then null;
  end;
end $$;
select 'report tests ok' as result;
