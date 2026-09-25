-- 0122: საიტის გვერდების სრული მართვა ადმინიდან — ახალი გვერდის დამატება/წაშლა, გამოქვეყნება/დრაფტი, ჰედერში/ფუტერში
-- გამოჩენა და რიგი. kind='system' გვერდები (home, home_cta, home_providers, how-it-works) კოდის შაბლონებს ემსახურება —
-- იშლება ვერ, slug/kind არ იცვლება; kind='page' გვერდები თავისუფალია და საიტზე /{slug}-ზე ჩანს. ადმინის ჩაწერები
-- (გვერდები, პარამეტრები, სექციები) აუდიტის ჟურნალში (0117) იწერება.

alter table public.site_pages
  add column if not exists kind text not null default 'page',
  add column if not exists is_published boolean not null default true,
  add column if not exists show_in_header boolean not null default false,
  add column if not exists show_in_footer boolean not null default false,
  add column if not exists sort_order integer not null default 0,
  add column if not exists meta_description text not null default '';

alter table public.site_pages drop constraint if exists site_pages_kind_check;
alter table public.site_pages add constraint site_pages_kind_check check (kind in ('system', 'page'));

update public.site_pages set kind = 'system' where slug in ('home', 'home_cta', 'home_providers', 'how-it-works');

-- ნაგულისხმევი განლაგება არსებული გვერდებისთვის (ადმინიდან იცვლება)
update public.site_pages set show_in_footer = true, sort_order = 1 where slug = 'privacy' and kind = 'page';
update public.site_pages set show_in_footer = true, sort_order = 2 where slug = 'terms' and kind = 'page';
update public.site_pages set show_in_footer = true, show_in_header = true, sort_order = 3 where slug = 'support' and kind = 'page';
update public.site_pages set show_in_footer = true, sort_order = 4 where slug = 'delete-account' and kind = 'page';

-- თავისუფალი გვერდის მისამართი: პატარა ლათინური ასოები/ციფრები/დეფისი; კოდის მარშრუტებთან კონფლიქტი დაუშვებელია
alter table public.site_pages drop constraint if exists site_pages_slug_check;
alter table public.site_pages add constraint site_pages_slug_check check (
  kind = 'system'
  or (
    slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    and char_length(slug) <= 60
    and slug not in ('admin', 'api', 'services', 'how-it-works', 'home', 'sitemap', 'robots', 'icon', 'login', 'new', '_next')
  )
);
alter table public.site_pages drop constraint if exists site_pages_title_len_check;
alter table public.site_pages add constraint site_pages_title_len_check check (char_length(btrim(title)) between 1 and 120);

-- საჯაროდ ჩანს სისტემური და გამოქვეყნებული გვერდები; დრაფტს მხოლოდ ადმინი კითხულობს (ადმინის ALL policy-ით)
drop policy if exists "Site pages are publicly readable" on public.site_pages;
create policy "Site pages are publicly readable" on public.site_pages for select to anon, authenticated
  using (kind = 'system' or is_published);

-- ადმინის policy მხოლოდ authenticated-ზე: anon-ს is_admin()-ზე EXECUTE არ აქვს და {public} როლის policy-ის შეფასება
-- (როცა წაკითხვის policy უკვე არაკონსტანტურია) anon-ის მოთხოვნას "permission denied"-ით ჩააგდებდა
drop policy if exists "Admin can write site pages" on public.site_pages;
create policy "Admin can write site pages" on public.site_pages for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- სისტემური გვერდი არ იშლება; slug/kind არასდროს იცვლება (ბმულები არ გაფუჭდეს)
create or replace function public.protect_site_pages() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.kind = 'system' then raise exception 'SYSTEM_PAGE_PROTECTED'; end if;
    return old;
  end if;
  if new.slug is distinct from old.slug or new.kind is distinct from old.kind then
    raise exception 'SLUG_IMMUTABLE';
  end if;
  return new;
end;
$$;
drop trigger if exists protect_site_pages on public.site_pages;
create trigger protect_site_pages before update or delete on public.site_pages
  for each row execute function public.protect_site_pages();

-- ახალი პარამეტრები (ადრე ფუტერის ტექსტი და hero-ს შენიშვნა კოდში იყო)
insert into public.site_settings (key, value) values
  ('footer_tagline', 'Ostati აკავშირებს მომხმარებლებს სანდო, ადგილობრივ ოსტატებთან — სანტექნიკოსი, ელექტრიკოსი და სხვა.'),
  ('hero_note', 'უფასოა · iOS და Android')
on conflict (key) do nothing;

-- აუდიტი: საიტის ჩაწერები ადმინისგან
create or replace function public.audit_site_write() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then return coalesce(new, old); end if;
  if tg_table_name = 'site_pages' then
    perform public.log_admin_action('site_page_' || lower(tg_op), 'site_page', coalesce(new.slug, old.slug),
      jsonb_build_object('title', coalesce(new.title, old.title), 'published', coalesce(new.is_published, old.is_published),
                         'header', coalesce(new.show_in_header, old.show_in_header), 'footer', coalesce(new.show_in_footer, old.show_in_footer)));
  elsif tg_table_name = 'site_settings' then
    perform public.log_admin_action('site_setting_change', 'site_setting', coalesce(new.key, old.key), '{}'::jsonb);
  else
    perform public.log_admin_action('site_block_' || lower(tg_op), 'site_block', coalesce(new.id, old.id)::text,
      jsonb_build_object('block_key', coalesce(new.block_key, old.block_key), 'title', coalesce(new.title, old.title)));
  end if;
  return coalesce(new, old);
end;
$$;
revoke execute on function public.audit_site_write() from public, anon, authenticated;

drop trigger if exists audit_site_pages on public.site_pages;
create trigger audit_site_pages after insert or update or delete on public.site_pages
  for each row execute function public.audit_site_write();
drop trigger if exists audit_site_settings on public.site_settings;
create trigger audit_site_settings after insert or update or delete on public.site_settings
  for each row execute function public.audit_site_write();
drop trigger if exists audit_site_blocks on public.site_blocks;
create trigger audit_site_blocks after insert or update or delete on public.site_blocks
  for each row execute function public.audit_site_write();
