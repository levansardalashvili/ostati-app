-- 0036_provider_job_cancellation.sql
-- Provider-initiated job cancellation. 0032/0033's cancel_job() is
-- Customer-only by design (its own header comment says so explicitly —
-- "there is deliberately no Provider-initiated cancellation path... so
-- none is added here"). This migration adds exactly that, as a
-- SEPARATE function (provider_cancel_job) rather than folding a second
-- caller identity into cancel_job — the two have different allowed
-- source statuses (Customer: pending or active; Provider: active only)
-- and different required inputs (Provider must supply a fixed reason
-- code, Customer's free-text reason stays optional) — cleaner as two
-- narrow, single-purpose RPCs than one function branching on caller role.

-- ============================================================
-- New columns — both nullable, both additive
-- ============================================================
-- cancellation_actor: who actually cancelled, derived server-side by
-- each RPC from auth.uid()/the job relationship — never trusted from
-- the client (neither RPC takes an actor parameter at all). Lets UI
-- (ProviderJobDetailScreen's 'cancelled' variant) show correct text
-- ("you cancelled this" vs "the customer cancelled this") instead of
-- always assuming Customer, which cancel_job's original (0032/0033)
-- banner text on the Provider side implicitly did.
alter table public.job_posts add column if not exists cancellation_actor text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'job_posts_cancellation_actor_check') then
    alter table public.job_posts
      add constraint job_posts_cancellation_actor_check
      check (cancellation_actor is null or cancellation_actor in ('customer', 'provider', 'admin'));
  end if;
end $$;

-- cancellation_reason_code: fixed enum, set only by provider_cancel_job
-- (Customer cancellation stays free-text-only via cancellation_reason,
-- unchanged — this task does not touch that UI/flow). Structured codes
-- (not just the Georgian display label) so a future moderation view can
-- aggregate/filter by reason without parsing free text.
alter table public.job_posts add column if not exists cancellation_reason_code text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'job_posts_cancellation_reason_code_check') then
    alter table public.job_posts
      add constraint job_posts_cancellation_reason_code_check
      check (
        cancellation_reason_code is null or cancellation_reason_code in (
          'provider_unavailable',
          'schedule_conflict',
          'cannot_complete_job',
          'customer_unreachable',
          'incorrect_job_information',
          'other'
        )
      );
  end if;
end $$;

-- Backfill: classify every already-cancelled row's actor from the
-- existing cancelled_by column (0032) against customer_id/provider_id —
-- lossless for the only two ways a row could have been cancelled before
-- this migration (cancel_job() always stamped cancelled_by = the calling
-- customer_id, since no Provider path existed yet).
update public.job_posts
set cancellation_actor = case
  when cancelled_by = customer_id then 'customer'
  when cancelled_by = provider_id then 'provider'
  else cancellation_actor
end
where status = 'cancelled' and cancellation_actor is null and cancelled_by is not null;

-- ============================================================
-- cancel_job() — unchanged behavior, now also stamps the actor
-- ============================================================
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
    cancellation_actor = 'customer',
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
  'Customer cancels their own job: pending or active -> cancelled, stamping cancelled_at/cancelled_by/cancellation_actor(''customer'')/cancellation_reason, and notifying the assigned Provider (if any).';

grant execute on function public.cancel_job(uuid, text) to authenticated;

-- ============================================================
-- provider_cancel_job() — new
-- ============================================================
create or replace function public.provider_cancel_job(p_job_id uuid, p_reason_code text, p_details text default null)
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

  -- The single check that structurally enforces every "must be the
  -- assigned Provider" requirement at once: an unassigned Provider, a
  -- Provider who only expressed interest via job_responses (never
  -- touches job_posts.provider_id), and a Provider on someone else's job
  -- all fail this the same way — provider_id simply doesn't match. Also
  -- rejects a Customer outright (their uid can never equal provider_id).
  if v_job.provider_id is distinct from auth.uid() then
    raise exception 'Only the assigned provider can cancel this job';
  end if;

  -- Only 'active' — not 'pending' (a Provider is never assigned to a
  -- pending job, so provider_id would already be null and the check
  -- above would have rejected it), and explicitly not
  -- 'awaiting_customer_confirmation'/'confirmed_awaiting_rating' (the
  -- Provider already requested completion — task requirement: "do not
  -- allow cancellation after Provider already requested completion"),
  -- not 'disputed', not 'completed', not already 'cancelled'.
  if v_job.status <> 'active' then
    raise exception 'Job cannot be cancelled by the provider from its current status (status=%)', v_job.status;
  end if;

  if p_reason_code is null or p_reason_code not in (
    'provider_unavailable', 'schedule_conflict', 'cannot_complete_job',
    'customer_unreachable', 'incorrect_job_information', 'other'
  ) then
    raise exception 'Invalid cancellation reason: %', p_reason_code;
  end if;

  if p_reason_code = 'other' and (p_details is null or btrim(p_details) = '') then
    raise exception 'Details are required when reason is "other"';
  end if;

  update public.job_posts
  set
    status = 'cancelled',
    cancelled_at = now(),
    cancelled_by = auth.uid(),
    cancellation_actor = 'provider',
    cancellation_reason_code = p_reason_code,
    cancellation_reason = nullif(btrim(coalesce(p_details, '')), '')
  where id = p_job_id;

  -- Same pattern as every other job-workflow RPC (0022/0023/0033):
  -- notification is inserted here, server-side, as this function's own
  -- definer identity — notifications has had zero client INSERT policy
  -- since 0018 and that stays untouched. Recipient/job details are read
  -- entirely from the already-validated v_job row, never from a client
  -- parameter.
  insert into public.notifications (user_id, title, body, icon_emoji, icon_bg, target)
  values (
    v_job.customer_id,
    'ოსტატმა სამუშაო გააუქმა',
    public.job_category_label(v_job.category),
    '🚫',
    '#DC2626',
    jsonb_build_object('screen', 'CustomerJobDetail', 'jobId', p_job_id)
  );
end;
$$;

comment on function public.provider_cancel_job(uuid, text, text) is
  'Assigned Provider cancels their own active job: active -> cancelled only (rejects pending/awaiting_customer_confirmation/confirmed_awaiting_rating/disputed/completed/already-cancelled), requiring a fixed reason code (free-text details mandatory when reason=''other''), and notifying the Customer. Rejects if the caller is not literally job_posts.provider_id — an unassigned Provider, a merely-interested Provider, or another Provider''s job all fail identically. Provider can never cancel after already requesting completion.';

grant execute on function public.provider_cancel_job(uuid, text, text) to authenticated;
