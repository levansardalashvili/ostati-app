-- 0032_job_cancellation.sql
-- Job cancellation — `job_posts.status` already accepted 'cancelled' as
-- a valid value (0011's check constraint), and CustomerJobDetailScreen
-- already has a full "გაუქმება" (Cancel) menu item + confirmation sheet
-- — but `confirmCancel()` only ever did `setCancelled(true)`, a local
-- boolean in that one screen's own state. Nothing was ever written to
-- Supabase: no real status change, no record of who cancelled or why,
-- and (since 0026 revoked all direct client UPDATE on job_posts) a
-- direct `.update({status:'cancelled'})` from the client would fail
-- outright even if someone tried it. This migration makes it real.

alter table public.job_posts add column if not exists cancelled_at timestamptz;
alter table public.job_posts add column if not exists cancelled_by uuid references auth.users(id) on delete set null;
alter table public.job_posts add column if not exists cancellation_reason text;

-- No RLS/grant change needed here — 0026 already revoked direct client
-- UPDATE on job_posts entirely and reduced its UPDATE policy to
-- `using (false)`; every real transition (this one included) goes
-- through a SECURITY DEFINER RPC, which bypasses that by design.

create or replace function public.cancel_job(p_job_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.job_posts%rowtype;
begin
  select * into v_job from public.job_posts where id = p_job_id for update;
  if v_job.id is null then
    raise exception 'Job not found';
  end if;

  -- Only the job's own customer may cancel it — an assigned Provider
  -- (or any other Provider) can never reach this branch, regardless of
  -- provider_id. There is deliberately no Provider-initiated
  -- cancellation path — none exists in the UI today (verified: no
  -- working Cancel action anywhere in ProviderJobDetailScreen/
  -- ProviderMyJobsScreen), so none is added here.
  if v_job.customer_id <> auth.uid() then
    raise exception 'Only the job owner can cancel it';
  end if;

  -- pending -> cancelled (no provider engaged yet) and active ->
  -- cancelled (provider already assigned, hence the reason) are the
  -- only allowed transitions. Everything past "active" in the job's
  -- lifecycle (awaiting_customer_confirmation, confirmed_awaiting_rating,
  -- disputed) is intentionally NOT cancellable through this function —
  -- the task only specifies pending/active as cancellable, and
  -- completed/cancelled are explicitly terminal, so this stays narrow
  -- rather than guessing at unrequested rules for the in-between states.
  if v_job.status not in ('pending', 'active') then
    raise exception 'Job cannot be cancelled from its current status (status=%)', v_job.status;
  end if;

  update public.job_posts
  set
    status = 'cancelled',
    cancelled_at = now(),
    cancelled_by = auth.uid(),
    -- Normalizes '' / whitespace-only to NULL — the column is nullable
    -- by design (a pending job with no provider yet has nothing to give
    -- a reason about; the current UI also has no reason input field at
    -- all, see CLAUDE.md's note on this migration for why that's
    -- intentionally not being added here).
    cancellation_reason = nullif(btrim(coalesce(p_reason, '')), '')
  where id = p_job_id;
end;
$$;

comment on function public.cancel_job(uuid, text) is
  'Customer cancels their own job: pending or active -> cancelled, atomically stamping cancelled_at/cancelled_by/cancellation_reason. Rejects if the caller is not the job''s own customer, or if the job is not currently pending/active (already completed, already cancelled, or past active in the two-sided completion flow).';

grant execute on function public.cancel_job(uuid, text) to authenticated;
