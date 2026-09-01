-- 0043_categories.sql
-- Categories become backend-driven (audit finding #6). Previously the
-- 15 service categories (src/data/categories.ts's `CATEGORIES` array)
-- were the only source of truth anywhere — name, order, and even
-- "does this category still exist" were baked into the client bundle,
-- so changing any of it required a new app release. This table is the
-- new canonical source for name/order/active/featured; the client's
-- static array becomes a presentation-only lookup (icon/color styling,
-- which this table deliberately does NOT carry — see icon_key below)
-- plus an offline fallback (src/services/categoryService.ts).

create table if not exists public.categories (
  id text primary key,
  name text not null,
  -- Only a Lucide component name already bundled in
  -- src/components/CategoryIcon.tsx's CATEGORY_ICON_MAP — this table
  -- cannot make the client render an icon it doesn't already ship
  -- (task: "icon_key maps only to approved bundled Lucide icons"). Adding
  -- a genuinely new icon still requires a client code change; this just
  -- prevents the DB from ever pointing at a name the client has no
  -- component for.
  icon_key text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_icon_key_check check (icon_key in (
    'Wrench', 'Zap', 'Paintbrush', 'Snowflake', 'Flame', 'Armchair', 'PlugZap',
    'Grid2X2', 'PanelsTopLeft', 'DoorOpen', 'LockKeyhole', 'Hammer', 'House',
    'Sparkles', 'Package'
  ))
);

create index if not exists idx_categories_sort_order on public.categories(sort_order);

alter table public.categories enable row level security;

-- Public read (categories are not sensitive) — same `to authenticated
-- using (true)` pattern as provider_profiles' public directory read (0003).
drop policy if exists "Categories are publicly readable" on public.categories;
create policy "Categories are publicly readable"
  on public.categories for select
  to authenticated
  using (true);

-- No client write path at all — no INSERT/UPDATE/DELETE grant, no RPC.
-- Nothing in the product lets a Customer/Provider create or edit
-- categories; only a future service_role admin tool (not built here,
-- matches every other "no Admin Panel" instruction in this project) can
-- change name/order/active/featured.
revoke insert, update, delete on public.categories from authenticated;

drop trigger if exists set_updated_at on public.categories;
create trigger set_updated_at
  before update on public.categories
  for each row
  execute function public.set_updated_at();

-- Seed — exact ids/labels/order src/data/categories.ts already had
-- (task: "preserve existing category IDs"), `featured` matching
-- CustomerHomeScreen.tsx's previous hardcoded TOP_CATEGORY_IDS
-- (plumbing/electrical/cleaning). Idempotent — safe to re-run.
insert into public.categories (id, name, icon_key, sort_order, is_active, featured) values
  ('plumbing', 'სანტექნიკა', 'Wrench', 0, true, true),
  ('electrical', 'ელექტროობა', 'Zap', 1, true, true),
  ('painting', 'შეღებვა', 'Paintbrush', 2, true, false),
  ('ac', 'კონდიციონერი', 'Snowflake', 3, true, false),
  ('heating', 'გათბობა', 'Flame', 4, true, false),
  ('furniture', 'ავეჯი', 'Armchair', 5, true, false),
  ('appliance', 'საყოფაცხოვრებო ტექნიკის შეკეთება', 'PlugZap', 6, true, false),
  ('tile', 'კაფელი / მეტლახი', 'Grid2X2', 7, true, false),
  ('flooring', 'ლამინატი / პარკეტი', 'PanelsTopLeft', 8, true, false),
  ('doors', 'კარ-ფანჯარა', 'DoorOpen', 9, true, false),
  ('locks', 'საკეტები', 'LockKeyhole', 10, true, false),
  ('repair', 'მცირე სარემონტო სამუშაოები', 'Hammer', 11, true, false),
  ('renovation', 'შიდა რემონტი', 'House', 12, true, false),
  ('cleaning', 'დასუფთავება', 'Sparkles', 13, true, true),
  ('moving', 'გადაზიდვა', 'Package', 14, true, false)
on conflict (id) do nothing;
