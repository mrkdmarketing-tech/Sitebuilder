-- Style kit (docs/ad-studio.md): the MRKD ad styles kit's code, fonts, configs
-- and approved people, stored privately so The Lab can render ads in the
-- browser (Python via Pyodide). Staff can read; only Claude / owners load it
-- (service role or the management API), no browser writes for now.

create table public.style_kit_files (
  path       text primary key,            -- e.g. 'EC/code/ec_ad.py', 'EC/code/people/x-cutout.png', 'EC/thumbs/x.jpg'
  style      text not null,               -- style code: EC, PS, ...
  kind       text not null,               -- code | font | config | person | thumb | example
  content    bytea not null,
  size       integer generated always as (octet_length(content)) stored,
  sha256     text generated always as (encode(extensions.digest(content, 'sha256'), 'hex')) stored,
  updated_at timestamptz not null default now()
);
create index style_kit_files_style_idx on public.style_kit_files (style, kind);
comment on table public.style_kit_files is 'MRKD ad styles kit files for rendering ads in The Lab (staff read only).';

alter table public.style_kit_files enable row level security;
create policy staff_read on public.style_kit_files for select to authenticated using ((select public.is_staff()));

/** What a style needs, without the bytes (the browser caches by sha256). */
create or replace function public.style_kit_list(p_style text)
returns table (path text, kind text, size integer, sha256 text)
language sql stable security invoker set search_path = '' as $$
  select path, kind, size, sha256 from public.style_kit_files where style = p_style order by path
$$;

/** Some files' contents, base64. */
create or replace function public.style_kit_get(p_paths text[])
returns table (path text, b64 text)
language sql stable security invoker set search_path = '' as $$
  select path, encode(content, 'base64') from public.style_kit_files where path = any (p_paths)
$$;
revoke all on function public.style_kit_list(text) from public, anon;
revoke all on function public.style_kit_get(text[]) from public, anon;
grant execute on function public.style_kit_list(text) to authenticated;
grant execute on function public.style_kit_get(text[]) to authenticated;
