-- 0026_fix_recursive_rls_policies.sql
-- Security audit — fixes three RLS policies that self-reference the same
-- table they're defined on:
--   - users: "Users can update own profile except role" — WITH CHECK did
--     `role = (select u.role from public.users u where u.id = auth.uid())`
--   - provider_profiles: "Provider can update own profile except verified"
--     (later "except verification_status", 0025) — same pattern
--   - job_posts: "Customer can update own jobs" / "Assigned provider can
--     update job status" (0013) — same pattern, on FOUR columns, and TWO
--     separate policies both doing it on the same table for the same
--     command (UPDATE), which Postgres must evaluate together.
--
-- A same-table correlated subquery inside a policy's USING/WITH CHECK
-- forces Postgres to re-run RLS policy evaluation against the very table
-- being checked, for every row, on every write. Besides being wasteful,
-- this is the documented Postgres/Supabase footgun that can produce
-- "infinite recursion detected in policy for relation ..." once a table
-- has multiple interacting policies (job_posts already has two UPDATE
-- policies) or once anything else (a trigger, another policy) also reads
-- the same table mid-check. None of the three actually recursed in
-- testing here, but the pattern is fixed everywhere it appears rather
-- than left as a ticking time bomb for the next policy/trigger added to
-- these tables.
--
-- Fix, per table, using the two patterns the task calls for instead of
-- "another unsafe self-select policy":

-- ============================================================
-- users.role — column-level privilege, not a self-select
-- ============================================================
-- Column-level GRANT/REVOKE is checked by Postgres BEFORE RLS even
-- runs, and needs no subquery at all: a client UPDATE statement that
-- names `role` in its SET list is rejected outright, regardless of what
-- any policy says. REVOKE the blanket table-level UPDATE (which Supabase
-- grants by default to `authenticated` when a table is created) and
-- re-GRANT it scoped to exactly the columns a user may edit.
revoke update on public.users from authenticated;
grant update (first_name, last_name, email, default_address) on public.users to authenticated;

drop policy if exists "Users can update own profile except role" on public.users;
drop policy if exists "Users can update own profile" on public.users;
create policy "Users can update own profile"
  on public.users for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ============================================================
-- provider_profiles.verification_status — same pattern
-- ============================================================
revoke update on public.provider_profiles from authenticated;
grant update (
  first_name, last_name, specialty, areas, experience, about, photo_url,
  certificates, portfolio, sqm_prices, is_available
) on public.provider_profiles to authenticated;

drop policy if exists "Provider can update own profile except verified" on public.provider_profiles;
drop policy if exists "Provider can update own profile" on public.provider_profiles;
create policy "Provider can update own profile"
  on public.provider_profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ============================================================
-- job_posts.status / provider_id / agreed_price / dispute_reason —
-- RPC-only writes, not a self-select
-- ============================================================
-- Unlike the two tables above, job_posts has NO legitimate direct-client
-- UPDATE path left at all: every real transition already goes through
-- the four SECURITY DEFINER RPCs (select_provider,
-- provider_request_completion, customer_confirm_completion,
-- customer_report_problem — 0014/0022), which run as the function owner
-- and bypass RLS/grants entirely, exactly like every other SECURITY
-- DEFINER function in this project. No screen in the app ever calls
-- `.from('job_posts').update(...)` directly (verified against the
-- current codebase) — the two UPDATE policies from 0004/0013 were
-- already unused in practice, just still open at the grant level. Revoke
-- the client's UPDATE privilege outright instead of trying to carve out
-- "which columns/rows" with more self-referencing subqueries.
revoke update on public.job_posts from authenticated;

drop policy if exists "Customer can update own jobs" on public.job_posts;
drop policy if exists "Assigned provider can update job status" on public.job_posts;

-- Defense in depth: even if the table-level grant above is ever
-- accidentally restored, this policy still unconditionally denies every
-- direct client UPDATE at the RLS layer — a constant `false`, so there
-- is nothing to recurse into.
create policy "Direct client updates are not allowed (RPC-only)"
  on public.job_posts for update
  using (false);
