-- 0080_admin_job_posts_read.sql
-- Real bug, caught live: the new ostati-admin "დავები" (disputes) page
-- (built on top of 0078's admin_resolve_job_dispute()) queries
-- `job_posts where status='disputed'` as the logged-in admin, through
-- the anon-key + cookie session (RLS-enforced, never a service_role
-- bypass — ostati-site's src/lib/supabase-admin/server.ts). `job_posts`
-- has exactly three SELECT policies (0004): the job's own Customer, a
-- Provider on still-open (`pending`) jobs, and the assigned Provider —
-- none of them match an admin who is neither. The query didn't error,
-- it just silently returned zero rows (RLS filtering, not a failure) —
-- surfaced as the disputes page showing "გადასაწყვეტი დავა არ არის" for
-- a genuinely disputed job sitting right there in the table. 0072 added
-- this exact "Admin can read all X" policy for `users`/
-- `provider_verification_requests`/`job_reports` when building the first
-- two admin sections — job_posts was simply never touched at that point
-- since no admin feature needed to read it yet.
--
-- Read-only, using the same is_admin() helper (0072) — does not affect
-- write access at all: job_posts INSERT/UPDATE remain fully RPC-only
-- (0026/0050/0052/0053), and admin_resolve_job_dispute() (0078) already
-- performs its own is_admin() check independently before writing, so
-- this policy adding read access changes nothing about who can mutate a
-- job.
drop policy if exists "Admin can read all job posts" on public.job_posts;
create policy "Admin can read all job posts"
  on public.job_posts for select
  using (public.is_admin());
