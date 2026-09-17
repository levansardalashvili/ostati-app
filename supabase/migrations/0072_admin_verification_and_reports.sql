-- 0072_admin_verification_and_reports.sql
-- Second admin-panel milestone — Provider verification approval and
-- job_reports moderation, both previously described as "future service_role
-- tool" (0025/0034/0051). The tool now exists (ostati-admin).
--
-- New helper: `is_admin()`. 0070/0071 inlined
-- `exists (select 1 from public.users u where u.id = auth.uid() and
-- u.role = 'admin')` directly in each policy — safe there because
-- categories/site_pages/site_settings are DIFFERENT tables from `users`.
-- This migration needs an admin-read policy ON `users` itself (so the
-- admin panel can show reporter/reported-user names), and an inline
-- subquery there would be self-referencing — the exact recursive-RLS
-- footgun 0026 moved away from. Wrapping the check in a SECURITY DEFINER
-- function breaks the recursion (Postgres does not re-apply the calling
-- policy inside a definer function's own body) — the standard Supabase
-- pattern for "role check used within RLS on the same table". 0070/0071's
-- existing inline subqueries also get swapped to call this, for one
-- single source of truth (functionally identical, not a security change).
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin');
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

drop policy if exists "Admin can insert categories" on public.categories;
create policy "Admin can insert categories"
  on public.categories for insert
  with check (public.is_admin());

drop policy if exists "Admin can update categories" on public.categories;
create policy "Admin can update categories"
  on public.categories for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admin can delete categories" on public.categories;
create policy "Admin can delete categories"
  on public.categories for delete
  using (public.is_admin());

drop policy if exists "Admin can write site pages" on public.site_pages;
create policy "Admin can write site pages"
  on public.site_pages for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admin can write site settings" on public.site_settings;
create policy "Admin can write site settings"
  on public.site_settings for all
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- users — admin-read (NOT write; role/email/address stay client-locked
-- exactly as before, 0002/0026). Needed so the admin panel can show
-- provider/reporter names instead of bare UUIDs.
-- ============================================================
drop policy if exists "Admin can read all users" on public.users;
create policy "Admin can read all users"
  on public.users for select
  using (public.is_admin());

-- ============================================================
-- provider_verification_requests — admin-read (existing owner-only SELECT
-- from 0051 stays; this adds a second, OR'd policy for admins).
-- ============================================================
drop policy if exists "Admin can read all verification requests" on public.provider_verification_requests;
create policy "Admin can read all verification requests"
  on public.provider_verification_requests for select
  using (public.is_admin());

-- admin_review_provider_verification() — the only way verification_status
-- moves from 'pending' to 'verified'/'rejected'. RPC (not a direct grant),
-- same reason 0035/0051's request_provider_verification() is an RPC:
-- provider_profiles already has a permissive self-serve UPDATE policy
-- (0026, "Provider can update own profile", using auth.uid()=id) — if
-- verification_status were added to that column-grant allowlist, a
-- Provider could satisfy that SAME policy on their own row and write it
-- themselves. SECURITY DEFINER sidesteps the grant/policy question
-- entirely rather than trying to carve out a column-safe exception to an
-- existing permissive policy.
create or replace function public.admin_review_provider_verification(
  p_provider_id uuid,
  p_approve boolean,
  p_rejection_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_provider public.provider_profiles%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  select * into v_provider from public.provider_profiles where id = p_provider_id for update;
  if v_provider.id is null then
    raise exception 'Provider profile not found';
  end if;

  if v_provider.verification_status <> 'pending' then
    raise exception 'Verification request is not pending (current status: %)', v_provider.verification_status;
  end if;

  if p_approve then
    update public.provider_profiles set verification_status = 'verified' where id = p_provider_id;
    update public.provider_verification_requests
      set rejection_reason = null
      where provider_id = p_provider_id;
  else
    update public.provider_profiles set verification_status = 'rejected' where id = p_provider_id;
    update public.provider_verification_requests
      set rejection_reason = nullif(btrim(coalesce(p_rejection_reason, '')), '')
      where provider_id = p_provider_id;
  end if;
end;
$$;

comment on function public.admin_review_provider_verification(uuid, boolean, text) is
  'Admin approves or rejects a pending Provider verification request. Only moves pending -> verified/rejected (raises otherwise) — target status is a boolean flag, not a free-form value the caller picks. Rejection reason is stored in provider_verification_requests (owner-only + admin-read, 0051/this migration), never on the public provider_profiles row.';

revoke execute on function public.admin_review_provider_verification(uuid, boolean, text) from public, anon;
grant execute on function public.admin_review_provider_verification(uuid, boolean, text) to authenticated;

-- ============================================================
-- job_reports — admin-read (all reports, not just the reporter's own) +
-- admin-only status transitions. Unlike provider_profiles above, this is
-- a *direct* grant+RLS (not an RPC) — job_reports has NO existing
-- permissive UPDATE policy for ordinary users at all (0034: reporters can
-- only ever SELECT their own report), so there is no self-serve policy
-- for a narrow admin grant to accidentally collide with.
-- ============================================================
drop policy if exists "Admin can read all job reports" on public.job_reports;
create policy "Admin can read all job reports"
  on public.job_reports for select
  using (public.is_admin());

grant update (status) on public.job_reports to authenticated;

drop policy if exists "Admin can update job report status" on public.job_reports;
create policy "Admin can update job report status"
  on public.job_reports for update
  using (public.is_admin())
  with check (public.is_admin());
