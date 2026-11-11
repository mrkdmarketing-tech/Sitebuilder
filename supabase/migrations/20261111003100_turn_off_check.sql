-- Whether "Turn off" will work for a suggestion, checked in advance by run-rules
-- (Meta validates a pause without doing it) and after a failed Turn off.
-- { ok, kind: page | account | unwritable | other, short, checkedAt }. Null = not checked yet.
-- Today shows "Turn off in Ads Manager" with the reason when ok is false.
alter table public.suggestions add column if not exists turn_off_check jsonb;
comment on column public.suggestions.turn_off_check is 'Can The Lab pause this ad? Checked by run-rules (validate only) and meta-action. See docs/suggestions.md.';
