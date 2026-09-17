-- 0078_admin_dispute_resolution.sql
-- Closes a real dead-end in the job-completion state machine: every RPC
-- that touches `disputed` (customer_report_problem, 0014/0022/0038/0045)
-- only ever writes INTO it. Nothing anywhere transitions a job OUT of
-- `disputed` — once a Customer disputes a Provider's completion request,
-- that job_posts row is permanently stuck. It can never reach `completed`
-- (no review can be attached — 0015/0023's trigger is the only path to
-- `completed`, and nothing prompts one on a disputed job) or `cancelled`
-- (cancel_job/provider_cancel_job, 0032/0036, both explicitly reject
-- `disputed` as a source status by design — disputes are meant to go
-- through a dedicated resolution path, not the ordinary self-service
-- cancel flow). The admin panel (ostati-admin, 0072) already moderates
-- job_reports' status, but that is a SEPARATE table (0034/0081) from
-- job_posts — resolving a report's moderation status has never touched
-- the underlying job's own status.
--
-- Fix: one new admin-only RPC, `admin_resolve_job_dispute()`, following
-- 0072's `admin_review_provider_verification()` pattern exactly (SECURITY
-- DEFINER, is_admin() gate, `for update` row lock, fixed-enum outcome —
-- not a free-form status the caller picks). Two possible resolutions,
-- matching how a real dispute actually resolves in a marketplace with no
-- payment system (CLAUDE.md's "არარსებული ფუნქციები" — there is no
-- escrow/charge to reverse, so "resolving" a dispute is purely about
-- what job_posts.status becomes):
--   - 'reopen'  — admin sides with the Provider (the work was actually
--     done): disputed -> awaiting_customer_confirmation, giving the
--     Customer another chance to confirm (-> mandatory rating ->
--     completed, 0015/0023, unchanged) or dispute again. dispute_reason
--     is cleared so a second dispute cycle starts clean.
--   - 'cancel'  — admin sides with the Customer (the work was not done
--     as claimed): disputed -> cancelled, via the SAME columns
--     cancel_job()/provider_cancel_job() stamp (cancelled_at/
--     cancelled_by/cancellation_actor/cancellation_reason) — cancelled_by
--     is the admin's own auth.uid() (a valid auth.users row, same FK the
--     other two paths use), cancellation_actor='admin' (this value was
--     already anticipated and reserved in 0036's check constraint —
--     `in ('customer', 'provider', 'admin')` — but never actually used by
--     any RPC until now), cancellation_reason carries the original
--     dispute_reason forward (falls back to a generic Georgian note if
--     somehow empty) so the cancellation UI (ProviderJobDetailScreen's
--     'cancelled' variant, CLAUDE.md #88) shows a real reason, not a
--     blank one.
-- Both outcomes notify BOTH participants (type=job_status_change, same
-- pattern as every other job-workflow RPC, 0022/0038/0045) — the admin's
-- decision affects whichever side didn't make it.

create or replace function public.admin_resolve_job_dispute(
  p_job_id uuid,
  p_resolution text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.job_posts%rowtype;
  v_reason text;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;
  if p_resolution not in ('reopen', 'cancel') then
    raise exception 'Invalid resolution: % (expected reopen or cancel)', p_resolution;
  end if;

  select * into v_job from public.job_posts where id = p_job_id for update;
  if v_job.id is null then
    raise exception 'Job not found';
  end if;
  if v_job.status <> 'disputed' then
    raise exception 'Job is not disputed (current status: %)', v_job.status;
  end if;

  if p_resolution = 'reopen' then
    update public.job_posts
    set status = 'awaiting_customer_confirmation', dispute_reason = null
    where id = p_job_id;

    insert into public.notifications (user_id, title, body, icon_emoji, icon_bg, target, type)
    values
      (v_job.customer_id, 'დავა განიხილეს', 'ადმინისტრაციამ დავა განიხილა — გთხოვთ, ხელახლა გადაამოწმოთ სამუშაოს დასრულება.', '⚖️', '#2563EB', jsonb_build_object('screen', 'CustomerJobDetail', 'jobId', p_job_id), 'job_status_change'),
      (v_job.provider_id, 'დავა განიხილეს', 'ადმინისტრაციამ დავა განიხილა — მომხმარებელს ხელახლა ეთხოვა დასრულების დადასტურება.', '⚖️', '#2563EB', jsonb_build_object('screen', 'ProviderJobDetail', 'id', p_job_id, 'mode', 'selected'), 'job_status_change');
  else
    v_reason := nullif(btrim(coalesce(v_job.dispute_reason, '')), '');
    update public.job_posts
    set
      status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = auth.uid(),
      cancellation_actor = 'admin',
      cancellation_reason = coalesce(v_reason, 'ადმინისტრაციამ დავა მომხმარებლის სასარგებლოდ გადაწყვიტა.')
    where id = p_job_id;

    insert into public.notifications (user_id, title, body, icon_emoji, icon_bg, target, type)
    values
      (v_job.customer_id, 'დავა გადაწყდა', 'ადმინისტრაციამ დავა განიხილა — სამუშაო გაუქმებულია.', '⚖️', '#DC2626', jsonb_build_object('screen', 'CustomerJobDetail', 'jobId', p_job_id), 'job_status_change'),
      (v_job.provider_id, 'დავა გადაწყდა', 'ადმინისტრაციამ დავა განიხილა — სამუშაო გაუქმებულია.', '⚖️', '#DC2626', jsonb_build_object('screen', 'ProviderJobDetail', 'id', p_job_id, 'mode', 'selected'), 'job_status_change');
  end if;
end;
$$;

comment on function public.admin_resolve_job_dispute(uuid, text) is
  'Admin-only resolution for a job stuck in disputed status (the only RPC that transitions OUT of it). reopen -> awaiting_customer_confirmation (siding with the Provider, clears dispute_reason, gives the Customer another confirm/dispute cycle). cancel -> cancelled (siding with the Customer, stamps cancelled_at/cancelled_by=admin/cancellation_actor=admin/cancellation_reason from the original dispute_reason). Notifies both participants either way. Rejects if the job is not currently disputed, or if p_resolution is not exactly reopen/cancel.';

revoke all on function public.admin_resolve_job_dispute(uuid, text) from public, anon;
grant execute on function public.admin_resolve_job_dispute(uuid, text) to authenticated;
