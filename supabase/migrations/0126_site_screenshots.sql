-- 0126: საიტის მთავარზე აპის რეალური ეკრანების (screenshot) მართვა ადმინიდან — დამატება, წაშლა, რიგი.
-- ფაილები საჯარო bucket-ში `site-media`, მწკრივი ცხრილში `site_screenshots`. ჩაწერა მხოლოდ ადმინს, წაკითხვა ყველას.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-media', 'site-media', true, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'];

drop policy if exists "Admin can insert site media" on storage.objects;
create policy "Admin can insert site media" on storage.objects for insert to authenticated
  with check (bucket_id = 'site-media' and public.is_admin());
drop policy if exists "Admin can read site media" on storage.objects;
create policy "Admin can read site media" on storage.objects for select to authenticated
  using (bucket_id = 'site-media' and public.is_admin());
drop policy if exists "Admin can delete site media" on storage.objects;
create policy "Admin can delete site media" on storage.objects for delete to authenticated
  using (bucket_id = 'site-media' and public.is_admin());

create table if not exists public.site_screenshots (
  id uuid primary key default gen_random_uuid(),
  path text not null unique,
  alt text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint site_screenshots_alt_len check (char_length(alt) <= 120)
);
alter table public.site_screenshots enable row level security;

drop policy if exists "Site screenshots are publicly readable" on public.site_screenshots;
create policy "Site screenshots are publicly readable" on public.site_screenshots for select to anon, authenticated using (true);
drop policy if exists "Admin can write site screenshots" on public.site_screenshots;
create policy "Admin can write site screenshots" on public.site_screenshots for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
grant select on public.site_screenshots to anon, authenticated;
grant insert, update, delete on public.site_screenshots to authenticated;

-- აუდიტი (0122-ის ფუნქცია + site_screenshots)
create or replace function public.audit_site_write() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then return coalesce(new, old); end if;
  if tg_table_name = 'site_pages' then
    perform public.log_admin_action('site_page_' || lower(tg_op), 'site_page', coalesce(new.slug, old.slug),
      jsonb_build_object('title', coalesce(new.title, old.title), 'published', coalesce(new.is_published, old.is_published),
                         'header', coalesce(new.show_in_header, old.show_in_header), 'footer', coalesce(new.show_in_footer, old.show_in_footer)));
  elsif tg_table_name = 'site_settings' then
    perform public.log_admin_action('site_setting_change', 'site_setting', coalesce(new.key, old.key), '{}'::jsonb);
  elsif tg_table_name = 'site_screenshots' then
    perform public.log_admin_action('site_screenshot_' || lower(tg_op), 'site_screenshot', coalesce(new.id, old.id)::text,
      jsonb_build_object('path', coalesce(new.path, old.path)));
  else
    perform public.log_admin_action('site_block_' || lower(tg_op), 'site_block', coalesce(new.id, old.id)::text,
      jsonb_build_object('block_key', coalesce(new.block_key, old.block_key), 'title', coalesce(new.title, old.title)));
  end if;
  return coalesce(new, old);
end;
$$;
revoke execute on function public.audit_site_write() from public, anon, authenticated;

drop trigger if exists audit_site_screenshots on public.site_screenshots;
create trigger audit_site_screenshots after insert or update or delete on public.site_screenshots
  for each row execute function public.audit_site_write();
