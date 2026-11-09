-- =============================================================================
-- 0800 File storage for ad approval uploads (images/videos).
-- Private bucket: files are only reachable by signed-in staff, through
-- short-lived signed URLs. Skipped automatically when the storage schema
-- doesn't exist (e.g. the plain-Postgres local test harness).
-- =============================================================================
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'storage') then
    raise notice 'storage schema not found, skipping bucket setup';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('ad-assets', 'ad-assets', false, 524288000,  -- 500 MB (videos)
          array['image/png', 'image/jpeg', 'image/webp', 'image/gif',
                'video/mp4', 'video/quicktime', 'video/webm'])
  on conflict (id) do nothing;

  execute $p$create policy "staff read ad-assets" on storage.objects for select to authenticated
    using (bucket_id = 'ad-assets' and public.is_staff())$p$;
  execute $p$create policy "staff upload ad-assets" on storage.objects for insert to authenticated
    with check (bucket_id = 'ad-assets' and public.is_staff())$p$;
  execute $p$create policy "staff delete ad-assets" on storage.objects for delete to authenticated
    using (bucket_id = 'ad-assets' and public.is_staff())$p$;
end $$;
