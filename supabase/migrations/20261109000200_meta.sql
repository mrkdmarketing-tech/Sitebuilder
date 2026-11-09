-- =============================================================================
-- 0200 Meta (Facebook/Instagram) ads data, synced by supabase/functions/meta-sync
-- every 30 minutes. Unlike Retool, metrics are typed columns (fast to report on)
-- and tables are linked with real foreign keys. Raw API payloads are kept in
-- `raw` for anything not modelled yet.
-- Docs: docs/data-model.md, docs/metrics.md
-- =============================================================================

create table public.meta_ad_accounts (
  account_id     text primary key,      -- numeric id without the "act_" prefix
  name           text,
  currency       text,
  timezone_name  text,
  -- Meta account_status as a label: ACTIVE, DISABLED, UNSETTLED, PENDING_RISK_REVIEW,
  -- PENDING_SETTLEMENT, IN_GRACE_PERIOD, PENDING_CLOSURE, CLOSED, ANY_ACTIVE, ANY_CLOSED
  account_status text,
  disable_reason text,
  client_id      integer references public.clients (id) on delete set null,
  amount_spent   numeric,
  raw            jsonb not null default '{}'::jsonb,
  synced_at      timestamptz not null default now()
);
create index meta_ad_accounts_client_idx on public.meta_ad_accounts (client_id);

-- Counts toward "Active Acc." (same three statuses Retool used).
create or replace function public.meta_account_is_active(status text) returns boolean
language sql immutable as $$
  select coalesce(status in ('ACTIVE', 'IN_GRACE_PERIOD', 'UNSETTLED'), false)
$$;

create table public.meta_campaigns (
  id               text primary key,
  account_id       text not null references public.meta_ad_accounts (account_id) on delete cascade,
  name             text,
  status           text,                -- configured status: ACTIVE / PAUSED / DELETED / ARCHIVED
  effective_status text,                -- Meta's computed status, e.g. ADSET_PAUSED
  objective        text,
  daily_budget     numeric,             -- in account currency (Meta sends cents; converted on sync)
  lifetime_budget  numeric,
  buying_type      text,
  bid_strategy     text,
  pacing_type      text,
  raw              jsonb not null default '{}'::jsonb,
  synced_at        timestamptz not null default now()
);
create index meta_campaigns_account_idx on public.meta_campaigns (account_id);

create table public.meta_adsets (
  id                text primary key,
  campaign_id       text not null references public.meta_campaigns (id) on delete cascade,
  account_id        text not null references public.meta_ad_accounts (account_id) on delete cascade,
  name              text,
  status            text,
  effective_status  text,
  optimization_goal text,
  daily_budget      numeric,
  advantage_plus    boolean,            -- Advantage+ audience on
  learning_stage    text,               -- LEARNING / SUCCESS / FAIL
  age_min           integer,
  age_max           integer,
  genders           text,               -- 'All' / 'Male' / 'Female'
  targeting         jsonb not null default '{}'::jsonb,
  raw               jsonb not null default '{}'::jsonb,
  synced_at         timestamptz not null default now()
);
create index meta_adsets_campaign_idx on public.meta_adsets (campaign_id);

create table public.meta_ad_creatives (
  id                  text primary key,
  account_id          text references public.meta_ad_accounts (account_id) on delete cascade,
  name                text,
  title               text,
  body                text,
  call_to_action      text,
  image_url           text,
  thumbnail_url       text,
  video_id            text,
  video_thumbnail_url text,
  permalink_url       text,
  raw                 jsonb not null default '{}'::jsonb,
  synced_at           timestamptz not null default now()
);

create table public.meta_ads (
  id               text primary key,
  adset_id         text not null references public.meta_adsets (id) on delete cascade,
  campaign_id      text not null references public.meta_campaigns (id) on delete cascade,
  account_id       text not null references public.meta_ad_accounts (account_id) on delete cascade,
  name             text,
  status           text,
  effective_status text,
  creative_id      text references public.meta_ad_creatives (id) on delete set null,
  raw              jsonb not null default '{}'::jsonb,
  synced_at        timestamptz not null default now()
);
create index meta_ads_adset_idx on public.meta_ads (adset_id);
create index meta_ads_account_idx on public.meta_ads (account_id);

-- One row per ad per day. The reporting functions add these up.
create table public.meta_ad_insights_daily (
  ad_id       text not null references public.meta_ads (id) on delete cascade,
  date        date not null,            -- in the ad account's time zone (as Meta reports it)
  account_id  text not null,
  campaign_id text not null,
  adset_id    text not null,
  spend       numeric not null default 0,
  impressions bigint  not null default 0,
  reach       bigint  not null default 0,
  clicks      bigint  not null default 0,
  link_clicks bigint  not null default 0,  -- action: link_click
  leads       bigint  not null default 0,  -- action: lead
  comments    bigint  not null default 0,  -- action: comment
  page_likes  bigint  not null default 0,  -- action: like
  messages    bigint  not null default 0,  -- action: onsite_conversion.messaging_conversation_started_7d
  actions     jsonb not null default '{}'::jsonb,  -- every action type, for future metrics
  synced_at   timestamptz not null default now(),
  primary key (ad_id, date)
);
create index meta_insights_date_idx on public.meta_ad_insights_daily (date);
create index meta_insights_account_date_idx on public.meta_ad_insights_daily (account_id, date);

create table public.meta_pages (
  id        text primary key,
  name      text,
  raw       jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now()
);

create table public.meta_leadgen_forms (
  id             text primary key,
  page_id        text references public.meta_pages (id) on delete set null,
  name           text,
  status         text,
  locale         text,
  questions      jsonb not null default '[]'::jsonb,
  context_card   jsonb,
  thank_you_page jsonb,
  privacy_policy jsonb,
  raw            jsonb not null default '{}'::jsonb,
  synced_at      timestamptz not null default now()
);

create table public.meta_leads (
  id           text primary key,
  ad_id        text references public.meta_ads (id) on delete set null,
  form_id      text references public.meta_leadgen_forms (id) on delete set null,
  account_id   text,
  created_time timestamptz not null,
  full_name    text,
  email        text,
  phone        text,
  field_data   jsonb not null default '[]'::jsonb,
  synced_at    timestamptz not null default now()
);
create index meta_leads_created_idx on public.meta_leads (created_time desc);
create index meta_leads_account_idx on public.meta_leads (account_id, created_time desc);

-- Full-text search for the "Search lead forms / ad copy" screen (replaces the
-- Retool app that built SQL from user input).
create index meta_leadgen_forms_search_idx on public.meta_leadgen_forms
  using gin (to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(raw::text, '')));
create index meta_ad_creatives_search_idx on public.meta_ad_creatives
  using gin (to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(title, '') || ' ' || coalesce(body, '')));
