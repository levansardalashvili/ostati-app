-- 0074_site_blocks.sql
-- Converts the last hardcoded marketing-site content into admin-editable
-- data: the 4 home-page feature cards and the 3 how-it-works steps (both
-- were plain TS arrays in ostati-site's code — src/app/(site)/page.tsx's
-- `FEATURES`, src/lib/content.ts's `STEPS`). Neither fits the existing
-- `site_pages` shape (single title+markdown body per slug) — both are
-- ORDERED LISTS of {icon, title, description} items, so this is a new
-- table rather than another site_pages row.
--
-- The home page's "დაიწყე დღესვე" CTA heading/subtext, by contrast, IS
-- just a title+body — that one is seeded as an ordinary new site_pages
-- row (slug='home_cta') below, no new table needed for it.

create table if not exists public.site_blocks (
  id uuid primary key default gen_random_uuid(),
  block_key text not null,
  sort_order int not null default 0,
  icon_key text not null,
  title text not null,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Union of the existing categories icon set (0043) plus the specific
  -- icons ostati-site's hardcoded FEATURES/STEPS arrays already used —
  -- same "only bundled, already-approved Lucide names" contract as
  -- categories.icon_key, just a different (larger) allowed set since
  -- this is marketing content, not app category icons.
  constraint site_blocks_icon_key_check check (icon_key in (
    'Wrench', 'Zap', 'Paintbrush', 'Snowflake', 'Flame', 'Armchair', 'PlugZap',
    'Grid2X2', 'PanelsTopLeft', 'DoorOpen', 'LockKeyhole', 'Hammer', 'House',
    'Sparkles', 'Package',
    'ShieldCheck', 'MessageCircle', 'Tags', 'ScanSearch', 'FileText', 'ThumbsUp',
    'Star', 'CheckCircle', 'Users', 'Clock'
  ))
);

create index if not exists idx_site_blocks_key_order on public.site_blocks(block_key, sort_order);

alter table public.site_blocks enable row level security;

-- Public read (`anon` too — same reasoning as 0071/0073: marketing-site
-- visitors have no Supabase session at all).
drop policy if exists "Site blocks are publicly readable" on public.site_blocks;
create policy "Site blocks are publicly readable"
  on public.site_blocks for select
  to anon, authenticated
  using (true);

-- Admin-only write — identical pattern to categories/site_pages
-- (0070/0071/0072), using the shared is_admin() helper.
grant insert, update, delete on public.site_blocks to authenticated;

drop policy if exists "Admin can write site blocks" on public.site_blocks;
create policy "Admin can write site blocks"
  on public.site_blocks for all
  using (public.is_admin())
  with check (public.is_admin());

drop trigger if exists set_updated_at on public.site_blocks;
create trigger set_updated_at
  before update on public.site_blocks
  for each row
  execute function public.set_updated_at();

-- Seed — exact copy of the hardcoded content it replaces, so the site's
-- rendered output doesn't change the moment this migration runs.
insert into public.site_blocks (block_key, sort_order, icon_key, title, description) values
  ('home_features', 0, 'ShieldCheck', 'სანდო ოსტატები', 'ყოველი ოსტატის პროფილს ახლავს რეალური შეფასებები და გამოცდილება — ირჩევ ინფორმირებულად.'),
  ('home_features', 1, 'MessageCircle', 'პირდაპირი ჩატი', 'დეტალებზე შეთანხმდი აპშივე, ჩატში — საკონტაქტო ინფორმაცია მხოლოდ ორმხრივი გადაწყვეტილებით ჩანს.'),
  ('home_features', 2, 'Tags', 'გამჭვირვალე ფასი', 'ოსტატი ფასს გთავაზობს შენი მოთხოვნის ნახვის შემდეგ — არა ბუნდოვანი შეფასება წინასწარ.'),
  ('home_features', 3, 'ScanSearch', '15 კატეგორია', 'სანტექნიკიდან რემონტამდე — ერთ აპში იპოვი ოსტატს ნებისმიერი სახლის სამუშაოსთვის.'),
  ('how_it_works_steps', 0, 'FileText', 'გამოაქვეყნე მოთხოვნა', 'აღწერე რა გჭირდება, დაამატე ფოტო — რაც უფრო დეტალურია, მით უკეთესი შეთავაზებები მოგივა.'),
  ('how_it_works_steps', 1, 'ThumbsUp', 'მიიღე შეთავაზებები', 'ოსტატები გამოხატავენ ინტერესს კონკრეტული ფასით — შენი მოთხოვნის ნახვის შემდეგ, არა წინასწარ.'),
  ('how_it_works_steps', 2, 'MessageCircle', 'აირჩიე და ითანამშრომლე', 'შეადარე ოსტატები რეიტინგით და ფასით, შეთანხმდი დეტალებზე ჩატში და დაასრულე სამუშაო.');

insert into public.site_pages (slug, title, content) values
  ('home_cta', 'დაიწყე დღესვე', 'გადმოწერე Ostati და იპოვე შენი პირველი ოსტატი წუთებში.')
on conflict (slug) do nothing;
