-- 0070_admin_role.sql
-- Foundation for the admin panel (separate Next.js project, ostati-admin —
-- not part of this repo, per the user's explicit choice to keep it in its
-- own folder/deploy). This migration only touches the shared Supabase
-- schema: adds 'admin' as a legal `users.role` value, and opens
-- `categories` write access to admin accounts only. Nothing else changes —
-- provider verification approval and job_reports moderation are deferred
-- to a later milestone (today's scope is Next.js skeleton + admin login +
-- categories CRUD only).
--
-- Admin accounts are provisioned manually (SQL Editor / service_role) —
-- there is no self-service "become an admin" path anywhere, by design.
-- Admin auth reuses ordinary Supabase Auth (email/password) — the only
-- difference from a Customer/Provider account is `users.role = 'admin'`.

alter table public.users drop constraint if exists users_role_check;
alter table public.users add constraint users_role_check check (role in ('customer', 'provider', 'admin'));

-- ============================================================
-- categories — admin-only write. Previously fully closed to every
-- authenticated client (0043: "only a future service_role admin tool").
-- That tool now exists, so this grants write access broadly to
-- `authenticated` but narrows it with an admin-only RLS policy — the same
-- safe pattern already used for role-gated access elsewhere in this
-- schema (e.g. job_posts_feed's provider-only SELECT, 0055): the RLS
-- check queries a DIFFERENT table (`users`), not `categories` itself, so
-- it carries none of the self-referencing-subquery recursion risk that
-- 0026 moved away from for same-table role checks.
-- ============================================================
grant insert, update, delete on public.categories to authenticated;

drop policy if exists "Admin can insert categories" on public.categories;
create policy "Admin can insert categories"
  on public.categories for insert
  with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));

drop policy if exists "Admin can update categories" on public.categories;
create policy "Admin can update categories"
  on public.categories for update
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'))
  with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));

drop policy if exists "Admin can delete categories" on public.categories;
create policy "Admin can delete categories"
  on public.categories for delete
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));
