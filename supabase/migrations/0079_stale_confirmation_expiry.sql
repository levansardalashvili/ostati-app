-- 0079_stale_confirmation_expiry.sql
-- Second gap found alongside 0078's disputed dead-end, while reviewing
-- the whole job-completion state machine (#47): `awaiting_customer_confirmation`
-- has no timeout either. `provider_request_completion()` (0014/0022/0038/
-- 0041/0045) notifies the Customer exactly ONCE (type=completion_reminder)
-- and nothing ever prompts again — if the Customer never opens the app,
-- the job sits in this status forever. Unlike `disputed` (0078, which
-- needed a human admin decision), this case has an unambiguous default
-- resolution: silence past a reasonable grace period is implicit
-- acceptance — a standard pattern in marketplaces with no payment/escrow
-- to hold (this app has none, CLAUDE.md's "არარსებული ფუნქციები").
--
-- No cron/scheduled-function infrastructure exists in this project yet
-- (the push pipeline, 0037-0039, is event-driven via a Database Webhook,
-- not time-based) — rather than introduce pg_cron as new infrastructure
-- for one narrow check, this is a lazy, opportunistic RPC: any participant
-- (Customer or Provider) can call it, but it only actually DOES anything
-- once the elapsed time has passed — server-enforced via job_posts'
-- already-existing `updated_at` (auto-stamped by the shared
-- `set_updated_at` trigger, 0001/0004, on every UPDATE — and nothing else
-- ever updates a job_posts row while it sits in
-- `awaiting_customer_confirmation`, so it reliably marks "when
-- provider_request_completion() was called" for this purpose; no new
-- timestamp column needed). Client wiring (jobService.ts +
-- ProviderJobDetailScreen/CustomerJobDetailScreen) calls this
-- fire-and-forget whenever either screen loads a job in that status — the
-- job self-heals the next time either party happens to look at it, no new
-- background infrastructure required.
--
-- Deliberately preserves the "review is always mandatory" rule (#18/#47):
-- this does NOT skip straight to `completed` — it transitions to
-- `confirmed_awaiting_rating`, the exact same next state
-- `customer_confirm_completion()` reaches on an explicit tap. The Customer
-- can no longer use the formal dispute RPC once this fires (it requires
-- `awaiting_customer_confirmation`), but retains recourse through the
-- review itself (stars + text) — matching how explicit confirmation
-- already worked, not a new restriction invented for this path.
create or replace function public.expire_stale_job_confirmation(p_job_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.job_posts%rowtype;
  -- Grace period before silence counts as implicit acceptance. Named
  -- here (not scattered as a magic literal) so it's the one place to
  -- retune later.
  v_grace interval := interval '72 hours';
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into v_job from public.job_posts where id = p_job_id for update;
  if v_job.id is null then
    raise exception 'Job not found';
  end if;
  if auth.uid() <> v_job.customer_id and auth.uid() <> v_job.provider_id then
    raise exception 'Only a participant of this job may check its confirmation status';
  end if;

  -- Not an error — an opportunistic no-op is the expected outcome most of
  -- the time this is called (wrong status, or grace period not yet up).
  if v_job.status <> 'awaiting_customer_confirmation' then
    return false;
  end if;
  if v_job.updated_at > now() - v_grace then
    return false;
  end if;

  update public.job_posts set status = 'confirmed_awaiting_rating' where id = p_job_id;

  insert into public.notifications (user_id, title, body, icon_emoji, icon_bg, target, type)
  values
    (v_job.customer_id, 'სამუშაო ავტომატურად დადასტურდა', '72 საათის განმავლობაში პასუხი არ მიგვიღია — გთხოვთ, შეაფასოთ ოსტატი.', '⏱️', '#2563EB', jsonb_build_object('screen', 'CustomerJobDetail', 'jobId', p_job_id), 'job_status_change'),
    (v_job.provider_id, 'სამუშაო ავტომატურად დადასტურდა', 'მომხმარებელმა 72 საათში არ უპასუხა — სამუშაო ავტომატურად ჩაითვალა დადასტურებულად.', '⏱️', '#2563EB', jsonb_build_object('screen', 'ProviderJobDetail', 'id', p_job_id, 'mode', 'selected'), 'job_status_change');

  return true;
end;
$$;

comment on function public.expire_stale_job_confirmation(uuid) is
  'Opportunistic, lazily-triggered auto-confirmation: if a job has sat in awaiting_customer_confirmation for >=72h (job_posts.updated_at, auto-stamped, nothing else touches the row in this status), transitions it to confirmed_awaiting_rating (same next state customer_confirm_completion() reaches explicitly — review is still mandatory before completed, #18/#47 unchanged) and notifies both participants. Callable by either participant (customer_id or provider_id); returns false (not an error) if the job is in a different status or the grace period has not elapsed yet — only raises for auth/not-found/non-participant. No cron — called fire-and-forget from the client whenever either job-detail screen loads a job in this status.';

revoke all on function public.expire_stale_job_confirmation(uuid) from public, anon;
grant execute on function public.expire_stale_job_confirmation(uuid) to authenticated;
