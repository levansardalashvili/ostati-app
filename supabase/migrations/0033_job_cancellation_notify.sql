-- 0033_job_cancellation_notify.sql
-- Secure in-app notification for job cancellation — same pattern as
-- every other job-workflow notification (0022/0023): folded into the
-- existing SECURITY DEFINER RPC rather than any client-side insert.
-- `notifications` has had zero client INSERT policy since 0018 and that
-- stays untouched here — this migration does not reopen it; the RPC
-- inserts as its own definer identity, exactly like select_provider/
-- provider_request_completion/customer_report_problem/
-- handle_review_completion already do.
--
-- CREATE OR REPLACE on 0032's cancel_job, same signature/behavior, plus
-- one notification insert once the cancellation has actually been
-- committed:
--   - Only fires when the job had an assigned Provider (v_job.provider_id
--     is not null) — i.e. the job was 'active', not merely 'pending'.
--     A pending job has no specific Provider relationship to notify (any
--     Provider who merely expressed interest via job_responses is not
--     "the assigned Provider" and is intentionally not notified here —
--     matches the task's "notify the assigned Provider" wording exactly,
--     not "notify everyone who showed interest").
--   - Recipient (v_job.provider_id) and job category/id are read
--     entirely from the already-validated, already-updated job_posts
--     row inside the function — never from a client-supplied parameter,
--     so there is no way to make this fire for an unrelated user.
--   - Provider-side cancellation does not exist anywhere in this app
--     (no RPC, no UI — confirmed before writing 0032) so the task's
--     "if Provider-side cancellation already exists, notify Customer"
--     branch has nothing to hook into yet; nothing added for it here.

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

  if v_job.customer_id <> auth.uid() then
    raise exception 'Only the job owner can cancel it';
  end if;

  if v_job.status not in ('pending', 'active') then
    raise exception 'Job cannot be cancelled from its current status (status=%)', v_job.status;
  end if;

  update public.job_posts
  set
    status = 'cancelled',
    cancelled_at = now(),
    cancelled_by = auth.uid(),
    cancellation_reason = nullif(btrim(coalesce(p_reason, '')), '')
  where id = p_job_id;

  if v_job.provider_id is not null then
    insert into public.notifications (user_id, title, body, icon_emoji, icon_bg, target)
    values (
      v_job.provider_id,
      'მომხმარებელმა მოთხოვნა გააუქმა',
      public.job_category_label(v_job.category),
      '🚫',
      '#DC2626',
      jsonb_build_object('screen', 'ProviderJobDetail', 'id', p_job_id, 'mode', 'selected')
    );
  end if;
end;
$$;

comment on function public.cancel_job(uuid, text) is
  'Customer cancels their own job: pending or active -> cancelled, atomically stamping cancelled_at/cancelled_by/cancellation_reason, and notifying the assigned Provider (if any) that the job was cancelled. Rejects if the caller is not the job''s own customer, or if the job is not currently pending/active.';

-- grant execute is unchanged from 0032 (CREATE OR REPLACE keeps existing
-- grants) — repeated here only for clarity/idempotency, not required.
grant execute on function public.cancel_job(uuid, text) to authenticated;
