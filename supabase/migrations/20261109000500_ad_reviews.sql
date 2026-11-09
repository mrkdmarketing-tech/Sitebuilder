-- =============================================================================
-- 0500 Ad approval (plan.md M6). Replaces Retool's Ad Preview app and the
-- ads_preview / ad_creative_templates / leadform_templates tables.
-- Docs: docs/data-model.md, docs/ad-approval.md
-- =============================================================================

create table public.ad_creative_templates (
  id         uuid primary key default gen_random_uuid(),
  legacy_id  text unique,                -- Retool ad_creative_templates.id
  name       text not null,
  -- { primaryText, headline, description, callToAction, ... } with {{placeholders}}
  body       jsonb not null default '{}'::jsonb,
  created_by text references public.employees (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger ad_creative_templates_updated_at before update on public.ad_creative_templates
  for each row execute function public.set_updated_at();

create table public.leadform_templates (
  id         uuid primary key default gen_random_uuid(),
  legacy_id  text unique,                -- Retool leadform_templates.id
  name       text not null,
  -- { formType, greeting, questions[], privacyPolicyUrl, thankYou{...} }
  body       jsonb not null default '{}'::jsonb,
  created_by text references public.employees (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger leadform_templates_updated_at before update on public.leadform_templates
  for each row execute function public.set_updated_at();

-- One submission of an ad (copy + images/videos + lead form) for approval.
create table public.ad_reviews (
  id                   uuid primary key default gen_random_uuid(),
  legacy_id            text unique,      -- Retool ads_preview.id (history import)
  client_id            integer references public.clients (id) on delete set null,
  name                 text not null,
  ad_type              text,
  booking_type         text,
  -- draft → review_pending → request_changes ↔ review_pending → approved → completed
  status               text not null default 'draft'
                       check (status in ('draft', 'review_pending', 'request_changes', 'approved', 'completed')),
  created_by           text references public.employees (id),
  reviewer_id          text references public.employees (id),
  creative_template_id uuid references public.ad_creative_templates (id) on delete set null,
  leadform_template_id uuid references public.leadform_templates (id) on delete set null,
  meta_leadform_id     text,             -- when reusing an existing Meta lead form
  -- { primaryText, headline, description, callToAction, tracking[], urlParameters }
  creative             jsonb not null default '{}'::jsonb,
  -- { name, formType, greeting{headline,description}, questions[], privacyPolicyUrl, thankYou{...} }
  leadform             jsonb not null default '{}'::jsonb,
  notes                text,
  -- Set when submitted while AI findings were still open ("Submit anyway").
  submitted_with_open_findings integer not null default 0,
  submitted_at         timestamptz,
  review_started_at    timestamptz,
  review_completed_at  timestamptz,
  completed_at         timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index ad_reviews_status_idx on public.ad_reviews (status, updated_at desc);
create index ad_reviews_client_idx on public.ad_reviews (client_id);
create trigger ad_reviews_updated_at before update on public.ad_reviews
  for each row execute function public.set_updated_at();

-- Uploaded images and videos (files live in the private "ad-assets" storage bucket).
create table public.ad_review_assets (
  id           uuid primary key default gen_random_uuid(),
  review_id    uuid not null references public.ad_reviews (id) on delete cascade,
  kind         text not null check (kind in ('image', 'video')),
  storage_path text,                     -- ad-assets/<review_id>/<file>
  canva_url    text,
  file_name    text,
  mime_type    text,
  width        integer,
  height       integer,
  duration_sec numeric,
  position     integer not null default 0,
  created_by   text references public.employees (id),
  created_at   timestamptz not null default now()
);
create index ad_review_assets_review_idx on public.ad_review_assets (review_id, position);

-- Each run of the AI quality check (Claude).
create table public.ad_review_check_runs (
  id          uuid primary key default gen_random_uuid(),
  review_id   uuid not null references public.ad_reviews (id) on delete cascade,
  status      text not null default 'running' check (status in ('running', 'ok', 'error')),
  model       text,
  input_hash  text,                      -- skip re-checking unchanged content
  cost_usd    numeric,
  error       text,
  started_at  timestamptz not null default now(),
  finished_at timestamptz
);

-- What the AI found. Shown inline and in the "Hey, just double checking" prompt.
create table public.ad_review_findings (
  id           uuid primary key default gen_random_uuid(),
  review_id    uuid not null references public.ad_reviews (id) on delete cascade,
  check_run_id uuid references public.ad_review_check_runs (id) on delete cascade,
  asset_id     uuid references public.ad_review_assets (id) on delete cascade,
  field        text,                     -- e.g. 'creative.headline', 'leadform.questions[2]'
  location     text,                     -- e.g. 'image 2', 'video 0:12'
  category     text not null check (category in ('spelling', 'grammar', 'logic', 'mismatch', 'cta', 'other')),
  severity     text not null default 'warning' check (severity in ('error', 'warning', 'info')),
  excerpt      text,                     -- the text that has the problem
  message      text not null,            -- what's wrong
  suggestion   text,                     -- suggested fix
  status       text not null default 'open' check (status in ('open', 'fixed', 'ignored')),
  created_at   timestamptz not null default now()
);
create index ad_review_findings_review_idx on public.ad_review_findings (review_id, status);

create table public.ad_review_comments (
  id         uuid primary key default gen_random_uuid(),
  review_id  uuid not null references public.ad_reviews (id) on delete cascade,
  author_id  text references public.employees (id),
  body       text not null,
  created_at timestamptz not null default now()
);
create index ad_review_comments_review_idx on public.ad_review_comments (review_id, created_at);

-- Reviewer checklist items (the 11 points from Retool's Ad Preview app).
create table public.review_checklist_items (
  key      text primary key,
  label    text not null,
  position integer not null,
  ai_checkable boolean not null default false,  -- AI can pre-fill this one
  active   boolean not null default true
);
insert into public.review_checklist_items (key, label, position, ai_checkable) values
  ('logo',            'Correct logo',                                              1,  true),
  ('address_phone',   'Address and phone number correct (check small print)',      2,  true),
  ('spelling',        'All spelling on the image is correct',                      3,  true),
  ('cta_headline',    'Image CTA matches the headline',                            4,  true),
  ('cta_primary',     'Image CTA matches the primary copy',                        5,  true),
  ('alignment',       'Image is aligned properly',                                 6,  false),
  ('city',            'City matches the primary copy',                             7,  true),
  ('tracking',        'Tracking events are on (if available)',                     8,  false),
  ('naming',          'Campaign naming is correct',                                9,  false),
  ('leadforms',       'Lead forms are connected and correct',                      10, false),
  ('new_leadform',    'Trent informed of any new campaign lead forms',             11, false);

create table public.ad_review_checklist (
  review_id    uuid not null references public.ad_reviews (id) on delete cascade,
  item_key     text not null references public.review_checklist_items (key),
  checked      boolean not null default false,
  ai_result    text check (ai_result in ('pass', 'fail', 'unsure')),
  checked_by   text references public.employees (id),
  checked_at   timestamptz,
  primary key (review_id, item_key)
);

-- Status history (who moved it, when, and which warnings they acknowledged).
create table public.ad_review_events (
  id          bigint generated always as identity primary key,
  review_id   uuid not null references public.ad_reviews (id) on delete cascade,
  actor_id    text references public.employees (id),
  from_status text,
  to_status   text not null,
  note        text,
  acknowledged_findings uuid[],          -- findings shown in "just double checking"
  created_at  timestamptz not null default now()
);
create index ad_review_events_review_idx on public.ad_review_events (review_id, created_at);
