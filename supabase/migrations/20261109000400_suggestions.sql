-- =============================================================================
-- 0400 Suggestions (plan.md M2, docs/suggestions.md)
-- The rules themselves live in shared/domain/rules.ts; this stores thresholds
-- and the suggestions each run produces.
-- =============================================================================

-- Thresholds. scope = 'global' (one row) or an override for one ad type or client.
-- `params` holds any subset of RuleSettings (shared/domain/rules.ts); missing
-- keys fall back to the next level: client → ad type → global → code defaults.
create table public.rule_settings (
  id         bigint generated always as identity primary key,
  scope      text not null check (scope in ('global', 'ad_type', 'client')),
  scope_key  text,                       -- ad type name or client id; null for global
  params     jsonb not null default '{}'::jsonb,
  updated_by text references public.employees (id),
  updated_at timestamptz not null default now(),
  unique (scope, scope_key)
);
create unique index rule_settings_one_global on public.rule_settings (scope) where scope = 'global';

-- Agreed with Jordan, Nov 2026.
insert into public.rule_settings (scope, scope_key, params) values (
  'global', null,
  '{"expensiveCpl": 50, "noLeadSpend": 50, "budgetHogShare": 0.6, "budgetHogCpl": 80,
    "budgetHogMaxLeads": 2, "lowCtr": 0.8, "lowLinkCtr": 0.5, "minImpressions": 1000,
    "noRecentLeadsDays": 3}'::jsonb
);

create table public.suggestions (
  id           uuid primary key default gen_random_uuid(),
  key          text not null,            -- `${rule}:${entity_id}` (see rules.ts)
  rule         text not null,
  severity     text not null check (severity in ('high', 'medium')),
  account_id   text references public.meta_ad_accounts (account_id) on delete cascade,
  client_id    integer references public.clients (id) on delete set null,
  manager_id   text references public.employees (id) on delete set null,
  level        text not null check (level in ('account', 'ad')),
  entity_id    text not null,
  entity_name  text,
  message      text not null,
  question     text not null,
  action       jsonb not null,           -- e.g. {"type":"pause_ad","adId":"…"}
  evidence     jsonb not null default '{}'::jsonb,
  siblings     jsonb,
  -- open: waiting. done: action taken. snoozed: "Not now". dismissed: ignored.
  -- resolved: the condition cleared by itself on a later run.
  status       text not null default 'open'
               check (status in ('open', 'done', 'snoozed', 'dismissed', 'resolved')),
  snoozed_until timestamptz,
  acted_by     text references public.employees (id),
  acted_at     timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  resolved_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
-- Only one live (open/snoozed) suggestion per problem.
create unique index suggestions_live_key on public.suggestions (key) where status in ('open', 'snoozed');
create index suggestions_account_idx on public.suggestions (account_id, status);
create index suggestions_manager_idx on public.suggestions (manager_id, status);
create trigger suggestions_updated_at before update on public.suggestions
  for each row execute function public.set_updated_at();
