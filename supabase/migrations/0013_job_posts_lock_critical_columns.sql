-- 0013_job_posts_lock_critical_columns.sql
-- "Critical workflow updates must not rely on arbitrary client-side
-- status updates." This tightens the two existing job_posts UPDATE
-- policies (from 0004_job_posts.sql) so a normal client `.update()` can
-- no longer change status / provider_id / agreed_price / dispute_reason
-- at all — those four columns may only move through the SECURITY
-- DEFINER RPCs in 0014_job_workflow_rpcs.sql (which run as the function
-- owner and therefore bypass RLS entirely, so this restriction has no
-- effect on them).
--
-- The `with check` re-reads each of those 4 columns' CURRENT stored
-- value for this row and requires the submitted row to match it
-- exactly (`is not distinct from` so NULL = NULL compares as "same") —
-- i.e. the client may still update any other column on their own job
-- (a future "edit job" feature, for example) but cannot smuggle a
-- status/provider_id/agreed_price/dispute_reason change through a plain
-- UPDATE.

drop policy if exists "Customer can update own jobs" on public.job_posts;
create policy "Customer can update own jobs"
  on public.job_posts for update
  using (customer_id = auth.uid())
  with check (
    customer_id = auth.uid()
    and status is not distinct from (select jp.status from public.job_posts jp where jp.id = job_posts.id)
    and provider_id is not distinct from (select jp.provider_id from public.job_posts jp where jp.id = job_posts.id)
    and agreed_price is not distinct from (select jp.agreed_price from public.job_posts jp where jp.id = job_posts.id)
    and dispute_reason is not distinct from (select jp.dispute_reason from public.job_posts jp where jp.id = job_posts.id)
  );

drop policy if exists "Assigned provider can update job status" on public.job_posts;
create policy "Assigned provider can update job status"
  on public.job_posts for update
  using (provider_id = auth.uid())
  with check (
    provider_id = auth.uid()
    and status is not distinct from (select jp.status from public.job_posts jp where jp.id = job_posts.id)
  );
