-- 0071_site_content.sql
-- Backend for the new public informational site (ostati.ge — separate
-- Next.js project, ostati-site, not part of this repo) and its content
-- editor (folded into the existing admin panel, ostati-admin, rather than
-- a third separate CMS/login system — same admin.ostati.ge surface that
-- already manages categories, 0070).
--
-- Two tables, both admin-write / PUBLIC-read (`to anon`, not just
-- `to authenticated`) — the marketing site has visitors who are never
-- signed in to Supabase at all, unlike every other table in this schema.
--
-- `site_pages` — one row per static page (slug), markdown body. Simple
-- on purpose: this is "what does the app do / how it works / privacy
-- policy" content that changes rarely, not a general block-based page
-- builder.
--
-- `site_settings` — small key/value bits the site needs dynamically
-- (store links, contact email) without a code deploy for every change.

create table if not exists public.site_pages (
  slug text primary key,
  title text not null,
  content text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.site_pages enable row level security;
alter table public.site_settings enable row level security;

-- Public read — anon, not authenticated: the marketing site is visited
-- by logged-out browsers.
drop policy if exists "Site pages are publicly readable" on public.site_pages;
create policy "Site pages are publicly readable"
  on public.site_pages for select
  to anon, authenticated
  using (true);

drop policy if exists "Site settings are publicly readable" on public.site_settings;
create policy "Site settings are publicly readable"
  on public.site_settings for select
  to anon, authenticated
  using (true);

-- Admin-only write — same pattern as categories (0070): grant broadly to
-- `authenticated`, narrow with an RLS check against a DIFFERENT table
-- (`users`), not self-referencing.
grant insert, update, delete on public.site_pages to authenticated;
grant insert, update, delete on public.site_settings to authenticated;

drop policy if exists "Admin can write site pages" on public.site_pages;
create policy "Admin can write site pages"
  on public.site_pages for all
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'))
  with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));

drop policy if exists "Admin can write site settings" on public.site_settings;
create policy "Admin can write site settings"
  on public.site_settings for all
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'))
  with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));

drop trigger if exists set_updated_at on public.site_pages;
create trigger set_updated_at
  before update on public.site_pages
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.site_settings;
create trigger set_updated_at
  before update on public.site_settings
  for each row
  execute function public.set_updated_at();

-- Seed — placeholder content, meant to be rewritten immediately through
-- the new admin "საიტის კონტენტი" section, not final marketing copy.
insert into public.site_pages (slug, title, content) values
  ('home', 'Ostati — იპოვე სანდო ოსტატი', 'მოკლედ აღწერეთ, რას აკეთებს Ostati (მაგ: აკავშირებთ მომხმარებლებს ადგილობრივ ოსტატებთან — სანტექნიკოსი, ელექტრიკოსი და ა.შ.).'),
  ('how-it-works', 'როგორ მუშაობს', 'აღწერეთ ნაბიჯები: 1) გამოაქვეყნეთ მოთხოვნა, 2) ოსტატები გამოხატავენ ინტერესს ფასთან ერთად, 3) აირჩიეთ ოსტატი და ითანამშრომლეთ ჩატში.'),
  ('privacy', 'კონფიდენციალურობის პოლიტიკა', 'ჩასვით კონფიდენციალურობის პოლიტიკის ტექსტი აქ.'),
  ('terms', 'მომსახურების პირობები', 'ჩასვით მომსახურების პირობების ტექსტი აქ.')
on conflict (slug) do nothing;

insert into public.site_settings (key, value) values
  ('play_store_url', ''),
  ('app_store_url', ''),
  ('contact_email', '')
on conflict (key) do nothing;
