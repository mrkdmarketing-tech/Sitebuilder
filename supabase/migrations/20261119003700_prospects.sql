-- =============================================================================
-- 3700 Prospects (docs/prospects.md). OWNERS ONLY.
--
-- People MRKD is talking to who haven't signed yet. prospects-sync reads chats
-- and sales pipelines from MRKD's GHL sub-account (read-only) and asks Jev for
-- the type of business and how warm the chat is. Owners set value, stage,
-- next step and notes, and can change anything Jev suggested.
--
-- Only owners (Jordan, Trent) can read or change any of it, and only after
-- two-step sign-in (mfa_ok()). Admins and staff get nothing: no policy lets
-- them read these tables, and the screen is hidden for them. Changes are not
-- copied into actions_log on purpose (staff can read that table).
-- =============================================================================

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.employees
    where auth_user_id = auth.uid() and active and role = 'owner'
  ) and public.mfa_ok()
$$;
revoke all on function public.is_owner() from public, anon;
grant execute on function public.is_owner() to authenticated;

create table public.prospects (
  contact_id      text primary key,          -- GHL contact id, or 'manual-<uuid>' for ones added by hand
  source          text not null default 'manual' check (source in ('ghl', 'manual')),
  name            text not null check (length(name) between 1 and 200),
  company         text check (length(company) <= 200),
  email           text,
  phone           text,
  channel         text,                      -- last chat channel (SMS, Facebook, Instagram, Email, Call)
  tags            text[] not null default '{}',
  -- Suggested by Jev from the chat (prospects-sync).
  ai_kind         text check (ai_kind in ('prospect', 'client', 'candidate', 'consumer', 'other')),
  ai_industry     text check (ai_industry in ('jiu_jitsu', 'steel', 'other')),
  ai_temperature  text check (ai_temperature in ('hot', 'warm', 'cold')),
  ai_confidence   jsonb not null default '{}',
  ai_version      integer,
  ai_at           timestamptz,
  ai_read_until   timestamptz,               -- last message Jev had seen
  -- Set by the owners (win over Jev).
  industry        text check (industry in ('jiu_jitsu', 'steel', 'other')),
  temperature     text check (temperature in ('hot', 'warm', 'cold')),
  value           numeric(12, 2) check (value >= 0),   -- dollars a month
  stage           text check (stage in ('new', 'call1_booked', 'call1_done', 'proposal_sent', 'call2', 'won', 'lost')),
  next_step       text check (length(next_step) <= 300),
  next_date       date,
  notes           text check (length(notes) <= 5000),
  hidden          boolean not null default false,       -- "Not a prospect"
  -- From GHL.
  last_message_at timestamptz,
  last_from       text check (last_from in ('them', 'us')),
  last_preview    text,
  message_count   integer not null default 0,
  ghl_pipeline    text,
  ghl_stage       text,
  ghl_value       numeric(12, 2),
  synced_at       timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz,
  updated_by      text references public.employees(id)
);
comment on table public.prospects is 'Owners only: people MRKD is selling to (GHL chats + owner notes). docs/prospects.md';

create table public.prospect_messages (
  message_id  text primary key,
  contact_id  text not null references public.prospects(contact_id) on delete cascade,
  direction   text not null check (direction in ('inbound', 'outbound')),
  type        text,
  body        text,
  at          timestamptz not null
);
create index prospect_messages_contact on public.prospect_messages (contact_id, at desc);
comment on table public.prospect_messages is 'Owners only: the latest messages of each prospect''s GHL chat (read-only copy).';

alter table public.prospects enable row level security;
alter table public.prospect_messages enable row level security;

revoke all on public.prospects, public.prospect_messages from anon, authenticated;
grant select on public.prospects, public.prospect_messages to authenticated;
-- Owners may add prospects by hand and change only their own fields.
grant insert (contact_id, source, name, company, channel, industry, temperature, value, stage, next_step, next_date, notes)
  on public.prospects to authenticated;
grant update (industry, temperature, value, stage, next_step, next_date, notes, hidden)
  on public.prospects to authenticated;
grant delete on public.prospects to authenticated;

create policy owner_read on public.prospects for select to authenticated using ((select public.is_owner()));
create policy owner_add on public.prospects for insert to authenticated
  with check ((select public.is_owner()) and source = 'manual' and contact_id like 'manual-%');
create policy owner_change on public.prospects for update to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));
create policy owner_remove on public.prospects for delete to authenticated
  using ((select public.is_owner()) and source = 'manual');
create policy owner_read on public.prospect_messages for select to authenticated using ((select public.is_owner()));
-- prospect_messages and the GHL fields are written only by prospects-sync (service role).

-- Who changed it last (owners' changes only; the sync runs without a signed-in person).
create or replace function private.prospects_stamp() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null then
    new.updated_at := now();
    new.updated_by := public.current_employee_id();
  end if;
  return new;
end $$;
create trigger prospects_stamp before insert or update on public.prospects
  for each row execute function private.prospects_stamp();

do $$
begin
  perform cron.unschedule('prospects-sync') where exists (select 1 from cron.job where jobname = 'prospects-sync');
  perform cron.schedule('prospects-sync', '5,35 * * * *', 'select private.call_function(''prospects-sync'')');
end $$;
