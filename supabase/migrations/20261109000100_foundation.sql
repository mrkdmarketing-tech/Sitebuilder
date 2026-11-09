-- =============================================================================
-- 0100 Foundation: shared helpers, lookup lists, staff, clients, audit + sync logs
-- Docs: docs/data-model.md
-- =============================================================================

-- Keeps updated_at current on every UPDATE.
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- -----------------------------------------------------------------------------
-- Lookup lists (were enum_* tables in Retool). Editable by admins; staff can add
-- new ad types from the app just as they can in Retool today.
-- -----------------------------------------------------------------------------
create table public.client_statuses (name text primary key, position int not null default 0);
create table public.ad_types        (name text primary key, created_at timestamptz not null default now());
create table public.booking_types   (name text primary key);
create table public.cta_options     (name text primary key);

insert into public.client_statuses (name, position) values
  ('New', 1), ('Active', 2), ('Paused', 3), ('Inactive', 4);
insert into public.ad_types (name) values
  ('jiu jitsu beginners program'), ('jiu jitsu kids program'), ('yoga studio'),
  ('yoga teacher training'), ('kickboxing'), ('boutique fitness'), ('kids summer camp'),
  ('muay thai beginners program'), ('no ad type'), ('buildings'), ('free swing assessment');
insert into public.booking_types (name) values
  ('Landing Page'), ('No Link'), ('Booking Link'), ('Purchase Link'), ('Home Page Website');
insert into public.cta_options (name) values
  ('Sign up'), ('Learn more'), ('Get quote'), ('Get offer'), ('Download'), ('Book now'),
  ('Subscribe'), ('Apply now');

-- -----------------------------------------------------------------------------
-- Staff. id is the person's GoHighLevel user id (same as Retool's employees.id),
-- which is how "Assigned to" on a client's GHL contact maps to an ads manager.
-- -----------------------------------------------------------------------------
create table public.employees (
  id            text primary key,
  first_name    text not null default '',
  last_name     text not null default '',
  email         text unique,
  is_ad_manager boolean not null default false,
  slack_id      text,
  active        boolean not null default true,
  -- staff: normal access. admin: settings, thresholds. owner: everything.
  role          text not null default 'staff' check (role in ('staff', 'admin', 'owner')),
  -- Linked on first sign-in (GHL single sign-on or Google), see docs/auth.md.
  auth_user_id  uuid unique,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger employees_updated_at before update on public.employees
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Clients. Same ids as Retool's clients table. During Phases 0–2 this table is
-- filled by the Retool bridge (supabase/functions/retool-bridge).
-- -----------------------------------------------------------------------------
create table public.clients (
  id                   integer primary key,
  business_name        text,
  contact_person_name  text,
  active_status        text references public.client_statuses (name) on update cascade,
  -- From the GHL contact's "Assigned to" field (decoded by the bridge).
  ad_manager_id        text references public.employees (id) on delete set null,
  ghl_contact_id       text,
  ghl_location_id      text,
  lead_sheet_url       text,
  website              text,
  city                 text,
  state                text,
  country              text,
  -- Decoded GHL custom fields (business info panel in ad approval).
  profile              jsonb not null default '{}'::jsonb,
  source               text not null default 'retool_bridge',
  synced_at            timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index clients_ad_manager_idx on public.clients (ad_manager_id);
create trigger clients_updated_at before update on public.clients
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Generic key/value settings (e.g. feature flags). Rule thresholds have their
-- own table in 0400.
-- -----------------------------------------------------------------------------
create table public.app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_by text references public.employees (id),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Background job log: one row per run of every sync. Powers the sync health page.
-- -----------------------------------------------------------------------------
create table public.sync_runs (
  id          bigint generated always as identity primary key,
  job         text not null,          -- e.g. 'meta.insights', 'retool_bridge.clients'
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  status      text not null default 'running' check (status in ('running', 'ok', 'error', 'partial')),
  rows        integer,
  error       text,
  details     jsonb not null default '{}'::jsonb
);
create index sync_runs_job_started_idx on public.sync_runs (job, started_at desc);

-- -----------------------------------------------------------------------------
-- Audit log: every action that changes something outside the app (pausing an
-- ad in Meta) or anything important inside it (status changes, threshold edits).
-- -----------------------------------------------------------------------------
create table public.actions_log (
  id          bigint generated always as identity primary key,
  actor_id    text references public.employees (id),
  action      text not null,          -- e.g. 'meta.pause_ad', 'rules.update'
  target_type text,                   -- e.g. 'meta_ad', 'ad_review'
  target_id   text,
  before      jsonb,
  after       jsonb,
  result      text not null default 'ok' check (result in ('ok', 'error')),
  error       text,
  created_at  timestamptz not null default now()
);
create index actions_log_target_idx on public.actions_log (target_type, target_id);
create index actions_log_created_idx on public.actions_log (created_at desc);
