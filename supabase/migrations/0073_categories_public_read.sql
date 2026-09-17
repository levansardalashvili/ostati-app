-- 0073_categories_public_read.sql
-- The new public marketing site (ostati-site) needs a /services page
-- listing all active categories — but `categories`' only SELECT policy
-- (0043) is scoped `to authenticated`, and marketing-site visitors have
-- no Supabase session at all (same situation site_pages/site_settings
-- were in before 0071 opened them to `anon`). Table-level GRANTs already
-- include `anon` (Supabase's default broad per-role grants on public
-- schema tables) — RLS's role-scoped policy was the only blocker.

drop policy if exists "Categories are publicly readable" on public.categories;
create policy "Categories are publicly readable"
  on public.categories for select
  to anon, authenticated
  using (true);
